# ADR 0003: неканонические профили щитов Quick Demo

- **Статус:** принято
- **Дата:** 2026-07-28

## Контекст

Manual Scorched Earth 1.5 подтверждает пять защитных семейств, их цены,
bundle size, arms level и функциональные роли. Он также подтверждает исключение
для прямого собственного попадания и иммунитет Super Mag к Laser. При этом
manual не публикует capacity, долю поглощения, силу deflection и failure
probability.

Для release `0.1` нужен интерактивный shield showcase, но выдавать подобранные
на глаз числа за Classic parity нельзя. Публичный интерфейс и тексты также не
должны копировать названия и оформление оригинала.

## Решение

1. Хранить пять source-backed строк отдельно в `lib/game/shields.ts`:
   `classicName`, `catalogPrice`, `catalogBundleSize`, `armsLevel` и
   `confirmedRole`.
2. Использовать в публичном UI собственные названия: Arc Lifter, Aegis Shell,
   Vector Veil, Bastion Layers и Magnetar Crown.
3. Хранить детерминированные `demoProfile` отдельно от source-backed полей:

   | Публичное имя | Capacity | Absorption | Deflection | Особое правило |
   |---|---:|---:|---|---|
   | None | 0 | 0 | нет | защиты нет |
   | Arc Lifter | 36 | 0 | `Δ(0, −38)`, cost 8 | projectile подбрасывается |
   | Aegis Shell | 46 | 100% | нет | обычное поглощение |
   | Vector Veil | 42 | 42% | `Δ(±30, −18)`, cost 10 | отклонение и частичное поглощение |
   | Bastion Layers | 82 | 100% | нет | усиленная ёмкость |
   | Magnetar Crown | 68 | 72% | `Δ(±18, −34)`, cost 9 | иммунитет к Laser |

4. Считать эти числа профилями Quick Demo, а не восстановленными параметрами
   версии 1.5. Менять их только вместе с измеримым сценарием и обновлением ADR.
5. Сохранить source-backed взаимодействия: прямое попадание собственного
   projectile проходит под собственным щитом; вторичный эффект может быть
   поглощён; обычный щит не останавливает Laser, Magnetar Crown останавливает.
6. Зафиксировать demo-взаимодействия неизвестных семейств:
   multi-warhead разрешается по порядку и расходует capacity каждым событием;
   Roller действует в конечной точке; underground blast обходит absorption на
   `82%`; Napalm и Plasma shieldable; fall damage обходит shield; операции,
   меняющие только terrain, не вызывают absorption, но magnetic/vector field
   может перенаправить их projectile до изменения материала.
7. Уровни Full, Balanced и Reduced меняют только presentation. Capacity,
   deflection, damage и порядок событий от них не зависят.
8. В Infinite Arsenal выбор shield бесплатен, не расходуется, хранится
   независимо на tank каждого игрока и закрывается при передаче хода.
   Quick Demo сохраняет Aegis Shell и существующий межраундовый demo-upgrade.

## Последствия

- Showcase можно проверять воспроизводимо до black-box исследования оригинала.
- `ShieldEvent` становится механическим журналом `absorb`, `deflect`, `break`,
  `bypass` и `laser-immunity`; Canvas только объясняет эти события.
- HUD всегда показывает публичное имя и `capacity/maxCapacity`.
- Наличие пяти семейств в demo не означает готовность полного Classic
  accessories ruleset.
- Эталонные сценарии и неизвестные canonical величины остаются отдельным
  исследовательским этапом.
