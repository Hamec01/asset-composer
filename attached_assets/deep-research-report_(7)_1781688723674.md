# Концепт и промт для полнофункционального векторного редактора игровой графики

## К чему должен прийти продукт

По вашему описанию нужен не просто «векторный редактор», а **модульная графическая IDE для 2D-игр**, где пользователь собирает персонажей, монстров, животных, одежду, оружие и статичные объекты из готовых шаблонов, меняет стили, сразу смотрит анимацию и выгружает результат в игровые форматы. Это ближе не к обычному SVG-редактору, а к смеси **character builder + item editor + animation authoring tool + sprite exporter**. Именно такую ценность показывают уже существующие продукты: референсный Character Editor [Megapack] у Hippo продаётся не как «рисовалка», а как конструктор персонажей с телом, экипировкой, цветами, выражениями лица, разделением анимации верх/низ тела, сохранением в JSON и генерацией sprite sheet; Spine показывает, что для массовой кастомизации нужны кости, слоты, attachments и skins; Rive показывает важность общей связки «редактор + формат + runtime + state machine». citeturn11view0turn13view0turn13view1turn16view0turn15view3

Ваш референс из Unity полезен как рыночная проверка идеи. На странице Unity Asset Store видно, что Character Editor [Megapack] остаётся актуальным продуктом: это Extension Asset, совместимый с Unity 2022.3.62, с версией 8.7 и датой обновления **14 мая 2026 года**. На официальной странице Hippo дополнительно заявлены встроенный редактор, большая коллекция спрайтов, смена частей тела и экипировки, изменение цветов, выражения лица, анимация верхней и нижней частей тела, сохранение/загрузка в prefab и JSON, а также использование web-версии для сборки персонажей и сохранения sprite sheet с анимациями. Это очень близко к вашему запросу, но с важным отличием: вам нужен не только человекоподобный редактор, а единая система и для тёмного фэнтези, и для боковой фермы, то есть с несколькими типами шаблонов и проекций. citeturn2view0turn11view0turn3search2

Ссылка на Magnific тоже показательна: там есть выдача по векторным персонажам, фильтры по лицензии, пометка AI-generated, типы файлов и стили. Это важно не потому, что Magnific сам решает задачу редактора, а потому, что ваш будущий продукт может выиграть от встроенного понятия **библиотеки заготовок и ассоциированных лицензий**: пользователь должен видеть не просто «часть брони», а её источник, разрешения на использование, стиль и совместимость с базовым телом/скелетом. citeturn10view0

## Что стоит взять из существующих решений

Из референса Hippo сто́ит взять саму продуктовую логику: **готовое голое тело как база**, поверх которой надеваются части экипировки; модульные body parts; color overrides; face expressions; раздельная анимация верхней и нижней части тела; сохранение в JSON; выгрузка sprite sheet; web-режим для неспециалистов. Это прямое подтверждение того, что пользователям нужен быстрый production pipeline, а не пустой холст. Для вас это нужно расширить от «human characters» до набора семейств: humanoid top-down, humanoid side-view, quadruped side-view, monster rig, bird rig, siege/static-object rig. citeturn11view0turn3search2

Из Spine нужно взять **архитектурные примитивы**, а не обязательно сам продукт. В официальной документации Spine attachments привязываются не прямо к bone, а через **slot**, и slot управляет тем, какой attachment сейчас видим; skins используются для переиспользования одного и того же skeleton/animation с разными визуальными наборами; JSON-экспорт описывает bones, slots, skins, attachments и animations; при этом сами разработчики Spine прямо пишут, что писать runtime с нуля — это «enormous amount of work». Это очень важный практический вывод: ваш первый релиз не должен пытаться стать «новым Spine во всём», а должен использовать **Spine-подобную модель данных** внутри, но экспортировать прежде всего в доступные форматы — JSON проекта, SVG частей и raster sprite sheets. citeturn13view0turn13view1turn15view0turn15view1

