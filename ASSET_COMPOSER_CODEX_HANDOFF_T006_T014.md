# Asset Composer IDE — Codex Continuation Handoff

## Purpose

Продолжить локальную разработку Asset Composer после остановки Replit Agent.

Документ является рабочим заданием для Codex. Он должен сначала проверить фактическое состояние репозитория, затем последовательно завершить интерактивное редактирование слотов, anchors и bone-local предметов, после чего выровнять Fabric, PixiJS и Export по единому `EvaluatedScene`.

Не расширять библиотеку контента и не добавлять новые крупные функции, пока один тестовый предмет волос не проходит полный цикл:

```text
equip
→ select
→ move
→ scale
→ rotate
→ animate
→ save
→ load
→ export
```

---

# 1. Проверенное состояние репозитория

Архив, на основании которого подготовлено задание:

```text
Deep-Research (3).zip
```

Ветка:

```text
main
```

Проверенный HEAD:

```text
6a0356e57cd6f01758d7824cf12454c394971351
```

Последние важные коммиты:

```text
0b283e9 — Improve asset importing, scene fitting, and attachment persistence
8bd9d8c — Update project audit with architectural corrections
e371fd7 — Improve SVG export and entity visual handling in asset composer
6a0356e — Add new editing modes and improve asset selection functionality
```

Основное приложение:

```text
artifacts/asset-composer
```

Рабочая директория для команд:

```text
Deep-Research
```

---

# 2. Сначала выполнить локальную проверку

Перед изменениями выполнить:

```bash
git status
git branch --show-current
git rev-parse HEAD

corepack enable
pnpm install
pnpm --filter @workspace/asset-composer typecheck
pnpm --filter @workspace/asset-composer build
```

После запуска:

```bash
pnpm --filter @workspace/asset-composer dev
```

Записать в отчёт:

1. текущий commit;
2. изменённые и untracked-файлы;
3. результат typecheck;
4. результат build;
5. ошибки браузерной консоли;
6. существующие failing tests, если они уже есть.

Не начинать рефакторинг, пока не зафиксирован baseline.

---

# 3. Уже созданная архитектура

## 3.1 Runtime и animation clock

Уже существует:

```text
src/core-v2/AnimationController.ts
```

Он является единым RAF-based источником времени.

Не создавать ещё один animation clock.

## 3.2 Domain model v2

В `src/domain/types.ts` уже добавлены либо частично добавлены:

```text
LocalTransform
VectorAssetMetrics
Pivot
EntityVisual
ItemPart
Matrix2D
EvaluatedVisual
CanvasMode
EditorSelection
ItemFitProfile
```

## 3.3 Scene evaluation

В `src/lib/evaluationPipeline.ts` уже существует:

```text
EvaluatedScene.visuals
EvaluatedVisual.worldMatrix
EvaluatedVisual.localBounds
EvaluatedVisual.worldBounds
```

Fabric начал использовать новый путь.

Старый массив:

```text
EvaluatedScene.layers
```

пока ещё остаётся для legacy renderer-ов.

## 3.4 CanvasEngine v3

В `src/engine/canvasEngine.ts` уже есть:

```text
setMode()
reconcileSceneStructure()
updateSceneTransforms()
persistent visual registry
object:moving
object:scaling
object:rotating
object:modified
attachment local-matrix calculation
template slot transform handling
```

## 3.5 Store

В `src/store/index.ts` уже есть:

```text
editor.canvasMode
editor.selection
setCanvasMode()
setEditorSelection()
setAttachmentOverride()
updateTemplateSlotTransform()
```

## 3.6 Import

Уже существует:

```text
src/components/wizard/ImportWizard.tsx
```

И частичная поддержка:

```text
Entity.visuals
Project 1.x → 2.0 migration
resolveTemplate(project, id)
scene fit
```

---

# 4. Подтверждённые незавершённые части

## 4.1 Canvas mode создан, но не подключён

В `CanvasPanel.tsx` импортированы:

```ts
MousePointer2
Move
LayoutGrid
CanvasMode
```

И получены из store:

