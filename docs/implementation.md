# Реализованный Quick Demo

- **Статус:** реализовано
- **Обновлено:** 2026-07-28
- **Область:** текущая браузерная версия с полным demo arsenal, не полный Classic

## Игровой цикл

Версия рассчитана на двух людей за одним устройством. Игроки по очереди
выбирают оружие, задают угол и силу, учитывают ветер и стреляют. Попадания
снимают здоровье или щит и меняют общую геометрию поля. Матч состоит из трёх
раундов; между раундами открывается магазин с покупкой и продажей боеприпасов.

Матч начинается с нулевым cash. Базовый Star Shell не расходуется, а каждый
игрок получает по одному shot остальных 32 finite weapons. Поэтому весь
каталог доступен для демонстрации, но базовый снаряд всё равно гарантирует
осмысленный ход после исчерпания inventory. После финального результата матч
можно немедленно перезапустить с новым полем.

## Полный demo arsenal

Типизированный каталог содержит все 33 weapons из таблицы `SCORCH.DOC`, но
разделяет разные типы данных:

- `classicName`, `catalogPrice`, `catalogBundleSize`, `blastRadius` и
  `armsLevel` сохраняют source-backed строку manual;
- `name`, `shortName`, описание, icon и palette являются собственной публичной
  оболочкой; Funky Bomb сохраняет исходное имя как явно принятое исключение;
- `demoResolution` хранит provisional radius, damage, count и scale отдельно и
  не считается доказательством баланса оригинала.

В игровом adapter реализованы 17 behavior paths:

- четыре размера обычного blast и три последовательных Leap Frog payload;
- Funky Bomb с `10–14` seeded chain nodes в области до 76 logical units;
- MIRV с пятью и Death Crown с девятью child warheads; carrier без достигнутого
  апогея fizzles без взрыва;
- два napalm flow, безвредные tracer и smoke tracer, три roller;
- локальные riot wedges и projectile terrain-only riot bombs;
- три digger и три underground Sandhog fan;
- три dirt sphere, liquid fill, dirt wedge и bounded global settle;
- owner-centered plasma pulse и прямой laser через terrain.

### Funky Bomb

Seed определяет число, позиции и порядок chain nodes. Механические центры
разрешаются детерминированно, а presentation группирует их в мягкие цветовые
волны, добавляет радужные trails, confetti-like particles, отдельный звук и
усиленный camera response. Reduced Motion сохраняет все nodes и outcome, но
уменьшает shake, trails и плотность частиц.

Количество `10–14`, scatter, node damage и VFX являются решением Quick Demo,
а не установленным фактом Scorched Earth 1.5.

### Demo damage contract

Все формулы этого подраздела детерминированы, но **НЕ канонические**:

- обычный круговой blast действует до `radius + 18`; внутри него raw damage
  равен `peak × (0.22 + 0.78 × (1 − distance / reach))`;
- Leap Frog последовательно применяет multipliers `0.68`, `0.84`, `1`;
- Funky делит source damage на
  `max(2.8, sqrt(nodeCount))` и добавляет повторяемый четырёхшаговый wobble;
- MIRV/Death Crown делят damage на
  `max(1.6, sqrt(childCount))`;
- Napalm использует расстояние до ближайшего flow point;
- Sandhog endpoints обходят shield на `82%`, laser — на `100%`;
- остальные profiles читают provisional `demoResolution.damage` и собственную
  геометрию behavior.

## Реализованная экономика

Source-backed параметры:

- canonical price и bundle каждого finite weapon;
- inventory cap `99`;
- default interest rate `5%`;
- бесконечный Baby Missile, представленный публичным Star Shell;
- приблизительный markup `20%` для partial bundle у cap.

Детерминированные Quick Demo policies, которые **НЕ являются каноническими**:

- partial purchase:
  `ceil(catalogPrice × quantity × 1.2 / catalogBundleSize)`;
- продажа одного или нескольких shots:
  `floor(catalogPrice × quantity × 0.60 / catalogBundleSize)`;
