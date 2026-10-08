const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2\\screenshots';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9227;
const userDataDir = 'C:\\Temp\\chrome-capture-dash';

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
    return res?.result?.value;
  }

  async shot(filename, delay = 600) {
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

  // 1. Return to dashboard
  console.log('Navigating to Dashboard...');
  await cdp.eval(`
    const dashBtn = document.querySelector('[data-testid="toolbar-back-dashboard"]');
    if (dashBtn) dashBtn.click();
  `);
  await cdp.shot('01_dashboard.png', 1000);

  // 2. Open wizard from dashboard
  console.log('Opening Wizard...');
  await cdp.eval(`
    const newBtn = document.querySelector('[data-testid="dashboard-new"]');
    if (newBtn) newBtn.click();
  `);
  await cdp.shot('02_wizard_body_type.png', 800);

  // 3. Select template to show name input step
  console.log('Template step to Name step...');
  await cdp.eval(`
    const tmpl = document.querySelector('[data-testid^="wizard-template-"]');
    if (tmpl) tmpl.click();
  `);
  await cdp.shot('03_wizard_name.png', 800);

  console.log('Done!');
  chrome.kill();
  process.exit(0);
}

run();