```ts
const setCanvasMode = useStore(s => s.setCanvasMode);
```

Но нет обязательной синхронизации:

```ts
engineRef.current?.setMode(editor.canvasMode);
```

И нет полноценного toolbar режимов.

Следствие:

```text
CanvasEngine.mode остаётся "select"
```

Режимы:

```text
edit-attachment
edit-template-slots
```

практически недоступны пользователю.

---

## 4.2 Inspector всё ещё использует старую slot-модель

`InspectorPanel.tsx` ориентируется на:

```text
selectedSlotId
Selected Slot
equipped item summary
```

Он не использует полноценно:

```text
editor.selection
```

Нет инспектора для:

```text
item-part
entity-visual
template-slot
anchor
bone
```

Нет редактирования:

```text
X
Y
Rotation
Scale X
Scale Y
Lock Aspect
Flip X
Flip Y
Reset
Bone
Anchor
```

---

## 4.3 Встроенные предметы остаются legacy

`src/data/items.ts` создаёт вещи преимущественно через:

```ts
svgLayers
```

Большинство встроенных предметов не содержит:

```ts
parts
metrics
pivot
localTransform
coordinateMode: "bone_local"
```

В CanvasEngine существует ограничение:

```ts
if (!part || part.coordinateMode === "legacy_full_frame") return;
```

Следствие: существующие волосы, броня и одежда не смогут пройти полноценное интерактивное редактирование даже после включения режима.

---

## 4.4 Anchors объявлены, но не входят в world matrix

В Template уже есть:

```text
anchors
```

В Item уже может быть:

```text
anchorRules
```

В SlotAssignment уже может быть:

```text
attachmentOverride.anchorId
```

Но `evaluateScene()` сейчас формирует матрицу предмета примерно как:

```text
partBoneMatrix
× slotDefaultMatrix
× attachmentOverrideMatrix
× itemPartLocalMatrix
```

В цепочке отсутствует:

```text
anchorMatrix
```

---

## 4.5 ItemFitProfile только типизирован

`ItemFitProfile` объявлен в types, но пока не завершены:

```text
хранение в Item
schema
resolution
Inspector UI
редактирование default fit
```

---

## 4.6 Pivot math требует фиксации

Проверить:

```text
src/lib/matrixUtils.ts
localTransformToMatrix()
```

Каноническое правило:

```text
localMatrix =
T(x, y)
× R(rotation)
× S(scaleX, scaleY)
× T(-pivotX, -pivotY)
```

Точка SVG, находящаяся в `pivot`, после local transform должна оказаться в `(x, y)` родительского пространства.

Нельзя продолжать создание предметов до unit-теста этой формулы.

---

## 4.7 Content bounds учитываются неполностью

Для v2 visual требуется использовать:

```text
visualMinX
visualMinY
visualWidth
visualHeight
```

Нельзя заменять это симметричным rectangle вокруг `(0, 0)`, если реальный content внутри SVG смещён.

Локальные bounds должны быть:

```text
minX = visualMinX
minY = visualMinY
maxX = visualMinX + visualWidth
maxY = visualMinY + visualHeight
```

Затем все четыре угла преобразуются через world matrix.

---

## 4.8 `preserveAspectRatio="none"` остаётся в v2 path

Проверить `scaleSvgToFit()` и `_loadVisual()`.

Новые `bone_local` visuals и item parts нельзя деформировать растягиванием SVG под произвольную ширину и высоту.

Для v2:

```text
сохранять aspect ratio
использовать исходный viewBox
управлять размером только через world matrix
```

Legacy full-frame путь можно оставить временно отдельно.

---

## 4.9 Store имеет типовые проблемы

Проверить обращения:

```ts
visual.name
```

если `EntityVisual` не содержит `name`.

Убрать:

```ts
override as any
```

из `CanvasPanel.tsx`.

`setAttachmentOverride()` должен принимать корректный тип:

```ts
Partial<AttachmentOverride>
```

либо строго нормализованный полный объект.

---

## 4.10 Template slot change не интегрирован с общей history

`updateTemplateSlotTransform()` меняет:

```text
project.templates
```

напрямую.

Текущая history-командная система ориентирована главным образом на:

```text
project.entities
```

Нужно добавить отдельную команду либо расширить history model для Project-level mutations.

---

## 4.11 Custom templates разрешаются не во всех компонентах

Проверить остаточные вызовы:

```ts
getTemplateById(...)
```

В runtime-компонентах использовать:

```ts
resolveTemplate(project, templateId)
```

Минимально проверить:

```text
CanvasPanel
PixiPreviewPanel
TimelinePanel
InspectorPanel
LibraryPanel
StateMachinePanel
ExportDialog
store actions
thumbnail generation
```

---

## 4.12 Renderer parity не завершена

Цель:

```text
Fabric
PixiJS
Export
```

должны использовать один:

```text
EvaluatedVisual.worldMatrix
```

Пока Pixi и frameRenderer могут продолжать читать:

```text
EvaluatedScene.layers
```

Из-за этого одно и то же ItemPart может отображаться по-разному.

---

# 5. Неприкосновенные архитектурные правила

## 5.1 JSON — единственный источник истины

Fabric objects и Pixi display objects не являются проектными данными.

Они только отображают:

```text
Project
→ evaluateSkeleton()
→ evaluateScene()
→ EvaluatedVisual[]
```

## 5.2 Одна система координат

Domain и EvaluatedScene используют:

```text
scene/template units
```

Viewport отвечает только за:

```text
scene → screen
```

ExportProfile отвечает только за:

```text
scene → export pixels
```

Не создавать новые:

```text
frameScale
bonePixelScale
itemScale
rendererScale
```

для логики размещения ассетов.

## 5.3 Один matrix contract

Для нового item part:

```text
entityRootMatrix
× partBoneWorldMatrix
× anchorMatrix
× slotDefaultMatrix
× itemFitProfileMatrix
× attachmentOverrideMatrix
× itemPartLocalMatrix
```

Все renderer-ы получают уже готовую итоговую world matrix.

## 5.4 Редактирование через inverse matrix

При drag/scale/rotate нельзя сохранять Fabric `left/top` напрямую.

Использовать:

```text
editedWorldMatrix
parentResolvedMatrix

newAttachmentMatrix =
inverse(parentResolvedMatrix)
× editedWorldMatrix
× inverse(itemPartLocalMatrix)
```

Затем:

```text
decompose matrix
→ offsetX
→ offsetY
→ rotation
→ scaleX
→ scaleY
```

После повторного `evaluateScene()` предмет должен остаться на том же месте.

## 5.5 Разделить уровни редактирования

### Edit Template Slots

Изменяет:

```text
Template
→ SlotDef
→ defaultTransform
```

Влияет на все сущности шаблона.

### Edit Attachment

Изменяет:

```text
Entity
→ SlotAssignment
→ attachmentOverride
```

Влияет только на конкретный экипированный item.

### Edit Item Fit Profile

Изменяет:

```text
Item
→ fit profile
```

Задаёт стандартную посадку предмета для выбранного Template/family.

Не смешивать эти три уровня.

---

# 6. План реализации

---

# T006 — подключить Canvas modes полностью

## Цель

Пользователь должен явно переключать:

```text
Select
Edit Attachment
Edit Template Slots
```

## Файлы

```text
src/components/panels/CanvasPanel.tsx
src/engine/canvasEngine.ts
src/store/index.ts
src/domain/types.ts
```

## Реализация

Добавить effect:

```ts
useEffect(() => {
  if (!initialized || !engineRef.current) return;
  engineRef.current.setMode(editor.canvasMode);
}, [initialized, editor.canvasMode]);
```

Добавить toolbar над Canvas:

```text
Select
Attachment
Slots
```

Текущий режим должен визуально выделяться.

При выборе режима:

```ts
setCanvasMode("select");
setCanvasMode("edit-attachment");
setCanvasMode("edit-template-slots");
```

При входе в edit-mode:

```text
pause animation
```

или заморозить authoring pose, чтобы объект не двигался под курсором.

## Selection behavior

### Select

