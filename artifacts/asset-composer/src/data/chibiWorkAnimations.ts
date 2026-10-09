import type { AnimationClip, BoneTransform } from '@/domain/types';

type Pose = Partial<BoneTransform>;
type Motion = 'strike' | 'bend' | 'carry' | 'offer' | 'cast' | 'wait' | 'pull' | 'sweep' | 'turn' | 'pump' | 'sew' | 'read' | 'sit' | 'talk' | 'raise' | 'recoil' | 'play' | 'cower' | 'rock' | 'throw' | 'combo' | 'guard' | 'kick';
export const TOKEN_TASKS = [
  { value: 'all', label: 'Все действия' }, { value: 'hero', label: 'Король / основные действия' },
  { value: 'food', label: 'Пища и земледелие' }, { value: 'building', label: 'Ресурсы и строительство' },
  { value: 'craft', label: 'Ремёсла' }, { value: 'military', label: 'Военные роли' },
  { value: 'spiritual', label: 'Обряды и наставничество' }, { value: 'life', label: 'Семья, возраст и быт' },
] as const;
export interface TokenAction { name: string; label: string; task: string; motion: Motion; duration: number; loop: boolean; props: string[]; station?: string; combat?: boolean; source?: string }
const action = (name: string, label: string, task: string, motion: Motion, duration: number, loop: boolean, props: string[] = [], station?: string, source?: string, combat = false): TokenAction => ({ name, label, task, motion, duration, loop, props, station, source, combat });
// Suggestions are metadata only. Nothing in this catalog equips an item.
export const TOKEN_WORK_ACTIONS: TokenAction[] = [
  action('chop', 'Рубит дерево', 'hero', 'strike', 1350, false, ['weapons_4'], undefined, 'axe_chop'),
  action('mine', 'Добывает руду', 'hero', 'strike', 1500, true, ['work_tools_0']),
  action('gather', 'Собирает ягоды и травы', 'hero', 'bend', 1600, true, ['work_tools_4']),
  action('pick_flowers', 'Срывает цветы', 'hero', 'bend', 1800, false, ['work_stations_8']),
  action('fish', 'Рыбачит · заброс, ожидание, подсечка', 'hero', 'cast', 3200, true, ['work_tools_1']),
  action('butcher', 'Разделывает добычу', 'hero', 'strike', 1400, true, ['work_tools_2']),
  action('build', 'Строит', 'hero', 'strike', 1100, true, ['work_tools_3'], 'work_stations_14'),
  action('deposit', 'Складывает груз', 'hero', 'offer', 1500, false, ['props_0']),
  action('punch', 'Рукопашный выпад корпусом', 'hero', 'recoil', 650, false, [], undefined, undefined, true),
  action('attack', 'Удар мечом', 'hero', 'strike', 850, false, ['weapons_2'], undefined, 'sword_attack', true),
  action('hit', 'Получает урон', 'hero', 'recoil', 750, false),
  action('eat', 'Ест', 'hero', 'read', 1800, true, ['work_stations_23']),
  action('drink', 'Пьёт', 'hero', 'read', 2100, true, ['work_tools_11']),
  action('rest', 'Отдыхает', 'hero', 'sit', 2600, true),
  action('sit', 'Садится', 'hero', 'sit', 1300, false),
  action('talk', 'Разговаривает', 'hero', 'talk', 2100, true),
  action('give', 'Передаёт подарок', 'hero', 'offer', 1700, false, ['work_stations_17']),
  action('idle_hunter', 'Охотник · настороженный покой', 'food', 'wait', 2200, true, ['weapons_0']),
  action('walk_hunter', 'Охотник · крадётся', 'food', 'carry', 1300, true, ['weapons_1']),
  action('bow_aim_shoot', 'Охотник · целится и стреляет', 'military', 'cast', 1600, false, ['weapons_0', 'weapons_7'], undefined, 'bow_attack', true),
  action('spear_throw', 'Охотник · бросает копьё', 'military', 'throw', 1300, false, ['weapons_1'], undefined, undefined, true),
  action('carcass_carry', 'Охотник · несёт добычу', 'food', 'carry', 1400, true, ['work_extra_0']),
  action('butcher_knife', 'Охотник · разделывает ножом', 'food', 'strike', 1000, true, ['work_tools_2']),
  action('forage_search', 'Собиратель · ищет', 'food', 'carry', 1700, true, ['work_tools_4']),
  action('forage_pick', 'Собиратель · собирает', 'food', 'bend', 1700, true, ['work_tools_4']),
  action('cast_rod', 'Рыбак · забрасывает удочку', 'food', 'cast', 1800, false, ['work_tools_1']),
  action('wait_fish', 'Рыбак · ждёт поклёвки', 'food', 'wait', 2800, true, ['work_tools_1']),
  action('pull_fish', 'Рыбак · вытягивает улов', 'food', 'pull', 1400, false, ['work_tools_1']),
  action('carry_fish_basket', 'Рыбак · несёт улов', 'food', 'carry', 1200, true, ['work_stations_9']),
  action('hoe_till', 'Фермер · рыхлит грядку', 'food', 'sweep', 1500, true, ['props_3'], undefined, 'plough'),
  action('sow_seeds', 'Фермер · сеет', 'food', 'offer', 1600, true, ['work_tools_5']),
  action('scythe_harvest', 'Фермер · косит', 'food', 'sweep', 1500, true, ['work_tools_6']),
  action('carry_sheaves', 'Фермер · несёт снопы', 'food', 'carry', 1300, true, ['work_tools_7']),
  action('quern_grind', 'Мельник · вращает жернов', 'food', 'turn', 1600, true, [], 'work_stations_4'),
  action('knead_dough', 'Пекарь · месит тесто', 'food', 'pump', 1500, true, [], 'work_stations_5'),
  action('oven_paddle', 'Пекарь · сажает хлеб в печь', 'food', 'offer', 1900, true, ['work_tools_8'], 'work_stations_3'),
  action('log_carry', 'Дровосек · несёт брёвна', 'building', 'carry', 1400, true, ['work_stations_12']),
  action('carry_logs', 'Несёт брёвна на плече', 'building', 'carry', 1600, true, ['work_stations_12']),
  action('axe_walk', 'Дровосек · идёт с топором', 'building', 'carry', 1000, true, ['weapons_4']),
  action('pickaxe_swing', 'Рудокоп · удар киркой', 'building', 'strike', 1600, true, ['work_tools_0']),
  action('chisel_stone', 'Каменотёс · тесает камень', 'building', 'strike', 900, true, ['work_tools_3', 'work_extra_1'], 'work_stations_14'),
  action('carry_ore_bucket', 'Рудокоп · несёт руду', 'building', 'carry', 1600, true, ['work_stations_10']),
  action('hammer_strike', 'Строитель · стучит молотком', 'building', 'strike', 950, true, ['work_tools_3']),
  action('lay_bricks', 'Строитель · укладывает кирпичи', 'building', 'bend', 1900, true, [], 'work_stations_14'),
  action('carry_planks', 'Строитель · несёт доски', 'building', 'carry', 1400, true, ['work_stations_11']),
  action('bellows_pump', 'Кузнец · качает меха', 'craft', 'pump', 1400, true, ['work_tools_10']),
  action('anvil_hammer', 'Кузнец · куёт', 'craft', 'strike', 1100, true, ['work_tools_3', 'work_tools_9'], 'work_stations_0'),
  action('quench_water', 'Кузнец · закаляет в воде', 'craft', 'bend', 1800, true, ['work_tools_9'], 'work_stations_1'),
  action('pottery_wheel', 'Гончар · формует кувшин', 'craft', 'turn', 2200, true, [], 'work_stations_2'),
  action('kiln_load', 'Гончар · загружает печь', 'craft', 'offer', 1900, true, ['work_tools_11'], 'work_stations_3'),
  action('loom_weave', 'Ткач · работает за станком', 'craft', 'sew', 1900, true, ['work_tools_13']),
  action('tailor_sew', 'Швея · шьёт', 'craft', 'sew', 1400, true, ['work_tools_12']),
  action('scrape_hide', 'Кожевник · скоблит шкуру', 'craft', 'sweep', 1400, true, ['work_tools_14'], 'work_stations_15'),
  action('stretch_frame', 'Кожевник · натягивает шкуру', 'craft', 'pull', 2000, true, [], 'work_stations_15'),
  action('sword_walk', 'Воин · боевая поступь', 'military', 'guard', 1000, true, ['weapons_2', 'weapons_6']),
  action('slash_combo', 'Воин · три рубящих удара', 'military', 'combo', 2400, false, ['weapons_2'], undefined, undefined, true),
  action('shield_block', 'Воин · блок щитом', 'military', 'guard', 1000, false, ['weapons_2', 'weapons_6'], undefined, undefined, true),
  action('draw_quiver', 'Лучник · достаёт стрелу', 'military', 'raise', 1000, false, ['weapons_0', 'weapons_7'], undefined, undefined, true),
  action('full_draw_shot', 'Лучник · полный натяг и выстрел', 'military', 'cast', 1900, false, ['weapons_0', 'weapons_7'], undefined, 'bow_attack', true),
  action('spear_thrust', 'Копейщик · выпад', 'military', 'strike', 1000, false, ['weapons_1'], undefined, 'spear_attack', true),
  action('spear_brace', 'Копейщик · оборонительный упор', 'military', 'guard', 1700, true, ['weapons_1'], undefined, undefined, true),
  action('guard_patrol', 'Стражник · патрулирует', 'military', 'carry', 1400, true, ['weapons_1']),
  action('alarm_horn', 'Стражник · трубит тревогу', 'military', 'read', 2200, true, ['work_tools_18']),
  action('command_signal', 'Полководец · подаёт сигнал', 'military', 'raise', 1700, false, ['work_tools_19']),
  action('rally_shout', 'Полководец · воодушевляет', 'military', 'raise', 2200, true, ['weapons_2']),
  action('drill_training', 'Ветеран · показывает стойки', 'military', 'guard', 2200, true, ['weapons_1'], undefined, undefined, true),
  action('ritual_prayer', 'Жрец · молится и кланяется', 'spiritual', 'raise', 2600, true),
  action('incense_offering', 'Жрец · подносит благовония', 'spiritual', 'offer', 2300, true, ['work_tools_20']),
  action('inspect_scroll', 'Мудрец · читает свиток', 'spiritual', 'read', 2600, true, ['work_stations_16']),
  action('brew_medicine', 'Знахарь · растирает травы', 'spiritual', 'turn', 1700, true, ['work_tools_21']),
  action('teach_youth', 'Наставник · объясняет', 'spiritual', 'talk', 2400, true),
  action('council_talk', 'Старейшина · говорит на совете', 'spiritual', 'sit', 2700, true),
  action('arbitrate_dispute', 'Старейшина · примиряет', 'spiritual', 'talk', 2400, true),
  action('carry_sack', 'Житель · несёт мешок', 'life', 'carry', 1300, true, ['props_0']),
  action('carry_box', 'Житель · несёт ящик', 'life', 'carry', 1500, true, ['props_1']),
  action('sweep_clean', 'Житель · подметает', 'life', 'sweep', 1400, true, ['work_tools_16']),
  action('eat_at_hearth', 'Житель · ест у очага', 'life', 'sit', 2400, true, ['work_stations_7'], 'work_stations_6'),
  action('child_run_play', 'Ребёнок · бежит вприпрыжку', 'life', 'play', 900, true),
  action('child_hide_cower', 'Ребёнок · съёживается', 'life', 'cower', 1800, true),
  action('child_help_light', 'Ребёнок · несёт лёгкий груз', 'life', 'carry', 1100, true, ['work_stations_20']),
  action('teen_apprentice', 'Подросток · подаёт инструмент', 'life', 'offer', 1800, true, ['work_tools_3']),
  action('walk_with_staff', 'Пожилой · идёт с посохом', 'life', 'carry', 2000, true, ['work_tools_17']),
  action('tell_stories', 'Пожилой · рассказывает истории', 'life', 'sit', 2800, true),
  action('rock_baby', 'Родитель · укачивает младенца', 'life', 'rock', 2400, true, ['work_tools_22']),
  action('care_gathering', 'Опекун · зовёт детей и угощает', 'life', 'offer', 2400, true, ['work_stations_23']),
  action('carry_stretcher', 'Несёт носилки', 'life', 'carry', 1700, true, ['work_stations_18']),
  action('dig_grave', 'Могильщик · копает', 'life', 'sweep', 1800, true, ['work_tools_23'], 'work_stations_19'),
  action('mourn_kneel', 'Скорбит · склоняется', 'life', 'cower', 2800, true, [], 'work_stations_19'),
  action('defile_grave', 'Вандал · толкает насыпь корпусом', 'life', 'kick', 1400, true, [], 'work_stations_19'),
];

