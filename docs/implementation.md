# Реализованный Quick Demo

- **Статус:** реализовано
- **Обновлено:** 2026-07-29
- **Область:** текущая браузерная версия с полным demo arsenal, не полный Classic

## Игровой цикл

Версия рассчитана на двух людей за одним устройством. Игроки по очереди
выбирают оружие, задают угол и силу, учитывают ветер и стреляют. Попадания
снимают здоровье или щит и меняют общую геометрию поля. Перед стартом явно
выбирается Quick Demo либо неканонический Infinite Arsenal / Showcase.

Quick Demo начинается с нулевым cash. Базовый Star Shell не расходуется, а
каждый игрок получает по одному shot остальных 32 finite weapons. Между
раундами открывается магазин. Infinite Arsenal оставляет те же три раунда и
механику выстрела, но все 33 позиции доступны бесконечно, а магазин,
начисления и interest пропускаются. После финального результата новый матч
снова открывает setup с Quick Demo по умолчанию.

## Полный demo arsenal

Типизированный каталог содержит все 33 weapons из таблицы `SCORCH.DOC`, но
разделяет разные типы данных:

- `classicName`, `catalogPrice`, `catalogBundleSize`, `blastRadius` и
  `armsLevel` сохраняют source-backed строку manual;
- `name`, `shortName`, описание, icon и palette являются собственной публичной
  оболочкой; Funky Bomb сохраняет исходное имя как явно принятое исключение;
- `demoResolution` хранит provisional radius, damage, count и scale отдельно и
  не считается доказательством баланса оригинала.

Selector, текущее оружие и shop показывают публичное имя как основное, но
добавляют `classicName` вторичной строкой там, где он отличается, чтобы игрок
мог быстро найти MIRV, Nuke, Death's Head и другие знакомые позиции без
дублирования catalog items.

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
- MIRV создаёт пять отдельных Missile-equivalent impact profiles
  `radius = 34`, `damage = 34`;
- каждая из девяти Death Crown warheads использует собственный provisional
  profile `radius = 52`, `damage = 48`, без деления общего damage;
- Napalm использует расстояние до ближайшего flow point;
- Sandhog endpoints обходят shield на `82%`, laser — на `100%`;
- остальные profiles читают provisional `demoResolution.damage` и собственную
  геометрию behavior;
- release 0.1 расширяет spatial reach по семейной шкале `1.0–1.8×`; уточнение
  per-warhead semantics составных payload принято отдельно в
  [ADR 0005](decisions/0005-composite-payload-resolution.md). Canonical damage
  formulas по-прежнему неизвестны.

## Effect envelopes

`lib/game/effect-profiles.ts` перечисляет все 33 weapons и хранит измеренный
baseline, новый mechanical radius/half-width, readable boundary, безопасный
spectacle envelope, shape/signature, budgets particles/shockwaves и maximum
aftermath. Таблица и баланс-решение находятся в
[ADR 0004](decisions/0004-quick-demo-effect-scale.md).

Прямая radial damage formula вынесена в чистый `resolveRadialDamage`; Canvas не
получает decorative radius. Ballistic/roller/digger/sandhog/terrain circle и
Plasma читают новые `demoResolution.radius`. Funky использует 24-unit node,
Napalm — отдельный reach от flow point, Earthflow — flow half-width, Laser —
17-unit collision half-width, global settle остаётся global.

Canvas рисует mechanical boundary сплошной линией с ticks, а safe spectacle —
пунктирными echo rings, rays, nuclear radial light и plume. Existing
family-specific flow, wedge, beam, seismic и growth choreography сохраняет
собственную геометрию. Full/Balanced/Reduced выбирают budgets `220/132/60`
максимум на shot и до `4/2/1` echoes; общий particle cap равен `320`.
Presentation seed отделён от mechanics seed.

Representative local/production flow описан в
[effect envelope verification](verification/effect-envelope-showcase.md).

## Shield showcase

`lib/game/shields.ts` содержит отдельный типизированный каталог из None и пяти
source-grounded shield families. Source-поля (`classicName`, price, bundle и
arms level) отделены от собственных публичных имён и от неканонического
`demoProfile`. Принятые числа и причины такого разделения зафиксированы в
[ADR 0003](decisions/0003-provisional-shield-profiles.md).