- выбор entity visual;
- выбор item part;
- выбор slot без трансформации;
- pan/zoom работают.

### Edit Attachment

- item parts selectable;
- slot gizmos не перехватывают клик по предмету;
- controls видимы;
- drag/scale/rotate сохраняются.

### Edit Template Slots

- slot zones selectable;
- item parts не получают transform controls;
- drag меняет `SlotDef.defaultTransform`.

## Acceptance

1. Режимы видны.
2. CanvasEngine получает новый mode.
3. Режим не сбрасывается после animation tick.
4. ItemPart выбирается в Edit Attachment.
5. Slot выбирается в Edit Template Slots.

## Commit

```text
T006: wire canvas editing modes
```

---

# T007 — Inspector Transform

## Цель

Inspector должен читать:

```text
editor.selection
```

и показывать разные панели для разных selection kinds.

## Файлы

```text
src/components/panels/InspectorPanel.tsx
src/store/index.ts
src/domain/types.ts
src/history/*
```

## Для `item-part`

Показать:

```text
Item
Part
Slot
Bone
Anchor
Offset X
Offset Y
Rotation
Scale X
Scale Y
Lock aspect ratio
Z order
```

Кнопки:

```text
Reset Position
Reset Rotation
Reset Scale
Reset All
Flip X
Flip Y
Edit Default Fit
```

Изменения чисел и Canvas drag должны вызывать один и тот же store action.

## Для `template-slot`

Показать:

```text
Template
Slot
Bone
Default X
Default Y
Rotation
Scale X
Scale Y
Allowed categories
Z index
```

## Для `entity-visual`

Показать:

```text
Bone
X
Y
Rotation
Scale
Pivot
Z index
```

## Типизация

Исправить `setAttachmentOverride()`:

```ts
setAttachmentOverride(
  entityId: string,
  slotId: string,
  patch: Partial<AttachmentOverride>
): void
```

Убрать `as any`.

## Acceptance

1. Клик по волосам показывает item-part Inspector.
2. Числовое изменение X/Y двигает тот же объект.
3. Масштаб из Inspector совпадает с Canvas controls.
4. Reset возвращает только нужную часть transform.
5. Save/Open сохраняет значения.

## Commit

```text
T007: add selection-aware transform inspector
```

---

# T008 — создать один эталонный v2 hair item

## Цель

Не конвертировать сразу всю библиотеку.

Создать один предмет:

```text
hair_test_v2
```

## Файл

Предпочтительно:

```text
src/data/items.v2.fixtures.ts
```

либо отдельный небольшой блок в:

```text
src/data/items.ts
```

## Структура

Предмет должен иметь:

```text
coordinateMode: bone_local
parts: [hair_back, hair_front]
anchorRules.slot_hair.anchorId = hair_top
```

Каждая часть содержит:

```text
boneId
svgData
metrics
pivot
localTransform
zOffset
```

### hair_back

```text
boneId: head
zOffset: -1
```

### hair_front

```text
boneId: head
zOffset: +1
```

## SVG

- viewBox обязателен;
- сохранить aspect ratio;
- использовать palette colors;
- не использовать full-frame overlay;
- визуальные bounds заполнить осознанно.

## Acceptance

1. Предмет появляется около головы.
2. Не перекрывает всё тело.
3. Выбирается кликом.
4. Масштабируется.
5. Следует за head bone.
6. Save/Open не меняет transform.

## Commit

```text
T008: add canonical bone-local hair fixture
```

---

# T009 — подключить anchors к evaluation pipeline

## Цель

Добавить реальную anchor matrix.

## Файлы

```text
src/lib/evaluationPipeline.ts
src/lib/matrixUtils.ts
src/domain/types.ts
src/data/templates.ts
```

## Resolution order

Определить anchor:

```text
1. SlotAssignment.attachmentOverride.anchorId
2. Item.anchorRules[slotId].anchorId
3. SlotDef.defaultAnchorId
4. no anchor
```

Найти anchor в:

```text
template.anchors
```

Проверить, что:

```text
anchor.boneId
```

