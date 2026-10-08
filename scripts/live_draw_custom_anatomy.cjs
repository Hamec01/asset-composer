const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9255;
const userDataDir = 'C:\\Temp\\chrome-full-live-demo';

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
    const res = await sendShot(this);
    if (res) {
      const buffer = Buffer.from(res, 'base64');
      const dest = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(dest, buffer);
      console.log(`[OK] Saved ${filename} (${buffer.length} bytes)`);
    }
  }
}

async function sendShot(cdp) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  return res?.data;
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

  await sleep(2000);

  // =========================================================================
  // ПЕРСОНАЖ 1: КУПЕЦ (ПОЛНЫЙ ЦИКЛ С НУЛЯ)
  // =========================================================================
  console.log('=== ЭТАП 1: Создание проекта и чистой базы тела ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    if (store) {
      store.newProject();
      store.setProjectName("Medieval World");
      store.createEntity("character", "biped_profile_sturdy_v1", "Бородатый Купец");
      const id = store.project.activeEntityId;
      if (id) {
        store.setEntityAppearance(id, { view: "right", sex: "male", muscle: 30, fat: 60, nose: "rounded" });
        store.setEntityPaletteToken(id, "skin", "#E6AF85");
      }
    }
  `);
  await cdp.shot('live_peasant_1_clean_body.png', 1000);

  console.log('=== ЭТАП 2: Отрисовка в Sprite Editor (Голова и Руки) ===');
  await cdp.eval(`document.querySelector('[data-testid="workspace-draw"]')?.click();`);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-testid="edit-body-part-hero_head"]')?.click();`);
  await cdp.shot('live_peasant_2_draw_head.png', 1000);

  await cdp.eval(`document.querySelector('[data-testid="edit-body-part-hero_hand_l"]')?.click();`);
  await cdp.shot('live_peasant_3_draw_hand.png', 1000);

  console.log('=== ЭТАП 3: Отрисовка черт лица, волос и бороды ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const id = store?.project?.activeEntityId;
    if (store && id) {
      store.setActiveAuthoringMode(null);
      store.setCanvasMode("select");
      document.querySelector('[data-testid="workspace-character"]')?.click();
      store.setEntityPaletteToken(id, "hair", "#5A3E2C");
      store.setEntityFaceFeature(id, "hair", { presetId: "merchant_dense_curls", visible: true });
      store.setEntityFaceFeature(id, "beard", { presetId: "merchant_full_beard", visible: true });
      store.setEntityFaceFeature(id, "eyes", { presetId: "wide_shine", visible: true });
      store.setEntityFaceFeature(id, "mouth", { presetId: "neutral", visible: true });
    }
  `);
  await cdp.shot('live_peasant_4_face_and_beard.png', 1000);

  console.log('=== ЭТАП 4: Одежда и экипировка (Стеганый жилет, штаны, сапоги, топор) ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const id = store?.project?.activeEntityId;
    if (store && id) {
      document.querySelector('[data-testid="workspace-equipment"]')?.click();
      store.setEntitySlot(id, "slot_torso", "merchant_quilted_vest_25d");
      store.setEntitySlot(id, "slot_legs", "trader_breeches_25d");
      store.setEntitySlot(id, "slot_foot_l", "trader_boots_25d");
      store.setEntitySlot(id, "slot_weapon_main", "peasant_axe_25d");
    }
  `);
  await cdp.shot('live_peasant_5_equipment.png', 1000);

  console.log('=== ЭТАП 5: Анимация рубки топором ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const id = store?.project?.activeEntityId;
    if (store && id) {
      document.querySelector('[data-testid="workspace-animate"]')?.click();
      store.setAnimBottomTab("timeline");
      store.setEntityActiveAnimation(id, "chibi_profile__axe_chop");
      store.setPlaybackPlaying(true);
    }
  `);
  await cdp.shot('live_peasant_6_animation.png', 1000);

  // =========================================================================
  // ПЕРСОНАЖ 2: МОЛОДОЙ МЕЧНИК СО ШРАМОМ
  // =========================================================================
  console.log('=== ПЕРСОНАЖ 2: Молодой Мечник со шрамом ===');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    if (store) {
      store.createEntity("character", "biped_profile_base_v1", "Молодой Мечник");
      const id = store.project.activeEntityId;
      if (id) {
        store.setEntityAppearance(id, { view: "right", sex: "male", muscle: 90, slimness: 0, scar: "eye", nose: "straight" });
        store.setEntityPaletteToken(id, "skin", "#EAB28D");
        store.setEntityPaletteToken(id, "hair", "#68452D");
        store.setEntityFaceFeature(id, "hair", { presetId: "warrior_spiky_manga", visible: true });
        store.setEntityFaceFeature(id, "beard", { presetId: "warrior_stubble", visible: true });
        store.setEntityFaceFeature(id, "eyes", { presetId: "dot_cute", visible: true });
        store.setEntityFaceFeature(id, "mouth", { presetId: "smirk", visible: true });
        store.setEntitySlot(id, "slot_torso", "warrior_laced_undershirt_25d");
        store.setEntitySlot(id, "slot_legs", "peasant_trousers_25d");
        store.setEntitySlot(id, "slot_foot_l", "warrior_footwraps_25d");
        store.setEntitySlot(id, "slot_weapon_main", "iron_sword_25d");
        store.setEntityActiveAnimation(id, "chibi_profile__sword_slash");
        store.setPlaybackPlaying(true);
      }
    }
  `);
  await cdp.shot('live_warrior_full_stage.png', 1000);

  console.log('=== ВСЕ ЭТАПЫ УСПЕШНО ЗАВЕРШЕНЫ И ЗАФИКСИРОВАНЫ! ===');
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  chrome.kill();
  process.exit(1);
});
