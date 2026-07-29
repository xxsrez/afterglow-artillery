# Проверка композиционных battlefield layouts 0.1

- **Статус:** release-candidate; пользовательская приёмка не завершена
- **Families:** `open`, `ridge`, `valley`, `cavern`
- **Motifs:** 12, по три на семейство
- **Размер fixture:** `2880×720`

## Gallery

![Labelled motif gallery 3×4](battlefield-layout-gallery.svg)

![Blind shuffled gallery](battlefield-layout-blind-gallery.svg)

Обе gallery пересобираются командой `npm run gallery:battlefield`. Labelled
вариант показывает по три motif каждого семейства на общем seed. Blind
вариант перемешивает те же 12 классов и скрывает labels: различие должно
читаться по материалу и spawn markers. Круг означает surface spawn, квадрат —
cave spawn; цвет различает игроков.

## Автоматические критерии

`tests/battlefield.test.ts` проверяет:

- plan sweep `512` seeds: каждое семейство не меньше `15%`, ни одно не больше
  `50%`, три раунда не повторяют один профиль;
- replay equality для plan, grid hash, spawns, attempt/fallback и metadata;
- полноразмерный fixture каждого из 12 motif;
- `ridge`/`valley` feature не меньше `10%` высоты мира и `160` world units;
- feature width измеряется по final grid, а не читается из plan envelope;
- island/asymmetric motif сохраняют отдельный floating component;
- `asymmetric-slope` разводит spawn по высоте минимум на `30%` высоты мира;
- plateau/mesa сохраняют минимум два cliff transitions;
- `buried-duel`/`underworld` сохраняют широкие roofed coverage и air span;
- silhouette distance между motif одного семейства на общем seed больше
  `0.035`, включая зеркальное сопоставление;
- surface support/open sky и cave floor/headroom/roof/mouth/firing exit;
- отдельные `surface-vs-cave` и `cave-vs-cave`;
- default motif generation не наследует случайный legacy cave pass;
- exact motif либо остаётся exact, либо завершается явной ошибкой — fallback
  не имеет права незаметно подменить fixture;
- scaled sweep проходит все 12 motif на нескольких seeds;
- bounded retry corpus с fallback rate меньше `5%` и средним числом попыток
  меньше `2`.

## Browser smoke

Query `?layout=open|ridge|valley|cavern` принудительно выбирает семейство,
`?motif=<id>` — точный motif, `?seed=<integer>` — воспроизводимый match seed.
Без `seed` новый матч получает новый явный browser seed. Значения отражаются
в `data-match-seed`, `data-battlefield-profile`,
`data-battlefield-motif` и `data-*-spawn-kind`. На representative motif:

1. выключить music и SFX до начала теста;
2. начать Quick Match и проверить полный контур через minimap;
3. вернуть камеру к обоим танкам; для cave spawn подтвердить видимую крышу,
   пол и вход;
4. сделать legal shot Star Shell и дождаться возврата в aiming;
5. повторить desktop viewport и short-height mobile viewport;
6. проверить отсутствие console/page errors.

Физический iPhone остаётся отдельной проверкой пользователя: desktop browser
и mobile viewport не доказывают touch-performance или удобство на устройстве.

## Performance corpus

`npm run benchmark:battlefield -- baseline|current` строит одинаковый corpus
из `24` полноразмерных карт: по два seed каждого motif. Baseline повторяет
прежний pipeline
`generateTerrain → findSpawnSites`; current использует profile planner,
2D material operations, paired/cave spawn, independent structure metrics и
final validator. Актуальные числа фиксируются на release commit отдельным
процессом через `/usr/bin/time -l`; локальный generation benchmark не
обобщается на frame time или физические телефоны.
