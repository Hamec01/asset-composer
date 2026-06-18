import type { Template, Bone, SlotDef, PaletteTokens, BonePart } from "@/domain/types";

const defaultLicense = {
  source: "Asset Composer Built-in",
  author: "Asset Composer",
  licenseType: "cc0" as const,
  aiGenerated: false,
  commercialUseAllowed: true,
  purchaseRef: null,
  derivativePolicy: "unrestricted",
};

const defaultPalette: PaletteTokens = {
  skin: "#C89A7B",
  hair: "#3B2314",
  primaryCloth: "#3C3A46",
  secondaryCloth: "#746A5E",
  metal: "#8E8A80",
  accent: "#B87333",
  outline: "#1A1A1A",
  shadow: "#00000033",
};

// ─── Humanoid Top-Down ───────────────────────────────────────────────────────
const humanoidTopdownBones: Bone[] = [
  { id: "root", name: "Root", parentId: null, restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "pelvis", name: "Pelvis", parentId: "root", restPose: { tx: 0, ty: -5, rotation: 0, scaleX: 1, scaleY: 1 }, length: 12 },
  { id: "spine", name: "Spine", parentId: "pelvis", restPose: { tx: 0, ty: -18, rotation: 0, scaleX: 1, scaleY: 1 }, length: 20 },
  { id: "chest", name: "Chest", parentId: "spine", restPose: { tx: 0, ty: -16, rotation: 0, scaleX: 1, scaleY: 1 }, length: 14 },
  { id: "neck", name: "Neck", parentId: "chest", restPose: { tx: 0, ty: -10, rotation: 0, scaleX: 1, scaleY: 1 }, length: 6 },
  { id: "head", name: "Head", parentId: "neck", restPose: { tx: 0, ty: -6, rotation: 0, scaleX: 1, scaleY: 1 }, length: 18 },
  { id: "shoulder_l", name: "Shoulder L", parentId: "chest", restPose: { tx: -16, ty: -6, rotation: 0, scaleX: 1, scaleY: 1 }, length: 12 },
  { id: "elbow_l", name: "Elbow L", parentId: "shoulder_l", restPose: { tx: -14, ty: 4, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "hand_l", name: "Hand L", parentId: "elbow_l", restPose: { tx: -10, ty: 2, rotation: 0, scaleX: 1, scaleY: 1 }, length: 6 },
  { id: "shoulder_r", name: "Shoulder R", parentId: "chest", restPose: { tx: 16, ty: -6, rotation: 0, scaleX: 1, scaleY: 1 }, length: 12 },
  { id: "elbow_r", name: "Elbow R", parentId: "shoulder_r", restPose: { tx: 14, ty: 4, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "hand_r", name: "Hand R", parentId: "elbow_r", restPose: { tx: 10, ty: 2, rotation: 0, scaleX: 1, scaleY: 1 }, length: 6 },
  { id: "hip_l", name: "Hip L", parentId: "pelvis", restPose: { tx: -8, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "knee_l", name: "Knee L", parentId: "hip_l", restPose: { tx: -2, ty: 16, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "foot_l", name: "Foot L", parentId: "knee_l", restPose: { tx: -1, ty: 14, rotation: 0, scaleX: 1, scaleY: 1 }, length: 6 },
  { id: "hip_r", name: "Hip R", parentId: "pelvis", restPose: { tx: 8, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "knee_r", name: "Knee R", parentId: "hip_r", restPose: { tx: 2, ty: 16, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "foot_r", name: "Foot R", parentId: "knee_r", restPose: { tx: 1, ty: 14, rotation: 0, scaleX: 1, scaleY: 1 }, length: 6 },
];

const humanoidTopdownSlots: SlotDef[] = [
  { id: "slot_feet", name: "Feet", boneId: "foot_l", zIndex: 0, allowedCategories: ["feet"], required: false, defaultItemId: null },
  { id: "slot_legs", name: "Legs", boneId: "pelvis", zIndex: 1, allowedCategories: ["legs"], required: false, defaultItemId: null },
  { id: "slot_waist", name: "Waist", boneId: "pelvis", zIndex: 2, allowedCategories: ["waist"], required: false, defaultItemId: null },
  { id: "slot_torso", name: "Torso", boneId: "chest", zIndex: 3, allowedCategories: ["torso"], required: false, defaultItemId: null },
  { id: "slot_arms", name: "Arms", boneId: "shoulder_l", zIndex: 4, allowedCategories: ["arms"], required: false, defaultItemId: null },
  { id: "slot_hands", name: "Hands", boneId: "hand_l", zIndex: 5, allowedCategories: ["hands"], required: false, defaultItemId: null },
  { id: "slot_neck", name: "Neck", boneId: "neck", zIndex: 6, allowedCategories: ["neck", "amulet"], required: false, defaultItemId: null },
  { id: "slot_cloak", name: "Cloak", boneId: "chest", zIndex: 7, allowedCategories: ["cloak"], required: false, defaultItemId: null },
  { id: "slot_hair", name: "Hair", boneId: "head", zIndex: 8, allowedCategories: ["hair"], required: false, defaultItemId: null, defaultAnchorId: "hair_top" },
  { id: "slot_eyes", name: "Eyes", boneId: "head", zIndex: 9, allowedCategories: ["eyes"], required: false, defaultItemId: null },
  { id: "slot_face", name: "Face", boneId: "head", zIndex: 10, allowedCategories: ["face"], required: false, defaultItemId: null },
  { id: "slot_beard", name: "Beard", boneId: "head", zIndex: 11, allowedCategories: ["beard"], required: false, defaultItemId: null },
  { id: "slot_head_cover", name: "Head Cover", boneId: "head", zIndex: 12, allowedCategories: ["head_cover"], required: false, defaultItemId: null },
  { id: "slot_weapon_main", name: "Main Weapon", boneId: "hand_r", zIndex: 13, allowedCategories: ["weapon_main"], required: false, defaultItemId: null },
  { id: "slot_weapon_off", name: "Off Hand / Shield", boneId: "hand_l", zIndex: 14, allowedCategories: ["weapon_off", "shield"], required: false, defaultItemId: null },
  { id: "slot_ring_l", name: "Ring Left", boneId: "hand_l", zIndex: 15, allowedCategories: ["ring"], required: false, defaultItemId: null },
  { id: "slot_ring_r", name: "Ring Right", boneId: "hand_r", zIndex: 16, allowedCategories: ["ring"], required: false, defaultItemId: null },
  { id: "slot_amulet", name: "Amulet", boneId: "neck", zIndex: 17, allowedCategories: ["amulet"], required: false, defaultItemId: null },
];

// Generate a naked base body SVG for top-down humanoid
function humanoidTopdownBaseSvg(palette: PaletteTokens): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Feet -->
  <ellipse cx="56" cy="110" rx="5" ry="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="72" cy="110" rx="5" ry="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Legs -->
  <rect x="52" y="80" width="10" height="28" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <rect x="66" y="80" width="10" height="28" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Pelvis -->
  <ellipse cx="64" cy="78" rx="16" ry="10" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Torso/Body -->
  <rect x="48" y="52" width="32" height="28" rx="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Chest shape -->
  <ellipse cx="64" cy="54" rx="15" ry="8" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Left Arm -->
  <rect x="30" y="54" width="18" height="10" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Left Hand -->
  <ellipse cx="30" cy="59" rx="6" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Right Arm -->
  <rect x="80" y="54" width="18" height="10" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Right Hand -->
  <ellipse cx="98" cy="59" rx="6" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Neck -->
  <rect x="59" y="42" width="10" height="12" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Head -->
  <ellipse cx="64" cy="28" rx="18" ry="20" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Eyes -->
  <ellipse cx="57" cy="24" rx="3" ry="3.5" fill="#2B1D18"/>
  <ellipse cx="71" cy="24" rx="3" ry="3.5" fill="#2B1D18"/>
  <circle cx="58" cy="23" r="1" fill="white"/>
  <circle cx="72" cy="23" r="1" fill="white"/>
  <!-- Nose -->
  <ellipse cx="64" cy="30" rx="2" ry="1.5" fill="${palette.shadow}"/>
  <!-- Mouth -->
  <path d="M60 35 Q64 38 68 35" stroke="${palette.outline}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;
}

// ─── Humanoid Side View ───────────────────────────────────────────────────────
function humanoidSideBaseSvg(palette: PaletteTokens): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 192">
  <!-- Back foot -->
  <ellipse cx="60" cy="180" rx="10" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Back leg lower -->
  <rect x="55" y="148" width="10" height="32" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Back leg upper -->
  <rect x="54" y="110" width="12" height="38" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Front leg upper -->
  <rect x="62" y="108" width="12" height="40" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Front leg lower -->
  <rect x="63" y="148" width="10" height="32" rx="4" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Front foot -->
  <ellipse cx="70" cy="180" rx="12" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Pelvis -->
  <ellipse cx="64" cy="108" rx="14" ry="9" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Torso -->
  <rect x="50" y="64" width="28" height="48" rx="7" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Back arm -->
  <rect x="44" y="68" width="10" height="36" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="49" cy="104" rx="6" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Front arm -->
  <rect x="74" y="68" width="10" height="36" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="79" cy="104" rx="6" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Neck -->
  <rect x="58" y="48" width="12" height="18" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Head -->
  <ellipse cx="64" cy="32" rx="20" ry="24" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Eye -->
  <ellipse cx="72" cy="28" rx="3.5" ry="4" fill="#2B1D18"/>
  <circle cx="73" cy="27" r="1.2" fill="white"/>
  <!-- Ear -->
  <ellipse cx="44" cy="32" rx="4" ry="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Nose -->
  <path d="M80 36 Q84 33 82 40" stroke="${palette.outline}" stroke-width="1.5" fill="${palette.skin}"/>
  <!-- Mouth -->
  <path d="M74 46 Q78 49 80 46" stroke="${palette.outline}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;
}

// ─── Quadruped Side View ─────────────────────────────────────────────────────
function quadrupedSideBaseSvg(palette: PaletteTokens): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128">
  <!-- Body -->
  <ellipse cx="96" cy="72" rx="54" ry="28" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Neck -->
  <ellipse cx="52" cy="52" rx="18" ry="24" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2" transform="rotate(-20 52 52)"/>
  <!-- Head -->
  <ellipse cx="36" cy="36" rx="22" ry="16" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Snout -->
  <ellipse cx="20" cy="40" rx="10" ry="8" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Eye -->
  <ellipse cx="38" cy="30" rx="3.5" ry="4" fill="#2B1D18"/>
  <circle cx="39" cy="29" r="1.2" fill="white"/>
  <!-- Ear -->
  <polygon points="46,20 52,8 58,20" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Front left leg -->
  <rect x="50" y="90" width="12" height="30" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="56" cy="122" rx="9" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Front right leg -->
  <rect x="64" y="90" width="12" height="30" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="70" cy="122" rx="9" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Back left leg -->
  <rect x="118" y="90" width="12" height="30" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="124" cy="122" rx="9" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Back right leg -->
  <rect x="132" y="90" width="12" height="30" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <ellipse cx="138" cy="122" rx="9" ry="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Tail -->
  <path d="M148 68 Q170 50 168 30 Q166 15 158 20" stroke="${palette.skin}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M148 68 Q170 50 168 30 Q166 15 158 20" stroke="${palette.outline}" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
  <!-- Nostril -->
  <ellipse cx="14" cy="42" rx="2" ry="1.5" fill="${palette.outline}" opacity="0.5"/>
</svg>`;
}

// ─── Bird Side View ───────────────────────────────────────────────────────────
function birdSideBaseSvg(palette: PaletteTokens): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 128">
  <!-- Body -->
  <ellipse cx="80" cy="76" rx="36" ry="26" fill="${palette.primaryCloth}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Wing (folded) -->
  <ellipse cx="80" cy="68" rx="38" ry="18" fill="${palette.secondaryCloth}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Tail feathers -->
  <path d="M114 76 L136 60 M114 80 L138 72 M114 84 L136 88" stroke="${palette.primaryCloth}" stroke-width="8" stroke-linecap="round"/>
  <path d="M114 76 L136 60 M114 80 L138 72 M114 84 L136 88" stroke="${palette.outline}" stroke-width="1" stroke-linecap="round"/>
  <!-- Neck -->
  <ellipse cx="52" cy="60" rx="14" ry="18" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5" transform="rotate(-10 52 60)"/>
  <!-- Head -->
  <ellipse cx="40" cy="44" rx="18" ry="16" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Beak -->
  <polygon points="24,44 18,40 18,48" fill="${palette.accent}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Eye -->
  <ellipse cx="36" cy="40" rx="4" ry="4.5" fill="#2B1D18"/>
  <circle cx="37" cy="39" r="1.5" fill="white"/>
  <!-- Crest feathers -->
  <path d="M44 28 Q40 12 36 10 M46 28 Q44 10 38 6 M48 30 Q48 14 44 8" stroke="${palette.hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Legs -->
  <line x1="68" y1="100" x2="62" y2="120" stroke="${palette.accent}" stroke-width="4" stroke-linecap="round"/>
  <line x1="80" y1="100" x2="74" y2="120" stroke="${palette.accent}" stroke-width="4" stroke-linecap="round"/>
  <!-- Claws -->
  <path d="M62 120 L54 124 M62 120 L62 128 M62 120 L70 125" stroke="${palette.accent}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M74 120 L66 124 M74 120 L74 128 M74 120 L82 125" stroke="${palette.accent}" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
}

// ─── Monster Humanoid ─────────────────────────────────────────────────────────
function humanoidMonsterBaseSvg(palette: PaletteTokens): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Feet - larger, clawed -->
  <ellipse cx="50" cy="116" rx="10" ry="7" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <path d="M42 118 L38 124 M46 120 L44 126 M52 120 L50 126" stroke="${palette.outline}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="78" cy="116" rx="10" ry="7" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <path d="M70 118 L66 124 M74 120 L72 126 M80 120 L78 126" stroke="${palette.outline}" stroke-width="2" stroke-linecap="round"/>
  <!-- Legs - thick -->
  <rect x="45" y="82" width="14" height="32" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <rect x="69" y="82" width="14" height="32" rx="5" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Pelvis - wide -->
  <ellipse cx="64" cy="80" rx="24" ry="13" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Torso - massive -->
  <rect x="38" y="42" width="52" height="42" rx="8" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Chest muscles -->
  <ellipse cx="58" cy="54" rx="12" ry="10" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1"/>
  <ellipse cx="74" cy="54" rx="12" ry="10" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1"/>
  <!-- Left Arm - thick -->
  <rect x="18" y="44" width="22" height="14" rx="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Left Hand - clawed -->
  <ellipse cx="19" cy="51" rx="9" ry="8" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <path d="M11 46 L6 40 M11 51 L6 52 M11 56 L6 62" stroke="${palette.outline}" stroke-width="2" stroke-linecap="round"/>
  <!-- Right Arm -->
  <rect x="88" y="44" width="22" height="14" rx="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <ellipse cx="109" cy="51" rx="9" ry="8" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <path d="M117 46 L122 40 M117 51 L122 52 M117 56 L122 62" stroke="${palette.outline}" stroke-width="2" stroke-linecap="round"/>
  <!-- Neck - thick -->
  <rect x="56" y="30" width="16" height="14" rx="6" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Head - angular -->
  <rect x="44" y="8" width="40" height="26" rx="8" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Jaw/mandible -->
  <path d="M44 28 Q64 38 84 28" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.5"/>
  <!-- Eyes - glowing -->
  <ellipse cx="55" cy="18" rx="5" ry="4" fill="#FF4400"/>
  <ellipse cx="73" cy="18" rx="5" ry="4" fill="#FF4400"/>
  <ellipse cx="55" cy="18" rx="2.5" ry="2" fill="#FF8800"/>
  <ellipse cx="73" cy="18" rx="2.5" ry="2" fill="#FF8800"/>
  <!-- Horns -->
  <path d="M50 10 Q44 0 46 -6" stroke="${palette.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M78 10 Q84 0 82 -6" stroke="${palette.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Teeth -->
  <path d="M52 32 L54 38 M58 34 L58 40 M64 34 L64 40 M70 34 L70 40 M76 34 L74 38" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

// ─── Siege/Static Object ─────────────────────────────────────────────────────
function siegeStaticBaseSvg(palette: PaletteTokens): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128">
  <!-- Wheels -->
  <circle cx="40" cy="100" r="26" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="3"/>
  <circle cx="40" cy="100" r="18" fill="${palette.secondaryCloth}" stroke="${palette.outline}" stroke-width="2"/>
  <line x1="40" y1="74" x2="40" y2="126" stroke="${palette.outline}" stroke-width="2"/>
  <line x1="14" y1="100" x2="66" y2="100" stroke="${palette.outline}" stroke-width="2"/>
  <circle cx="152" cy="100" r="26" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="3"/>
  <circle cx="152" cy="100" r="18" fill="${palette.secondaryCloth}" stroke="${palette.outline}" stroke-width="2"/>
  <line x1="152" y1="74" x2="152" y2="126" stroke="${palette.outline}" stroke-width="2"/>
  <line x1="126" y1="100" x2="178" y2="100" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Frame/Axle -->
  <rect x="40" y="90" width="112" height="16" rx="4" fill="${palette.secondaryCloth}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Counterweight arm -->
  <rect x="130" y="30" width="16" height="70" rx="5" fill="${palette.secondaryCloth}" stroke="${palette.outline}" stroke-width="2" transform="rotate(-15 138 65)"/>
  <!-- Bucket/sling arm -->
  <rect x="52" y="18" width="12" height="72" rx="4" fill="${palette.secondaryCloth}" stroke="${palette.outline}" stroke-width="2" transform="rotate(15 58 54)"/>
  <!-- Pivot post -->
  <rect x="84" y="52" width="20" height="56" rx="4" fill="${palette.primaryCloth}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Pivot bolt -->
  <circle cx="94" cy="60" r="8" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Counterweight box -->
  <rect x="118" y="8" width="36" height="28" rx="4" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="2"/>
  <!-- Sling/bucket -->
  <path d="M50 80 Q44 92 56 96" stroke="${palette.secondaryCloth}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Rivets -->
  <circle cx="90" cy="90" r="3" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="1"/>
  <circle cx="98" cy="90" r="3" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="1"/>
  <circle cx="90" cy="100" r="3" fill="${palette.metal}" stroke="${palette.outline}" stroke-width="1"/>
</svg>`;
}

// ─── Thumbnail SVGs (simplified) ─────────────────────────────────────────────
const thumbnails = {
  humanoid_topdown_v1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><ellipse cx="24" cy="16" rx="10" ry="11" fill="#C89A7B"/><rect x="16" y="24" width="16" height="16" rx="4" fill="#C89A7B"/></svg>`,
  humanoid_side_v1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 64"><ellipse cx="16" cy="10" rx="10" ry="11" fill="#C89A7B"/><rect x="10" y="20" width="12" height="32" rx="4" fill="#C89A7B"/></svg>`,
  quadruped_side_v1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><ellipse cx="32" cy="28" rx="24" ry="14" fill="#A0896A"/><ellipse cx="14" cy="18" rx="12" ry="9" fill="#A0896A"/></svg>`,
  bird_side_v1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><ellipse cx="32" cy="28" rx="20" ry="14" fill="#7A9E7E"/><ellipse cx="16" cy="16" rx="10" ry="9" fill="#C89A7B"/></svg>`,
  humanoid_monster_v1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><ellipse cx="24" cy="14" rx="14" ry="12" fill="#6B8A52"/><rect x="12" y="24" width="24" height="20" rx="4" fill="#6B8A52"/></svg>`,
  siege_static_v1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect x="16" y="16" width="32" height="24" rx="4" fill="#8E8A80"/><circle cx="12" cy="40" r="8" fill="#6B6B6B"/><circle cx="52" cy="40" r="8" fill="#6B6B6B"/></svg>`,
};

// ─── Default palette for monsters/animals ────────────────────────────────────
const monsterPalette: PaletteTokens = { ...defaultPalette, skin: "#6B8A52", hair: "#2A3A1E", primaryCloth: "#4A3C28" };
const quadrupedPalette: PaletteTokens = { ...defaultPalette, skin: "#A0896A", hair: "#5C3D1E", primaryCloth: "#7A5C3A" };
const birdPalette: PaletteTokens = { ...defaultPalette, skin: "#C89A7B", hair: "#1A3A2A", primaryCloth: "#7A9E7E", secondaryCloth: "#5A7E6A" };
const siegePalette: PaletteTokens = { ...defaultPalette, skin: "#8E8A80", primaryCloth: "#5C4A2A", secondaryCloth: "#8A7A5C" };

// ─── Stage 3: per-bone SVG body parts for humanoid_topdown_v1 ─────────────────
//
// Each part is authored with defaultPalette hex values so applyPaletteToSvg
// can substitute them when evaluateScene renders with the entity's palette.
//
// SVG viewBox is centred at (0,0) in template units.
// naturalWidth/naturalHeight match the viewBox width/height exactly.
//
// Z-order (lower = drawn first, further from camera):
//   feet(-900) < knees(-880) < hips(-860) < pelvis(-840) < spine(-820)
//   < chest(-800) < shoulders(-780) < elbows(-760) < hands(-740)
//   < neck(-720) < head(-700) < slot items (0+)
//
// Bone world positions (rest pose, template units, from scratchpad):
//   head(0,-55)  neck(0,-49)  chest(0,-39)  spine(0,-23)  pelvis(0,-5)
//   shoulder_l(-16,-45)  elbow_l(-30,-41)  hand_l(-40,-39)
//   hip_l(-8,-5)  knee_l(-10,11)  foot_l(-11,25)  (right side mirrored)
function humanoidTopdownBoneParts(palette: PaletteTokens): BonePart[] {
  const { skin, outline } = palette;
  return [
    // ── Feet ──────────────────────────────────────────────────────────────
    {
      id: "foot_l", boneId: "foot_l", naturalWidth: 16, naturalHeight: 10,
      localX: 0, localY: 0, zOffset: -900,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -5 16 10"><ellipse cx="0" cy="0" rx="7" ry="4" fill="${skin}" stroke="${outline}" stroke-width="0.5"/><ellipse cx="0" cy="0" rx="5" ry="2.5" fill="${skin}" stroke="${outline}" stroke-width="0.3" opacity="0.5"/></svg>`,
    },
    {
      id: "foot_r", boneId: "foot_r", naturalWidth: 16, naturalHeight: 10,
      localX: 0, localY: 0, zOffset: -899,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -5 16 10"><ellipse cx="0" cy="0" rx="7" ry="4" fill="${skin}" stroke="${outline}" stroke-width="0.5"/><ellipse cx="0" cy="0" rx="5" ry="2.5" fill="${skin}" stroke="${outline}" stroke-width="0.3" opacity="0.5"/></svg>`,
    },
    // ── Knees / lower legs ────────────────────────────────────────────────
    {
      id: "knee_l", boneId: "knee_l", naturalWidth: 12, naturalHeight: 16,
      localX: 0, localY: 0, zOffset: -880,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -8 12 16"><rect x="-5" y="-7" width="10" height="14" rx="4" fill="${skin}" stroke="${outline}" stroke-width="0.6"/><ellipse cx="0" cy="-3" rx="3" ry="2" fill="${skin}" stroke="${outline}" stroke-width="0.4" opacity="0.5"/></svg>`,
    },
    {
      id: "knee_r", boneId: "knee_r", naturalWidth: 12, naturalHeight: 16,
      localX: 0, localY: 0, zOffset: -879,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -8 12 16"><rect x="-5" y="-7" width="10" height="14" rx="4" fill="${skin}" stroke="${outline}" stroke-width="0.6"/><ellipse cx="0" cy="-3" rx="3" ry="2" fill="${skin}" stroke="${outline}" stroke-width="0.4" opacity="0.5"/></svg>`,
    },
    // ── Hips / thighs ─────────────────────────────────────────────────────
    {
      id: "hip_l", boneId: "hip_l", naturalWidth: 14, naturalHeight: 18,
      localX: 0, localY: 0, zOffset: -860,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 -9 14 18"><rect x="-6" y="-8" width="12" height="16" rx="5" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    {
      id: "hip_r", boneId: "hip_r", naturalWidth: 14, naturalHeight: 18,
      localX: 0, localY: 0, zOffset: -859,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 -9 14 18"><rect x="-6" y="-8" width="12" height="16" rx="5" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    // ── Pelvis ────────────────────────────────────────────────────────────
    {
      id: "pelvis", boneId: "pelvis", naturalWidth: 24, naturalHeight: 14,
      localX: 0, localY: 0, zOffset: -840,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -7 24 14"><ellipse cx="0" cy="0" rx="11" ry="6" fill="${skin}" stroke="${outline}" stroke-width="0.7"/></svg>`,
    },
    // ── Spine ─────────────────────────────────────────────────────────────
    {
      id: "spine", boneId: "spine", naturalWidth: 12, naturalHeight: 20,
      localX: 0, localY: 0, zOffset: -820,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -10 12 20"><rect x="-5" y="-9" width="10" height="18" rx="3" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    // ── Chest ─────────────────────────────────────────────────────────────
    {
      id: "chest", boneId: "chest", naturalWidth: 28, naturalHeight: 18,
      localX: 0, localY: 0, zOffset: -800,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -9 28 18"><rect x="-13" y="-8" width="26" height="16" rx="4" fill="${skin}" stroke="${outline}" stroke-width="0.8"/><ellipse cx="-5" cy="-2" rx="5" ry="4" fill="${skin}" stroke="${outline}" stroke-width="0.4" opacity="0.55"/><ellipse cx="5" cy="-2" rx="5" ry="4" fill="${skin}" stroke="${outline}" stroke-width="0.4" opacity="0.55"/></svg>`,
    },
    // ── Shoulders / upper arms ────────────────────────────────────────────
    {
      id: "shoulder_l", boneId: "shoulder_l", naturalWidth: 18, naturalHeight: 14,
      localX: 0, localY: 0, zOffset: -780,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14"><rect x="-8" y="-6" width="16" height="12" rx="5" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    {
      id: "shoulder_r", boneId: "shoulder_r", naturalWidth: 18, naturalHeight: 14,
      localX: 0, localY: 0, zOffset: -779,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14"><rect x="-8" y="-6" width="16" height="12" rx="5" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    // ── Elbows / forearms ─────────────────────────────────────────────────
    {
      id: "elbow_l", boneId: "elbow_l", naturalWidth: 16, naturalHeight: 12,
      localX: 0, localY: 0, zOffset: -760,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -6 16 12"><rect x="-7" y="-5" width="14" height="10" rx="4" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    {
      id: "elbow_r", boneId: "elbow_r", naturalWidth: 16, naturalHeight: 12,
      localX: 0, localY: 0, zOffset: -759,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -6 16 12"><rect x="-7" y="-5" width="14" height="10" rx="4" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    // ── Hands ─────────────────────────────────────────────────────────────
    {
      id: "hand_l", boneId: "hand_l", naturalWidth: 14, naturalHeight: 10,
      localX: 0, localY: 0, zOffset: -740,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 -5 14 10"><ellipse cx="0" cy="0" rx="6" ry="4" fill="${skin}" stroke="${outline}" stroke-width="0.5"/><circle cx="-4" cy="-3" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/><circle cx="-1" cy="-4" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/><circle cx="2" cy="-4" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/><circle cx="5" cy="-3" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/></svg>`,
    },
    {
      id: "hand_r", boneId: "hand_r", naturalWidth: 14, naturalHeight: 10,
      localX: 0, localY: 0, zOffset: -739,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 -5 14 10"><ellipse cx="0" cy="0" rx="6" ry="4" fill="${skin}" stroke="${outline}" stroke-width="0.5"/><circle cx="-4" cy="-3" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/><circle cx="-1" cy="-4" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/><circle cx="2" cy="-4" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/><circle cx="5" cy="-3" r="1.5" fill="${skin}" stroke="${outline}" stroke-width="0.4"/></svg>`,
    },
    // ── Neck ──────────────────────────────────────────────────────────────
    {
      id: "neck", boneId: "neck", naturalWidth: 10, naturalHeight: 10,
      localX: 0, localY: 0, zOffset: -720,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 10 10"><ellipse cx="0" cy="0" rx="4" ry="5" fill="${skin}" stroke="${outline}" stroke-width="0.6"/></svg>`,
    },
    // ── Head ──────────────────────────────────────────────────────────────
    {
      id: "head", boneId: "head", naturalWidth: 28, naturalHeight: 28,
      localX: 0, localY: 0, zOffset: -700,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -14 28 28"><ellipse cx="0" cy="0" rx="12" ry="13" fill="${skin}" stroke="${outline}" stroke-width="0.8"/><ellipse cx="-4" cy="-3" rx="2.5" ry="3" fill="#2B1D18"/><ellipse cx="4" cy="-3" rx="2.5" ry="3" fill="#2B1D18"/><circle cx="-3.2" cy="-3.8" r="0.8" fill="white"/><circle cx="4.8" cy="-3.8" r="0.8" fill="white"/><ellipse cx="0" cy="3" rx="1.5" ry="1" fill="#00000033"/><path d="M-3 7 Q0 9 3 7" stroke="${outline}" stroke-width="0.7" fill="none" stroke-linecap="round"/></svg>`,
    },
  ];
}

export const TEMPLATES: Template[] = [
  {
    id: "humanoid_topdown_v1",
    name: "Humanoid — Top-Down",
    description: "Isometric/top-down humanoid character. Ideal for RPGs, dungeon crawlers, and strategy games.",
    skeletonFamily: "humanoid_topdown_v1",
    viewProfile: "topdown_45",
    entityTypes: ["character", "monster"],
    bones: humanoidTopdownBones,
    slots: humanoidTopdownSlots,
    anchors: {
      hand_r_weapon: { id: "hand_r_weapon", boneId: "hand_r", offsetX: 4, offsetY: 0, rotation: 0 },
      hand_l_weapon: { id: "hand_l_weapon", boneId: "hand_l", offsetX: -4, offsetY: 0, rotation: 0 },
      back_cloak:    { id: "back_cloak",    boneId: "spine",  offsetX: 0, offsetY: 0, rotation: 0 },
      head_crown:    { id: "head_crown",    boneId: "head",   offsetX: 0, offsetY: -14, rotation: 0 },
      head_center:   { id: "head_center",   boneId: "head",   offsetX: 0, offsetY: 0,   rotation: 0 },
      hair_top:      { id: "hair_top",      boneId: "head",   offsetX: 0, offsetY: -11, rotation: 0 },
      forehead:      { id: "forehead",      boneId: "head",   offsetX: 0, offsetY: -7,  rotation: 0 },
      face_center:   { id: "face_center",   boneId: "head",   offsetX: 0, offsetY: -2,  rotation: 0 },
      ear_l:         { id: "ear_l",         boneId: "head",   offsetX: -11, offsetY: -4, rotation: 0 },
      ear_r:         { id: "ear_r",         boneId: "head",   offsetX:  11, offsetY: -4, rotation: 0 },
      beard:         { id: "beard",         boneId: "head",   offsetX: 0, offsetY: 7,   rotation: 0 },
      neck_top:      { id: "neck_top",      boneId: "head",   offsetX: 0, offsetY: 12,  rotation: 0 },
    },
    paletteTokens: defaultPalette,
    baseBodyLayers: [{
      id: "base_naked",
      styleSetId: null,
      svgData: humanoidTopdownBaseSvg(defaultPalette),
      paletteChannels: ["skin", "outline", "shadow"],
      zOffset: 0,
    }],
    boneParts: humanoidTopdownBoneParts(defaultPalette),
    previewWidth: 128,
    previewHeight: 128,
    thumbnailSvg: thumbnails.humanoid_topdown_v1,
  },
  {
    id: "humanoid_side_v1",
    name: "Humanoid — Side View",
    description: "Side-scrolling humanoid. Perfect for platformers, farm games, and action RPGs.",
    skeletonFamily: "humanoid_side_v1",
    viewProfile: "side_view",
    entityTypes: ["character", "monster"],
    bones: humanoidTopdownBones,
    slots: humanoidTopdownSlots.map(s => ({ ...s, id: s.id.replace("slot_", "side_slot_") })),
    anchors: {
      hand_r_weapon: { id: "hand_r_weapon", boneId: "hand_r", offsetX: 6, offsetY: 0, rotation: -20 },
      hand_l_weapon: { id: "hand_l_weapon", boneId: "hand_l", offsetX: 6, offsetY: 0, rotation: 20 },
      back_cloak:    { id: "back_cloak",    boneId: "spine",  offsetX: -6, offsetY: 0, rotation: 0 },
      head_center:   { id: "head_center",   boneId: "head",   offsetX: 0, offsetY: 0,   rotation: 0 },
      hair_top:      { id: "hair_top",      boneId: "head",   offsetX: 0, offsetY: -11, rotation: 0 },
      forehead:      { id: "forehead",      boneId: "head",   offsetX: 0, offsetY: -7,  rotation: 0 },
      face_center:   { id: "face_center",   boneId: "head",   offsetX: 0, offsetY: -2,  rotation: 0 },
      ear_l:         { id: "ear_l",         boneId: "head",   offsetX: -11, offsetY: -4, rotation: 0 },
      ear_r:         { id: "ear_r",         boneId: "head",   offsetX:  11, offsetY: -4, rotation: 0 },
      beard:         { id: "beard",         boneId: "head",   offsetX: 0, offsetY: 7,   rotation: 0 },
      neck_top:      { id: "neck_top",      boneId: "head",   offsetX: 0, offsetY: 12,  rotation: 0 },
    },
    paletteTokens: defaultPalette,
    baseBodyLayers: [{
      id: "base_naked_side",
      styleSetId: null,
      svgData: humanoidSideBaseSvg(defaultPalette),
      paletteChannels: ["skin", "outline", "shadow"],
      zOffset: 0,
    }],
    previewWidth: 128,
    previewHeight: 192,
    thumbnailSvg: thumbnails.humanoid_side_v1,
  },
  {
    id: "quadruped_side_v1",
    name: "Quadruped — Side View",
    description: "Four-legged animals: horses, wolves, cows, boars, dogs. Supports mounts, mobs, and farm animals.",
    skeletonFamily: "quadruped_side_v1",
    viewProfile: "side_view",
    entityTypes: ["animal"],
    bones: [
      { id: "root", name: "Root", parentId: null, restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
      { id: "body", name: "Body", parentId: "root", restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 54 },
      { id: "neck", name: "Neck", parentId: "body", restPose: { tx: -44, ty: -18, rotation: -20, scaleX: 1, scaleY: 1 }, length: 20 },
      { id: "head", name: "Head", parentId: "neck", restPose: { tx: -14, ty: -14, rotation: -10, scaleX: 1, scaleY: 1 }, length: 18 },
      { id: "tail", name: "Tail", parentId: "body", restPose: { tx: 52, ty: -8, rotation: 30, scaleX: 1, scaleY: 1 }, length: 24 },
      { id: "front_leg_l", name: "Front Leg L", parentId: "body", restPose: { tx: -30, ty: 28, rotation: 0, scaleX: 1, scaleY: 1 }, length: 28 },
      { id: "front_leg_r", name: "Front Leg R", parentId: "body", restPose: { tx: -18, ty: 28, rotation: 0, scaleX: 1, scaleY: 1 }, length: 28 },
      { id: "back_leg_l", name: "Back Leg L", parentId: "body", restPose: { tx: 22, ty: 28, rotation: 0, scaleX: 1, scaleY: 1 }, length: 28 },
      { id: "back_leg_r", name: "Back Leg R", parentId: "body", restPose: { tx: 34, ty: 28, rotation: 0, scaleX: 1, scaleY: 1 }, length: 28 },
    ],
    slots: [
      { id: "quad_saddle", name: "Saddle", boneId: "body", zIndex: 5, allowedCategories: ["creature_saddle"], required: false, defaultItemId: null },
      { id: "quad_pack_l", name: "Pack Left", boneId: "body", zIndex: 6, allowedCategories: ["creature_pack"], required: false, defaultItemId: null },
      { id: "quad_pack_r", name: "Pack Right", boneId: "body", zIndex: 7, allowedCategories: ["creature_pack"], required: false, defaultItemId: null },
      { id: "quad_horn_l", name: "Horn Left", boneId: "head", zIndex: 8, allowedCategories: ["creature_horn"], required: false, defaultItemId: null },
      { id: "quad_horn_r", name: "Horn Right", boneId: "head", zIndex: 9, allowedCategories: ["creature_horn"], required: false, defaultItemId: null },
      { id: "quad_armor", name: "Barding", boneId: "body", zIndex: 4, allowedCategories: ["torso"], required: false, defaultItemId: null },
    ],
    anchors: {
      saddle: { id: "saddle", boneId: "body", offsetX: 0, offsetY: -28, rotation: 0 },
      pack_left: { id: "pack_left", boneId: "body", offsetX: 10, offsetY: -20, rotation: 0 },
      pack_right: { id: "pack_right", boneId: "body", offsetX: -10, offsetY: -20, rotation: 0 },
      horn_l: { id: "horn_l", boneId: "head", offsetX: -8, offsetY: -16, rotation: -30 },
      horn_r: { id: "horn_r", boneId: "head", offsetX: 8, offsetY: -16, rotation: 30 },
      mouth: { id: "mouth", boneId: "head", offsetX: -20, offsetY: 4, rotation: 0 },
      tail_tip: { id: "tail_tip", boneId: "tail", offsetX: 24, offsetY: 0, rotation: 0 },
    },
    paletteTokens: quadrupedPalette,
    baseBodyLayers: [{
      id: "base_quadruped",
      styleSetId: null,
      svgData: quadrupedSideBaseSvg(quadrupedPalette),
      paletteChannels: ["skin", "outline"],
      zOffset: 0,
    }],
    previewWidth: 192,
    previewHeight: 128,
    thumbnailSvg: thumbnails.quadruped_side_v1,
  },
  {
    id: "bird_side_v1",
    name: "Bird — Side View",
    description: "Winged creatures: ravens, eagles, parrots, fantasy birds. Supports mounted and wild variants.",
    skeletonFamily: "bird_side_v1",
    viewProfile: "side_view",
    entityTypes: ["animal"],
    bones: [
      { id: "root", name: "Root", parentId: null, restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 8 },
      { id: "body", name: "Body", parentId: "root", restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 36 },
      { id: "neck", name: "Neck", parentId: "body", restPose: { tx: -28, ty: -16, rotation: -15, scaleX: 1, scaleY: 1 }, length: 14 },
      { id: "head", name: "Head", parentId: "neck", restPose: { tx: -10, ty: -12, rotation: -5, scaleX: 1, scaleY: 1 }, length: 16 },
      { id: "wing_l", name: "Wing L", parentId: "body", restPose: { tx: 0, ty: -8, rotation: 15, scaleX: 1, scaleY: 1 }, length: 40 },
      { id: "wing_r", name: "Wing R", parentId: "body", restPose: { tx: 0, ty: -8, rotation: -15, scaleX: 1, scaleY: 1 }, length: 40 },
      { id: "tail", name: "Tail", parentId: "body", restPose: { tx: 36, ty: 0, rotation: 20, scaleX: 1, scaleY: 1 }, length: 20 },
      { id: "leg_l", name: "Leg L", parentId: "body", restPose: { tx: -4, ty: 26, rotation: 0, scaleX: 1, scaleY: 1 }, length: 20 },
      { id: "leg_r", name: "Leg R", parentId: "body", restPose: { tx: 8, ty: 26, rotation: 0, scaleX: 1, scaleY: 1 }, length: 20 },
    ],
    slots: [
      { id: "bird_wing_l", name: "Wing L Attachment", boneId: "wing_l", zIndex: 3, allowedCategories: ["creature_wing"], required: false, defaultItemId: null },
      { id: "bird_wing_r", name: "Wing R Attachment", boneId: "wing_r", zIndex: 4, allowedCategories: ["creature_wing"], required: false, defaultItemId: null },
      { id: "bird_crest", name: "Crest", boneId: "head", zIndex: 5, allowedCategories: ["creature_horn"], required: false, defaultItemId: null },
      { id: "bird_tail", name: "Tail Feathers", boneId: "tail", zIndex: 2, allowedCategories: ["creature_tail"], required: false, defaultItemId: null },
      { id: "bird_back", name: "Back", boneId: "body", zIndex: 6, allowedCategories: ["creature_shell", "creature_pack"], required: false, defaultItemId: null },
    ],
    anchors: {
      wing_l: { id: "wing_l", boneId: "wing_l", offsetX: 40, offsetY: 0, rotation: 0 },
      wing_r: { id: "wing_r", boneId: "wing_r", offsetX: 40, offsetY: 0, rotation: 0 },
      tail_tip: { id: "tail_tip", boneId: "tail", offsetX: 20, offsetY: 0, rotation: 0 },
      back_shell: { id: "back_shell", boneId: "body", offsetX: 0, offsetY: -18, rotation: 0 },
      mouth: { id: "mouth", boneId: "head", offsetX: -16, offsetY: 2, rotation: 0 },
    },
    paletteTokens: birdPalette,
    baseBodyLayers: [{
      id: "base_bird",
      styleSetId: null,
      svgData: birdSideBaseSvg(birdPalette),
      paletteChannels: ["skin", "primaryCloth", "secondaryCloth", "accent", "outline", "hair"],
      zOffset: 0,
    }],
    previewWidth: 160,
    previewHeight: 128,
    thumbnailSvg: thumbnails.bird_side_v1,
  },
  {
    id: "humanoid_monster_v1",
    name: "Monster Humanoid",
    description: "Large bipedal monsters: orcs, trolls, demons, undead knights. Heavier proportions, claws, fangs.",
    skeletonFamily: "humanoid_monster_v1",
    viewProfile: "topdown_45",
    entityTypes: ["monster"],
    bones: humanoidTopdownBones.map(b => ({
      ...b,
      restPose: {
        ...b.restPose,
        scaleX: b.id === "chest" || b.id === "pelvis" ? 1.3 : 1,
        scaleY: b.id === "chest" || b.id === "pelvis" ? 1.1 : 1,
      },
    })),
    slots: humanoidTopdownSlots.map(s => ({ ...s, id: s.id.replace("slot_", "monster_slot_") })),
    anchors: {
      hand_r_weapon: { id: "hand_r_weapon", boneId: "hand_r", offsetX: 6, offsetY: 0, rotation: 0 },
      hand_l_weapon: { id: "hand_l_weapon", boneId: "hand_l", offsetX: -6, offsetY: 0, rotation: 0 },
      horn_l: { id: "horn_l", boneId: "head", offsetX: -12, offsetY: -14, rotation: -30 },
      horn_r: { id: "horn_r", boneId: "head", offsetX: 12, offsetY: -14, rotation: 30 },
    },
    paletteTokens: monsterPalette,
    baseBodyLayers: [{
      id: "base_monster",
      styleSetId: null,
      svgData: humanoidMonsterBaseSvg(monsterPalette),
      paletteChannels: ["skin", "outline"],
      zOffset: 0,
    }],
    previewWidth: 128,
    previewHeight: 128,
    thumbnailSvg: thumbnails.humanoid_monster_v1,
  },
  {
    id: "siege_static_v1",
    name: "Siege / Static Object",
    description: "Catapults, chests, barrels, trees, buildings. Non-animated or simple idle animations.",
    skeletonFamily: "siege_static_v1",
    viewProfile: "isometric_34",
    entityTypes: ["static_object"],
    bones: [
      { id: "root", name: "Root", parentId: null, restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
      { id: "base", name: "Base", parentId: "root", restPose: { tx: 0, ty: 20, rotation: 0, scaleX: 1, scaleY: 1 }, length: 20 },
      { id: "arm_main", name: "Main Arm", parentId: "base", restPose: { tx: 0, ty: -20, rotation: 0, scaleX: 1, scaleY: 1 }, length: 50 },
      { id: "arm_counter", name: "Counter Arm", parentId: "base", restPose: { tx: 0, ty: -20, rotation: 180, scaleX: 1, scaleY: 1 }, length: 30 },
    ],
    slots: [
      { id: "siege_ammo", name: "Ammo", boneId: "arm_main", zIndex: 5, allowedCategories: ["static_part"], required: false, defaultItemId: null },
      { id: "siege_armor", name: "Armor Plating", boneId: "base", zIndex: 4, allowedCategories: ["torso"], required: false, defaultItemId: null },
    ],
    anchors: {
      launch_point: { id: "launch_point", boneId: "arm_main", offsetX: 50, offsetY: 0, rotation: 0 },
      counter_weight: { id: "counter_weight", boneId: "arm_counter", offsetX: 30, offsetY: 0, rotation: 0 },
    },
    paletteTokens: siegePalette,
    baseBodyLayers: [{
      id: "base_siege",
      styleSetId: null,
      svgData: siegeStaticBaseSvg(siegePalette),
      paletteChannels: ["metal", "primaryCloth", "secondaryCloth", "outline"],
      zOffset: 0,
    }],
    previewWidth: 192,
    previewHeight: 128,
    thumbnailSvg: thumbnails.siege_static_v1,
  },
];

export function cloneTemplates(): Template[] {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(TEMPLATES);
  }
  return JSON.parse(JSON.stringify(TEMPLATES)) as Template[];
}

const REFRESHED_BUILTIN_TEMPLATE_IDS = new Set([
  "humanoid_topdown_v1",
]);

function cloneTemplate(template: Template): Template {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(template);
  }
  return JSON.parse(JSON.stringify(template)) as Template;
}

function mergeUserSlotTransforms(canonical: Template, saved: Template): Template {
  const savedSlots = new Map(saved.slots.map(slot => [slot.id, slot]));
  return {
    ...canonical,
    slots: canonical.slots.map(slot => {
      const savedSlot = savedSlots.get(slot.id);
      if (!savedSlot) return slot;
      return {
        ...slot,
        defaultAnchorId: savedSlot.defaultAnchorId ?? slot.defaultAnchorId,
        defaultTransform: savedSlot.defaultTransform ?? slot.defaultTransform,
      };
    }),
  };
}

export function refreshCanonicalBuiltInTemplate(template: Template): Template {
  if (!REFRESHED_BUILTIN_TEMPLATE_IDS.has(template.id)) {
    return template;
  }
  const canonical = TEMPLATES.find(t => t.id === template.id);
  if (!canonical) return template;
  return mergeUserSlotTransforms(cloneTemplate(canonical), template);
}

export function refreshCanonicalBuiltInTemplates(templates: Template[]): Template[] {
  return templates.map(refreshCanonicalBuiltInTemplate);
}

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesForEntityType(type: string): Template[] {
  return TEMPLATES.filter(t => t.entityTypes.includes(type as any));
}

/**
 * Resolve a template by ID.
 * Checks project.templates first (imported / custom templates),
 * then the built-in TEMPLATES registry.
 * Always prefer this over getTemplateById() when a Project is in scope.
 */
export function resolveTemplate(
  project: { templates: Template[] },
  id: string,
): Template | undefined {
  const projectTemplate = project.templates.find(t => t.id === id);
  return projectTemplate
    ? refreshCanonicalBuiltInTemplate(projectTemplate)
    : TEMPLATES.find(t => t.id === id);
}
