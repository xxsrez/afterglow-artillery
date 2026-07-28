# Музыка и sound design

- **Статус:** реализованный presentation-контракт Quick Demo
- **Обновлено:** 2026-07-28
- **Область:** музыка, SFX оружия, shield/armor, terrain и UI

## 1. Цель

Аудио объясняет тот же механический исход, что Canvas и HUD: выбор, запуск,
траекторию, момент каждого фактического impact, материал, урон, реакцию щита,
разрушение и передачу хода. Оно усиливает ритм hot-seat матча, но никогда не
становится источником состояния симуляции.

Музыкальное направление Quick Demo — энергичный action-chiptune loop,
достаточно ритмичный для артиллерийского матча и не конкурирующий с
кульминациями оружия. Текущая композиция Juhani Junkala выбрана из набора
`5 Chiptunes (Action)`, опубликованного под CC0, нормализована для игрового
микса и поставляется локально вместе с приложением.

SFX используют собственную комбинацию CC0 one-shot samples Kenney и
синтезируемых Web Audio signatures. В продукт не входят музыка, мелодии или
sound assets оригинальной игры. Источник, лицензия, локальная обработка и
контрольные суммы файлов фиксируются в
[справочнике аудиоассетов](../reference/audio-assets.md). Встроенный почти
нулевой PCM используется только как технический media-route bridge для Apple
WebKit без AudioSession API и не является частью score.

## 2. Граница systems

`app/game/audio-system.ts` — отдельный presentation module. Он принимает
типизированный `GameAudioEvent`, строит чистый `AudioPlan` из sample layers и
procedural voices и только затем исполняет его через Web Audio. Загрузка
локальных файлов из `public/audio/` вынесена в отдельный adapter:
`fetch → ArrayBuffer → decodeAudioData → AudioBuffer`. `lib/game/` не
импортирует `AudioContext`, DOM, время, storage или сведения об ассетах.

Входные события используют уже рассчитанные данные:

- `weapon-timeline` получает реальную длительность shot, `resolvedAt` и
  фактические `impactTimes`; преждевременный carrier fizzle не создаёт звуки
  дочерних impacts;
- `resolution` получает материал, фактические изменения health, direct-hit и
  destruction flags, ordered `ShieldEvent` и признак осыпания terrain;
- `ui` описывает выбор, магазин, pause/resume, смену хода и результаты;
- состояние music bus управляет воспроизведением, паузой и ducking, но не
  меняет фазу матча.

Планирование детерминировано переданным seed. Глобальная случайность и время в
выборе cue не используются.

## 3. Профили оружия

`SoundProfile` существует для всех `33` canonical weapons и `10`
Experimental Ultimates. Помимо семейства, профиль хранит семантический масштаб
impact — `small`, `medium`, `large` либо `ultimate`. У каждого item собственная
комбинация:

- трёхчастотного motif;
- двух waveform;
- attack, impact, tail и rhythm;
- stereo motion;
- списка фаз и общего layer budget;
- sample archetype и масштаба, определяющих физический характер impact.

Варианты одного семейства различаются не только громкостью. Малый blast
получает короткий crunch, средний — более плотный impact, большой и ultimate —
отдельный крупный blast, низкочастотное основание, более длинный хвост и
слышимую на телефоне mid-frequency опору. Terrain, hull, shield, laser, fire и
launch используют собственные материал и движение, а не один и тот же
«взрывной» cue. Pitch variation, pan и timing выводятся из seed.

Sample layers накладываются поверх процедурного motif: synthesis сохраняет
узнаваемую подпись weapon и остаётся fallback, если отдельный файл не
загрузился или не декодировался. Один event планирует не более `12` суммарных
sample/procedural layers; Experimental профиль дополнительно ограничивается
своим quality budget.

## 4. Щиты, корпус и terrain

Все варианты доменного `ShieldEvent` имеют отдельный cue: `absorb`, `break`,
`deflect`, `bypass` и `laser-immunity`. Пять защитных семейств различаются
sample layer, частотой и/или waveform; `None` не изображается как активное
поле.

Health loss разделён на `light`, `medium`, `heavy` и `critical`; direct hull
hit, однократное пересечение critical-порога, fall/landing, destruction и
terrain collapse добавляют отдельные слои. Impact material различает `air`,
`soil`, `rock`, `liquid-fire` и `hull`. Для soil, rock, hull, field, laser,
fire и thruster используются отдельные CC0 one-shots; procedural voice
сохраняет information cue даже при ошибке ассета.

## 5. Музыка и микс

Локальный MP3 action-chiptune загружается после успешного unlock, декодируется
в `AudioBuffer` и проигрывается одним зацикленным `AudioBufferSourceNode`.
Источник подключён к существующему графу
`musicGain → duckGain → masterGain → compressor → destination`; во время
громких событий score ducked.

Текущий Quick Demo содержит один непрерывный loop. Состояния `intro`, `aiming`,
`flight`, `shop`, `round-result` и `match-end` пока не имеют шести отдельных
аранжировок и не меняют гармонию: lifecycle, pause, настройки bus и ducking
управляют только воспроизведением и уровнем одного loop. Динамический score
остаётся будущим улучшением, а не заявленной возможностью текущей версии.

