const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9228;
const userDataDir = 'C:\\Temp\\chrome-capture-chars';

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

  await sleep(2000);

  // --- CHARACTER 1: Bearded Stout Merchant ---
  console.log('1. Setting up Character 1: Bearded Merchant...');
  await cdp.eval(`
    const dashBtn = document.querySelector('[data-testid="toolbar-back-dashboard"]');
    if (dashBtn) dashBtn.click();
  `);
  await sleep(600);

  await cdp.eval(`
    const newBtn = document.querySelector('[data-testid="dashboard-new"]');
    if (newBtn) newBtn.click();
  `);
  await sleep(600);

  // Choose "Крепкое" template
  await cdp.eval(`
    const btns = Array.from(document.querySelectorAll('button'));
    const sturdy = btns.find(b => b.textContent && b.textContent.includes('Крепкое')) || document.querySelector('[data-testid*="sturdy"]');
    if (sturdy) sturdy.click();
  `);
  await sleep(500);

  // Set name: "Бородатый Торговец"
  await cdp.eval(`
    const input = document.querySelector('[data-testid="wizard-name-input"]');
    if (input) {
      input.value = "Бородатый Торговец";
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const createBtn = document.querySelector('[data-testid="wizard-create-btn"]');
    if (createBtn) createBtn.click();
  `);
  await sleep(1500);

  // Switch to Equipment and equip Merchant Vest, Breeches, Boots
  await cdp.eval(`
    document.querySelector('[data-testid="workspace-equipment"]')?.click();
  `);
  await sleep(800);

  await cdp.eval(`
    const items = Array.from(document.querySelectorAll('button, div, span'));
    const kamzol = items.find(el => el.textContent && el.textContent.includes('Камзол'));
    if (kamzol) kamzol.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const items = Array.from(document.querySelectorAll('button, div, span'));
    const bridzhi = items.find(el => el.textContent && el.textContent.includes('Бриджи'));
    if (bridzhi) bridzhi.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const items = Array.from(document.querySelectorAll('button, div, span'));
    const sapogi = items.find(el => el.textContent && el.textContent.includes('сапоги'));
    if (sapogi) sapogi.click();
  `);
  await sleep(800);

  // Switch to Character -> Hair
  await cdp.eval(`
    document.querySelector('[data-testid="workspace-character"]')?.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const hairBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Волосы'));
    if (hairBtn) hairBtn.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const hairItems = Array.from(document.querySelectorAll('button, div, span'));
    const kudri = hairItems.find(el => el.textContent && (el.textContent.includes('Кудри') || el.textContent.includes('Взъерошенные')));
    if (kudri) kudri.click();
  `);
  await sleep(800);

  console.log('Capturing Character 1 in engine...');
  await cdp.shot('engine_char1_bearded_merchant.png', 1000);

  // --- CHARACTER 2: Young Scarred Fighter ---
  console.log('2. Setting up Character 2: Young Scarred Fighter...');
  await cdp.eval(`
    const dashBtn = document.querySelector('[data-testid="toolbar-back-dashboard"]');
    if (dashBtn) dashBtn.click();
  `);
  await sleep(600);

  await cdp.eval(`
    const newBtn = document.querySelector('[data-testid="dashboard-new"]');
    if (newBtn) newBtn.click();
  `);
  await sleep(600);

  // Choose "Обычное" template
  await cdp.eval(`
    const btns = Array.from(document.querySelectorAll('button'));
    const standard = btns.find(b => b.textContent && b.textContent.includes('Обычное')) || document.querySelector('[data-testid*="base"]');
    if (standard) standard.click();
  `);
  await sleep(500);

  // Set name: "Молодой Воин"
  await cdp.eval(`
    const input = document.querySelector('[data-testid="wizard-name-input"]');
    if (input) {
      input.value = "Молодой Воин";
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const createBtn = document.querySelector('[data-testid="wizard-create-btn"]');
    if (createBtn) createBtn.click();
  `);
  await sleep(1500);

  // Equip Linen Shirt and Sword
  await cdp.eval(`
    document.querySelector('[data-testid="workspace-equipment"]')?.click();
  `);
  await sleep(800);
  await cdp.eval(`
    const items = Array.from(document.querySelectorAll('button, div, span'));
    const rubaha = items.find(el => el.textContent && el.textContent.includes('рубаха'));
    if (rubaha) rubaha.click();
  `);
  await sleep(400);
  await cdp.eval(`
    const items = Array.from(document.querySelectorAll('button, div, span'));
    const sapogi = items.find(el => el.textContent && el.textContent.includes('сапоги'));
    if (sapogi) sapogi.click();
  `);
  await sleep(400);
  await cdp.eval(`
    const items = Array.from(document.querySelectorAll('button, div, span'));
    const sword = items.find(el => el.textContent && el.textContent.includes('меч'));
    if (sword) sword.click();
  `);
  await sleep(800);

  // Hair style: Взъерошенные
  await cdp.eval(`
    document.querySelector('[data-testid="workspace-character"]')?.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const hairBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Волосы'));
    if (hairBtn) hairBtn.click();
  `);
  await sleep(500);
  await cdp.eval(`
    const hairItems = Array.from(document.querySelectorAll('button, div, span'));
    const vz = hairItems.find(el => el.textContent && (el.textContent.includes('Взъерошенные') || el.textContent.includes('Короткие')));
    if (vz) vz.click();
  `);
  await sleep(800);

  console.log('Capturing Character 2 in engine...');
  await cdp.shot('engine_char2_young_warrior.png', 1000);

  console.log('ALL CUSTOM CHARACTERS CREATED & CAPTURED SUCCESSFULLY!');
  chrome.kill();
  process.exit(0);
}

run();
