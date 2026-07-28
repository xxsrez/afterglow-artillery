# Проверка effect envelopes 0.1

- **Статус:** воспроизводимый release-сценарий
- **Seed:** `41705`
- **Режим:** Infinite Arsenal
- **Настройка representative shots:** угол `70°`, сила `200`

## Styleframes

| Класс | Weapon | Что должно быть в кадре |
|---|---|---|
| Small ballistic | Star Shell | локальная сплошная граница 18, ticks, один короткий dashed echo и sparks |
| Medium blast | Nova Missile | граница 34, два spatially-separated echo rings и более плотный burst |
| Cluster/chain | Funky Bomb | seeded 10–14 nodes; механическая окружность каждого node отдельно от внешних confetti/echo |
| Terrain-changing | Terra Nova | граница fill 90, growth rays и безопасный dashed envelope 178; итоговый грунт читаем |
| Nuclear | Starbreaker | сплошная граница 110, четыре dashed echoes до 285, radial light volume и plume |

Local browser run на commit-кандидате должен снять impact после resolution, а
затем повторить representative small/medium/cluster/terrain/nuclear frames на
точном production deployment. HUD и итоговый terrain должны оставаться
читаемыми.

## Механическая сверка

`tests/effect-profiles.test.ts` проверяет:

- полный ordered набор 33 `baseline → proposed`;
- отсутствие слепого `×2` и диапазон ratios `1.0–1.8`;
- `mechanical ≤ readable < spectacle`;
- budgets Full/Balanced/Reduced;
- неизменные center damage и payload count;
- совпадение прямых radial значений с `demoResolution`;
- один и тот же damage outcome для Full/Balanced/Reduced.

`npm run check` проверяет детерминированную terrain/ballistics основу целиком.
Физический phone trace и недоступные media attachments фиксируются отдельным
Linear-комментарием и не подменяются desktop viewport.