Из Unity 2D Animation и Sprite Library стоит взять идею **Category / Label / Variant**. Официальная документация Unity объясняет, что Category нужна для группировки похожих спрайтов вроде Hats, Labels ссылаются на конкретные спрайты, а inherited categories и overrides позволяют создавать вариации поверх базовой библиотеки. Это почти идеально ложится на вашу задачу: один базовый туловищный шаблон, поверх него расовые варианты; одна категория Boots, внутри которой метки совместимости по расе, стилю, полу, скелету и проекции; одна категория TorsoIdle, внутри — пресеты анимаций. citeturn13view2

Из Rive нужно взять **компоненты и state machines**. В Rive state machines — это визуальный способ связывать анимации и логику переходов, а Components появились именно как способ явно отмечать, что является переиспользуемым и должно попадать в runtime. Для вашего редактора это чрезвычайно полезно: голова, торс, рука, плащ, лук, колчан, седло, хвост, шлем, фермерская рубашка — всё это должно быть компонентами/instances, а логика вроде `idle -> walk -> attack -> hit -> die` должна жить в state-machine-редакторе, а не только в таймлайне. citeturn16view0turn17view0turn13view6

Live2D Cubism здесь полезен скорее как отрицательный ориентир. Его официальный pipeline экспортирует `.moc3`, `.model3.json`, texture, а при необходимости ещё `.physics3.json`, `.motionsync3.json`, `.userdata3.json`, `.cdi3.json`. Это хороший путь для «живой куклы» с деформациями, но для вашего сценария — массовая экипировка, десятки предметных слотов, монстры, животные, side-view и игровые sprite sheets — такой путь будет заметно тяжелее и менее универсален, чем открытая модульная схема с проектным JSON и растровым экспортом кадров. citeturn13view7

## Рекомендуемая архитектура

Так как вы пишете на TypeScript, наиболее практичный путь — сделать продукт как **TypeScript-first desktop/web app**. Если нужна современная кроссплатформенная упаковка без отказа от веб-стека, Tauri официально поддерживает любой frontend framework и сборку из одной кодовой базы под Linux, macOS, Windows, Android и iOS; если вы хотите максимально «чистый JS/TS» стек без Rust в ядре, Electron официально позволяет делать кроссплатформенные desktop apps на JavaScript, HTML и CSS, встраивая Chromium и Node.js. Для вашего случая основной рекомендацией выглядит **Tauri + TypeScript frontend**, а Electron — как запасной путь, если захотите быстрее стартовать без Rust-модуля упаковки/рендера. citeturn13view8turn8search1turn8search3

В качестве редакторского canvas-слоя я бы ориентировался на **Fabric.js как authoring surface**, а не как единственный источник истины. В официальной документации Fabric.js прямо указано, что Canvas умеет object interactions, reorder stack, render, serialize/deserialize state и **export в JSON, SVG или image**; также Fabric поддерживает shapes, path, polygon, image, text, gradients, shadows и image filters. Для вашей задачи это означает, что редактор может опираться на зрелую интерактивную 2D-сцену вместо написания базового выбор/drag/rotate/resize-движка с нуля. citeturn13view3turn12search1turn12search4

Но хранить проект как «сырое состояние холста» нельзя. Документация Konva очень хорошо объясняет проблему: сериализация целого canvas tree через `toJSON()` годится только для очень маленьких приложений; в больших приложениях event listeners, filters, images и визуальный мусор плохо сериализуются, а сохранять нужно **доменное состояние**, а не объектный граф отрисовки. Это ключевое архитектурное решение для вашего редактора: **каноническое состояние проекта должно быть собственным проектным JSON**, а Fabric/Konva-подобная сцена — лишь визуальным представлением этого состояния. citeturn13view4

Геометрию частей лучше хранить в терминах **SVG path / compound path / group / transform / anchor / clipping**, а не в произвольных проприетарных примитивах. W3C описывает `path` как базовый SVG-элемент для линий, кривых, дуг, compound paths, клиппинга и даже анимационных сценариев; path data при этом компактна и предназначена для эффективной передачи и хранения. Для вашего продукта это даёт важное преимущество: одна и та же база головы, руки, сапога или кольца может жить и как редактируемый векторный объект, и как источник SVG-экспорта, и как вход для растеризации в sprite sheet. citeturn14view0

