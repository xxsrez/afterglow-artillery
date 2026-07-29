# Протокол issue worker в отдельном worktree

Работай только над issue из переданного manifest. Ты владеешь её
issue-scoped реализацией, тестами, локальной проверкой, commit и push только в
свою feature-ветку в отдельном worktree. Ты не мержишь default branch, не деплоишь
Sites, не ставишь `Done` и по умолчанию не мутируешь Linear. Верни
coordinator-у только `FEATURE_RECEIPT` и при необходимости
`DEFECT_CANDIDATE`. Не создавай subagents.

## Подтвердить входные данные

1. Полностью прочитай текущий `AGENTS.md`, обязательные документы из него,
   этот файл и `references/defect-triage.md`.
2. Прочитай live Linear issue с acceptance criteria, attachments и последними
   comments. Подтверди, что `projectMilestone.id` всё ещё равен pinned release
   ID. Если issue удалена из milestone, стала `Canceled`/`Duplicate` либо уже
   независимо завершена, прекрати новые мутации и верни фактическое состояние.
3. Проверь batch root SHA, `base SHA`, ordered dependency SHAs, intended branch,
   worktree path, queue fingerprint и issue `updatedAt` из manifest. Base может
   быть exact ready head предшественника в stacked lane, но обязан быть rooted
   в batch root. Если worktree не изолирован, ancestry не сходится, база
   неожиданно изменилась или ownership конфликтует с чужими правками, не
   исправляй это разрушительно: верни `STATUS: needs-input`.
4. Подтверди изоляцию worktree:
   - отдельный checkout и branch только для этой issue;
   - отдельные mutable env/cache/tmp/build/port значения, если задача
     поднимает процессы; общий content-addressed dependency cache допустим;
   - никакие временные файлы не должны утекать в root checkout соседних issue.
5. Проверь resume state и существующие issue-scoped branch/commit/ref. Если
   доказанный прогресс уже есть, продолжай с первой незавершённой стадии и не
   дублируй commit.

## Выполнить issue

1. Реализуй последний live scope, сохраняя детерминизм, границы domain и
   presentation, продуктовые ограничения и ownership paths. Если новый scope
   отменяет сделанное, конфликтует с ownership или требует нового
   архитектурного решения, верни `needs-input`.
2. Добавь соразмерные regression-тесты. Для механики используй seeded
   unit/property scenarios; для UI проверь затронутый flow локально в реальном
   браузере, если она затрагивает runtime/UI.
3. Ограничивай собственный контекст: ищи через `rg`, читай только нужные
   диапазоны, не печатай полный diff и длинные логи.
4. Feature gate на точном будущем дереве:
   - узкие тесты затронутой области;
   - один локальный smoke затронутого flow, если применимо;
   - `git diff --check`;
   - `npm run check` только если есть code changes;
   - доступные в текущей среде дополнительные проверки из `AGENTS.md` или
     issue.
5. Не дублируй `npm run test:render` после `npm run check`, если issue явно не
   требует отдельной render-проверки.
6. Исправь и повтори любую доступную упавшую проверку. Для flaky-проверки
   допускается ровно один повтор на неизменённом SHA; если снова нестабильно,
   верни точный gap и не маскируй его успехом.
7. Недоступный physical device, branded browser, listening pass или trace
   запиши как `not-available` gap и продолжай. Не возвращай `needs-input` только
   из-за отсутствия такого automation path и не заявляй эту совместимость
   проверенной. Известный воспроизведённый дефект при этом остаётся fail.

## Commit и branch-ready результат

1. Перед commit ещё раз fetch-ом проверь milestone membership, state,
   `updatedAt` и scope. При изменении перечитай issue и примени правило
   адаптации выше.
2. Stage только issue-scoped файлы. Сделай минимальное число осмысленных
   commits с Linear identifier; release-defect fix добавляй новым commit, не
   переписывая уже опубликованный SHA. Push exact HEAD только в intended
   feature branch и докажи совпадение remote ref.
3. Не мержи никакую ветку, не пушь в default branch, не запускай Sites
   deployment и не переводи issue в `Done`.
4. Сохрани worktree и branch до явного release success coordinator-а. Не
   удаляй worktree как часть своей normal path.
5. По умолчанию не меняй Linear. Если внешний протокол отдельно разрешил
   создать linked bug по `defect-triage.md`, не меняй state исходной issue без
   явной инструкции coordinator-а.

## Дефекты во время работы

Следуй `references/defect-triage.md`.

- same-scope дефект: чини в той же ветке/worktree и отрази в receipt;
- tiny obvious repair: чини в своей ветке только если он feature-local; если
  проявляется лишь в assembled candidate, верни `DEFECT_CANDIDATE` с
  предложением quick fix;
- independent или cross-feature regression: не чини молча в этой ветке без
  отдельного разрешения; верни связанный кандидат с provenance и dedupe-ключом.

Если после сгенерированного fix возник дефект второго поколения или проблема
выглядит системной, сработал recursion guard: остановись и верни
`STATUS: needs-input`.

## Вернуть bounded receipt

Верни coordinator-у только этот формат, суммарно не более 2000 символов:

```text
STATUS: branch-ready | failed | needs-input
ISSUE: <identifier> (<id>)
WORKTREE: <absolute path>
BRANCH: <name>
BASE_SHA: <sha>
DEPENDENCY_SHAS: <ordered refs или none>
HEAD_SHA: <full sha or none>
SCOPE: start=<updatedAt>; final=<updatedAt>; unchanged | adapted
RESUMED_FROM: none | branch | commit | receipt
ORIGIN_REF: <branch=sha or none>
SMOKE: <коротко что локально проверено>
TESTS: <короткий список команд и итогов>
GAPS: <none или точная граница>
DIRTY_REMAINDER: <none или сохранённые paths внутри worktree>
DEFECT_CANDIDATE: <none или короткий summary + defect_signature>
NEXT: <none или один конкретный вопрос/блокер>
```

Не прикладывай diff, полный tool log или длинный stack trace. Если issue не
доведена до branch-ready, не начинай другую issue.
