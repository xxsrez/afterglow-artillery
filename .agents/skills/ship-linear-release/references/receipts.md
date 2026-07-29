# Квитанции и восстановление

Квитанции — компактные durable records, а не журналы. Coordinator создаёт и
изменяет Linear comments; workers возвращают данные для upsert. Используй UTC
ISO-8601, full Git SHAs и exact opaque IDs. Не записывай credentials, bearer
tokens, authorization headers, secret/env values, временные archive paths,
полные логи или приватные browser state.

## Разделы

- [Idempotent upsert](#idempotent-upsert)
- [`RELEASE_RUN`](#release_run)
- [`WORK_CLAIM`](#work_claim)
- [`FEATURE_RECEIPT`](#feature_receipt)
- [`DEFECT_CANDIDATE`](#defect_candidate)
- [`BATCH_RELEASE_RECEIPT`](#batch_release_receipt)
- [Восстановление](#восстановить-после-прерывания)

## Idempotent upsert

Каждый comment начинается с устойчивого маркера:

```text
<!-- ship-linear-release:<KIND>:<KEY> -->
SCHEMA: 1
KIND: <KIND>
KEY: <KEY>
```

Перед записью найди exact marker и обнови тот же comment по его ID. Не создавай
второй основной comment для того же key. При новой generation обнови поля
`GENERATION` и `SUPERSEDES`; отдельный обнаруженный дефект сохраняй своим
`DEFECT_CANDIDATE`. Если live connector не позволяет безопасный update, верни
`needs-input`, а не размножай receipts.

`RELEASE_RUN` и `BATCH_RELEASE_RECEIPT` храни комментариями exact milestone;
`WORK_CLAIM`, `FEATURE_RECEIPT` и issue-specific `DEFECT_CANDIDATE` —
комментариями соответствующей issue. После первого create сохраняй comment ID
в coordinator state; следующие записи делай update этого ID.

## RELEASE_RUN

Key: `<release_id>`.

```text
STATUS: planning | dispatching | assembling | sealed | validating |
        default-pushed | deploying | live-awaiting-tag | checkpoint | complete |
        needs-input
RUN_ID: <stable id>
GOAL: <goal id/objective fingerprint>
PROJECT_ID: <id>
RELEASE_ID: <id>; name=<name>
COORDINATOR_REF: <remote ref=commit>
DEFAULT_BRANCH: <name>; observed_sha=<full>
WORKERS: requested=<1|N|auto|auto(max=N)>; effective=<n>; reason=<bounded>
CURRENT_BATCH: <batch_id or none>; generation=<n or none>
QUEUE_FINGERPRINT: <hash>
STARTED_AT: <timestamp>
HEARTBEAT_AT: <timestamp>
NEXT: <одно действие или none>
```

Remote coordinator ref обеспечивает atomic ownership; milestone comment
объясняет его. Используй один стабильный ref вида
`refs/heads/codex/release/<milestone>/coordinator`. Claim — metadata commit с
`run_id` и неизменённым source tree; первый non-force push атомарно создаёт
ref. Если ref уже существует, сначала восстанови указанный run. Следующие
state commits должны быть descendants текущего ref и обновлять его только
fast-forward. Heartbeat записывай лишь на переходах стадий, не в цикле
ожидания. После `complete` сохрани ref как ledger; новый run того же milestone
продолжает ref новой fast-forward generation, не удаляя доказательство релиза.

Перед каждой mutating stage (`dispatch`, candidate publish, default-branch
push, deploy, tag, Linear closure) сначала CAS-продвинь coordinator ref в эту
stage. Только победитель push выполняет действие. При rejected update fetch-ни
новое состояние и перейди в observer/resume, не продолжая параллельную мутацию.

## WORK_CLAIM

Key: `<release_id>:<issue_id>`.

```text
STATUS: active | released | superseded
PROJECT_ID: <id>
RELEASE_ID: <id>
ISSUE: <identifier>; <id>; updated_at=<timestamp>
OWNER: coordinator=<session/goal>; worker=<agent/ref или none>
ROOT_BASE: sha=<full>; tree=<oid>; origin_default=<full>
BASE: sha=<full>; dependency_shas=<ordered refs или none>
FEATURE_REF: <branch/ref или none>
OWNERSHIP_PATHS: <компактный список>
QUEUE_FINGERPRINT: <hash>
CLAIMED_AT: <timestamp>
HEARTBEAT_AT: <timestamp>
NEXT: <одно действие или none>
```

Один статус `In Progress` не заменяет claim. Перед takeover проверь session,
refs и heartbeat; stale timestamp сам по себе не разрешает захват.

## FEATURE_RECEIPT

Key: `<release_id>:<issue_id>`.

```text
STATUS: ready | failed | needs-input | superseded
GENERATION: <n>
ISSUE: <identifier>; <id>; scope_updated_at=<timestamp>
ROOT_BASE: sha=<full>; tree=<oid>
BASE: sha=<full>; tree=<oid>
DEPENDENCIES: <ordered issue=sha@origin_ref или none>
FEATURE: sha=<full>; tree=<oid>; origin_ref=<ref=sha>
OWNERSHIP_PATHS: <компактный список>
AFFECTED_SURFACES: <domain/ui/build/docs/...>
CHECKS: <affected commands и pass/fail; без полного лога>
BROWSER: <проверенный flow/viewport или none>
GAPS: <точная граница или none>
DIRTY_REMAINDER: <сохранённые чужие paths или none>
SUPERSEDES: <предыдущий feature SHA/comment id или none>
NEXT: <одно действие или none>
UPDATED_AT: <timestamp>
```

`ready` доказывает feature-scoped результат, но не full integrated gate,
production readiness или право менять external state.

`GAPS` различает `not-available` и известный fail. Недоступный physical device,
branded browser, listening pass или trace остаётся non-blocking gap: не ставь
из-за него `needs-input` и не заявляй проверенную совместимость. Известный
воспроизведённый дефект gap-ом не маскируй.

## DEFECT_CANDIDATE

Key: `<release_id>:<batch_id>:<generation>:<defect_key>`.

```text
STATUS: open | fixing | excluded | reverted | resolved | rolled-back
BATCH: <batch_id>; generation=<n>
CANDIDATE: sha=<full>; tree=<oid>
DEFECT_SIGNATURE: <surface|symptom|repro-or-invariant|expected-vs-actual>
FOUND_AT: preflight | integrated-gate | ci | live-smoke
SIGNAL: <короткий failing check/наблюдение>
ATTRIBUTION: <issue/ref | cross-feature | unknown>
DECISION: tiny-direct-fix | reopen-feature | new-linear-bug
ACTION: <fix/exclude/revert/rollback/block>
LINEAR_BUG: <identifier/id или none>
SOURCE_ISSUES: <identifiers или none>
PREVIOUS_STABLE: tag=<tag>; sha=<full>; sites_version_id=<id> | none
EVIDENCE: <bounded reference, не raw log>
NEXT: <одно действие>
UPDATED_AT: <timestamp>
```

Если feature исключена или reverted, её issue остаётся незавершённой, а
независимый batch может продолжиться.

## BATCH_RELEASE_RECEIPT

Key: `<release_id>:<batch_id>`.

```text
STATUS: assembling | sealed | gate-passed | default-pushed | deployed |
        live-awaiting-tag | released | failed | rolled-back
PROJECT_ID: <Linear project id>
RELEASE_ID: <id>; name=<name>
BATCH: <batch_id>; generation=<n>; queue_fingerprint=<hash>
EXPECTED_DEFAULT_SHA: <full>
FEATURES: <topological identifier=base/dependencies->feature_sha@origin_ref>
CANDIDATE: sha=<full>; tree=<oid>
VALIDATION_KEY: tree=<oid>; gate=<hash>; env=<hash>
VALIDATION: run=<pass/fail+timestamp> | reused=<receipt/key> | none
MAIN: origin/<default>=<full>; cas=<pass/fail>
CI: sha=<full>; run/check=<id|none>; status=<terminal|none>
SITES: project=<id>; version=<number>; version_id=<id>;
       archive_sha256=<digest>
DEPLOYMENT: id=<id>; status=<terminal>; url=<url>
LIVE_SMOKE: <flows+timestamp+pass/fail>
PRODUCT: version=<vX.Y.Z>; tag=<annotated tag@sha или none>
PREVIOUS_STABLE: tag=<tag>; sha=<full>; sites_version_id=<id> | none
DEFECTS: <DEFECT_CANDIDATE keys/signatures или none>
LINEAR_DONE: <identifiers или none>
GAPS: <точные недоказанные границы или none>
NEXT: <одно действие или none>
UPDATED_AT: <timestamp>
```

Не заполняй downstream поля предположениями. Tag и `LINEAR_DONE` допустимы
только после успешного live smoke.

`STATUS: gate-passed` и `VALIDATION: run=pass` могут сосуществовать с
`not-available` в `GAPS`, если все проверки capability boundary выполнены.
Само отсутствие внешнего device/automation path не переводит receipt в
`failed` или release run в `needs-input`.

## Восстановить после прерывания

Проверяй состояние в этом порядке:

1. remote Git refs и annotated tags;
2. CI для exact SHA;
3. Sites saved versions, archive digest и deployments;
4. live Linear scope, claims и receipts;
5. локальные branches/worktrees/caches.

Refs, CI и Sites факты авторитетнее пересказа в comment; Linear определяет
актуальный scope; локальное состояние — только подсказка. При расхождении
обнови receipt фактическими IDs/status и продолжи с первой незавершённой
стадии. Переиспользуй найденные feature refs, CI result, Sites version,
deployment и tag вместо создания дублей. Никогда не восстанавливай secret из
receipt или лога.