Для окна предпросмотра и экспортного playback-режима полезно добавить runtime-панель, которая умеет проигрывать экспортируемые atlas/spritesheet-наборы. PixiJS официально описывает spritesheet как комбинацию одной общей картинки и JSON, где хранятся координаты кадров; такой формат нужен для уменьшения числа запросов и эффективной отрисовки. Значит, ваш редактор может иметь два режима runtime-preview: **векторный preview внутри IDE** и **игровой preview по экспортированному atlas JSON + PNG/WebP**, чтобы пользователь видел именно то, что потом поедет в игру. citeturn13view5turn5search0

## Модель данных и форматы экспорта

Я бы закладывал проектную модель как **многоуровневый доменный JSON**, а не как единый dump сцены. На верхнем уровне должны быть: `project`, `assetLibrary`, `templates`, `skeletons`, `attachments`, `items`, `animations`, `styleSets`, `exportProfiles`, `licenseMeta`. Это согласуется и с практиками Spine, где JSON разделяет bones, slots, skins, attachments и animations, и с Unity Sprite Library, где Categories и Labels формируют логические наборы вариантов. citeturn15view0turn13view2

Ключевая сущность — не «нарисованная картинка», а **template-based entity**. Например, `humanoid.darkfantasy.base_male_a` — это голое тело со skeleton family, bones, slot map и anchors; поверх него надеваются `boots.leather_01`, `armor.torso_chain_03`, `ring.bronze_02`, `weapon.longbow_04`, `cloak.ragged_01`. Совместимость задаётся не вручную пользователем каждый раз, а через `skeletonFamily`, `species`, `viewProfile`, `fitProfile`, `allowedSlots`, `layerPriority`, `occlusionRules`. По сути это объединяет Spine-подобные slots/attachments/skins с Unity-подобными categories/labels/variants. citeturn13view0turn13view1turn13view2

Ниже — пример того, как должен выглядеть **источник истины** для одного персонажа:

```json
{
  "projectVersion": "1.0",
  "entityType": "character",
  "id": "npc_dark_knight_001",
  "template": {
    "baseBody": "humanoid.topdown.male.base_a",
    "skeletonFamily": "humanoid_topdown_v1",
    "viewProfile": "isometric_34",
    "species": ["human"],
    "styleSet": "dark_fantasy_ink_01"
  },
  "palette": {
    "skin": "#C89A7B",
    "hair": "#2B1D18",
    "primaryCloth": "#3C3A46",
    "secondaryCloth": "#746A5E",
    "metal": "#8E8A80"
  },
  "slots": {
    "head": "hair.long_03",
    "face": "eyes.tired_02",
    "torso": "armor.leather_05",
    "hands": "gloves.dark_02",
    "feet": "boots.hunter_03",
    "weapon_main": "weapon.sword_broadsword_01",
    "ring_left": "ring.bronze_02"
  },
  "attachments": {
    "weapon_main": {
      "anchor": "hand_r_weapon",
      "bindMode": "follow_slot"
    }
  },
  "animations": {
    "idle_torso": "idle_torso_07",
    "idle_full": "idle_full_02",
    "walk": "walk_01",
    "attack_slash": "attack_03"
  },
  "export": {
    "frameSize": 128,
    "format": ["project_json", "entity_json", "png_sheet", "webp_sheet", "svg_parts"],
    "pivotPolicy": "per_animation",
    "atlasMode": "hash_json"
  }
}
```

Экспорт у продукта должен быть **двухконтурным**. Первый контур — исходники для дальнейшего редактирования: `project.json`, `template.json`, `item.json`, `animation.json`, отдельные SVG-части, palette/style packs. Второй контур — игровые артефакты: `spritesheet.png`, `spritesheet.webp`, `atlas.json`, image sequences, preview GIF/MP4 только как вторичный convenience export. Такой подход хорошо сочетается с тем, что Fabric умеет JSON/SVG/image export, а PixiJS и аналогичные runtime-system’ы работают с image + JSON atlas. citeturn13view3turn12search1turn13view5

Если вы хотите экспорт «сразу проигрывать анимацию», есть два реалистичных пути. Первый — **внутренний runtime** приложения, который читает ваш `entity.json` и проигрывает bones/slots/state machine прямо в IDE. Второй — **экспорт в raster atlas и metadata JSON**, который легко использовать в игре. Практически правильнее делать оба, но поставить в приоритет второй: даже Spine, у которого mature runtime, подчёркивает, что собственный runtime с нуля — это очень тяжёлая задача; а вот JSON и image export у него являются стандартными сценариями. citeturn15view0turn15view1

