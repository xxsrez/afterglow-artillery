---
name: ship-linear-release
description: >-
  Start or continue this repository's autonomous Linear release delivery.
  Coordinate one or many isolated issue workers, feature worktrees, batched
  integration, release-defect triage, exact-SHA Sites deployment, production
  smoke, immutable Git tags, rollback, and Linear closure. Interpret worker
  count from nearby free-form language as well as workers=N/auto. Use only
  when the user explicitly invokes $ship-linear-release or asks to run this
  current-release delivery skill. Do not trigger for ordinary issue creation,
  Linear triage, release planning, status reporting, or work on one named issue
  outside the release flow.
---

# Ship Linear Release

Доставляй весь закреплённый Linear milestone автономно: feature worktrees ->
запечатанный batch candidate -> одна полная integrated-проверка -> default
branch (сейчас `main`) -> Sites -> production smoke -> immutable release tag
-> Linear `Done`.

Считай root единственным coordinator. Issue workers реализуют только свои
ветки. Не создавай видимые Codex tasks/threads: используй внутренних subagents.
Перечитывай этот файл в начале каждого goal-хода.

## Понять вызов

Разбирай весь текст текущего сообщения пользователя: указание количества может
стоять до или после `$ship-linear-release`, быть отделено пунктуацией и не
обязано выглядеть как CLI-аргумент.

Поддерживай как минимум:

- `$ship-linear-release` — для нового run один одновременно активный issue
  worker;
- `$ship-linear-release workers=N`, «используй 3 воркера», «запусти с тремя
  воркерами», «пусть работают три агента», «в три потока» — максимум `N`;
- `$ship-linear-release workers=auto`, «используй много/несколько воркеров»,
  «задействуй всех доступных», «возьми максимум», «сам выбери оптимальное
  количество» — режим `auto`;
- «много воркеров, но не больше четырёх» — `auto` с верхней границей `4`;
- `dry-run` — только построить план без Git, Linear и Sites мутаций.

Распознавай положительное целое цифрами или обычными русскими/английскими
словами и формы `worker/воркер/subagent/агент`, если контекст явно означает
параллельных исполнителей этого skill. Не принимай количество issue, batch,
шагов, токенов или версий за число workers.

Нормализуй запрос в `requested_workers`:

```text
новый run без указания         -> 1
явное N                        -> N
auto-фраза без числа           -> auto
auto-фраза + "не больше N"     -> auto(max=N)
resume без нового указания     -> значение из RELEASE_RUN
```

Явное `до/не больше/максимум N` — cap. Если сообщение содержит несколько
несовместимых чисел именно для workers и их нельзя свести к request + cap,
задай один короткий уточняющий вопрос. Ноль и отрицательные значения не
принимай; уточни, не имел ли пользователь в виду `dry-run`.

Текущая free-form просьба может изменить worker limit активного run для
следующих dispatch waves: обнови `RELEASE_RUN.WORKERS`, но не прерывай уже
работающих workers. Не наследуй случайное число из старого сообщения при
создании нового run.

`N` — верхняя граница, а не обещание. Вычисли:

```text
effective_workers = min(
  requested_or_auto_limit,
  доступные runtime slots за вычетом coordinator,
  ширина графа готовых независимых issue,
  безопасный лимит CPU/RAM/ports
)
```

Не спрашивай подтверждение, если безопасное значение меньше запрошенного:
одной строкой сообщи распознанный `requested_workers`, фактический
`effective_workers` и ограничивающий фактор. Число workers не равно размеру
batch. Один worker может последовательно подготовить несколько feature refs,
после чего coordinator выпустит их одним batch.

Явный недвусмысленный запуск без `dry-run` разрешает в пределах закреплённого
release:

- создавать worktrees, feature/integration branches, commits и origin refs;
- менять статусы и idempotent receipts в Linear;
- автоматически создавать deduplicated linked Bug, назначать на `me` и при
  необходимости добавлять его в тот же milestone;
- fast-forward обновлять default branch, сохранять/deploy Sites version,
  выполнять production smoke и создавать новый immutable annotated tag.