Чистые `resolveShieldDamage` и `resolveShieldDeflection` возвращают новый
capacity и доменный `ShieldEvent`, не обращаясь к Canvas, времени или
случайности. Adapter сохраняет `shieldId`, current/max capacity и последнюю
реакцию на объекте конкретного tank. Ordered multi-warhead events расходуют
его capacity последовательно. Self-fired direct hit, fall damage, underground
bypass, обычный Laser и Magnetar immunity имеют явные ветки.

Infinite Arsenal показывает отдельную кнопку Shield Bay рядом с оружием.
Selector предлагает шесть бесплатных вариантов, работает мышью, touch,
стрелками, Home/End, Enter/Space и Escape. Выбор P1 не меняет P2; modal
закрывается на handoff, а выбранный shield и остаток заряда сохраняются.
Оба HUD постоянно показывают публичное имя и `current/max capacity`.

Canvas различает роли формой: magnetic arcs, solid shell, vector field,
layered shell и hybrid crown. `absorb`, `deflect`, `break`, `bypass` и
`laser-immunity` получают отдельные геометрические cues. Effect intensity
меняет только декоративную presentation и не передаётся в shield resolver.
Воспроизводимый browser-сценарий описан в
[shield showcase verification](verification/shield-showcase.md).

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

## Infinite Arsenal policy

`lib/game/match-policy.ts` хранит явный `DemoMatchMode` и чисто отвечает на
вопросы `canSelectWeapon`, `shouldConsumeAmmo` и
`shouldOpenInterroundShop`. Presentation передаёт режим в player-owned
selection/consumption и только отображает результат policy.

В `infinite-arsenal` inventory не заполняется `99`, `Infinity` или иным
sentinel. Finite quantity остаётся обычным числом и не меняется после shot;
UI показывает `∞` для каждой позиции. Quick Demo продолжает расходовать finite
ammo и переводить исчерпанную позицию в unavailable. Match mode не передаётся
в trajectory/resolution, поэтому seeded mechanical outcome не зависит от
ammo policy.

## Техническая форма

- battlefield имеет размер `2880 × 720`, а Canvas viewport — `960 × 540`;
  камера связывает эти две системы координат и ограничивается границами мира;
- `TerrainGrid` хранит материалы в `Uint8Array` и умеет вырезать, заполнять и
  ограниченно осаждать изменённые области;
- Canvas terrain cache после первого полного построения обновляет только
  объединённые dirty bounds операций carve/fill/settle; полная пересборка
  остаётся safe fallback и применяется при новом battlefield;
- `BattlefieldPlan` до rasterization выбирает `open`, `ridge`, `valley` или
  `cavern`, macro anchors и surface/cave роли; веса и topology thresholds
  хранятся в domain ruleset;
- seeded PRNG воспроизводимо сочетает план, detail-шум, связные сети пещер,
  камеры, ответвления, входы с поверхности и bedrock;
- surface spawn solver оценивает пару позиций и рельеф между ними. Cavern
  создаёт настоящий внутренний пол под сохранённой крышей для одного или обоих
  танков, соединяет камеру с surface mouth и готовит firing exit в сторону
  противника; локальная cave shelf не очищает колонку до неба;
- generator metadata фиксирует profile, attempt/fallback, spawn kinds,
  barrier/basin/relief и cave roof/headroom/mouth/exit; финальный validator
  ограничен четырьмя детерминированными попытками;
- поиск опоры под танком учитывает полости: провалившийся танк оседает на
  ближайшем материале ниже, а не переносится на верхний контур;
- камера поддерживает drag одним пальцем или мышью, pinch и wheel zoom,
  навигацию по minimap, пошаговый сдвиг кнопками и возврат к активному танку;
  во время выстрела auto-follow удерживает в кадре траекторию и место
  разрешения эффекта;
- mobile Canvas больше не использует фиксированный `960 × 540` letterbox:
  `ResizeObserver`, `visualViewport`, orientation/resize events и актуальный
  DPR синхронизируют CSS viewport с backing store, а input mapping читает
  фактический `getBoundingClientRect()`;
- seeded PRNG, генерация поля и баллистика воспроизводимы;
- Quick Demo registry стратегий и чистые roller/digger/flow/cluster
  path-builders вынесены из React adapter в `lib/game/`; Digger, Sandhog и
  Laser передают resolver явные mechanical paths, а не ищут механику по
  визуальному `style` сегмента;
- траектория считается фиксированными шагами со swept collision, чтобы быстрый
  projectile не проходил сквозь тонкий слой земли;
- React отвечает за HUD и controls, Canvas 2D — за поле, танки, projectiles и
  эффекты;
