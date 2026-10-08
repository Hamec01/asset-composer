const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9230;
const userDataDir = 'C:\\Temp\\chrome-live-creation';

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
  // ПЕРСОНАЖ 1: БОРОДАТЫЙ КРЕСТЬЯНИН / ТОРГОВЕЦ
  // =========================================================================
  console.log('--- 1. Создаем проект и персонажа 1 ---');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    if (store) {
      store.newProject();
      store.setProjectName("Medieval Characters");
      store.createEntity("character", "biped_profile_sturdy_v1", "Бородатый Крестьянин");
      const entityId = store.project.activeEntityId;
      if (entityId) {
        store.setEntityAppearance(entityId, { view: "right", sex: "male", muscle: 30, fat: 60, nose: "broad" });
        store.setEntityPaletteToken(entityId, "skin", "#D8A880");
        store.setEntityPaletteToken(entityId, "hair", "#4B382A");
        store.setEntityFaceFeature(entityId, "hair", { presetId: "curls", visible: true });
        store.setEntityFaceFeature(entityId, "beard", { presetId: "full_short", visible: true });
        store.setEntityFaceFeature(entityId, "eyes", { presetId: "iris_round", visible: true });
      }
    }
  `);
  await sleep(600);

  // Скриншот Шаг 1: Персонаж готов
  console.log('--- Скриншот: Шаг 1 (Анатомия и лицо персонажа 1) ---');
  await cdp.eval(`document.querySelector('[data-testid="workspace-character"]')?.click()`);
  await cdp.shot('live_step1_peasant_character.png', 1000);

  // Шаг 2: Надеваем вещи (зеленый жилет, штаны, сапоги, топор)
  console.log('--- 2. Одеваем персонажа 1 ---');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setEntitySlot(entityId, "slot_torso", "hunter_jacket_25d");
      store.setEntitySlot(entityId, "slot_legs", "trader_breeches_25d");
      store.setEntitySlot(entityId, "slot_foot_l", "trader_boots_25d");
      store.setEntitySlot(entityId, "slot_weapon_main", "peasant_axe_25d");
    }
  `);
  await sleep(600);

  // Скриншот Шаг 2: Вещи надеты
  console.log('--- Скриншот: Шаг 2 (Одежда и оружие персонажа 1) ---');
  await cdp.eval(`document.querySelector('[data-testid="workspace-equipment"]')?.click()`);
  await cdp.shot('live_step2_peasant_equipment.png', 1000);

  // Шаг 3: Включаем анимацию (ходьба / атака топором)
  console.log('--- 3. Запускаем анимацию персонажа 1 ---');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setAnimBottomTab("timeline");
      store.setEntityActiveAnimation(entityId, "chibi_profile__axe_chop");
      store.setPlaybackPlaying(true);
    }
  `);
  await sleep(600);

  // Скриншот Шаг 3: Анимация играет на таймлайне
  console.log('--- Скриншот: Шаг 3 (Анимация персонажа 1) ---');
  await cdp.eval(`document.querySelector('[data-testid="workspace-animate"]')?.click()`);
  await cdp.shot('live_step3_peasant_animation.png', 1000);

  // =========================================================================
  // ПЕРСОНАЖ 2: МОЛОДОЙ ВОИН СО ШРАМОМ
  // =========================================================================
  console.log('--- 4. Создаем персонажа 2 (Молодой Воин) ---');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    if (store) {
      store.createEntity("character", "biped_profile_base_v1", "Молодой Воин");
      const entityId = store.project.activeEntityId;
      if (entityId) {
        store.setEntityAppearance(entityId, { view: "right", sex: "male", muscle: 90, slimness: 0, scar: "eye", nose: "straight" });
        store.setEntityPaletteToken(entityId, "skin", "#E8AF88");
        store.setEntityPaletteToken(entityId, "hair", "#5C3928");
        store.setEntityFaceFeature(entityId, "hair", { presetId: "messy_short", visible: true });
        store.setEntityFaceFeature(entityId, "eyes", { presetId: "dot_cute", visible: true });
      }
    }
  `);
  await sleep(600);

  // Скриншот Шаг 1 (Воин): Анатомия и шрам
  console.log('--- Скриншот: Шаг 1 (Анатомия и лицо персонажа 2) ---');
  await cdp.eval(`document.querySelector('[data-testid="workspace-character"]')?.click()`);
  await cdp.shot('live_step1_warrior_character.png', 1000);

  // Шаг 2 (Воин): Одежда (льняная рубаха, штаны, меч)
  console.log('--- 5. Одеваем персонажа 2 ---');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setEntitySlot(entityId, "slot_torso", "peasant_shirt_25d");
      store.setEntitySlot(entityId, "slot_legs", "peasant_trousers_25d");
      store.setEntitySlot(entityId, "slot_foot_l", "peasant_boots_25d");
      store.setEntitySlot(entityId, "slot_weapon_main", "iron_sword_25d");
    }
  `);
  await sleep(600);

  // Скриншот Шаг 2 (Воин): Одежда
  console.log('--- Скриншот: Шаг 2 (Одежда и меч персонажа 2) ---');
  await cdp.eval(`document.querySelector('[data-testid="workspace-equipment"]')?.click()`);
  await cdp.shot('live_step2_warrior_equipment.png', 1000);

  // Шаг 3 (Воин): Анимация удара мечом
  console.log('--- 6. Запускаем анимацию меча персонажа 2 ---');
  await cdp.eval(`
    const store = window.__STORE__?.getState();
    const entityId = store?.project?.activeEntityId;
    if (store && entityId) {
      store.setAnimBottomTab("timeline");
      store.setEntityActiveAnimation(entityId, "chibi_profile__sword_slash");
      store.setPlaybackPlaying(true);
    }
  `);
  await sleep(600);

  // Скриншот Шаг 3 (Воин): Анимация
  console.log('--- Скриншот: Шаг 3 (Анимация удара мечом персонажа 2) ---');
  await cdp.eval(`document.querySelector('[data-testid="workspace-animate"]')?.click()`);
  await cdp.shot('live_step3_warrior_animation.png', 1000);

  console.log('=== ГОТОВО! Все шаги выполнены и зафиксированы. ===');
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  chrome.kill();
  process.exit(1);
});