Это разрешение не распространяется на продуктовые решения, секреты,
force-push, переписывание истории, другой milestone/project или изменение
внешней инфраструктуры. Пользователь нужен только для настоящего продуктового
выбора, неустранимой неоднозначности или внешнего блокера.

## Ограничить проверки возможностями среды

1. До dispatch и sealing зафиксируй capability boundary текущей среды:
   доступные browser engines, подключённые устройства, automation paths,
   credentials и release-инфраструктуру.
2. В hard gate включай только проверки, которые реально можно выполнить в
   текущей среде. Используй сильнейшие доступные substitutes: unit/property
   tests, Chromium/WebKit browser suites, viewport/geometry snapshots,
   lifecycle/resize scenarios и production smoke.
3. Недоступный физический device, branded browser, listening pass или
   performance trace записывай как `not-available` в `GAPS`. Это не `fail`, не
   `needs-input` и не release blocker, даже если старый текст issue называл
   такую проверку обязательной. Обнови acceptance/receipt под эту policy и не
   заявляй, что недоступная совместимость была проверена.
4. Не ослабляй известный дефект: воспроизведённая пользователем либо доступной
   проверкой проблема остаётся настоящим `fail`. Если physical-device дефект
   обнаружен уже после релиза, переоткрой исходную issue или создай
   deduplicated linked Bug и выпусти исправление следующим batch.
5. Делай недоступную внешнюю проверку hard gate только по новому явному решению
   пользователя остановить релиз до ручного evidence. Само отсутствие
   подключённого устройства или automation path такого решения не создаёт.

## Разделить роли

Coordinator единолично владеет:

- live Linear scope, scheduling, states, claims, Bugs и receipts;
- созданием и удалением task-owned worktrees;
- integration candidate, default branch, Sites, production smoke и tags;
- defect attribution, исключением feature, rollback и release ledger.

Каждый свежий issue worker владеет только:

- одним exact Linear issue;
- одним отдельным worktree и `codex/<identifier>-<slug>` branch;
- issue-scoped кодом, тестами, commit/push своей branch;
- bounded `FEATURE_RECEIPT` и `DEFECT_CANDIDATE`.

Worker не мержит default branch, не деплоит, не тегирует, не ставит `Done` и
по умолчанию не мутирует Linear. Протокол worker:
[issue-worker.md](references/issue-worker.md).

## Выполнить preflight и восстановление

1. Прочитай текущие `AGENTS.md`, `.openai/hosting.json`, Git default branch,
   remotes, status, refs и tags. Не меняй dirty пользовательский checkout.
2. Убедись, что этот skill и его references tracked и доступны из pinned base
   SHA. Если они существуют только как untracked/local files, останови реальный
   запуск до commit: worktree не получит воспроизводимый контракт.
3. При `dry-run` выполняй только read-only путь: можно вызвать `get_goal`,
   разрешить exact project/milestone, прочитать scope/statuses/refs и построить
   dependency/conflict graph, proposed cohort, effective worker count и gate
   plan. Не вызывай `create_goal`, не публикуй coordinator ref/comment, не
   создавай worktree и не делай других мутаций. После плана остановись.
4. Вызови `get_goal` read-only.
   - При активном release-goal используй только pinned IDs из objective.
   - При отсутствии goal разреши exact Linear project/current milestone, но
     пока не создавай новый goal.
   - Активный другой goal не заменяй и не завершай.
5. Восстанови прерванный run и получи свежий scope в порядке из
   [receipts.md](references/receipts.md): remote refs/tags -> exact-SHA CI ->
   Sites -> Linear scope/receipts -> локальные worktrees.
6. Если существующий `RELEASE_RUN` имеет status `complete`, свежий scope пуст и
   нет незавершённых artifacts, верни idempotent `already-complete` без нового
   goal/run. Если старый release-goal по факту ещё active, заверши его только
   после обычной двойной snapshot-проверки done criteria.
7. Если goal отсутствует и работа есть, прочитай
   [goal-card.md](references/goal-card.md) и создай goal без `token_budget`,
   если пользователь явно не задал положительный budget.