- round payout:
  `7000 + round(weightedDamage × 55) + 2500 за победу`;
- shield damage входит в `weightedDamage` с коэффициентом `0.35`;
- interest округляется как `floor(currentCash × 0.05)`.

Оба игрока покупают и продают по очереди; перед следующим раундом процент
начисляется на весь текущий cash, включая выручку от продажи. Магазин
показывает quote до действия, ограничивает покупку cap и продаёт по одному shot
за нажатие. Health и shield upgrades остаются собственными demo items, а не
переносом canonical accessories.

## Техническая форма

- логический мир имеет размер `960 × 540`;
- `TerrainGrid` хранит материалы в `Uint8Array` и умеет вырезать, заполнять и
  ограниченно осаждать изменённые области;
- seeded PRNG, генерация поля и баллистика воспроизводимы;
- траектория считается фиксированными шагами со swept collision, чтобы быстрый
  projectile не проходил сквозь тонкий слой земли;
- React отвечает за HUD и controls, Canvas 2D — за поле, танки, projectiles и
  эффекты;
- звук синтезируется через Web Audio после пользовательского действия;
- симуляция не зависит от частиц, звука, частоты кадров и camera shake.

Чистые системы находятся в `lib/game/`, presentation — в `app/game/`. Их
граница и выбор renderer зафиксированы в
[ADR 0002](decisions/0002-vertical-slice-architecture.md).

## Управление и адаптация

Экранные элементы поддерживают touch и мышь; клавиатура дублирует основные
действия. Интерфейс рассчитан на альбомную ориентацию и показывает отдельное
приглашение повернуть узкий телефон. На коротком landscape viewport masthead
скрывается, HUD и управление уплотняются без уменьшения touch-targets ниже
48 CSS px, а safe-area учитывается один раз внешней оболочкой. На время полёта
снаряда нижняя панель скрывается и освобождает поле для траектории и эффекта.
В закрытом состоянии выбор оружия показывает одну крупную current-weapon
кнопку с названием, механической ролью и ammo. Она открывает native modal
Arsenal Deck: все 33 позиции доступны в прокручиваемой сетке с фильтрами по
роли, selected/depleted состояниями, стрелочной навигацией, `Escape` и
возвратом focus. Modal блокирует случайный Fire, на коротком landscape
становится bottom sheet, а при переходе в portrait закрывается перед
orientation gate. Магазин сохраняет собственные cards и отдельно показывает
buy/sell quotes.
Для пользователей с `prefers-reduced-motion` сокращаются тряска и декоративное
движение, но не исчезают механические cues.

## Проверка

Для релизного состояния обязательна команда `npm run check`: она последовательно
запускает ESLint, strict TypeScript, unit-тесты, production build и проверку
server-rendered HTML. После этого основной поток должен дополнительно
проверяться во встроенном браузере на desktop и landscape 844×390, 852×393,
932×430 и 667×375. Высота 844×320 служит прокси для раскрытых панелей мобильного
браузера; portrait 390×844 проверяется как корректный orientation gate.

## Осознанные ограничения

- нет bots, online multiplayer, аккаунтов и backend;
- состояние матча не переносится между устройствами;
- все 33 weapons доступны, но их `demoResolution`, spread, flow, settle,
  damage, payout и sell-back не являются доказанным паритетом оригинала;
- полный каталог accessories, guidance, batteries и canonical shield families
  не реализован; поэтому отсутствуют battery scaling Plasma, поведение Laser с
  batteries и иммунитет Super Mag;
- Napalm не моделирует подтверждённую зависимость heat от глубины pool;
- Digger не отличает прямое попадание в tank с canonical fizzle;
- Basic/Standard/Greedy coefficients, quantity-dependent sale offers и Free
  Market не восстановлены;
- производительность на физическом среднем Android-устройстве пока не
  измерена: device trace и physical touch pass не выполнялись, поэтому
  совместимость формулируется как целевая, а не подтверждённая.
