# Музыка и sound design

- **Статус:** реализованный presentation-контракт Quick Demo
- **Обновлено:** 2026-07-28
- **Область:** музыка, SFX оружия, shield/armor, terrain и UI

## 1. Цель

Аудио объясняет тот же механический исход, что Canvas и HUD: выбор, запуск,
траекторию, момент каждого фактического impact, материал, урон, реакцию щита,
разрушение и передачу хода. Оно усиливает ритм hot-seat матча, но никогда не
становится источником состояния симуляции.

Музыкальное направление — собственный спокойный ретрофутуристический
procedural score около `72–84 BPM`. В продукт не входят аудиофайлы, музыка,
мелодии или sound assets оригинальной игры.

## 2. Граница systems

`app/game/audio-system.ts` — отдельный presentation module. Он принимает
типизированный `GameAudioEvent`, строит чистый `AudioPlan` и только затем
исполняет его через Web Audio. `lib/game/` не импортирует `AudioContext`, DOM,
время или storage.

Входные события используют уже рассчитанные данные:

- `weapon-timeline` получает реальную длительность shot, `resolvedAt` и
  фактические `impactTimes`; преждевременный carrier fizzle не создаёт звуки
  дочерних impacts;
- `resolution` получает материал, фактические изменения health, direct-hit и
  destruction flags, ordered `ShieldEvent` и признак осыпания terrain;
- `ui` описывает выбор, магазин, pause/resume, смену хода и результаты;
- `music` задаёт состояние score, но не меняет фазу матча.

Планирование детерминировано переданным seed. Глобальная случайность и время в
выборе cue не используются.

## 3. Профили оружия

`SoundProfile` существует для всех `33` canonical weapons и `10`
Experimental Ultimates. У каждого item собственная комбинация:

- трёхчастотного motif;
- двух waveform;
- attack, impact, tail и rhythm;
- stereo motion;
- списка фаз и voice budget.

Варианты одного семейства различаются не только громкостью. Одновременно один
event создаёт не более `12` voices; Experimental профиль дополнительно
ограничивается своим quality budget.

## 4. Щиты, корпус и terrain

Все варианты доменного `ShieldEvent` имеют отдельный cue: `absorb`, `break`,
`deflect`, `bypass` и `laser-immunity`. Пять защитных семейств различаются
частотой и/или waveform; `None` не изображается как активное поле.

Health loss разделён на `light`, `medium`, `heavy` и `critical`; direct hull
hit, однократное пересечение critical-порога, fall/landing, destruction и
terrain collapse добавляют отдельные слои. Impact material различает `air`,
`soil`, `rock`, `liquid-fire` и `hull`.

## 5. Музыка и микс

Непрерывная музыка синтезируется четырьмя мягкими oscillator voices с медленным
detune movement. Состояния `intro`, `aiming`, `flight`, `shop`,
`round-result` и `match-end` меняют гармонический слой без перезапуска
симуляции. Во время громких событий score ducked.

Граф разделён на music и SFX, а SFX — на `weapon`, `shieldArmor`,
`impactTerrain` и `ui`. Перед destination стоит compressor. Общий предел —
`24` одновременных audible voices, включая музыку; при переполнении
низкоприоритетный voice уступает более важному.

## 6. Настройки и lifecycle

До старта и на pause доступны независимые:

- Music on/off и volume `0–100`;
- SFX on/off и volume `0–100`.

Настройки сохраняются в `localStorage`; прежний общий mute мигрирует в два
выключенных bus. `AudioContext` не создаётся до пользовательского действия.
Если Web Audio недоступен, UI показывает retry, а матч продолжает работать.

Mute отменяет соответствующие voices. Pause, background, restart и unmount
отменяют pending SFX и/или continuous music согласно lifecycle; скрытая
вкладка suspends context, возвращение создаёт актуальный music state.

## 7. Проверка

Автоматически проверяются:

- полное покрытие `33 + 10`, уникальность профилей и budgets;
- фактические timestamps multi-impact и отсутствие child impacts при fizzle;
- все shield variants/families, damage buckets, material и collapse;
- независимость Music/SFX, нормализация и persistence;
- предел `24`, pause/background/dispose cleanup.

Browser smoke проверяет наличие controls, сохранение настроек, запуск после
gesture, pause/resume и отсутствие runtime errors. Субъективный listening test,
физические iPhone/Android, speakers/headphones/mono и измерение audio callback
нельзя заменять unit-тестом или desktop viewport; недоступный пункт фиксируется
как отдельный release gap без ложного заявления о совместимости.
