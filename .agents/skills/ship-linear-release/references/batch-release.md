# Пакетный выпуск релиза

Читай этот файл при сборке нескольких готовых feature refs в один production
release. Coordinator единолично владеет default branch, Linear, Sites и
release tags.
Workers владеют только своими worktree/branch, реализацией, commit и
`FEATURE_RECEIPT`; они не меняют default branch, Linear, Sites и tags.

## Сформировать batch

1. Восстанови состояние по [протоколу квитанций](receipts.md), закрепи exact
   release, ожидаемый `origin/<default>` SHA, queue fingerprint и `batch_id`.
2. Выбери `FEATURE_RECEIPT` со статусом `ready`: refs существуют, scope
   актуален и dependencies выполнены. Пересечение ownership само по себе не
   исключает feature из batch, но требует последовательной интеграции и
   semantic conflict review. Неразрешимую зависимую либо конфликтующую feature
   отложи, не задерживая независимые.
3. Создай dedicated integration worktree и branch
   `codex/release/<milestone>-<batch>-g<generation>` от ожидаемого default
   branch.
   Никогда не собирай batch в пользовательском либо dirty checkout.
4. В топологическом устойчивом порядке добавляй exact feature SHAs. Перед
   каждым добавлением проверь ref, batch-root ancestry, записанные dependency
   SHAs, scope и конфликт путей. Stacked descendant добавляй только после его
   ancestors. После него выполняй только merge preflight, `git diff --check` и
   affected tests; не запускай полный suite после каждого merge.
5. Если feature не проходит preflight или ломает affected tests, оформи
   `DEFECT_CANDIDATE`, верни её issue в `In Progress` и исключи feature.
   Предпочти пересборку integration branch из того же base без плохого ref;
   если ref уже опубликован в общей истории и нельзя чисто исключить, сделай
   явный issue-scoped revert и проверь его. Остальные совместимые feature
   продолжай выпускать.
6. Если upstream feature исключена либо её receipt superseded, не используй
   downstream refs со старым dependency SHA. Исключи их вместе с upstream или
   дождись новых descendant SHAs и receipts; независимые lanes продолжай.

## Запечатать и проверить candidate

Когда состав перестал меняться, создай новую candidate generation и зафиксируй:

- ordered `issue -> base/dependency SHAs -> feature SHA -> origin ref`;
- `candidate_sha` и source tree OID (`candidate^{tree}`);
- `gate_contract_hash`: hash канонического списка обязательных команд, browser
  flows, viewport/device gates и применимых правил;
- `environment_fingerprint`: hash OS/arch, Node/npm, lockfile digest,
  build/browser runtime versions и иных влияющих на gate параметров.

После sealing не меняй source tree. Любая правка, merge, исключение либо revert
создаёт следующую generation.

Повторно используй успешный integrated gate только при точном совпадении
`source_tree_oid + gate_contract_hash + environment_fingerprint` и наличии
durable evidence. Это переиспользует только validation: exact-SHA CI,
default-branch CAS, Sites deployment и live smoke всегда выполняются для
текущего release.

Для generation без подходящего evidence один раз выполни полный integrated
gate на exact candidate tree: `npm run check`, обязательные проверки из
`AGENTS.md`, batch-wide affected scenarios и browser/device gates. Не запускай
`npm run test:render` после успешного `npm run check`, если текущий script уже
включает тот же build/render gate.

При провале классифицируй причину:

- маленькая локальная ошибка без нового решения — исправь на integration
  branch, выполни affected tests, reseal и повтори полный gate;
- дефект конкретной feature — переоткрой исходную работу, исправь тот же
  feature ref/worktree, замени ref в batch и собери новую generation;
- новый либо cross-feature дефект — coordinator создаёт Linear bug и либо
  исключает/revert-ит виновный scope, либо блокирует batch при обязательной
  зависимости.

Не считай retry доказательством успеха при недетерминированном результате:
необъяснённый flake блокирует candidate.

## Продвинуть exact candidate

1. Fetch-ом потребуй `origin/<default> == expected_default_sha` и fast-forward
   ancestry `expected_default_sha -> candidate_sha`.
2. Push exact candidate в default branch без force. Считай server-side ref
   update CAS: при drift перечитай refs и пересобери/revalidate candidate; не
   переписывай чужую историю.
3. Дождись required CI именно для `candidate_sha`, если required CI настроен.
   Не подменяй его проверкой другого commit с тем же содержимым; отсутствие
   configured CI запиши как `none`.
4. Найди существующие Sites artifacts этого SHA. Если их нет, один раз сохрани
   version из exact validated build и один раз deploy её. Повторный ход
   продолжай по сохранённым opaque IDs, не создавая дубликаты.
5. Дождись terminal `succeeded`, затем выполни cache-busted HTTP и все
   затронутые production flows. Для неаудио-проверок сначала выключи Music и
   SFX.
6. Только после успешного live smoke создай immutable annotated tag
   `vX.Y.Z` на exact `candidate_sha`, проверь его и push без force. Не двигай и
   не переиспользуй release tags. Milestone `0.1` начинает с `v0.1.0`;
   последующие успешные batch этого milestone увеличивают PATCH. Sites version
   number и `package.json` — не product version.
7. Upsert-ни `BATCH_RELEASE_RECEIPT`, затем issue receipts/comments и переведи
   вошедшие issue в `Done`. После свежего release snapshot очисти только
   task-owned worktrees/refs, чьи commits уже достижимы из default branch или
   release tag.

До первого нового deploy определи `previous_stable`. Если tags ещё нет, но
текущий Sites production deployment доказуемо связан с reachable Git SHA и
проходит cache-busted smoke, создай после smoke baseline annotated tag и
используй его Sites version для rollback. Следующий batch получает PATCH+1.
Если доказать связь нельзя, не выдумывай baseline и остановись до deploy за
одним продуктовым решением.

## Провал production smoke

Не создавай tag и не переводи issue в `Done`. Сохрани failed Sites version как
evidence, оформи `DEFECT_CANDIDATE` и redeploy exact saved version из
`previous_stable`. Дождись terminal success и проверь прежний критический flow.

Так как default branch уже содержит failed candidate, не строй новый batch
поверх известного дефекта молча. Примени ту же классификацию: маленький direct
fix, возврат в исходную feature branch или новый Linear Bug; при необходимости
сделай явный whole-batch/issue revert новым commit. Исправление всегда получает
новый commit, candidate generation, Sites version и PATCH. Невиновные feature
можно выпустить отдельным batch; production fail одной feature не удерживает
их без dependency-причины.
