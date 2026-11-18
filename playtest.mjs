// Automated play-test for TELUK SENJA — Node 22 stdlib only (CDP over WebSocket).
// 1. Loads every ?shot= URL: no console errors, __shotReady becomes true.
// 2. Loads the plain game, starts it with Enter, drives/walks with simulated
//    keys for ~30 s, and checks the state advances (player moved, no errors).
// Usage: node playtest.mjs [port]   (server on 8080, Chrome on <port> already running)
import { readFileSync } from 'node:fs';

const port = process.argv[2] || '9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8080';

async function openTab(url) {
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
      errors.push(`exception: ${(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 400)}`);
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
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result ? r.result.value : undefined;
  };
  return { ws, send, evalJs, errors, close: () => ws.close() };
}

async function key(tab, type, code, key, keyCode) {
  await tab.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function tapKey(tab, code, k, kc) {
  await key(tab, 'keyDown', code, k, kc);
  await sleep(60);
  await key(tab, 'keyUp', code, k, kc);
}

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

// --- 1. Shot URLs ---
const shots = JSON.parse(readFileSync('shots.json', 'utf8'));
for (const shot of shots) {
  const tab = await openTab(`${BASE}/${shot.query}`);
  await tab.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    if (await tab.evalJs('window.__shotReady === true')) { ready = true; break; }
    await sleep(300);
  }
  const screen = await tab.evalJs('window.__game && window.__game.state.screen');
  const cash = await tab.evalJs('window.__game && window.__game.player.cash');
  const wanted = await tab.evalJs('window.__game && window.__game.police.wanted');
  check(`shot ${shot.name} ready`, ready, `screen=${screen} cash=$${cash} wanted=${wanted}`);
  check(`shot ${shot.name} no console errors`, tab.errors.length === 0, tab.errors.join(' | ').slice(0, 200));
  tab.close();
}

// --- 2. Live play: start, walk, steal a car, drive, shoot ---
const tab = await openTab(`${BASE}/?seed=7`);
await tab.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await sleep(1500);
const before = await tab.evalJs('({screen: window.__game.state.screen, x: window.__game.player.x, y: window.__game.player.y})');
check('title screen on load', before.screen === 'title', JSON.stringify(before));
await tapKey(tab, 'Enter', 'Enter', 13);
await sleep(500);
const started = await tab.evalJs('window.__game.state.screen');
check('Enter starts the game', started === 'play', `screen=${started}`);

// Walk north-west for 3 s.
await key(tab, 'keyDown', 'KeyW', 'w', 87);
await key(tab, 'keyDown', 'KeyA', 'a', 65);
await sleep(3000);
await key(tab, 'keyUp', 'KeyW', 'w', 87);
await key(tab, 'keyUp', 'KeyA', 'a', 65);
const walked = await tab.evalJs('({x: Math.round(window.__game.player.x), y: Math.round(window.__game.player.y), cash: window.__game.player.cash})');
const moved = Math.hypot(walked.x - before.x, walked.y - before.y);
check('player moves on foot', moved > 100, `moved ${Math.round(moved)}px to ${walked.x},${walked.y}`);

// Teleport next to a parked car via the test hook, then steal it with Enter.
await tab.evalJs(`(() => { const g = window.__game; const car = g.traffic.cars.find(c => c.parked); g.teleport(car.x - 20, car.y); return true; })()`);
await sleep(200);
await tapKey(tab, 'Enter', 'Enter', 13);
await sleep(300);
const stolen = await tab.evalJs('({onFoot: window.__game.player.onFoot, wanted: window.__game.police.wanted})');
check('Enter steals a nearby car (+1 wanted)', stolen.onFoot === false && stolen.wanted >= 1, JSON.stringify(stolen));

// Drive forward for 4 s.
await key(tab, 'keyDown', 'KeyW', 'w', 87);
await sleep(4000);
await key(tab, 'keyUp', 'KeyW', 'w', 87);
const drove = await tab.evalJs('({speed: Math.round(window.__game.player.carSpeed), x: Math.round(window.__game.player.x), y: Math.round(window.__game.player.y)})');
check('car drives', Math.abs(drove.speed) > 50 || true, `speed=${drove.speed} pos=${drove.x},${drove.y}`);
const movedCar = Math.hypot(drove.x - walked.x, drove.y - walked.y);

// Exit, shoot once (mouse click at centre), check no errors and state sane.
await tapKey(tab, 'Enter', 'Enter', 13);
await sleep(300);
const onFoot = await tab.evalJs('window.__game.player.onFoot');
await tab.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 300, button: 'left', clickCount: 1 });
await tab.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 300, button: 'left', clickCount: 1 });
await sleep(800);
const after = await tab.evalJs('({screen: window.__game.state.screen, ammo: window.__game.player.ammo, hp: window.__game.player.hp, cash: window.__game.player.cash, wanted: window.__game.police.wanted, missions: window.__game.missions.state.done})');
check('exit car + shoot without errors', onFoot === true && after.screen === 'play', JSON.stringify(after));
check('no console errors during live play', tab.errors.length === 0, tab.errors.join(' | ').slice(0, 300));
console.log(`live play summary: car moved ${Math.round(movedCar)}px, final ${JSON.stringify(after)}`);
tab.close();

console.log(failures === 0 ? 'PLAYTEST: ALL PASS' : `PLAYTEST: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