8. Используй один `run_id` на pinned release-goal и один durable coordinator
   claim. Публикуй claim через устойчивый remote release-run ref без force и
   соответствующий receipt.
   - Если существующий `RELEASE_RUN` не terminal, resume/observe тот же run; не
     запускай второго coordinator.
   - Если status `complete`, но появились новые незавершённые issue, создай
     новый `run_id` и fast-forward продолжи ledger ref metadata commit-ом.
   - Если active goal fingerprint расходится с active claim, не делай takeover:
     верни `needs-input`.
   Не считай один `In Progress` доказательством ownership.

## Закрепить scope и очередь

1. Разрешай exact project по repo path, remote/product name и live Linear.
   Выбирай только сущность, которую Linear явно считает текущим milestone или
   release. Не хардкодь название/UUID и не переключай активный goal на новый
   milestone.
2. Получи live workflow statuses и labels команды. Используй существующие
   states по их type/name; не создавай новый workflow state ради skill.
3. Если connector release-filter пуст, но scope хранится как milestone, fetch
   issues exact project и фильтруй по `projectMilestone.id`.
4. Получи компактный snapshot всех issue pinned milestone:
   `id/identifier`, milestone ID, title, state, priority, type/labels,
   `createdAt/updatedAt`, dependencies/blockers и board tie-breaker. Полные
   descriptions/comments читай только выбранным issue.
5. Построй fingerprint из отсортированных
   `identifier/state/updatedAt/projectMilestone.id`.
6. Исключай completed/canceled/duplicate states; добавленные и переоткрытые issue
   автоматически попадают в следующий незапечатанный batch.
7. Сортируй готовую очередь:
   `Urgent > High > Medium > Low > No priority`; внутри priority —
   подтверждённый Bug/regression, затем больше разблокируемых issue, старше
   `createdAt`, board position, identifier.

## Спланировать cohort и параллелизм

1. Построй dependency graph и conservative conflict graph по ownership paths,
   затрагиваемым подсистемам, миграциям, generated assets и runtime resources.
   Классифицируй dependency:
   - `code` — downstream можно начать после branch-ready exact SHA
     предшественника в stacked lane того же batch;
   - `release` — downstream требует deployed/Done поведение и идёт только в
     следующем batch;
   - неясную dependency консервативно считай `release`, не выдумывая контракт.
2. Выбери bounded cohort из уже готовых issue. Cohort может быть больше
   `effective_workers`: освобождённый slot получает следующую совместимую
   issue. Не жди будущих задач ради увеличения batch.
3. Держи вместе изменения, для которых общая integrated-проверка экономит
   работу. Отделяй рискованные migrations/architecture changes, несовместимые
   rollout constraints и batch, где marginal integration risk уже выше
   экономии проверки.
4. До dispatch зафиксируй `batch_id`, expected default-branch SHA, queue
   fingerprint, ordered cohort, зависимости и предполагаемые ownership paths.
   Новый ready issue после cutoff идёт в следующий batch.
5. Для каждого issue coordinator:
   - перечитывает full live scope;
   - делает idempotent `WORK_CLAIM`;
   - переводит реально начатую работу в `In Progress`;
   - создаёт worktree от pinned batch root либо exact dependency-base,
     собранного из уже ready ancestor refs;
   - выдаёт отдельные cache/tmp/build/runtime paths и уникальные ports.
6. Переиспользуй content-addressed package-manager cache по toolchain/lockfile,
   но не разделяй между worktrees mutable build output. Не переустанавливай
   зависимости при совпавшем fingerprint и доказанно готовом локальном install.
   Не копируй секреты в Git, receipts или сообщения.
7. Same-path conflict создаёт serial lane: второй issue не dispatch-ится до
   ready receipt первого. Если первый SHA меняет контекст второго, base второго
   должен быть descendant первого и явно записать dependency SHA. Все lanes
   остаются rooted в одном `expected_default_sha`; не подтягивай движущийся
   default branch.
8. Если upstream `FEATURE_RECEIPT` superseded новым descendant SHA, все
   downstream receipts, записавшие старый dependency SHA, временно
   `superseded`. Обнови их branches новым commit/merge через свежих workers и
   перепроверь только affected feature gates. Не force-rewrite опубликованные
   feature refs.

## Запустить issue workers