Отдельно рекомендую сразу ввести в проектную модель **лицензионные поля**: `source`, `author`, `licenseType`, `purchaseRef`, `derivativePolicy`, `aiGenerated`, `commercialUseAllowed`. Это не бюрократия, а защита от будущих проблем, потому что в Magnific уже есть фильтры лицензии и AI-generated, а на Unity Asset Store каждая поставка завязана на EULA и license type. Если редактор позволит импортировать сторонние части, эти данные надо хранить так же строго, как и путь до SVG. citeturn10view0turn2view0

## Какие редакторы и подсистемы реально нужны

Главный модуль должен называться не просто Editor, а **Asset Composer**. В нём пользователь выбирает семейство шаблона: человек для изометрии, человек для боковика, волк, корова, лошадь, свинья, паук, демон, скелет, катапульта, бочка, сундук, дерево. После выбора загружается не пустой холст, а **готовая параметрическая заготовка**: торс, голова, руки, ноги, кости, anchors, z-layer rules, базовые материалы, palette slots и комплект преднастроенных анимационных состояний. Именно это и делает продукт полезным для людей, которые плохо рисуют и не хотят кодить. Логика reuse здесь должна следовать подходу Rive Components и Unity Categories/Variants: шаблоны должны быть библиотечными единицами с явной переиспользуемостью, наследованием и overrides. citeturn17view0turn13view2turn15view3

Второй обязательный модуль — **Item Forge**, то есть редактор предметов. Он должен собирать всё, что вы перечислили: сапоги, штаны, ремни, туники, броню, плащи, шлемы, амулеты, кольца, перчатки, щиты, мечи, луки, арбалеты, пики, посохи, катапульты, фермерские инструменты, седла и статичные декоративные объекты. Формально это тот же векторный редактор, но поверх доменной модели предметов: предмет знает, к каким слотам он подходит, к каким skeleton family применим, какие anchors использует, нужна ли ему собственная анимация и какие palette channels можно перекрашивать. Для некоторых типов, например оружия и катапульт, объект должен поддерживать собственные animated subparts. Логика привязки здесь хорошо описывается Spine-моделью через slots/attachments. citeturn13view0turn15view0

Третий модуль — **Animation IDE**. Здесь нужен не просто timeline, а комбинация из timeline + state machine + preset library. Для вашего кейса я бы заложил минимум такие классы пресетов для персонажей: `idle_full`, `idle_torso`, `walk`, `run`, `attack_melee`, `attack_ranged`, `cast`, `block`, `hurt`, `stagger`, `death`, `sit`, `farm_work`, `carry`, `interact`; отдельно для торса вы просили около 15 idle-вариантов, и это правильная идея — лучше иметь библиотеку preset-idle с разной амплитудой, дыханием, углом плеч, напряжением кистей, переключаемыми микродвижениями головы и плаща. Для логики переходов сюда очень естественно ложится Rive-подход со state machines, states и transitions. citeturn16view0

Четвёртый модуль — **Creature and Mount Editor**. Это критично, потому что если редактор останется только гуманоидным, он не покроет ни тёмное фэнтези, ни ферму. Здесь нужно сразу поддержать как минимум семейства `quadruped_side_v1`, `bird_side_v1`, `serpent_v1`, `spider_v1`, `humanoid_monster_v1`, `siege_machine_v1`. Для животных и монстров важнее не свободное рисование, а наличие **готовых rig-шаблонов** и attachment points: `mouth`, `horn_l`, `horn_r`, `saddle`, `pack_left`, `pack_right`, `tail_tip`, `back_shell`, `wing_l`, `wing_r`. Тогда один и тот же Item Forge начинает работать не только с человеком, но и с волком, быком, драконом или телегой. Это уже не просто косметическая фича, а системное требование продукта. citeturn13view0turn17view0

