const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2\\screenshots';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9226;
const userDataDir = 'C:\\Temp\\chrome-capture-all-views';

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

  async shot(filename, delay = 700) {
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
    await sleep(500);
    try {
      listRes = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (listRes && listRes.length > 0) break;
    } catch (e) {}
  }

  if (!listRes) {
    console.error('Could not connect to Chrome debugging port.');
    chrome.kill();
    return;
  }

  const page = listRes.find(t => t.type === 'page');
  if (!page) {
    console.error('No page target found');
    chrome.kill();
    return;
  }

  const cdp = new CDPRunner(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  await sleep(2500);

  // --- 1. Main Initial Screen: Персонаж Appearance ---
  console.log('Capturing Initial Character Workspace...');
  await cdp.shot('03_workspace_character_appearance_eyes.png');

  // --- 2. Workspace: Character -> Hair ---
  console.log('Capturing Hair...');
  await cdp.eval(`
    const hairBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Волосы'));
    if (hairBtn) hairBtn.click();
  `);
  await cdp.shot('04_workspace_character_appearance_hair.png');

  // --- 3. Workspace: Character -> Body ---
  console.log('Capturing Body Appearance...');
  await cdp.eval(`
    const bodyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Тело'));
    if (bodyBtn) bodyBtn.click();
  `);
  await cdp.shot('05_workspace_character_appearance_body.png');

  // --- 4. Library Tab: Части тела (Bones / Slots Hierarchy) ---
  console.log('Capturing Body Parts Hierarchy...');
  await cdp.eval(`
    const partsTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Части тела'));
    if (partsTab) partsTab.click();
  `);
  await cdp.shot('06_library_body_parts.png');

  // --- 5. Library Tab: Персонажи (Entities) ---
  console.log('Capturing Entities...');
  await cdp.eval(`
    const entTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Персонажи'));
    if (entTab) entTab.click();
  `);
  await cdp.shot('07_library_personazhi.png');

  // --- 6. Library Tab: Крепления (Attachment points) ---
  console.log('Capturing Attachments...');
  await cdp.eval(`
    const attTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Крепления'));
    if (attTab) attTab.click();
  `);
  await cdp.shot('08_library_attachments.png');

  // --- 7. Workspace: Рисование (Sprite Editor) ---
  console.log('Capturing Workspace: Draw...');
  await cdp.eval(`
    const drawBtn = document.querySelector('[data-testid="workspace-draw"]');
    if (drawBtn) drawBtn.click();
  `);
  await cdp.shot('09_workspace_draw_sprite_editor.png', 1200);

  // --- 8. Workspace: Экипировка (Equipment) ---
  console.log('Capturing Workspace: Equipment...');
  await cdp.eval(`
    const eqBtn = document.querySelector('[data-testid="workspace-equipment"]');
    if (eqBtn) eqBtn.click();
  `);
  await cdp.shot('10_workspace_equipment_catalog.png', 1200);

  // --- 9. Workspace: Анимация (Timeline) ---
  console.log('Capturing Workspace: Animate...');
  await cdp.eval(`
    const animBtn = document.querySelector('[data-testid="workspace-animate"]');
    if (animBtn) animBtn.click();
  `);
  await cdp.shot('11_workspace_animate_timeline.png', 1200);

  // --- 10. Bottom Panel: Предпросмотр (Pixi Preview) ---
  console.log('Capturing Bottom Panel: Pixi Preview...');
  await cdp.eval(`
    const prevTab = document.querySelector('[data-testid="bottom-tab-preview"]');
    if (prevTab) prevTab.click();
  `);
  await cdp.shot('12_bottom_panel_preview.png', 1200);

  // --- 11. Bottom Panel: Состояния (State Machine) ---
  console.log('Capturing Bottom Panel: State Machine...');
  await cdp.eval(`
    const smTab = document.querySelector('[data-testid="bottom-tab-statemachine"]');
    if (smTab) smTab.click();
  `);
  await cdp.shot('13_bottom_panel_statemachine.png', 1200);

  // --- 12. Bottom Panel: Редактор (Authoring) ---
  console.log('Capturing Bottom Panel: Authoring...');
  await cdp.eval(`
    const authTab = document.querySelector('[data-testid="bottom-tab-authoring"]');
    if (authTab) authTab.click();
  `);
  await cdp.shot('14_bottom_panel_authoring.png', 1200);

  // --- 13. Inspector Details (Body part selected) ---
  console.log('Capturing Inspector...');
  await cdp.eval(`
    const charBtn = document.querySelector('[data-testid="workspace-character"]');
    if (charBtn) charBtn.click();
    const partsTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Части тела'));
    if (partsTab) partsTab.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const node = document.querySelector('[data-testid^="body-part-"]') || Array.from(document.querySelectorAll('div, button')).find(el => el.textContent && el.textContent.includes('Голова') || el.textContent.includes('Торс'));
    if (node) node.click();
  `);
  await cdp.shot('15_inspector_details.png', 800);

  // --- 14. Export Dialog ---
  console.log('Capturing Export Dialog...');
  await cdp.eval(`
    const exportBtn = document.querySelector('[data-testid="toolbar-export"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Экспорт'));
    if (exportBtn) exportBtn.click();
  `);
  await cdp.shot('16_export_dialog.png', 1200);

  // Close Export Dialog
  await cdp.eval(`
    const closeBtn = document.querySelector('button[aria-label="Close"], [data-testid="dialog-close"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Отмена'));
    if (closeBtn) closeBtn.click();
  `);
  await sleep(500);

  // --- 15. Dashboard & Wizard ---
  console.log('Capturing Dashboard & Wizard...');
  await cdp.eval(`
    const homeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('lucide-home') || b.getAttribute('title') === 'Dashboard' || b.getAttribute('aria-label') === 'Home');
    if (homeBtn) homeBtn.click();
  `);
  await cdp.shot('01_dashboard.png', 1000);

  await cdp.eval(`
    const newBtn = document.querySelector('[data-testid="dashboard-new"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Новый проект'));
    if (newBtn) newBtn.click();
  `);
  await cdp.shot('02_wizard_body_type.png', 800);

  console.log('=== ALL 16 SECTIONS CAPTURED SUCCESSFULLY! ===');
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Error during run:', err);
  chrome.kill();
  process.exit(1);
});