- particle lifecycle вынесен в отдельный presentation-модуль: canonical и
  Experimental используют общий object pool, но сохраняют раздельные caps
  `320` и `600/250/80`; projectile trail sampling переиспользует координатный
  scratch вместо тысяч краткоживущих объектов;
- отдельный audio module после пользовательского действия проигрывает локальный
  CC0 action-chiptune и смешивает CC0 one-shot layers с procedural Web Audio
  signatures; все `33 + 10` items имеют typed profile, semantic archetype и
  impact scale;
  Apple mobile WebKit получает playback AudioSession, а без этого API —
  media-route fallback; desktop Safari сохраняет автоматическую AudioSession и
  получает отдельный `MediaStreamAudioDestinationNode → HTMLAudioElement`
  output, потому что `running` Web Audio context в Safari не всегда означает
  физически слышимый destination; `resume()` считается успешным только после
  bounded timeout, подтверждённого состояния `running` и движения clock;
- симуляция не зависит от частиц, звука, частоты кадров и camera shake.

Математика камеры, детерминизм battlefield, дальность spawn и свойства
пещерного рельефа проверяются unit/property-сценариями. Browser smoke
проверяет pan, zoom, minimap и auto-follow в desktop и мобильном viewport.
Pinch, listening-flow и производительность на iPhone остаются отдельной
проверкой на физическом устройстве.

Player-owned combat state хранится на стабильном объекте tank: выбранное
оружие, shield family/capacity, угол, сила и inventory не разделяются между
участниками hot-seat.
Каждый shot фиксирует owner до асинхронного visual resolution; расход ammo,
damage credit и восстановление следующего хода используют этого owner, а не
позднее значение active player. При передаче хода transient Arsenal Deck
закрывается и сбрасывает presentation-фильтр. Music/SFX имеют независимые
persisted on/off и volume; effect intensity, reduced motion, pause, ruleset,
round, wind и мир остаются общими настройками матча. Аудиограф и lifecycle
описаны в [спецификации sound design](specs/audio-design.md). `suspended` и
WebKit `interrupted` не скрываются за включёнными controls: экран показывает
диагностируемый recovery state и даёт новый прямой Retry tap. На стартовом
экране отдельный sound-check даёт высокий слышимый cue; SFX volume применяется
один раз на bus.
Выбранный `DemoMatchMode` также является общей явной настройкой матча.

Чистые системы находятся в `lib/game/`, presentation — в `app/game/`. Их
граница и выбор renderer зафиксированы в
[ADR 0002](decisions/0002-vertical-slice-architecture.md).

## Музыка и SFX

Музыка Quick Demo — локально поставляемый action-chiptune loop Juhani Junkala
из CC0-набора `5 Chiptunes (Action)`. Файл нормализован и перекодирован для
игрового микса, загружается через `fetch`, декодируется в `AudioBuffer` и
проигрывается одним зацикленным `AudioBufferSourceNode` через
`musicGain → duckGain → masterGain → compressor`. Текущая версия содержит
один loop: шесть фаз матча пока не имеют отдельных аранжировок; его
воспроизведением и уровнем управляют lifecycle, pause, настройки bus и ducking.

CC0 one-shots Kenney дают отдельные слои для малого, среднего, большого и
ultimate blast, низкочастотного основания, soil/rock/hull impact, shield,
laser, fire и thruster. План использует механический archetype и scale оружия,
поэтому крупный взрыв отличается от малого не только громкостью, но числом
слоёв, спектром и хвостом; large/ultimate дополнительно получают
среднечастотный crunch, слышимый там, где телефонный динамик ослабляет sub.
Процедурные motifs остаются signatures и fallback: ошибка загрузки музыки не
выключает SFX, а недоступный sample не отменяет остальные слои event.

Music и sample buffers начинают загружаться асинхронно только после успешного
audio unlock и не входят в iOS activation timeout. Future impact ждёт уже
идущий decode до своего deadline; pause/background сохраняют оставшуюся
задержку ещё не начавшихся timeline layers и создают новые sources после
resume. Эти механизмы не меняют симуляцию. Apple mobile AudioSession
`playback`, iOS hidden media-route bridge, desktop Safari media-stream output,
`suspended`/`interrupted` recovery и новый прямой Retry gesture сохранены.
Источники, лицензии, локальные преобразования и контрольные суммы перечислены в
[справочнике аудиоассетов](reference/audio-assets.md).

## Управление и адаптация