Граф разделён на music и SFX, а SFX — на `weapon`, `shieldArmor`,
`impactTerrain` и `ui`. Перед destination стоит compressor. Общий предел —
`24` одновременных audible sources, включая музыку, samples и procedural
voices; при переполнении низкоприоритетный source уступает более важному.

Загрузка музыки и sample cache запускается асинхронно после активации context и
не входит в критический unlock timeout. Ошибка music fetch/decode не закрывает
`AudioContext` и не выключает SFX. Ошибка отдельного one-shot также не отменяет
остальные слои event: слышимым fallback остаётся procedural signature.

Пользовательская громкость применяется ровно один раз на общем music/SFX bus.
Профиль отдельного cue хранит нормализованный gain и не умножает volume
повторно.

## 6. Настройки и lifecycle

До старта и на pause доступны независимые:

- Music on/off и volume `0–100`;
- SFX on/off и volume `0–100`.

Настройки сохраняются в `localStorage`; прежний общий mute мигрирует в два
выключенных bus. `AudioContext` не создаётся до пользовательского действия.
Если Web Audio недоступен, UI показывает retry, а матч продолжает работать.

На iPhone/iPad WebKit, где доступен AudioSession API, приложение до создания
context запрашивает session type `playback`: игра содержит непрерывную музыку,
а не только системные notification cues. Desktop Safari сохраняет
`AudioSession.type = auto` и выводит общий Web Audio mix через
`MediaStreamAudioDestinationNode → HTMLAudioElement`. Эта ветка обходит
известное состояние WebKit, в котором `AudioContext` остаётся `running`, его
clock и callbacks движутся, но прямой destination физически молчит. Unlock
начинается непосредственно внутри Start/Retry gesture: выбранный media route
запускается, короткий ненулевой confirmation tone планируется и `resume()`
вызывается до первого `await`.
Вводится bounded timeout, поэтому зависший WebKit promise переходит в Retry, а
не оставляет UI навсегда в промежуточном состоянии. Unlock
считается успешным только при фактическом `AudioContext.state === "running"` и
движущемся `currentTime`. Resolved `resume()` при оставшемся
`suspended`/`interrupted` либо замершем clock не превращается в ложное
состояние «Вкл».

Если AudioSession API отсутствует на iPhone/iPad WebKit, тот же прямой gesture
запускает скрытый looping HTMLMediaElement с почти нулевым PCM. Он удерживает
media playback route, чтобы системный Silent Mode не глушил Web Audio как
ambient sound. На остальных платформах fallback не создаётся. Стартовый экран
даёт явную кнопку «Проверить звук» с хорошо слышимым высоким cue; это
пользовательская проверка, а не автоматическое доказательство физического
динамика.

Mute, restart и unmount отменяют соответствующие sources. Pause и background
останавливают их, но сохраняют оставшееся время будущих timeline layers; при
возобновлении создаются новые nodes с оставшейся задержкой. Остановленный
`AudioBufferSourceNode` не переиспользуется. Скрытая вкладка suspends context и
media bridge. После возвращения UI требует новый прямой Retry/Resume tap и
только затем создаёт актуальные music и отложенные SFX sources.
WebKit-состояние `interrupted` обрабатывается как восстанавливаемое, но не
аудируемое: UI показывает причину и предлагает новый прямой Retry tap.
Production diagnostics сохраняет state, current time, AudioSession, активные
voices и значения music/SFX/category gains без пользовательских данных.

Основание для platform-specific ветки: MDN документирует необходимость
возобновления `interrupted` context в iOS Safari, а W3C Audio Session определяет
`playback` как отдельный тип длительного воспроизведения:
[BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state),
[Audio Session](https://www.w3.org/TR/audio-session/).

## 7. Проверка

Автоматически проверяются:

- полное покрытие `33 + 10`, уникальность профилей и budgets;
- выбор разных sample archetype/scale для малого, среднего, большого и
  ultimate impact и суммарный предел sample/procedural layers;
- фактические timestamps multi-impact и отсутствие child impacts при fizzle;
- все shield variants/families, damage buckets, material и collapse;
- независимость Music/SFX, нормализация и persistence;
- предел `24`, pause/background reschedule и dispose cleanup;
- один loop source на активный score, корректное создание нового source после
  stop и изоляция music/sample load failures от процедурных SFX;
- запуск будущего impact после завершения cold-cache decode, если его
  фактический deadline ещё не прошёл;
- `suspended → running`, `interrupted → running`, rejected `resume()` и
  false-positive `resume()`, после которого state не стал `running` или
  clock остался заморожен;
- timeout зависшего `resume()`, единственную точку применения volume и порядок
  `confirmation source.start() → media bridge → resume()`;
- выбор AudioSession `playback` только для Apple mobile, возврат desktop Safari
  к `auto` и отдельный Safari media-stream output; Apple mobile fallback при
  отсутствии API;
- отдельный высокочастотный sound-check cue.

Browser smoke проверяет наличие controls, сохранение настроек, запуск после
gesture, pause/resume и отсутствие runtime errors. Субъективный listening test,
физические iPhone/Android, speakers/headphones/mono и измерение audio callback
нельзя заменять unit-тестом или desktop viewport; недоступный пункт фиксируется
как отдельный release gap без ложного заявления о совместимости. Даже
`context.state === "running"`, движущийся clock и ненулевой graph доказывают
работу scheduler/graph, но не слышимый сигнал конкретного динамика iPhone.
