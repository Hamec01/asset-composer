const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2\\screenshots';
const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const PORT = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = new Map();

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => {
        console.log('Connected to target WebSocket');
        resolve();
      };
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
      if (msg.method) {
        const listeners = this.events.get(msg.method) || [];
        for (const fn of listeners) fn(msg.params);
      }
    };
  }

  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res?.exceptionDetails) {
      console.error('Eval error on:', expression, res.exceptionDetails);
    }
    return res?.result?.value;
  }

  async screenshot(filename) {
    await sleep(600);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Captured] ${filename} (${buffer.length} bytes)`);
  }
}

async function main() {
  const userDataDir = 'C:\\Temp\\chrome-asset-composer-dump';
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (e) {}

  console.log(`Launching Chrome: ${CHROME_PATH}`);
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--window-size=1600,1000',
    '--hide-scrollbars',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  let versionInfo = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      versionInfo = await getJson(`http://127.0.0.1:${PORT}/json/version`);
      if (versionInfo && versionInfo.webSocketDebuggerUrl) break;
    } catch (e) {}
  }

  if (!versionInfo) {
    console.error('Failed to get Chrome debug version');
    chrome.kill();
    process.exit(1);
  }

  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  console.log('Page target URL:', pageTarget.webSocketDebuggerUrl);

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;

  client.on('Runtime.consoleAPICalled', (params) => {
    // console.log('[Browser Console]', params.type, params.args.map(a => a.value || a.description).join(' '));
  });

  client.on('Runtime.exceptionThrown', (params) => {
    console.error('[Browser Exception]', params.exceptionDetails?.text, params.exceptionDetails?.exception?.description);
  });

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Navigating to http://localhost:5173/');
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });

  // Wait until #root has content
  console.log('Waiting for DOM content in #root...');
  let loaded = false;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const html = await client.eval(`document.querySelector('#root')?.innerHTML || ''`);
    if (html && html.length > 50) {
      console.log('Root loaded, HTML length:', html.length);
      loaded = true;
      break;
    }
  }

  if (!loaded) {
    console.error('Page failed to render in #root within timeout');
  }

  await sleep(1000);

  // 1. Dashboard screenshot
  console.log('--- 1. Dashboard ---');
  await client.screenshot('01_dashboard.png');

  // 2. Open New Entity Wizard
  console.log('--- 2. Open Wizard ---');
  await client.eval(`
    const btn = document.querySelector('[data-testid="dashboard-new"]');
    if (btn) btn.click();
  `);
  await sleep(800);
  await client.screenshot('02_wizard_body_type.png');

  // 3. Select template to go to name input
  console.log('--- 3. Template Selection ---');
  await client.eval(`
    const tmpl = document.querySelector('[data-testid^="wizard-template-"]');
    if (tmpl) tmpl.click();
  `);
  await sleep(600);
  await client.screenshot('03_wizard_name.png');

  // 4. Create entity and enter IDE
  console.log('--- 4. Enter IDE ---');
  await client.eval(`
    const btn = document.querySelector('[data-testid="wizard-create-btn"]');
    if (btn) btn.click();
  `);
  await sleep(1500);

  // 4. Workspace: Character (Appearance)
  console.log('--- 4. Workspace Character - Appearance ---');
  await client.eval(`
    document.querySelector('[data-testid="workspace-character"]')?.click();
  `);
  await sleep(800);
  await client.screenshot('04_workspace_character_appearance.png');

  // 5. Library: Body Hierarchy
  console.log('--- 5. Library Body Tab ---');
  await client.eval(`
    const btns = Array.from(document.querySelectorAll('button'));
    const bodyBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Тело');
    if (bodyBtn) bodyBtn.click();
  `);
  await sleep(800);
  await client.screenshot('05_library_body_hierarchy.png');

  // 6. Workspace: Draw (Sprite Editor)
  console.log('--- 6. Workspace Draw (Sprite Editor) ---');
  await client.eval(`
    document.querySelector('[data-testid="workspace-draw"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('06_workspace_draw_sprite_editor.png');

  // 7. Workspace: Equipment
  console.log('--- 7. Workspace Equipment ---');
  await client.eval(`
    document.querySelector('[data-testid="workspace-equipment"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('07_workspace_equipment_items.png');

  // 8. Workspace: Animate & Timeline
  console.log('--- 8. Workspace Animate & Timeline ---');
  await client.eval(`
    document.querySelector('[data-testid="workspace-animate"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('08_workspace_animate_timeline.png');

  // 9. Bottom Tab: Preview (Pixi.js interactive preview)
  console.log('--- 9. Bottom Tab: Pixi Preview ---');
  await client.eval(`
    document.querySelector('[data-testid="bottom-tab-preview"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('09_bottom_pixi_preview.png');

  // 10. Bottom Tab: State Machine
  console.log('--- 10. Bottom Tab: State Machine ---');
  await client.eval(`
    document.querySelector('[data-testid="bottom-tab-statemachine"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('10_bottom_statemachine.png');

  // 11. Bottom Tab: Authoring
  console.log('--- 11. Bottom Tab: Authoring ---');
  await client.eval(`
    document.querySelector('[data-testid="bottom-tab-authoring"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('11_bottom_authoring_panel.png');

  // 12. Inspector with Bone Selected
  console.log('--- 12. Inspector with Selected Bone ---');
  await client.eval(`
    document.querySelector('[data-testid="workspace-character"]')?.click();
  `);
  await sleep(600);
  await client.eval(`
    const btns = Array.from(document.querySelectorAll('button'));
    const bodyBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Тело');
    if (bodyBtn) bodyBtn.click();
  `);
  await sleep(600);
  await client.eval(`
    const treeItems = Array.from(document.querySelectorAll('div, button, span'));
    const torsoItem = treeItems.find(el => el.textContent && (el.textContent.includes('Торс') || el.textContent.includes('Голова') || el.textContent.includes('torso') || el.textContent.includes('head')));
    if (torsoItem) torsoItem.click();
  `);
  await sleep(800);
  await client.screenshot('12_inspector_properties.png');

  // 13. Export Dialog
  console.log('--- 13. Export Dialog ---');
  await client.eval(`
    document.querySelector('[data-testid="toolbar-export"]')?.click();
  `);
  await sleep(1200);
  await client.screenshot('13_export_dialog.png');

  console.log('=== COMPLETE! All screenshots captured cleanly. ===');
  chrome.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