Экранные элементы поддерживают touch и мышь; клавиатура дублирует основные
действия. Интерфейс рассчитан на альбомную ориентацию и показывает отдельное
приглашение повернуть узкий телефон. На коротком landscape viewport masthead
скрывается. Поверх поля остаются верхняя combat strip `48 px`, нижняя action
rail `64 px` и закрытая кнопка камеры `48×48 px`; вместе HUD и rail занимают
не больше `112 px`. Angle/power steppers меняют значения на `1°` и `10`,
центральные значения открывают взаимоисключающие precision trays, которые
блокируют Fire.

Compact weapon/shield chips открывают fullscreen native Loadout с вкладками.
Все 33 позиции доступны в прокручиваемой сетке с фильтрами по роли,
selected/depleted состояниями, стрелочной навигацией, `Escape` и возвратом
focus. Modal делает фон inert и блокирует случайный Fire; при переходе в
portrait закрывается перед orientation gate. Одна camera-кнопка открывает
popover с minimap и controls и остаётся выше popover в hit-testing.

Coarse-pointer Fire срабатывает один раз при отпускании внутри кнопки. Уход
pointer за границу, cancel/lost capture, background, Pause и открытие transient
UI отменяют tap; mouse/keyboard сохраняют обычное явное действие. На время
полёта action rail и camera control скрываются; combat strip и Pause остаются
доступными, а открытый Pause замораживает simulation/audio до resume.

Safe-area учитывается со всех сторон. При высоте ниже `286 px` вместо боя
показывается просьба закрыть панели браузера. Короткий status toast скрывается
примерно через две секунды, а отдельный `aria-live` сохраняет сообщение.
Размер самого combat surface, а не только Canvas backing store, ограничивается
текущими `visualViewport.width/height`: при раскрытых панелях iPhone нижняя
action rail остаётся внутри hit-testable видимой области.
Магазин сохраняет собственные cards и отдельно показывает buy/sell quotes.
Для пользователей с `prefers-reduced-motion` сокращаются тряска и декоративное
движение, но не исчезают механические cues.

## Проверка

Для релизного состояния обязательна команда `npm run check`: она последовательно
запускает ESLint, strict TypeScript, unit-тесты, production build и проверку
server-rendered HTML. `npm run test:mobile` отдельно собирает production build,
поднимает production server и прогоняет Chromium/WebKit matrix для Quick Demo
и Infinite Arsenal на `667×375`, `844×390`, `852×393`, `932×430`, `844×320`
и `932×296`. Suite измеряет overlap/overflow, canvas coverage, touch targets,
Fire gap, fullscreen Loadout, precision trays, camera popover, coarse-pointer
tap/cancel, Pause, resize/orientation, portrait gate и browser
console/page errors; layout snapshots маскируют недетерминированную Canvas
presentation. Высота `844×320` служит прокси для раскрытых панелей мобильного
браузера, portrait `390×844` — для orientation gate. После автоматики основной
поток дополнительно проверяется во встроенном браузере. Pixel snapshots
проверяются локально на macOS, где созданы их baselines; Linux CI прогоняет
переносимые geometry и interaction checks, но не заявляет cross-OS pixel
parity без отдельных Linux baselines.

## Осознанные ограничения

- нет bots, online multiplayer, аккаунтов и backend;
- состояние матча не переносится между устройствами;
- все 33 weapons доступны, но их `demoResolution`, spread, flow, settle,
  damage, payout и sell-back не являются доказанным паритетом оригинала;
- остальные accessories, guidance и batteries не реализованы; battery scaling
  Plasma/Laser отсутствует, а пять shield families используют явные
  неканонические Quick Demo profiles до black-box сверки capacity, absorption
  и deflection;
- Napalm не моделирует подтверждённую зависимость heat от глубины pool;
- Digger не отличает прямое попадание в tank с canonical fizzle;
- Basic/Standard/Greedy coefficients, quantity-dependent sale offers и Free
  Market не восстановлены;
- производительность на физическом среднем Android-устройстве пока не
  измерена: device trace и physical touch pass не выполнялись, поэтому
  совместимость формулируется как целевая, а не подтверждённая.
- mobile geometry и interaction suite пройдены только в desktop-hosted
  Chromium/WebKit: реальный iPhone Safari pass с browser chrome, safe-area,
  системными жестами, coarse tap-to-fire и rotate/resize всё ещё обязателен
  перед закрытием `AND-19`.
- качество нового микса на физическом iPhone, встроенном mono-динамике,
  headphones и при системном Silent Mode требует отдельного listening pass:
  успешный decode и `AudioContext.state === "running"` этого не доказывают.