Пятый модуль — **StyleSet and Theme System**. Вам нужны две игры с радикально разным визуальным характером: одна — тёмное фэнтези, другая — детская ферма. Значит, один и тот же базовый скелет и набор шаблонов должен уметь переключаться между style packs: толщина контура, кривизна форм, насыщенность, тени, форма глаз, материал металла, искажение пропорций, пастельность/грязность палитры. На уровне данных это должны быть не «случайные перекраски», а отдельные style presets, которые переопределяют palette tokens, stroke presets, brush profile и, при необходимости, подменяют некоторые library components через mechanism наподобие Unity variants/inherited categories. citeturn13view2turn17view0

И шестой модуль — **Export Studio**. Он должен позволять выбрать профиль вывода: `32x32`, `48x48`, `64x64`, `96x96`, `128x128`, `256x256`, `512x512`; режимы `single sprite`, `sheet`, `atlas`, `animation strip`, `svg part pack`, `json package`; pivot policy; outline padding; downscale rules; antialiasing policy; shadow bake; palette bake; frame naming; naming templates; пакетный экспорт нескольких сущностей. С точки зрения движков это особенно важно, потому что PixiJS и похожие runtime system’ы ждут atlas + JSON, а игровые команды обычно хотят воспроизводимую массовую публикацию, а не ручной экспорт по одному объекту. citeturn13view5turn15view1

## Реалистичная стратегия реализации

Самая большая ошибка здесь — пытаться в первой версии сделать «универсальный редактор всего на свете» и одновременно собственный production runtime уровня Spine или Rive. Официальные материалы Spine и Rive как раз показывают, насколько ценен связанный pipeline «editor + format + runtime», но Spine отдельно предупреждает, что runtime с нуля — огромная работа. Поэтому первая версия должна быть жёстко сфокусирована: **authoring IDE + project JSON + spritesheet/atlas export + встроенный preview player**. Этого уже достаточно, чтобы редактор был полезен и вам, и другим пользователям. citeturn15view0turn15view3turn13view6

Я бы разделил разработку по зрелости, а не по абстрактным модулям. В первой волне нужно закрыть одного «героя» продукта: например, humanoid top-down/isometric с голым телом, одеждой, оружием, 15 torso idle, walk/run/attack/hit/death, JSON проекта и экспортом sheet/atlas. Во второй волне — item editor и массовые пресеты экипировки, потом side-view humanoid для фермы, потом quadrupeds/animals, и только потом сложные монстры, mounts и siege-объекты. Такой порядок важен ещё и потому, что 80% UX-проблем вскрываются не на монстрах, а на человеческом пайплайне body → clothing → preview → export. citeturn11view0turn3search2turn13view2

Автоподгонку одежды под расы и монстров нужно делать очень осторожно. В маркетинговом описании легко написать «одежда подходит ко всем», но в реальности это превращается в бесконечный источник багов. Правильнее строить не «магическую универсальную автоподгонку», а **семейства совместимости**: `human_slim`, `human_heavy`, `orc`, `goblin`, `skeleton_humanoid`, `wolf_side`, `cow_side`, `horse_side`. Внутри каждого семейства у предмета есть набор fit-rules и anchors, а между семействами подключаются только явно подготовленные variants. Для пользователя это будет выглядеть как «умная система совместимости», а для архитектуры — как контролируемый и расширяемый pipeline. Эту идею хорошо поддерживают и Spine skins/placeholders, и Unity categories/labels/overrides. citeturn13view1turn13view2

Для вашего конкретного набора игр оптимальная продуктовая формула звучит так: **один движок редактора, две основные проекции, несколько семейств скелетов, несколько style packs**. То есть не делать «редактор тёмного фэнтези» и отдельно «редактор фермы», а реализовать единое ядро, в котором `viewProfile`, `skeletonFamily` и `styleSet` определяют поведение библиотек, слоёв и экспорта. Это даст вам главный выигрыш по времени: вы один раз строите pipeline, а дальше расширяете контентом и шаблонами, а не переписываете редактор под каждую игру. citeturn17view0turn13view2turn13view5

## Готовый промт для создания такого продукта

Ниже — промт, который уже можно давать сильной ИИ-модели для проектирования и начала реализации. Он собран не как абстрактное ТЗ, а как **product + architecture brief**, основанный на рабочих паттернах modular character editors, slot/skin-систем, sprite-library подхода и редакторов с собственным runtime pipeline. citeturn11view0turn15view0turn13view2turn16view0turn13view3

