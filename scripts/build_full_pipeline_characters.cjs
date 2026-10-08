const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9229;
const userDataDir = 'C:\\Temp\\chrome-pipeline-chars';

try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1600,1000',
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-first-run',
  `--user-data-dir=${userDataDir}`,
  'http://localhost:5173/'
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

class CDPRunner {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(code) {
    const res = await this.send('Runtime.evaluate', {
      expression: `(function(){ ${code} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (res?.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res?.result?.value;
  }

  async shot(filename, delay = 800) {
    await sleep(delay);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const dest = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(dest, buffer);
    console.log(`[OK] Saved ${filename} (${buffer.length} bytes)`);
  }
}

async function run() {
  let listRes = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      listRes = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (listRes && listRes.length > 0) break;
    } catch (e) {}
  }

  const page = listRes.find(t => t.type === 'page');
  const cdp = new CDPRunner(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  await sleep(2500);

  // =========================================================================
  // ПЕРСОНАЖ 1: БОРОДАТЫЙ ТОРГОВЕЦ
  // =========================================================================
  console.log('=== 1. ПЕРСОНАЖ 1: ШАГ 1 — СОЗДАНИЕ И АНАТОМИЯ ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    if (store) {
      store.newProject();
      store.setProjectName("Бородатый Торговец");
      store.createEntity("character", "biped_profile_sturdy_v1", "Бородатый Торговец");
      const entityId = store.project.activeEntityId;
      if (entityId) {
        store.setEntityBodyMorphValue(entityId, "muscle", 0.4);
        store.setEntityBodyMorphValue(entityId, "fat", 0.6);
        store.setEntityPaletteToken(entityId, "hair", "#4B382A");
        store.setEntityPaletteToken(entityId, "skin", "#D8A880");
        store.setEntityFaceFeature(entityId, "hair", { presetId: "curls" });
        store.setEntityFaceFeature(entityId, "beard", { presetId: "full_short" });
        store.setEntityFaceFeature(entityId, "eyes", { presetId: "iris_round" });
        store.setEntityAppearance(entityId, { nose: "broad" });
      }
    }
  `);
  await sleep(800);
  await cdp.shot('step1_char1_body_appearance.png', 1000);

  console.log('=== 2. ПЕРСОНАЖ 1: ШАГ 2 — ЭКИПИРОВКА И ОДЕЖДА ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setEntitySlot(entityId, "slot_torso", "hunter_jacket_25d");
      store.setEntitySlot(entityId, "slot_legs", "trader_breeches_25d");
      store.setEntitySlot(entityId, "slot_foot_l", "trader_boots_25d");
      store.setEntitySlot(entityId, "slot_weapon_main", "peasant_axe_25d");
      store.setAppState("ide");
    }
    document.querySelector('[data-testid="workspace-equipment"]')?.click();
  `);
  await sleep(800);
  await cdp.shot('step2_char1_equipment.png', 1000);

  console.log('=== 3. ПЕРСОНАЖ 1: ШАГ 3 — АНИМАЦИЯ И ВОСПРОИЗВЕДЕНИЕ ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setAnimBottomTab("timeline");
      store.setEntityActiveAnimation(entityId, "chibi_profile__axe_chop");
      store.setPlaybackPlaying(true);
    }
    document.querySelector('[data-testid="workspace-animate"]')?.click();
  `);
  await sleep(1000);
  await cdp.shot('step3_char1_animation_timeline.png', 1000);

  // =========================================================================
  // ПЕРСОНАЖ 2: МОЛОДОЙ ВОИН СО ШРАМОМ
  // =========================================================================
  console.log('=== 4. ПЕРСОНАЖ 2: ШАГ 1 — СОЗДАНИЕ И АНАТОМИЯ ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    if (store) {
      store.newProject();
      store.setProjectName("Молодой Воин");
      store.createEntity("character", "biped_profile_base_v1", "Молодой Воин");
      const entityId = store.project.activeEntityId;
      if (entityId) {
        store.setEntityBodyMorphValue(entityId, "muscle", 0.9);
        store.setEntityBodyMorphValue(entityId, "slimness", 0.0);
        store.setEntityPaletteToken(entityId, "hair", "#5C3928");
        store.setEntityPaletteToken(entityId, "skin", "#E8AF88");
        store.setEntityFaceFeature(entityId, "hair", { presetId: "messy_short" });
        store.setEntityFaceFeature(entityId, "eyes", { presetId: "dot_cute" });
        store.setEntityAppearance(entityId, { scar: "eye", nose: "straight" });
      }
    }
    document.querySelector('[data-testid="workspace-character"]')?.click();
  `);
  await sleep(800);
  await cdp.shot('step1_char2_body_appearance.png', 1000);

  console.log('=== 5. ПЕРСОНАЖ 2: ШАГ 2 — ЭКИПИРОВКА И ОДЕЖДА ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setEntitySlot(entityId, "slot_torso", "peasant_shirt_25d");
      store.setEntitySlot(entityId, "slot_legs", "peasant_trousers_25d");
      store.setEntitySlot(entityId, "slot_foot_l", "peasant_boots_25d");
      store.setEntitySlot(entityId, "slot_weapon_main", "iron_sword_25d");
      store.setAppState("ide");
    }
    document.querySelector('[data-testid="workspace-equipment"]')?.click();
  `);
  await sleep(800);
  await cdp.shot('step2_char2_equipment.png', 1000);

  console.log('=== 6. ПЕРСОНАЖ 2: ШАГ 3 — АНИМАЦИЯ УДАРА МЕЧОМ ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setAnimBottomTab("timeline");
      store.setEntityActiveAnimation(entityId, "chibi_profile__sword_slash");
      store.setPlaybackPlaying(true);
    }
    document.querySelector('[data-testid="workspace-animate"]')?.click();
  `);
  await sleep(1000);
  await cdp.shot('step3_char2_animation_sword.png', 1000);

  console.log('=== ALL 6 STAGE SCREENSHOTS COMPLETED! ===');
  chrome.kill();
  process.exit(0);
}

run();