совместим с item part или явно определить правила cross-bone anchor.

## Matrix

```text
anchorMatrix =
T(offsetX, offsetY)
× R(rotation)
```

Итог:

```text
entityRoot
× partBone
× anchor
× slotDefault
× fitProfile
× attachmentOverride
× itemPartLocal
```

### Важное уточнение

Если anchor относится к `head`, а `part.boneId` также `head`, не применять head world matrix дважды.

Нужно определить единый parent resolved matrix, а не независимо умножать и bone, и anchor bone.

## Validation

Если anchor отсутствует:

- не падать;
- использовать identity;
- показать validation warning в Inspector/console.

## Acceptance

1. Hair использует `hair_top`.
2. Изменение anchor offset сдвигает волосы.
3. Head animation перемещает волосы.
4. Fabric/Pixi/Export получают одинаковую world matrix.

## Commit

```text
T009: resolve anchor transforms in evaluated scene
```

---

# T010 — исправить pivot и content bounds

## Цель

Зафиксировать математику до массовой миграции предметов.

## Файлы

```text
src/lib/matrixUtils.ts
src/lib/sceneUtils.ts
src/lib/svgUtils.ts
src/lib/evaluationPipeline.ts
```

## Pivot unit test

Для:

```text
pivot = (32, 40)
transform position = (10, 20)
rotation = 0
scale = 1
```

после применения local matrix:

```text
transformPoint(matrix, pivot) == (10, 20)
```

Дополнительные тесты:

```text
rotation 90°
scale 2
scaleX -1
non-zero viewBox origin
```

## Content bounds

Использовать:

```text
visualMinX
visualMinY
visualWidth
visualHeight
```

Преобразовать четыре угла.

Не использовать только:

```text
width / 2
height / 2
```

## SVG rendering

Разделить:

```text
legacyFullFrameSvgPath
v2VectorAssetPath
```

В v2 не применять:

```text
preserveAspectRatio="none"
```

## Acceptance

1. Масштаб не деформирует волосы.
2. Pivot остаётся в attachment point.
3. Fit Scene учитывает реальные content bounds.
4. Пустые поля viewBox не смещают визуальный центр.

## Commit

```text
T010: fix vector pivot and content bounds math
```

---

# T011 — завершить persistent Fabric authoring adapter

## Цель

Никакой полной перезагрузки SVG на animation tick.

## Файлы

```text
src/engine/canvasEngine.ts
src/components/panels/CanvasPanel.tsx
```

## Проверить registry

```text
visualId → FabricObject
```

`reconcileSceneStructure()`:

- добавляет отсутствующие объекты;
- удаляет объекты, которых больше нет;
- перезагружает art только при изменении `svgData`;
- сохраняет selection, если visual id сохранился.

`updateSceneTransforms()`:

- обновляет только matrix/position/rotation/scale/z-order;
- не вызывает `canvas.clear()`;
- не вызывает `FabricImage.fromURL()`.

## Transform session

На:

```text
mouse:down / object:moving / object:scaling / object:rotating
```

ставить:

```text
isTransforming = true
```

На:

```text
object:modified / mouse:up
```

- сохранить transform;
- переоценить scene;
- убедиться, что object registry не заменил выбранный объект;
- `isTransforming = false`.

## Hit testing priority

```text
active controls
selected item part
other item parts
anchor
slot
bone
background
```

Slot gizmo не должен закрывать волосы.

## Acceptance

1. Selected Fabric object сохраняет identity во время drag.
2. Drag не обрывается.
3. Animation tick не сбрасывает selection.
4. Нет повторной SVG decode на каждом tick.

## Commit

```text
T011: stabilize persistent Fabric authoring objects
```

---

# T012 — renderer parity

## Цель

Fabric, PixiJS и Export используют:

```text
EvaluatedScene.visuals
```

и только готовую:

```text
EvaluatedVisual.worldMatrix
```

## Файлы

Найти фактические пути:

```text
src/components/panels/PixiPreviewPanel.tsx
src/export/frameRenderer.ts
src/export/export.worker.ts
```

## Pixi

