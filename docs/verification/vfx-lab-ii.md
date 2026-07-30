# Проверка VFX Lab II

- **Статус:** локальная browser-проверка; physical-device gaps открыты
- **Дата:** 2026-07-30
- **Режим:** Infinite Arsenal / VFX Lab II
- **Viewport gallery:** `960×540`, Full, music/SFX muted
- **Mobile smoke:** Chromium, `844×390`, music/SFX muted

## Воспроизводимые материалы

[Contact sheet](vfx-lab-ii-contact-sheet.png) фиксирует climax всех десяти
прототипов в одном production-server browser session. Capture выполняется
командой ниже при уже запущенном production server:

```bash
VFX_LAB_BASE_URL=http://127.0.0.1:5188 npm run gallery:vfx-lab-ii
```

Скрипт начинает матч с выключенными music/SFX, выбирает каждый VFX Lab II item,
снимает Canvas около `t=1100 ms`, собирает contact sheet и записывает
`vfx-lab-ii-browser-telemetry.json`. JSON является измерением Playwright
Chromium на текущем macOS host, а не phone performance trace. Setup, selection
и screenshot capture pauses включены в sampled session, поэтому результат нельзя
экстраполировать на устройство или использовать как доказательство 30/60 fps.

Текущий capture `2026-07-30T09:46:52.601Z` содержит `4112` RAF intervals:
`p50 = 8.3 ms`, `p95 = 9.3 ms`, интервалов больше `50 ms` — `0`. Это
воспроизводимый host-browser факт из JSON, не performance target и не
device-compatibility claim.

## Автоматические инварианты

`tests/vfx-lab-ii.test.ts` проверяет:

- canonical 33 и исходные 10 Ultimates не меняются; VFX Lab II содержит ровно
  10 новых IDs, общий Experimental Showcase — 20;
- 10 новых presentation classes уникальны, mechanics-independent и вместе
  используют все пять draw stages;
- Full climax bounds покрывают не меньше 70% viewport;
- Full/Balanced/Reduced budgets ограничены, Reduced не использует
  capture/offscreen pixels/particles/distortion/parallax/shake;
- accessibility ограничивает flash/pulse и запрещает saturated-red fullscreen
  flash;
- seed повторяет event log, terrain и tanks, а local crater/damage не выходят
  за declared radius `18–30 ≤ 34`;
- visual tier не меняет mechanical outcome.

`tests/mobile/vfx-lab-ii.spec.ts` проигрывает все десять items в одном
Chromium mobile session, прикладывает anticipation, climax и aftermath,
проверяет возврат action rail, отсутствие browser errors и отсутствие роста
числа Canvas elements. Отдельные browser attachments являются test output и
не входят в production bundle.

## Что считать доказанным

- Доказано автоматикой: registry counts, stage/quality/accessibility contract,
  local mechanics, deterministic replay и presentation resource lifecycle на
  покрытом Chromium session.
- Доказано визуальным review локального contact sheet: десять кульминаций
  используют разные крупные композиции; mechanic contour остаётся локальным.
- Не проверено: physical phone touch flow, branded Safari/WebKit pass,
  физически слышимый mix, средний Android frame-time/device trace, texture/
  memory trace и production deployment. Эти пункты имеют статус
  `not-available`, а не `verified`.

Selection/cleanup исходных материалов остаётся отдельным owner review.
Текущий VFX Lab II использует только процедурную графику из repository source
и не содержит внешних visual assets.
