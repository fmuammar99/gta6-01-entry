// CDP screenshotter for TELUK SENJA — Node 22 stdlib only (global WebSocket).
// Opens a URL in a headless Chromium already listening on port 9222, waits
// for window.__shotReady, collects console errors, and saves a JPEG.
// Usage: node shot.mjs <url> <out.jpg> [timeoutMs] [port]
import { writeFileSync } from 'node:fs';

const [url, out, timeoutArg, portArg] = process.argv.slice(2);
const timeoutMs = Number.parseInt(timeoutArg || '60000', 10);
const port = portArg || '9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((r) => r.json());
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error)));
    else res(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(`exception: ${(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 500)}`);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const started = Date.now();
let ready = false;
while (Date.now() - started < timeoutMs) {
  const result = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
  if (result.result && result.result.value === true) { ready = true; break; }
  await sleep(300);
}
if (!ready) {
  console.error('TIMEOUT waiting for __shotReady');
  console.error('errors:', JSON.stringify(errors, null, 2));
  process.exit(2);
}
await sleep(200);
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 84 });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('wrote', out);
if (errors.length > 0) console.log('page errors:', JSON.stringify(errors, null, 2));
ws.close();
process.exit(errors.length > 0 ? 1 : 0);
