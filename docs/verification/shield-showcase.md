# Проверка shield showcase 0.1

- **Статус:** воспроизводимый release-сценарий
- **Seed:** `41705`
- **Режим:** Infinite Arsenal
- **Игроки:** Пилот Лайм → Пилот Коралл → Пилот Лайм

## Базовый сценарий

1. Открыть Infinite Arsenal и убедиться, что оба HUD показывают Aegis.
2. Для активного игрока открыть отдельный Shield Bay мышью, touch или
   клавиатурой; выбрать семейство.
3. Выстрелить Star Shell в область щита соперника и дождаться завершения
   события.
4. На ходе второго игрока выбрать другой shield и сделать ответный выстрел.
5. На следующем ходе первого игрока подтвердить сохранение его собственного
   выбора и capacity.
6. Повторить сценарий по таблице. После каждого события кадр должен включать
   поле, оба HUD, status ribbon и различимый shape/reaction cue.

| Shield | Воспроизводимый stimulus | Обязательный результат |
|---|---|---|
| None | близкий Star Shell | нет поля и расхода capacity |
| Arc Lifter | projectile входит в radius 58 | impact поднят, две магнитные дуги и стрелка вверх |
| Aegis Shell | shieldable blast | цельная оболочка, `absorb` либо `break`, остаток в HUD |
| Vector Veil | projectile входит в radius 54 | impact смещён в сторону и вверх, направленные линии |
| Bastion Layers | shieldable blast | несколько оболочек, повышенная capacity |
| Magnetar Crown | Laser пересекает tank | `laser-immunity`, корона и разрыв луча, capacity не меняется |

## Механическая сверка

Автоматические тесты в `tests/shields.test.ts` повторяют одинаковый input и
сравнивают полный result для deflection, absorption, break, self-direct hit,
secondary self effect, underground bypass, Laser и всех трёх effect levels.
`tests/shield-selector.test.ts` проверяет клавиатурный порядок шести вариантов.

Фактические local/production browser frames и недоступные device-проверки
фиксируются в Linear release evidence для точного commit; этот документ не
подменяет свежий smoke.
