# Документация Scorched Earth / Afterglow Artillery

Документация отделяет реализованный Quick Demo от полного Classic ruleset,
которому всё ещё нужны accessories, black-box формулы и физическая проверка.
Один и тот же тезис не считается одинаково обязательным во всех документах:

- **принято** — решение, прямо следующее из проектного брифа;
- **предложено** — рабочая гипотеза, которую можно менять после прототипа;
- **справочно** — проверенный факт об оригинале или внешней платформе;
- **открыто** — вопрос, для которого ещё нет достаточных данных.

## Быстрый маршрут

1. [Обзор](overview.md) — зачем существует игра и где её границы.
2. [Реализация](implementation.md) — что действительно работает в Quick Demo.
3. [Спецификации](specs/README.md) — игровой цикл, визуальный и звуковой язык.
4. [Архитектура](architecture.md) — текущая форма и дальнейшие границы.
5. [Основа продукта и платформы](decisions/0001-product-and-platform-foundation.md) —
   уже принятые исходные решения.
6. [Архитектура вертикального среза](decisions/0002-vertical-slice-architecture.md) —
   принятый renderer и граница симуляции/presentation.
7. [Профили щитов Quick Demo](decisions/0003-provisional-shield-profiles.md) —
   явная граница source-backed ролей и неканонических параметров showcase.
8. [Шкала поражения и spectacle](decisions/0004-quick-demo-effect-scale.md) —
   измерения `current → proposed`, три envelope и performance budgets.
9. [Составные боеприпасы](decisions/0005-composite-payload-resolution.md) —
   per-warhead resolution MIRV, Death's Head и Leap Frog.
10. [Меняющийся ветер Quick Demo](decisions/0006-quick-demo-changing-wind.md) —
    provisional mean-reverting модель и статистическая калибровка.
11. [Оригинальная игра](reference/original-game.md) — полный source-backed
   каталог из 33 weapons, экономика и неизвестные параметры Scorched Earth 1.5.
12. [Происхождение аудио-ассетов](reference/audio-assets.md) — CC0-источники,
    исходные имена, преобразования и SHA-256 публичных music/SFX files.
13. [Проверка shield showcase](verification/shield-showcase.md) —
   воспроизводимый seed, stimulus и обязательные реакции пяти семейств.
14. [Проверка effect envelopes](verification/effect-envelope-showcase.md) —
    representative small/medium/cluster/terrain/nuclear styleframes.

## Пути чтения

- **Для игрового дизайна:** обзор → спецификация игры → справочник оригинала.
- **Для VFX и аудио:** обзор → спецификация эффектов →
  [sound design](specs/audio-design.md) → архитектура.
- **Для разработки:** сначала [AGENTS.md](../AGENTS.md), затем реализация →
  архитектура → обе спецификации → ADR.
- **Для баланса:** справочник оригинала → раздел «Контракт баланса» в
  спецификации игры.

Команды запуска и полной проверки находятся в [корневом README](../README.md).
Публикация требует точного проверенного commit и выполняется отдельно от
локальной разработки.
