# ADR 0005: разрешение составных боеприпасов Quick Demo

- **Статус:** принято
- **Дата:** 2026-07-29
- **Область:** Leap Frog, MIRV и Death's Head

## Контекст

Каталог и animation path уже создавали правильное число дочерних объектов:
три последовательных удара, пять MIRV warheads и девять Death's Head
warheads. Однако airburst resolver трактовал `demoResolution.damage` как общий
бюджет всего payload и делил его на `sqrt(childCount)`.

Из-за этого одна MIRV warhead была слабее обычной Missile, хотя руководство
прямо описывает MIRV как пять Missile warheads. Одна warhead самого дорогого
тяжёлого каскада также получалась слабее бесконечного baseline. Автоматические
тесты проверяли число в каталоге, но не эту интерпретацию при разрешении удара.

Руководство подтверждает функциональные отношения и число warheads, но не
публикует точные damage, spread и falloff Death's Head. Поэтому исправление
должно сохранить границу между source-backed ролью и provisional числами
Quick Demo.

Позднейший аудит выявил вторую проблему той же составной модели: после
достижения апогея runtime заново запускал каждый child под собственным
восходящим angle и немного отличающейся power. Получался второй расходящийся
вверх веер, а одинаковый presentation interval растягивал trajectories разной
длительности и дополнительно рассинхронизировал их вертикальную фазу.

Manual прямо подтверждает раскрытие MIRV строго в апогее и fizzle carrier при
раннем контакте. Death's Head назван функциональным аналогом MIRV, но его
точные spread, child velocity и отдельное правило раннего контакта не
публикуются. Поэтому общий момент раскрытия и fall model следуют подтверждённой
функциональной связи, а численные offsets остаются открыто provisional.

## Решение

1. Вынести профили составных payload в чистый модуль
   `lib/game/payload-profiles.ts`.
2. MIRV разрешать как пять отдельных warheads с текущими Quick Demo radius и
   damage обычной Missile.
3. Death's Head разрешать как девять отдельных тяжёлых warheads. Каждая
   использует собственные текущие provisional `radius = 52` и `damage = 48`;
   деление общего damage между девятью центрами отменяется.
4. Leap Frog сохраняет три последовательных профиля `0.68 / 0.84 / 1` от
   текущего максимального radius и damage. Сплошная readable boundary каждого
   удара должна показывать именно его индивидуальный радиус.
5. Full, Balanced и Reduced меняют только presentation budgets. Число
   warheads, их центры, radius и damage одинаковы во всех режимах.
6. Публичный selector объясняет механику собственными краткими подписями и
   отдельным фильтром тяжёлых payload, не создавая дубликаты 33 catalog items.
7. Apogee fall model применяется ровно к runtime behavior `airburst`, который
   registry назначает только MIRV и Death's Head. Catalog delivery не является
   условием: Funky Bomb сохраняет отдельную seeded chain, Leap Frog —
   последовательные старты, Sandhog — underground fan, а Napalm/Hot
   Napalm/Liquid Dirt — flow mechanics.
8. При найденном апогее каждый child получает одинаковую начальную vertical
   velocity `max(0, carrier.velocityY)`. Новый восходящий angle запрещён.
   Horizontal velocity равна `carrier.velocityX + centeredIndex × delta`, где
   `centeredIndex` симметричен относительно нуля.
9. Для Quick Demo приняты family-specific delta `24 logical units/s` у MIRV и
   `16 logical units/s` у Death's Head. Эти величины — **НЕ каноническая**
   provisional policy до black-box измерения оригинала. Меньшая delta тяжёлого
   payload сохраняет плотный девятицентровый строй; менять её без нового
   измерения и решения нельзя.
10. Дочерние trajectories симулируются фиксированным шагом из общей точки,
    vertical velocity и wind. На плоском рельефе их `y(t)` совпадает до
    первого индивидуального столкновения, а соседний horizontal spacing растёт
    линейно и одинаково.
11. Presentation запускает children одновременно и нормализует каждый path по
    его фактической simulated duration относительно общего clock. Ранний
    impact заканчивает свой segment раньше; VFX не пересчитывает trajectory.

## Последствия

- MIRV снова выполняет подтверждённую роль пяти Missile-equivalent ударов.
- Death's Head становится действительно тяжёлым площадным каскадом; его точный
  баланс остаётся **НЕ каноническим** до black-box измерений.
- Суммарный damage при перекрывающихся зонах заметно возрастает. Это намеренное
  исправление функциональной роли, но требует playtest против shields и на
  тесных участках.
- MIRV и Death's Head теперь визуально раскрываются в один синхронно падающий
  строй без повторного набора высоты; wind одинаково ускоряет все children и
  не ломает их vertical phase.
- Ранний contact carrier продолжает давать fizzle. Для MIRV это прямо
  source-backed; перенос на Death's Head основан на опубликованной роли
  функционального аналога и остаётся с более низкой certainty.
- Unit-тесты фиксируют per-warhead профили и порядок Leap Frog; browser smoke
  дополнительно фиксирует count, velocity progression, `y(t)`, wind и
  фактическую timing-нормализацию. Browser smoke по-прежнему нужен для
  фактической хореографии и touch-scroll selector.
