# Asset Composer — Architecture Roadmap from Deep Research

## Purpose

Этот документ — рабочая выжимка из `D:/Downloads/mp3/deep-research-report (7).md`.

Он нужен, чтобы:

- не потерять архитектурные выводы из исследования;
- не смешивать их с текущим foundation-closeout;
- идти по этапам: сначала закрыть текущую V2 authoring/runtime базу, потом переходить к vector/rig/directional stage.

---

## Rule Zero

Нельзя смешивать в один тип:

- стиль;
- анатомию;
- политику направлений.

Они должны быть независимыми осями модели.

### Canonical axes

- `style`: `cute_farm`, `dark_fantasy`, `cartoon`, `custom`
- `anatomy`: `biped`, `quadruped`, `serpent`, `dragon`, `centaur`
- `facingPolicy`: `profile_mirror`, `directional_4`, `directional_5`, `directional_8`

Ключевой вывод:

- `cute_farm` side-profile и `RPG directional humanoid` не должны жить как один и тот же шаблон с косметическими флагами.
- Нужно вводить разные `rig families`, а не плодить несвязанные top-level templates на каждый ракурс.

---

## Platform Direction

Asset Composer должен эволюционировать в платформу из:

- `rig families`
- `facing policies`
- `view variants`
- встроенного vector/sprite editor
- единого runtime/evaluation/export contract

Не “один humanoid и несколько костылей вокруг него”.

---

## Target Data Model

```ts
type StyleId =
  | "cute_farm"
  | "dark_fantasy"
  | "cartoon"
  | "custom";

type AnatomyFamilyId =
  | "biped"
  | "quadruped"
  | "serpent"
  | "dragon"
  | "centaur";

type FacingPolicy =
  | "profile_mirror"
  | "directional_4"
  | "directional_5"
  | "directional_8";

type ViewKey =
  | "south"
  | "south_east"
  | "east"
  | "north_east"
  | "north"
  | "north_west"
  | "west"
  | "south_west";

interface RigFamily {
  id: string;
  styleId: StyleId;
  anatomy: AnatomyFamilyId;
  facingPolicy: FacingPolicy;
  logicalBones: LogicalBoneContract[];
  slots: SlotContract[];
  constraints: ConstraintContract[];
}

interface Template {
  id: string;
  rigFamilyId: string;
  defaultFacing: ViewKey;
  views: Partial<Record<ViewKey, TemplateView>>;
}
```

### Architectural meaning

- `RigFamily` хранит skeleton contract.
- `Template` хранит конкретную визуальную реализацию family.
- `views` — это не отдельные несвязанные templates, а view-варианты одного logical character.

---

## Canonical Rig Families

### Profile families

- `biped_profile_v1`
- `quadruped_profile_v1`
- `serpent_profile_v1`

### Directional families

- `biped_directional_v1`
- `quadruped_directional_v1`
- `serpent_directional_v1`
- `dragon_directional_v1`
- `centaur_directional_v1`

---

## Facing Strategy

### Profile mode

Использовать для:

- cute-farm content
- side-facing monsters
- дешёвого production loop на раннем этапе

Contract:

- основной нарисованный вид: `east`
- `west` получается через mirror, если part `mirrorSafe`
- asymmetric parts должны поддерживать явный left/right override

### Directional mode

Первый production-safe шаг:

- не `directional_8` сразу
- а `directional_5`

Canonical set:

- `south`
- `south_east`
- `east`
- `north_east`
- `north`

Mirrored when safe:

- `south_west`
- `west`
- `north_west`

---

## Item Contract Direction

Items не должны быть просто SVG-картинками.

Для следующего этапа им нужен явный контракт:

- `compatibleFamilies`
- `targetSlots`
- `coverageByBone`
- `viewVariants`
- `mirrorPolicy`
- `zBands`
- `anchor contracts`

Особенно это важно для:

- hair
- face parts
- beards
- armor
- cloaks
- shields
- weapons
- boots
- greaves
- pants

---

## Built-in Editor Direction

Встроенный редактор должен опираться не на “сырую SVG-строку”, а на внутренний scene/document model:

- stable node ids
- history commands
- reusable components
- variant links across views
- rig binding metadata
- slot metadata
- clip metadata

SVG и ORA должны остаться import/export мостами, а не внутренним source of truth.

---

## Import / Export Direction

Нужно целиться в такой стек:

- internal package/document model
- SVG import/export
- ORA import/export
- spritesheet export
- runtime JSON export
- thumbnails
- batch export by clips/views

Но это только после закрытия foundation-closeout.

---

## Execution Order

### Stage A — Finish current foundation

Источник истины:

- `D:/asset-composer/ASSET_COMPOSER_FOUNDATION_CLOSEOUT_BEFORE_VECTOR_RIG_STAGE.md`

Нужно полностью закрыть:

1. `F001` — Transform history and global shortcuts
2. `F002` — Complete selection-aware Inspector
3. `F003` — Canonical pivot / bounds / aspect-ratio math
4. `F004` — Anchor and ItemFitProfile completion
5. `F005` — Persistent Fabric authoring stability
6. `F006` — Renderer parity: Fabric / Pixi / Preview / Export
7. `F007` — Schema, migration, validation, roundtrip, autosave
8. `F008` — E2E tests and Windows desktop smoke

### Stage B — Introduce architecture for next generation

После закрытия foundation:

1. ввести `RigFamily` + `FacingPolicy` + `Template.views`
2. выпустить `biped_profile_v1`
3. выпустить `quadruped_profile_v1`
4. пройти vertical slice: vector editor -> rig editor -> equip -> animate -> export
5. затем строить `biped_directional_v1`
6. затем view-aware items
7. затем Face Studio
8. затем monster families
9. затем import/export hardening
10. только потом масштабировать контент-библиотеку

---

## Immediate Recommendation

На текущем коде не прыгать сразу в directional RPG.

Следующий правильный путь:

1. добить foundation-closeout без регрессий текущего editor/runtime;
2. зафиксировать новый data contract для `RigFamily` и `Template.views` отдельным milestone;
3. первым production family сделать `biped_profile_v1`, а не directional humanoid.

---

## Risks to Keep Explicit

### 1. Mixed concerns

Самый опасный риск — снова смешать:

- вид
- стиль
- анатомию

### 2. Raw-SVG trap

Нельзя считать SVG внутренним source of truth редактора.

### 3. Divergent transforms

Canvas, Preview, Pixi и Export обязаны использовать один matrix/evaluation contract.

### 4. Weak compatibility contracts

Items без явных compatibility rules снова приведут к ручным багам позиционирования, coverage и z-order.

### 5. Content before architecture

Нельзя массово рисовать новый контент до стабилизации family/view/item architecture.

---

## Project Shell Addendum

Отдельно от research-плана, но важно для продукта:

- нужен явный project menu / home flow;
- пользователь должен уметь:
  - создать проект;
  - открыть существующий проект;
  - сохранить;
  - вернуться в главное меню;
  - продолжить последнюю сессию без скрытого автопрыжка в редактор.

Это должно жить как отдельная продуктовая ветка поверх foundation-closeout, без ломания editor-runtime.
