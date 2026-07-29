# Goal card

Читай только при создании нового release-goal. Подставь exact live IDs и
передай objective в `create_goal`. `workers` — параметр исполнения, а не часть
done criteria; сохраняй выбранный режим в run receipt.

```text
Objective: Автономно выпустить все незавершённые issue Linear project
<project_name> (<project_id>) из закреплённого milestone <release_name>
(<release_id>) для <repo> по tracked контракту
<repo>/.agents/skills/ship-linear-release/SKILL.md.

Done when: Два свежих согласованных Linear snapshot exact milestone не содержат
незавершённых issue, кроме Canceled/Duplicate; нет активных WORK_CLAIM,
candidate, CI, deployment или rollback artifacts; каждый production batch
имеет BATCH_RELEASE_RECEIPT, successful live smoke и immutable annotated tag на
exact default-branch SHA; вошедшие issue имеют FEATURE_RECEIPT и Done; ledger указывает
previous stable tag и Sites version.

Verify with: Feature branches проходят targeted gate; каждый sealed candidate
проходит один integrated gate по validation key; default branch обновляется
только fast-forward; доступный pre-push CI проверяет exact candidate до main;
required CI exact default SHA остаётся обязательным; Sites deployment
соответствует exact SHA; production smoke выполняется до tag и Linear Done;
rollback проверяется по сохранённому previous stable receipt. Не дублировать
npm run test:render после npm run check, если check уже включает тот же render
gate.

Constraints: Один coordinator владеет Linear/default branch/Sites/tags. Каждая
issue выполняется свежим worker в отдельном worktree/feature branch. workers=1
по умолчанию; число можно задать параметром или free-form фразой рядом с
вызовом; explicit N — верхняя граница; auto ограничивается runtime slots,
графом независимости и ресурсами. Размер batch не равен числу workers. Не
force-push, не двигать tags, не трогать пользовательский dirty checkout.
Автоматически создавать deduplicated linked Bugs для независимых release
regressions; same-scope возвращать в исходную feature; systemic second
generation выносить на решение пользователю. Contract digest должен быть
tracked до dispatch; смена версии активного run проходит migration checkpoint
с переиспользованием доказанных artifacts. Worker никогда не меняет
default/Linear/Sites/tags. Normal path: один integrated gate на validation key,
один default push, один Sites deploy; receipts обновляются только на
содержательных state transitions, external jobs — bounded polling без
streaming logs.

Blocked when: Тот же внешний доступ, неустранимая неоднозначность или
необходимое продуктовое решение не позволяют продвинуть ни текущий batch, ни
безопасный независимый subset минимум три последовательных goal-хода.
```