Заполняй до `effective_workers` slots свежими subagents через
`spawn_agent(agent_type="worker", fork_turns="none")`. Не переиспользуй worker
для другой issue и не разрешай ему собственных subagents.

Если slots временно заняты, сначала дождись/восстанови текущих task-owned
workers. Если subagents недоступны на этой поверхности вообще, coordinator
может последовательно выполнить worker-протокол сам, но только в отдельном
issue worktree и с тем же bounded receipt; не работай в dirty root checkout.

Передай только task-local manifest:

```text
Выполни ровно Linear issue <identifier> (<id>) из project <project_id>,
milestone <release_id>.
Repo: <absolute_repo>. Worktree: <absolute_worktree>. Branch: <branch>.
Batch root SHA: <root_sha>. Base SHA: <sha>.
Dependency SHAs: <ordered refs или none>.
Queue fingerprint: <hash>. Issue updatedAt: <timestamp>.
Ownership paths: <paths>. Isolated env/cache/tmp/ports: <values>.
Resume: <none или exact artifacts>.
Прочитай <worktree>/.agents/skills/ship-linear-release/references/issue-worker.md
и AGENTS.md из worktree. Ты не один: не откатывай и не захватывай чужие
изменения. Не создавай subagents. Верни только bounded receipt.
```

Проверяй receipt без повторения всей работы: exact worktree/branch/HEAD,
origin ref, scope freshness и заявленные checks. `branch-ready` переводи в
существующий `In Review`, если он есть; иначе оставляй в started-state
`In Progress` с ready receipt. Failed issue оставляй незавершённой. Освобождай
slot и продолжай cohort, пока есть готовые задачи.

## Собрать и запечатать batch

После branch-ready receipts следуй
[batch-release.md](references/batch-release.md).

Ключевые инварианты:

1. Собирай batch только в dedicated clean integration worktree от
   `expected_default_sha`.
2. Добавляй exact feature SHAs в топологическом устойчивом порядке. Stacked
   descendant включай только после всех записанных dependency SHAs. После
   каждого merge делай только preflight, `git diff --check` и affected tests —
   не полный suite.
3. Merge-конфликт не разрешай механически. Локальный очевидный конфликт можно
   исправить в candidate; semantic/scope конфликт верни свежему worker в
   исходный feature worktree и supersede receipt.
4. Запечатай поколение: membership, ordered feature SHAs, `candidate_sha`,
   source tree OID, gate contract hash и environment fingerprint.
5. Любая code change, merge, exclusion или revert создаёт новое generation.
   Не вливай default branch бесконечно в каждую feature branch.
6. Один раз выполни полный integrated release gate на exact sealed tree.
   Переиспользуй pass только при совпадении
   `tree OID + gate contract hash + environment fingerprint`.
7. Для этого repo `npm run check` уже включает build и rendered-HTML gate:
   не запускай затем `npm run test:render` без отдельной причины. Добавь
   batch-wide affected browser flows и применимые device/performance checks из
   `AGENTS.md`.

## Обработать найденные дефекты

Используй [defect-triage.md](references/defect-triage.md). Coordinator
deduplicate-ит `defect_signature` и выбирает минимальный корректный путь:

- acceptance scope исходной issue — вернуть её в `In Progress`, исправить в
  той же feature branch/worktree, supersede receipt и reseal;
- tiny obvious integration repair без продуктового выбора — отдельный
  candidate fix commit, affected test, затем reseal;
- новая independent/cross-feature regression — автоматически создать
  связанный Linear Bug с repro, expected/actual, provenance, batch/candidate
  SHA, failing gate, previous stable tag и acceptance criteria; назначить
  `me`, применить существующий label `Bug` и `Regression`, только если такой
  label уже существует;
- release blocker, созданный текущим milestone, включить в тот же milestone и
  поставить впереди очереди; неблокирующий defect оставить в backlog и
  продолжить release;
- systemic либо дефект второго поколения после generated fix — остановить
  автономную рекурсию и запросить архитектурное/продуктовое решение.

При flake один раз повтори exact failing subcommand на неизменённом SHA.
Противоречивый результат без причины — fail/gap, не pass. После code change
запусти affected check и ровно один новый full integrated gate; feature gates
остальных веток не повторяй.