```text
Ты — principal software architect, lead product designer и tech lead одновременно.
Нужно спроектировать и начать реализовывать полнофункциональный редактор-конструктор векторной 2D-графики для игр, ориентированный на пользователей, которые плохо рисуют и не умеют кодить.

Главная цель продукта:
создать desktop-first приложение с современным UI, где пользователь собирает персонажей, монстров, животных, NPC, предметы, одежду, оружие и статичные объекты из готовых шаблонов, редактирует их, анимирует, примеряет предметы на сущности, сохраняет проект, экспортирует JSON и изображения, а также сразу проигрывает анимации внутри приложения.

Технологические предпочтения:
- пользователь пишет на TypeScript, поэтому frontend и большая часть приложения должны быть TypeScript-first;
- допускается Tauri или Electron;
- архитектура должна быть модульной, расширяемой и пригодной для plugin system;
- код должен быть production-ready, а не demo-only.

Продукт нельзя строить как “пустой векторный редактор”.
Это должна быть modular asset IDE со следующими ключевыми сущностями:

1) Template Library
- готовые шаблоны тел и сущностей:
  - humanoid top-down / isometric
  - humanoid side-view
  - quadruped side-view
  - bird / winged
  - monster humanoid
  - siege/static object
- каждый шаблон содержит:
  - базовое голое тело или базовую форму без одежды и без брони
  - skeletonFamily
  - viewProfile
  - bones
  - slots
  - anchors
  - z-layer rules
  - palette tokens
  - базовые пресеты анимаций

2) Character Editor
- сборка персонажа из частей:
  - голова
  - волосы
  - лицо
  - шея
  - торс
  - руки
  - кисти
  - таз
  - ноги
  - стопы
- настройка пропорций, палитры, формы отдельных шаблонных элементов
- поддержка race/species compatibility
- база всегда должна поддерживать “naked base body”
- поверх базы пользователь надевает одежду и броню

3) Item Editor
- отдельный редактор предметов:
  - сапоги
  - штаны
  - туники
  - плащи
  - шлемы
  - броня
  - пояса
  - кольца
  - амулеты
  - перчатки
  - щиты
  - мечи
  - луки
  - арбалеты
  - копья
  - посохи
  - фермерские инструменты
  - катапульты и прочие большие объекты
- каждый предмет должен знать:
  - allowedSlots
  - compatibleSkeletonFamilies
  - compatibleSpecies
  - viewProfiles
  - fitProfile
  - palette channels
  - имеет ли собственную анимацию
  - anchor rules

4) Animation IDE
- визуальный animation editor
- timeline + state machine
- поддержка layered animation:
  - full body
  - upper body
  - lower body
  - additive overlays
- библиотека готовых анимаций
- обязательно добавить минимум:
  - 15 разных torso idle
  - idle_full
  - walk
  - run
  - melee_attack
  - ranged_attack
  - cast
  - block
  - hurt
  - stagger
  - death
  - sit
  - interact
  - work/farm
  - carry
- возможность цеплять предметы к персонажу, монстру, животному или объекту через anchors/slots
- возможность быстро тестировать комбинации “сущность + экипировка + анимация”

5) Creature and Animal Editor
- отдельные шаблоны и пайплайны для:
  - животных
  - монстров
  - ездовых существ
  - существ с хвостами, рогами, крыльями
- обязательны attachment points:
  - mouth
  - horn_l
  - horn_r
  - saddle
  - pack_left
  - pack_right
  - tail_tip
  - wing_l
  - wing_r
  - back
- система переиспользования общих компонентов между существами

6) StyleSet System
- движок должен поддерживать разные художественные стили без переписывания редактора
- минимум два готовых глобальных style packs:
  - dark fantasy
  - cute farm side-view
- styleSet должен уметь переопределять:
  - palette
  - stroke presets
  - shading mode
  - eye style
  - silhouette bias
  - material presets
  - optional component variants

7) Export / Import Studio
- экспорт и импорт проекта в JSON
- экспорт и импорт частей в SVG
- экспорт изображений минимум в:
  - PNG
  - WebP
  - SVG
  - JPEG preview
- экспорт в sprite sheet и atlas JSON
- экспорт последовательности кадров
- размеры экспорта:
  - 32x32
  - 48x48
  - 64x64
  - 96x96
  - 128x128
  - 256x256
  - 512x512
- экспорт должен включать:
  - pivots
  - frame meta
  - naming templates
  - animation names
  - optional packing metadata
- должен быть preview player для воспроизведения экспортированного результата внутри приложения

8) Project Data Model
создай собственный canonical domain model.
Нельзя использовать raw canvas serialization как главный источник истины.
Источник истины — собственный project JSON.

Проектная модель должна содержать:
- project
- entities
- templates
- skeletons
- bones
- slots
- attachments
- items
- animations
- stateMachines
- styleSets
- exportProfiles
- licenseMeta
- compatibility rules

9) Licensing / provenance
каждый импортируемый или встроенный asset должен хранить:
- source
- author
- licenseType
- aiGenerated
- commercialUseAllowed
- purchaseRef
- derivativePolicy

10) UX требования
- приложение должно помогать человеку, который не умеет рисовать
- вместо пустого холста должны быть wizard-сценарии:
  - Create Character
  - Create Monster
  - Create Animal
  - Create Item
  - Create Static Object
  - Create Animation Pack
- UI должен быть быстрым и понятным:
  - library panel
  - scene panel
  - properties inspector
  - timeline/state machine panel
  - compatibility panel
  - preview panel
  - export panel
- должны быть ready-made kits, batch apply, presets, smart defaults
- должен быть undo/redo, history, autosave, project snapshots

11) Архитектурные требования
- monorepo
- strict TypeScript
- modular packages
- clear domain layer / editor layer / runtime layer / export layer
- tests for domain model and exporters
- plugin-ready API
- performance-friendly rendering strategy
- separation between authoring scene and exported data

12) Техническая реализация
предложи рекомендуемый стек.
Сделай аргументированный выбор между:
- Tauri vs Electron
- Fabric.js / SVG-based authoring approach
- internal preview runtime
- atlas exporter
- JSON schema versioning
- asset library system
- animation system
- serialization strategy

13) Что нужно выдать в ответ
Сначала выдай:
- product vision
- architecture diagram in text form
- module breakdown
- domain model breakdown
- JSON schema draft
- folder structure
- MVP scope
- post-MVP roadmap
- main technical risks
- main UX risks
- plugin system proposal

После этого начни писать конкретную основу проекта:
- monorepo structure
- package.json files
- tsconfig
- base domain types
- project schema types
- template/item/entity/animation interfaces
- import/export interfaces
- starter desktop shell
- starter editor shell
- mock data for templates and items
- first working prototype of:
  - library panel
  - canvas/editor panel
  - inspector panel
  - preview panel
  - export dialog

14) Важный продуктовый приоритет
Не пытайся сделать всё сразу.
Сделай умную стратегию:
- MVP: humanoid top-down/isometric + item slots + 15 torso idle + JSON + sprite sheet export + preview player
- next: side-view humanoid for farm game
- next: animals and monsters
- next: advanced fit rules and plugin SDK

15) Ключевая философия
Продукт должен быть полезен не художнику-профессионалу, а инди-разработчику, который хочет быстро собирать игровые ассеты из качественных шаблонов, менять стиль, экипировку и анимации, а затем сразу отправлять всё в игру.
Нужен production tool, а не экспериментальный редактор.
```

## Итоговая рекомендация

Если свести всё к одному предложению, то лучший путь для вашей идеи — строить **не универсальный “векторный Photoshop для игр”**, а **TypeScript-first модульную IDE-конструктор**, где ядро состоит из шаблонов тел и существ, slot/attachment-системы для предметов, preset-анимаций, state machines, style packs и жёстко продуманного экспорта в project JSON + SVG parts + spritesheet/atlas bundle. Такой дизайн напрямую опирается на сильные стороны уже существующих решений — Hippo как modular character builder, Spine как модель bones/slots/skins/JSON, Unity Sprite Library как category/label/variant system, Rive как component/state-machine pipeline — но при этом лучше соответствует вашей практической цели: быстро делать контент для реальных игр, даже если человек плохо рисует и почти не кодит. citeturn11view0turn15view0turn13view2turn16view0turn17view0turn13view3