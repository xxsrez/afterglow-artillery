# ADR-0008: Слоистая presentation-архитектура VFX Lab II

- **Статус:** принято для неканонического Infinite Arsenal Showcase
- **Дата:** 2026-07-30

## Контекст

Первые 10 Experimental Ultimates доказали отделение seeded mechanics от
частиц, но в основном оставались вариациями world-space geometry поверх
Canvas. VFX Lab II должен проверить более широкий visual vocabulary:
полноэкранные композиции, background/foreground depth, matte/compositor,
scene capture и крупные vector-образы. Такая зрелищность не должна расширять
урон, скрывать локальную область воздействия или превращать particles в
источник истины.

Новые прототипы не входят в canonical 33, магазин, экономику или Quick Demo
inventory. Они не являются утверждением о визуальных эффектах оригинальной
Scorched Earth 1.5.

## Решение

Infinite Arsenal получает вторую группу из ровно 10 VFX Lab II prototypes.
Общий Experimental Showcase содержит 20 IDs, но исходные 10 Ultimates и их
механика не меняются.

Каждый новый weapon имеет чистый `local-impact` resolver. Он принимает seed,
trajectory impact, terrain и tanks, а возвращает ordered phase/node/terrain/
damage event log и финальные копии terrain/tanks. Единственный mechanical
footprint — radial crater/damage радиусом `18–30`, не больше Missile-sized
`34`. Spectacle radius `420–530` является только metadata для presentation.

Presentation описывает отдельный typed registry без mechanical strategy:

| ID | Presentation class | Основные stages |
|---|---|---|
| `behindTheSky` | background flipbook/parallax | behind, overlay, foreground |
| `blackPanel` | graphic-novel compositor | overlay, screen |
| `inkTide` | animated organic alpha matte | underlay, overlay, foreground |
| `thunderWeave` | procedural vector network | behind, underlay, overlay |
| `filmBurnZero` | burn-dissolve transition | overlay, screen |
| `pixelUndertow` | scene-snapshot tile compositor | overlay, screen |
| `neonLeviathan` | giant original vector character | behind, overlay, foreground |
| `shadowJudgment` | dynamic silhouette lighting | behind, underlay, overlay, foreground |
| `clockworkEclipse` | hierarchical vector rig | behind, underlay, overlay |
| `invertedOcean` | layered atmospheric caustics | behind, underlay, overlay, foreground |

Canvas adapter исполняет пять фиксированных draw stages:
`behindWorld → worldUnderlay → worldOverlay → foreground → screenSpace`.
Anticipation, climax и aftermath задаются keyframes. В climax Full
декоративная композиция покрывает не меньше 70% viewport, но сплошной локальный
contour и minimap cue читают только mechanics.

Каждый эффект декларирует Full/Balanced/Reduced budgets: atlas и decoded
bytes, offscreen canvases/pixels, scene captures, composite passes, draw
operations, flipbook layers, particles, lights, voices, blocking/tail time,
camera и distortion. Верхняя граница на эффект: один offscreen
canvas/capture, `518400` pixels, три passes, три flipbook layers, семь voices
и `1800 ms` blocking. Reduced использует ноль captures/offscreen pixels/
particles, не включает distortion, strong parallax и shake.

Доступность является частью registry: максимум три вспышки в секунду, не более
одного viewport luminance pulse, никакой полноэкранной saturated-red вспышки.
Цвет не заменяет mechanic contour.

Cel atlas, panel, ink, lightning, burn matte, tiles, creature silhouette,
shadows, gears и caustics строятся оригинальным процедурным кодом. В продукт
не импортируются исполняемые файлы, исходный код, artwork, audio, text, UI или
конфигурация оригинальной игры.

## Проверка

- unit/property tests фиксируют `33 + 10 + 10`, уникальность presentation
  classes, все пять stages, три keyframes и границы budgets/accessibility;
- seeded replay сравнивает event log, terrain и tank outcomes;
- изменённые cells и damage не выходят за mechanical radius, а tiers дают один
  outcome;
- один muted Chromium mobile session последовательно проигрывает все 10,
  прикладывает anticipation/climax/aftermath и проверяет canvas lifecycle;
- фиксированная Full gallery при `960×540` даёт review-contact-sheet и
  browser-host frame telemetry.

Physical phone touch pass, branded Safari, прослушивание и device trace
остаются обязательными внешними проверками. Desktop/Playwright результаты их
не подтверждают.

## Последствия

- Новая визуальная техника добавляется через presentation definition и
  bounded renderer branch, а не через новую механику.
- Scene capture принадлежит одному shot и освобождается lifecycle cleanup;
  bounded procedural atlas-cache переиспользуется между shot.
- Minimap, damage и terrain остаются пригодными для replay независимо от
  renderer tier.
- Canvas 2D остаётся принятым renderer; WebGL/framework по-прежнему требует
  измеримого ограничения и отдельного ADR.
