# Проверка тактических battlefield layouts 0.1

- **Статус:** воспроизводимый release-сценарий
- **Profiles:** `open`, `ridge`, `valley`, `cavern`
- **Размер fixture:** `2880×720`

## Gallery

![Gallery 4×4](battlefield-layout-gallery.svg)

Gallery пересобирается командой `npm run gallery:battlefield`. Каждая строка
фиксирует один profile, каждый столбец — отдельный seed. Круг означает surface
spawn, квадрат — cave spawn; цвет различает игроков. Под картой записана
основная topology metric и номер попытки.

## Автоматические критерии

`tests/battlefield.test.ts` проверяет:

- plan sweep `512` seeds: каждый профиль не меньше `15%`, ни один не больше
  `50%`, три раунда не повторяют один профиль;
- replay equality для plan, grid hash, spawns, attempt/fallback и metadata;
- не меньше трёх полноразмерных fixtures каждого профиля;
- `ridge`/`valley` feature не меньше `10%` высоты мира и `160` world units;
- surface support/open sky и cave floor/headroom/roof/mouth/firing exit;
- отдельные `surface-vs-cave` и `cave-vs-cave`;
- bounded retry corpus с fallback rate меньше `5%` и средним числом попыток
  меньше `2`.

## Browser smoke

Query `?layout=open|ridge|valley|cavern` принудительно выбирает fixture profile
для текущего матча и отражается в `data-battlefield-profile` и
`data-*-spawn-kind`. На каждом профиле:

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
из `16` полноразмерных карт. Baseline повторяет прежний pipeline
`generateTerrain → findSpawnSites`; current использует profile planner,
rasterization, paired/cave spawn и final validator. Результаты release-кандидата
на локальном Mac:

| Pipeline | Domain time, 16 maps | Среднее | Maximum RSS процесса |
|---|---:|---:|---:|
| baseline | `179.6 ms` | `11.2 ms/map` | `107,364,352 B` |
| current | `615.0 ms` | `38.4 ms/map` | `102,793,216 B` |

Замер выполнен отдельным процессом на каждый режим через `/usr/bin/time -l`.
Current дороже по CPU из-за pair scoring, cave construction и проверки
фактического grid, но на этом corpus не увеличил maximum RSS. Это локальная
характеристика generation step; вывод не обобщается на frame time или
физические телефоны.