type Factory = (name: string, label: string, duration: number, loops: boolean, poses: Record<string, Pose[]>, fractions?: number[]) => AnimationClip;
function poses(m: Motion, name: string): Record<string, Pose[]> {
  const head: Pose[] = [{}, { rotation: -3 }, { rotation: 2 }, { rotation: 5 }, { rotation: -2 }, {}];
  const root: Pose[] = [{}, { ty: -2 }, {}, { ty: -3 }, {}, {}];
  const chest: Pose[] = [{}, { rotation: -3 }, { rotation: -5 }, { rotation: 7 }, { rotation: 3 }, {}];
  let tool: Pose[] = [{}, { rotation: -15 }, { ty: -15 }, { rotation: 20 }, { ty: 4 }, {}];
  const off: Pose[] = [{}, {}, {}, {}, {}, {}];
  if (m === 'strike') tool = [{}, { ty: -65, rotation: -35 }, { ty: -110, rotation: -55 }, { tx: 16, ty: 20, rotation: 75 }, { tx: 18, ty: 25, rotation: 80 }, {}];
  if (m === 'bend' || m === 'cower') {
    const amount = m === 'cower' ? 24 : 14;
    chest.splice(0, 6, {}, { ty: 6, rotation: 8 }, { ty: amount, rotation: 15, scaleY: .86 }, { ty: amount, rotation: 17, scaleY: .86 }, { ty: 8, rotation: 8 }, {});
    tool = [{}, { tx: 4, ty: 15 }, { tx: 12, ty: 32, rotation: 12 }, { tx: 6, ty: 32, rotation: 20 }, { tx: -15, ty: 5 }, {}];
    if (m === 'cower') head.splice(0, 6, { rotation: 12 }, { ty: 7, rotation: 16 }, { ty: 14, rotation: 20 }, { ty: 14, rotation: 18 }, { ty: 7, rotation: 16 }, { rotation: 12 });
  }
  if (m === 'carry') {
    root.splice(0, 6, {}, { ty: -3, rotation: 2 }, { ty: -1 }, { ty: -3, rotation: -2 }, { ty: -1 }, {});
    const high = /log|planks|carcass|axe_walk/.test(name);
    tool = Array.from({ length: 6 }, (_, i) => ({ tx: high ? -15 : -35, ty: high ? -62 : -12 + (i % 2 ? -2 : 0), rotation: high ? 65 : 0 }));
    if (name === 'walk_with_staff') tool = [{ tx: -5, ty: 25 }, { tx: -12, ty: 25, rotation: -7 }, { tx: -12, ty: 25, rotation: -7 }, { tx: 5, ty: 18, rotation: 5 }, { tx: 5, ty: 25 }, { tx: -5, ty: 25 }];
  }
  if (m === 'offer') tool = [{ tx: -25 }, { tx: -20, ty: -18 }, { tx: 5, ty: -20 }, { tx: 28, ty: -15, rotation: 12 }, { tx: 12, ty: -8 }, { tx: -25 }];
  if (name === 'deposit') tool = [{ tx: -25, ty: -20 }, { tx: -10 }, { tx: 18, ty: 35 }, { tx: 25, ty: 53 }, { tx: 25, ty: 53 }, { tx: 25, ty: 53 }];
  if (m === 'cast') tool = [{ rotation: 15 }, { tx: -10, ty: -40, rotation: -50 }, { tx: -12, ty: -65, rotation: -65 }, { tx: 20, ty: -15, rotation: 55 }, { tx: 15, ty: 0, rotation: 35 }, { rotation: 15 }];
  if (m === 'wait') { tool = Array(6).fill({ rotation: 35, tx: 10 }); chest.splice(0, 6, {}, { scaleY: 1.01 }, {}, { scaleY: 1.01 }, {}, {}); }
  if (m === 'pull') tool = [{ rotation: 35 }, { rotation: 20, ty: -5 }, { rotation: -25, tx: -15, ty: -55 }, { rotation: -35, tx: -22, ty: -70 }, { rotation: -15, ty: -40 }, { rotation: 35 }];
  if (m === 'sweep') tool = [{ rotation: 25 }, { tx: 20, ty: 12, rotation: 55 }, { tx: 25, ty: 20, rotation: 80 }, { tx: -25, ty: 20, rotation: -10 }, { tx: -10, ty: 10, rotation: 10 }, { rotation: 25 }];
  if (m === 'turn') tool = [{ tx: -25 }, { tx: -10, ty: -10, rotation: 15 }, { tx: 5, rotation: 30 }, { tx: -10, ty: 10, rotation: 15 }, { tx: -25, rotation: -5 }, { tx: -25 }];
  if (m === 'pump') { tool = [{ ty: 0 }, { ty: 18, scaleY: .85 }, { ty: 25, scaleY: .75 }, { ty: 18, scaleY: .85 }, {}, {}]; chest.splice(0, 6, {}, { ty: 4, rotation: 3 }, { ty: 8, rotation: 6 }, { ty: 4, rotation: 3 }, {}, {}); }
  if (m === 'sew') tool = [{ tx: -25 }, { tx: -40, ty: -8, rotation: -10 }, { tx: -20, ty: 3 }, { tx: -40, ty: -8, rotation: -10 }, { tx: -20, ty: 3 }, { tx: -25 }];
  if (m === 'read') { const mouth = /eat|drink|horn/.test(name); tool = [{ tx: -15 }, { tx: -38, ty: mouth ? -45 : -20 }, { tx: -48, ty: mouth ? -65 : -30, rotation: mouth ? -25 : -8 }, { tx: -48, ty: mouth ? -65 : -30, rotation: mouth ? -35 : 8 }, { tx: -38, ty: -20 }, { tx: -15 }]; }
  if (m === 'sit') { root.forEach(p => { p.ty = 14; p.scaleY = .9; }); chest.forEach((p, i) => { p.rotation = i % 2 ? 3 : -2; }); tool = Array(6).fill({ tx: -35, ty: -10 }); }
  if (m === 'talk') { tool = [{}, { tx: -25, ty: -30, rotation: -15 }, { tx: 5, ty: -10, rotation: 15 }, { tx: -25, ty: -35, rotation: -25 }, { tx: 10, ty: -10 }, {}]; off.splice(0, 6, {}, { ty: -15 }, {}, { tx: -8, ty: -25 }, {}, {}); }
  if (m === 'raise') { tool = [{}, { tx: -10, ty: -55, rotation: -10 }, { tx: -25, ty: -120, rotation: -20 }, { tx: -25, ty: -120, rotation: 5 }, { tx: -10, ty: -55 }, {}]; head.splice(0, 6, {}, { rotation: -5 }, { rotation: -10 }, { rotation: -8 }, { rotation: -3 }, {}); }
  if (m === 'recoil') root.splice(0, 6, {}, { tx: -6, rotation: -5 }, { tx: name === 'punch' ? 15 : -14, rotation: name === 'punch' ? 10 : -12 }, { tx: -6, rotation: -5 }, { tx: 2 }, {});
  if (m === 'play') root.splice(0, 6, {}, { ty: -12, rotation: -8 }, { ty: -5 }, { ty: -20, rotation: 8 }, { ty: -5 }, {});
  if (m === 'rock') { root.forEach((p, i) => { p.rotation = [0,-4,-6,4,6,0][i]; }); tool = [0,-4,-6,4,6,0].map(rotation => ({ tx: -65, ty: -5, rotation: 65 + rotation })); }
  if (m === 'guard') { tool = [{ rotation: 25 }, { tx: -15, ty: -20, rotation: 55 }, { tx: -25, ty: -25, rotation: 65 }, { tx: -25, ty: -25, rotation: 65 }, { tx: -15, ty: -20, rotation: 55 }, { rotation: 25 }]; off.splice(0, 6, {}, { tx: 15, ty: -12 }, { tx: 23, ty: -22, rotation: 12 }, { tx: 20, ty: -20, rotation: 8 }, { tx: 15, ty: -12 }, {}); }
  if (m === 'kick') root.splice(0, 6, {}, { tx: -8, rotation: -5 }, { tx: 18, rotation: 12 }, { tx: 25, rotation: 14 }, { tx: 8, rotation: 4 }, {});
  if (m === 'throw') tool = [{ rotation: 10 }, { tx: -25, ty: -80, rotation: -45 }, { tx: -35, ty: -115, rotation: -65 }, { tx: 95, ty: -50, rotation: 65 }, { tx: 240, ty: -40, rotation: 80 }, { tx: 360, ty: -30, rotation: 90, scaleX: 0, scaleY: 0 }];
  if (name === 'anvil_hammer') off.forEach(p => Object.assign(p, { tx: 110, ty: 20, rotation: 65 }));
  if (name === 'draw_quiver') return { root, chest, head, token_weapon: Array(6).fill({}), token_arrow: [{}, { tx: -120, ty: -95, rotation: -30 }, { tx: -110, ty: -115, rotation: 30 }, { tx: -35, ty: -65, rotation: 65 }, { ty: -35, rotation: 90 }, { ty: -35, rotation: 90 }] };
  return { root, chest, head, token_weapon: tool, token_offhand: off, token_support: off };
}
export function createTokenWorkAnimations(factory: Factory, existing: AnimationClip[]): AnimationClip[] {
  return TOKEN_WORK_ACTIONS.map(a => {
    const source = existing.find(c => c.name === a.source);
    if (source) {
      const result = structuredClone(source);
      const ratio = a.duration / result.durationMs;
      result.id = `token__${a.name}`; result.name = a.name; result.label = a.label; result.durationMs = a.duration; result.loops = a.loop;
      result.layers.forEach(l => l.tracks.forEach(t => t.keyframes.forEach(k => { k.timeMs = Math.round(k.timeMs * ratio); })));
      result.reviewMarkers?.forEach(m => { m.timeMs = Math.round(m.timeMs * ratio); });
      return result;
    }
    if (a.motion === 'combo') {
      const f = [0,.1,.2,.27,.35,.43,.5,.58,.67,.75,.85,1];
      const result = factory(a.name, a.label, a.duration, false, {
        root: [0,-4,7,3,-5,8,3,-6,10,4,2,0].map(rotation => ({ rotation })),
        head: [0,4,-5,0,4,-5,0,5,-6,0,0,0].map(rotation => ({ rotation })),
        token_weapon: [0,-55,90,50,-65,110,60,-70,115,80,20,0].map((rotation, i) => ({ rotation, ty: [0,-105,8,5,-115,8,5,-120,12,8,0,0][i], tx: i % 3 === 2 ? 25 : 0 })),
      }, f);
      result.reviewMarkers = f.map((fraction, i) => ({ label: ['Готовность','Замах 1','Удар 1','Доводка 1','Замах 2','Удар 2','Доводка 2','Замах 3','Удар 3','Доводка 3','Возврат','Готовность'][i], timeMs: Math.round(a.duration * fraction) }));
      return result;
    }
    if (a.name === 'fish') return factory(a.name, a.label, a.duration, true, {
      root: [{}, { rotation: -4 }, { rotation: 5 }, {}, {}, { rotation: -8 }, {}],
      head: [{}, { rotation: -7 }, { rotation: 5 }, { rotation: 4 }, { rotation: 4 }, { rotation: -8 }, {}],
      token_weapon: [{ rotation: 15 }, { ty: -60, rotation: -60 }, { tx: 20, rotation: 55 }, { tx: 15, rotation: 35 }, { tx: 15, rotation: 35 }, { tx: -15, ty: -65, rotation: -30 }, { rotation: 15 }],
    }, [0,.15,.3,.4,.75,.88,1]);
    const result = factory(a.name, a.label, a.duration, a.loop, poses(a.motion, a.name));
    if (a.name === 'draw_quiver') {
      result.equipmentDepth!.find(d => d.slotId === 'token_projectile')!.keyframes = [
        { timeMs: 0, slot: 'BODY_BACK' }, { timeMs: Math.round(a.duration * .72), slot: 'EQUIPMENT_FRONT' },
      ];
    }
    return result;
  });
}
export function tokenAction(name: string) { return TOKEN_WORK_ACTIONS.find(a => a.name === name); }
export function isTokenCombat(name: string) { return !!tokenAction(name)?.combat || /attack|block|chop/.test(name); }
export function tokenTaskMatches(name: string, task: string) {
  if (task === 'all') return true;
  const entry = tokenAction(name);
  if (entry) return entry.task === task;
  return task === 'military' ? /attack|block/.test(name) : task === 'building' ? /chop|plough/.test(name) : task === 'hero';
}
