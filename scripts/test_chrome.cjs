const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const PORT = 9225;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Temp\\chrome-debug-profile';

try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1600,1000',
  `--user-data-dir=${userDataDir}`,
  'http://localhost:5173/'
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await sleep(1500);
  http.get(`http://127.0.0.1:${PORT}/json/list`, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', async () => {
      const list = JSON.parse(d);
      console.log('Targets:', list.map(t => ({ url: t.url, type: t.type, ws: t.webSocketDebuggerUrl })));
      const page = list.find(t => t.type === 'page');
      if (!page) {
        console.log('No page target');
        chrome.kill();
        return;
      }
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.onopen = () => {
        console.log('WS open');
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 3, method: 'Log.enable' }));
      };
      ws.onmessage = async (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[Console]', msg.params.type, msg.params.args);
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          console.error('[Exception]', msg.params.exceptionDetails);
        }
      };
      await sleep(3000);
      // capture screenshot
      let msgId = 10;
      ws.send(JSON.stringify({ id: msgId, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      const onMsg = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          const buf = Buffer.from(msg.result.data, 'base64');
          fs.writeFileSync('C:\\Users\\Ham_h\\.gemini\\antigravity-ide\\brain\\be0dbc94-7a70-429a-88bf-4d9a566692c2\\screenshots\\test.png', buf);
          console.log('Test screenshot saved:', buf.length, 'bytes');
          chrome.kill();
          process.exit(0);
        }
      };
      ws.addEventListener('message', onMsg);
    });
  });
}

run();