Не вычислять отдельно:

```text
bone transform
slot position
item scale
anchor
pivot
```

Pixi adapter должен только:

1. создать texture;
2. применить world matrix;
3. применить z-index;
4. применить opacity/visibility.

## Export

Каждый кадр:

```ts
const pose = evaluateClip(...);
const skeleton = evaluateSkeleton(...);
const scene = evaluateScene(...);
renderEvaluatedVisuals(scene.visuals);
```

## Legacy layers

После перевода renderer-ов:

- оставить `layers` только для миграции на ограниченный срок;
- добавить TODO с удалением;
- новые пути не должны обращаться к `layers`.

## Tests

Для одного visual сравнить matrix components:

```text
a
b
c
d
tx
ty
```

в:

```text
scene
Fabric adapter input
Pixi adapter input
Export renderer input
```

## Acceptance

1. Hair имеет одинаковое положение во всех трёх renderer-ах.
2. Animated head даёт одинаковое движение.
3. Exported frame визуально совпадает с preview.
4. Animated export содержит разные frame hashes.

## Commit

```text
T012: unify Fabric Pixi and export visual matrices
```

---

# T013 — schema, migration и roundtrip

## Цель

Новые данные не теряются.

## Проверить schema-файлы

Найти текущие Zod schemas и добавить:

```text
EntityVisual
ItemPart
VectorAssetMetrics
Pivot
LocalTransform
coordinateMode
ItemFitProfile
SlotDef.defaultTransform
Template.anchors
Template.boneParts
```

## Import order

```text
JSON.parse
→ detectProjectVersion
→ migrateProjectV1ToV2
→ ProjectV2Schema.safeParse
→ cross-reference validation
→ loadProject
```

Не валидировать старый raw-файл неполной v2 schema до миграции.

## Unknown fields

Для development:

```text
.strict()
```

либо обоснованный:

```text
.passthrough()
```

Нельзя молча удалять поля.

## Roundtrip test

```text
save A
→ load A
→ save B
→ deep compare normalized A/B
```

Обязательно сохранить:

```text
boneParts
entity.visuals
item.parts
metrics
pivots
transforms
anchors
fit profiles
attachment overrides
```

## Исправить store

Убрать использование:

```ts
visual.name
```

если поле не добавляется в domain type.

Либо добавить `name` в `EntityVisual` и schema сознательно.

## Acceptance

1. v1 JSON мигрирует.
2. v2 JSON не теряет поля.
3. Hair transform сохраняется.
4. Custom Template используется после reopen.
5. Invalid references выдают понятный отчёт.

## Commit

```text
T013: complete v2 schema migration and roundtrip safety
```

---

# T014 — tests, smoke workflow и desktop build

## Unit tests

Добавить Vitest, если инфраструктуры ещё нет.

Минимум:

```text
localTransform pivot contract
matrix invert/multiply roundtrip
decompose/compose roundtrip
anchor resolution
attachment edit preserves world matrix
scene bounds use visualMinX/visualMinY
slot default transform
v1 → v2 migration
v2 save/load roundtrip
renderer adapter matrix parity
```

## Browser/UI tests

Добавить Playwright либо существующий UI test framework.

Workflow:

```text
1. Open app.
2. Create humanoid top-down.
3. Select Hair slot.
4. Equip hair_test_v2.
5. Switch Edit Attachment.
6. Click actual hair.
7. Drag hair.
8. Scale uniformly.
9. Rotate.
10. Play animation.
11. Verify hair follows head.
12. Pause.
13. Switch tab.
14. Return.
15. Verify transform persists.
16. Save project.
17. Reload project.
18. Verify transform persists.
19. Export.
20. Verify output exists and frames differ for animated clip.
```

## Desktop smoke

```bash
pnpm --filter @workspace/asset-composer package:win
```

Проверить:

```text
artifacts/asset-composer/dist/desktop/
```

Подтвердить наличие реального:

```text
.exe installer
или portable .exe
```

Не считать desktop готовым только по наличию electron-builder config.

## Commit

```text
T014: add v2 editing regression tests and desktop smoke
```

