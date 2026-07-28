# ADR 0004: шкала поражения и spectacle Quick Demo

- **Статус:** принято
- **Дата:** 2026-07-28
- **Область:** release 0.1, все 33 weapons
- **Уточнение:** per-warhead damage и индивидуальные boundaries составных
  payload приняты позднее в [ADR 0005](0005-composite-payload-resolution.md)

## Контекст

До AND-7 большинство impact cues заканчивались примерно у mechanical radius.
Малые и стратегические weapons отличались в основном размером одной окружности
и числом частиц. Гипотеза задачи предлагала начать с удвоения mechanical
radius, но общий `×2` делал Nuke и глобальные terrain effects чрезмерными для
одновременно видимого viewport `960 × 540`, а tracer и beam не имеют обычной
круговой зоны. Battlefield позднее расширен отдельно; это не меняет
screen-space критерий читаемости эффекта.

Manual хранит canonical `blastRadius`, но не публикует damage/falloff formulas
для браузерного продукта. Поэтому новая шкала является решением Quick Demo и
не заменяет source-backed значения.

## Измерение `current → proposed`

`Radius` означает фактический круг impact для radial weapons. Для Funky это
радиус одного node, для Napalm — reach от ближайшего flow point, для wedge —
длину, для Liquid Dirt — half-width потока, для Earth Disrupter — половину
ширины global field, для Laser — collision half-width.

| Weapon | Shape | До | После | Readable | Spectacle |
|---|---|---:|---:|---:|---:|
| Star Shell | radial | 10 | 18 | 18 | 42 |
| Nova Missile | radial | 20 | 34 | 34 | 76 |
| Nova Seed | radial/nuclear | 40 | 64 | 64 | 160 |
| Starbreaker | radial/nuclear | 75 | 110 | 110 | 285 |
| Triple Hop | multi-radial | 30 | 44 | 44 | 102 |
| Funky Bomb | chain node | 16 | 24 | 24 | 72 |
| Prism MIRV | multi-radial | 20 | 32 | 32 | 74 |
| Death Crown | multi-radial | 35 | 52 | 52 | 122 |
| Solar Gel | flow reach | 72 | 92 | 92 | 132 |
| Corona Gel | flow reach | 96 | 126 | 126 | 188 |
| Light Needle | trace | 0 | 0 | 5 | 22 |
| Spectrum Tracer | trace | 0 | 0 | 7 | 34 |
| Pebble Roller | radial | 10 | 18 | 18 | 44 |
| Comet Roller | radial | 20 | 34 | 34 | 78 |
| Nova Roller | radial | 45 | 68 | 68 | 154 |
| Escape Charge | wedge length | 36 | 50 | 50 | 76 |
| Escape Wave | wedge length | 60 | 84 | 84 | 126 |
| Null Bomb | radial terrain | 30 | 48 | 48 | 92 |
| Grand Null | radial terrain | 45 | 68 | 68 | 136 |
| Mole Bit | underground endpoint | 12 | 20 | 20 | 50 |
| Deep Bore | underground endpoint | 20 | 34 | 34 | 78 |
| Abyss Bore | underground endpoint | 34 | 52 | 52 | 118 |
| Burrow Swarm | underground endpoint | 14 | 22 | 22 | 54 |
| Tunnel Swarm | underground endpoint | 20 | 32 | 32 | 76 |
| World Eater | underground endpoint | 30 | 46 | 46 | 108 |
| Dirt Seed | radial fill | 20 | 32 | 32 | 68 |
| Dirt Bloom | radial fill | 35 | 52 | 52 | 104 |
| Terra Nova | radial fill | 70 | 90 | 90 | 178 |
| Earthflow | flow half-width | 112 | 126 | 126 | 174 |
| Earth Fan | wedge length | 44 | 64 | 64 | 112 |
| Gravity Pulse | global half-width | 480 | 480 | 480 | 520 |
| Plasma Halo | radial energy | 75 | 110 | 110 | 210 |
| Sunline | beam half-width | 13 | 17 | 17 | 34 |

Получилась семейная шкала `1.0–1.8×`, а не единый multiplier:

- малые radial weapons доходят до `1.8×`, чтобы их кульминация читалась;
- medium/cluster/underground получают примерно `1.47–1.7×`;
- nuclear и крупные terrain weapons ограничены примерно `1.29–1.6×`, чтобы
  один shot не стирал карту;
- Napalm расширяет reach и flow, но сохраняет различие двух tiers;
- global settle не увеличивает mechanics;
- beam увеличивает только collision half-width;
- tracer остаётся безвредным.

## Решение

1. Source-backed `blastRadius`, prices, bundle sizes и Arms level не менять.
2. Сохранить `demoResolution.damage`, payload count и существующий falloff.
   Расширять только spatial reach и terrain operation. Для составных payload
   смысл `damage` как per-warhead значения позднее уточнён ADR 0005.
3. Хранить все 33 профиля явно в `lib/game/effect-profiles.ts`; не выводить
   масштаб из цены или Arms level.
4. Mechanical boundary рисовать сплошной окружностью с геометрическими ticks.
   Safe spectacle рисовать пунктирными echo rings, rays, plume, sparks и
   particles. Различие не зависит только от цвета.
5. Nuclear получает один radial light volume, до четырёх echo rings, plume и
   outer envelope до 285 logical units; damage остаётся внутри 110.
6. Full/Balanced/Reduced используют один mechanical profile. Режим качества
   выбирает только budget и число декоративных echoes.
7. Сохранить Canvas 2D и один renderer.

## Performance budgets

| Ресурс | Full | Balanced | Reduced |
|---|---:|---:|---:|
| Particles конкретного shot | до 220 | до 132 | до 60 |
| Активные particles глобально | 320 | 320 | 320 |
| Echo rings одного impact | до 4 | до 2 | до 1 |
| Одновременно читаемые chain centers | до 7 presentation samples | до 7 | до 7 |
| Nuclear radial gradients | 1 | 1 | 1 |
| Napalm flame gradients | до 20 | до 20 | stride 3 |
| Impact audio voices | до 9 | до 9 | до 9 |
| Aftermath particle lifetime | до 1.9 s | до 1.9 s | до 1.9 s |

Эти пределы являются кодовыми budgets, а не доказательством fps на устройстве.
Физический Android trace остаётся отдельной обязательной проверкой, когда
reference device доступен.

## Последствия

- Малые, средние, chain, terrain и nuclear effects имеют измеримо разный
  масштаб и spatial composition.
- Decorative envelope может занимать большую часть viewport, но не передаётся
  в damage, collision или terrain resolution.
- Увеличение площади меняет Quick Demo balance и ценность shield/terrain; до
  black-box сверки оно не называется Classic parity.
- Цена, economy, center damage и payload count остаются прежними, поэтому
  измеряется одна группа механических параметров за раз.
