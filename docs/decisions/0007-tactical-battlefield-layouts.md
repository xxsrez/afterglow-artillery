# ADR-0007: Композиционные motif battlefield и объёмные позиции

- **Статус:** принято
- **Дата:** 2026-07-29

## Контекст

Seeded noise, связные пещеры и безопасные площадки сами по себе не создают
разные артиллерийские задачи. Первая реализация этого ADR добавила четыре
profile, но пользовательская приёмка показала, что это была формальная, а не
визуальная разница: `ridge`/`valley` оставались одной центральной `sin²`
деформацией, `open`/`cavern` — той же плавной поверхностью, а позиции почти
всегда сохраняли схему `0.2W ↔ 0.8W`.

Требуемая композиция двумерна. Помимо верхнего контура нужны отдельные массы,
открытые пропасти, арки, навесы, тонкие перемычки и внутренние площадки.
Танк обязан иметь опору, но эта опора не обязана быть верхней границей одного
сплошного массива.

Официальные материалы подтверждают процедурный и разрушаемый рельеф, но не
публикуют алгоритм генерации, распределение форм карт или правила размещения
танков. Поэтому решение ниже является собственным профилем Quick Demo, а не
заявлением о каноническом алгоритме Scorched Earth 1.5.

## Решение

Перед rasterization создаётся чистый типизированный `BattlefieldPlan`.
Ruleset хранит веса четырёх семейств, а каждое семейство — три motif:

1. `open`: `island-chain`, `broken-plateaus`, `asymmetric-slope`;
2. `ridge`: `central-spire`, `twin-peaks`, `fortress-mesa`;
3. `valley`: `deep-basin`, `split-chasm`, `terraced-canyon`;
4. `cavern`: `cliff-cave`, `buried-duel`, `underworld`.

Motif задаёт:

- ordered surface anchors с переходами `smooth`, `linear` или `step`;
- ordered material operations: добавить остров/мост/полку либо вырезать
  пустоту/арку;
- две bounded spawn regions, preferred position и минимальную дистанцию;
- surface/cave roles и cavern variant.

Порядок генерации:

```text
match seed + round
  → weighted family + seeded motif
  → surface skeleton
  → material masses, voids, arches, bridges and shelves
  → bounded seeded local detail
  → paired spawn preparation
  → topology, structure and playability validation
  → metadata
```

Распределение профилей адресуется seed матча и номером раунда. Default
ruleset использует равные веса. Расписание сдвигается между раундами, поэтому
один профиль не может выпасть три раза подряд в трёхраундовом Quick Demo.

`ridge` и обычные `valley` имеют нормализованные минимальные амплитуду `0.10 ×
worldHeight` и ширину `160` world units. `split-chasm` вместо ложной surface
depth проверяет фактический вертикальный empty span под мостом. Floating и
asymmetric motif обязаны сохранить отдельный solid component и, где заявлено,
вертикальную разницу spawn не меньше `0.30 × worldHeight`. Feature width
измеряется по финальному rasterized surface; compatibility envelope из plan
не участвует в приёмке. Для уменьшенных test fixtures порог ширины ограничен
`0.12 × fixtureWidth`, для production-поля действует полный порог `160`.

Стандартный `generateTerrain` умеет строить собственную случайную сеть caves,
но battlefield pipeline передаёт `caveCount=0` и `tunnelCount=0`. Пустоты,
арки и подземные пространства принадлежат motif grammar и cave-spawn builder.
Явный low-level caller всё ещё может передать ненулевые значения, но Quick
Demo от этой независимой сети не зависит.

Surface spawn готовит площадку от открытого неба до опоры. Cave spawn
использует отдельную локальную операцию: очищает headroom только внутри
камеры, укрепляет пол и не меняет материал над крышей. Пещерная роль допустима
только если финальный grid подтверждает:

- сплошную опору и свободный габарит танка;
- материал над камерой и измеримую толщину крыши;
- связный mouth к открытому небу;
- выход в направлении противника для legal shot базовым Baby Missile.

Surface candidates ищутся внутри motif-specific regions и оцениваются парами.
В score входят горизонтальная дистанция, relief между игроками,
barrier/basin и соответствие motif. `asymmetric-slope` гарантирует старт на
разных высотных уровнях; cave motif гарантируют хотя бы одну внутреннюю
позицию.

Генератор делает не более четырёх детерминированных попыток. Финальный clean
rescue сохраняет тот же motif, отключает дополнительную roughness и
записывается в metadata. Если exact `layoutMotif` после этого невалиден,
генератор возвращает явную ошибку, а не подменяет fixture другим motif.
Обычный weighted match сохраняет детерминированный open fallback. Результат
записывается в metadata вместе с profile, attempt, причиной fallback, spawn
kinds, relief/barrier/basin и cave clearance/roof/mouth/exit. Целевые пределы
на общем seed corpus: fallback меньше `5%`, среднее число попыток меньше `2`.

## Проверка

- быстрый sweep строит планы для `512` seeds: каждое семейство занимает не
  меньше `15%`, ни одно — больше `50%`;
- full-grid fixtures покрывают все 12 motif, `surface-vs-cave` и
  `cave-vs-cave`;
- replay сравнивает profile, grid hash, spawn positions, attempt, fallback и
  metadata;
- topology tests измеряют ridge/basin, roof, headroom, mouth connectivity,
  firing exit, support и bedrock; отдельные regression tests доказывают, что
  width измерен по grid, default random caves отключены, а exact motif не
  подменяется fallback;
- scaled sweep проверяет каждый из 12 exact motif на нескольких seeds;
- воспроизводимая labelled gallery показывает все 12 motif, а shuffled blind
  gallery скрывает labels и сравнивает только материал и spawn markers;
- внутри каждого семейства mirror-invariant distance 64-bin silhouette на
  общем seed превышает `0.035`; structural metadata отдельно фиксирует robust
  relief, cliffs, floating components и roofed span;
- browser smoke проходит representative motif каждого семейства на desktop и
  short-height mobile с
  выключенными music и SFX;
- generation time и peak memory фиксируются на одном seed corpus без
  обобщения на непроверенные устройства.

## Последствия

- Сложность уровня становится явными ruleset-данными и проверяемой
  топологией, а не побочным эффектом random walk.
- Noise остаётся локальной детализацией и не является автором композиции.
- Пещеры могут менять начальную задачу выстрела, не нарушая поддержку
  overhangs и туннелей material grid.
- Добавление нового motif требует типа, material grammar, validator, fixtures
  и документации; одного Canvas-эффекта недостаточно.
- Изменение весов или порогов является изменением правил Quick Demo и требует
  повторного distribution sweep.

## Граница использования референсов

[Официальное руководство Worms Armageddon](https://ftp.zx.net.nz/pub/archive/ftp.team17.com/pub/t17/manuals/Worms_Armageddon.pdf)
различает island и cavern generation, а документация Hedgewars описывает
[отдельные map generators и двухэтапное построение](https://www.hedgewars.org/wiki/Map)
«naked terrain → bridges / objects» и
[template-driven curves](https://www.hedgewars.org/BehindTheHedge1).
Из этих источников взята только общая инженерная идея разделять композицию и
локальную детализацию. Конкретные формы, алгоритмы, code, assets, названия и
карты не копируются.