Если виновную feature можно исключить без нарушения dependencies, пересобери
batch без неё и выпусти независимые issue. Серьёзный defect одной feature не
должен автоматически блокировать весь milestone. Исключение upstream
автоматически исключает его stacked descendants из текущего batch.

## Выпустить и тегировать

1. Требуй, чтобы current remote default branch всё ещё равнялась
   `expected_default_sha`, а candidate был её descendant.
2. Push exact candidate в default branch только fast-forward и без любого
   force. При drift создай новое generation на свежем base; переиспользуй
   feature refs, но integrated validation — только при совпавшем validation
   key.
3. Дождись required CI для exact candidate SHA, если required CI настроен.
   Отсутствие configured CI запиши как `none`, не выдумывай check.
4. Сохрани и deploy ровно одну Sites version exact validated SHA. Продолжай по
   найденным opaque IDs после прерывания, не создавай дубликаты.
5. После terminal `succeeded` выполни cache-busted HTTP и затронутые production
   flows. Неаудио smoke начинай с выключенными Music и SFX.
6. Только после успешного production smoke создай и push immutable annotated
   SemVer tag на exact candidate SHA без force:
   - milestone `X.Y` начинает с `vX.Y.0`;
   - следующий успешный batch того же milestone увеличивает PATCH;
   - существующий tag никогда не двигай, не удаляй и не переиспользуй;
   - Sites version number и `package.json` не являются product version.
7. В annotation запиши milestone, batch ID, exact SHA, issue identifiers,
   Sites version/deployment/archive digest, previous stable tag и live smoke.
8. Upsert-ни `BATCH_RELEASE_RECEIPT`; затем обнови issue receipts и переведи
   вошедшие issue в существующий completed-state (`Done`, если так он
   называется). Только теперь удаляй task-owned worktrees/refs, достижимые из
   default branch/tag.

До первого нового deploy установи `previous_stable`. Если stable tags ещё нет,
но текущая Sites production version доказуемо соответствует reachable Git SHA
и проходит smoke, создай после этого smoke baseline annotated tag; новый batch
получит следующий PATCH. Не ставь baseline tag по предположению. Если milestone
нельзя однозначно сопоставить SemVer или текущий production нельзя связать с
rollback artifact, задай один продуктовый вопрос до deploy.

Если post-smoke tag push временно не удался, сохрани exact состояние
`live-awaiting-tag`, не ставь `Done` и idempotently продолжи тот же SHA/tag.

## Откатить неудачный production release

При провале production smoke:

1. не создавай новый stable tag и не ставь issue `Done`;
2. зафиксируй failed deployment/version как evidence;
3. redeploy exact saved Sites version из `previous_stable` receipt;
4. проверь предыдущий критический production flow;
5. создай/верни defect в работу и выпусти исправление новым commit, candidate,
   Sites version и SemVer PATCH.

Не reset/force default branch. Если Git-состояние надо отменить, сделай явный
revert whole batch или issue в новом commit и выпусти его новой версией.

## Делать checkpoint и завершить goal

За один goal-ход доводи один batch до terminal checkpoint: `released`,
`rolled-back`, `needs-input` или доказанного external wait. Не останавливайся
после подготовки одной feature и не проси пользователя запустить следующий
шаг; активный goal продолжает следующий batch автоматически.

Checkpoint должен содержать только:

```text
batch -> issues -> candidate/default SHA -> validation key -> Sites -> live ->
tag/rollback -> defects/gaps -> remaining counts
```

Перед следующим batch получи новый Linear snapshot. Goal заверши только после
двух свежих согласованных snapshots без незавершённых issue pinned milestone,
без активных claims/candidate/deployment artifacts и с полным release ledger.

`update_goal(status="blocked")` используй только после трёх последовательных
goal-ходов с тем же настоящим внешним блокером. Проблема, которую можно
автоматически исправить, исключить, переоткрыть или оформить linked Bug, не
является поводом останавливать пользователя.

Если пользователь просит изменить этот процесс, сначала обнови skill через
`skill-creator`, проверь его и только затем запускай release.
