import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-image`);
  return (await import(workerUrl.href)).default;
}

test("server-renders the game shell and production metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ru">/i);
  assert.match(html, /<title>AFTERGLOW \/\/ ARTILLERY<\/title>/i);
  assert.match(html, /AFTERGLOW/);
  assert.match(html, /ARTILLERY/);
  assert.match(html, /Локальный бой/);
  assert.match(html, /Поверните телефон/);
  assert.match(html, /Проверить звук/);
  assert.match(
    html,
    /property="og:image" content="http:\/\/localhost:3000\/og-funky\.png"/i,
  );
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("routes safe image transforms through the Sites image binding", async () => {
  const worker = await loadWorker();
  let assetPath = "";
  let transformOptions;
  let outputOptions;

  const response = await worker.fetch(
    new Request(
      "http://localhost/_vinext/image?url=%2Fog.png&w=64&q=80",
      { headers: { accept: "image/webp" } },
    ),
    {
      ASSETS: {
        fetch: async (request) => {
          assetPath = new URL(request.url).pathname;
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { "content-type": "image/png" },
          });
        },
      },
      IMAGES: {
        input: () => ({
          transform: (options) => {
            transformOptions = options;
            return {
              output: async (options) => {
                outputOptions = options;
                return {
                  response: () =>
                    new Response(new Uint8Array([82, 73, 70, 70]), {
                      headers: { "content-type": options.format },
                    }),
                };
              },
            };
          },
        }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.equal(assetPath, "/og.png");
  assert.deepEqual(transformOptions, { width: 64 });
  assert.deepEqual(outputOptions, { format: "image/webp", quality: 80 });
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