---

# 7. ItemFitProfile — делать после работающего hair vertical slice

Не блокировать T006–T012 сложной универсальной системой профилей.

После того как `hair_test_v2` работает, завершить:

```ts
interface ItemFitProfile {
  templateId: string;
  skeletonFamily?: string;
  slotId: string;
  partTransforms: Record<string, LocalTransform>;
}
```

Resolution:

```text
entity attachmentOverride
→ exact template fit profile
→ skeleton family fit profile
→ ItemPart.localTransform
```

UI:

```text
Edit Default Fit
Save Fit For This Template
Reset To Item Default
```

---

# 8. Миграция встроенной библиотеки

Не конвертировать всё одной огромной задачей.

Порядок:

```text
1. hair
2. helmet
3. torso armor
4. boots
5. gloves
6. pants
7. weapons
8. cloaks
```

Для многокостных предметов:

```text
boots:
  boot_l → foot_l
  boot_r → foot_r

pants:
  waist → pelvis
  thigh_l → hip_l
  shin_l → knee_l
  thigh_r → hip_r
  shin_r → knee_r

armor:
  chest → chest
  shoulder_l → shoulder_l
  shoulder_r → shoulder_r
```

Не прикреплять цельные штаны только к pelvis, если ноги должны анимироваться независимо.

---

# 9. Запрещённые временные исправления

Не делать:

1. Случайные `+84`, `-37`, `scale *= 0.43`.
2. Отдельные offsets для Fabric, Pixi и Export.
3. Растягивание 64×64 item SVG на полный персонаж.
4. Новые предметы только через `svgLayers`.
5. `boneId: null` для новых item parts.
6. Сохранение Fabric `left/top` как domain coordinates.
7. `canvas.clear()` на animation tick.
8. Повторную SVG decode каждый кадр.
9. Смешение Template Slot и Attachment Override.
10. Автоматический Fit после каждого render.
11. Молчаливое удаление JSON-полей.
12. Объявление этапа готовым только потому, что UI-кнопка появилась.

---

# 10. Definition of Done для текущего milestone

Milestone завершён только когда один `hair_test_v2` проходит всё:

```text
[ ] Hair появляется возле головы.
[ ] Hair не перекрывает всё тело.
[ ] Hair выбирается кликом по самой графике.
[ ] Slot behind hair не перехватывает click.
[ ] Edit Attachment включается из Canvas toolbar.
[ ] Drag сохраняет offset.
[ ] Corner scale сохраняет пропорции.
[ ] Rotation сохраняется.
[ ] Flip X работает.
[ ] Reset работает.
[ ] Hair следует за head bone.
[ ] Animation tick не сбрасывает selection.
[ ] Switching tabs не сбрасывает transform.
[ ] Save/Open сохраняет transform.
[ ] Fabric показывает правильное положение.
[ ] Pixi показывает то же положение.
[ ] Export показывает то же положение.
[ ] v1 migration продолжает работать.
[ ] v2 roundtrip не теряет поля.
[ ] Typecheck проходит.
[ ] Build проходит.
[ ] Tests проходят.
```

---

# 11. Формат отчёта Codex после каждого T-задачи

После каждой задачи предоставить:

```text
TASK:
COMMIT:
STATUS:

Что было сломано:
Почему:
Изменённые файлы:
Новая цепочка данных:
Добавленные тесты:
Результат typecheck:
Результат build:
Результат tests:
Как проверить вручную:
Известные ограничения:
Следующая задача:
```

Не объединять T006–T014 в один гигантский commit.

---

# 12. Первая команда для Codex

Начни так:

```text
Прочитай этот документ полностью. Не начинай с переписывания архитектуры.

1. Проверь git status, HEAD, typecheck и build.
2. Сверь перечисленное состояние с фактическим кодом.
3. Покажи короткий baseline audit.
4. Затем выполни только T006.
5. Запусти typecheck и build.
6. Создай отдельный commit.
7. После отчёта переходи к T007.

Не добавляй новый массовый контент, пока hair_test_v2 не пройдёт Definition of Done.
```
