// Local mirror of the make.fun scorer's gate rows for gta6-01.
// Usage: node check-gate.mjs <out-dir>   (out-dir was produced by main.ts)
// Rows: game_files, references, screenshots, dossier_matches, determinism
// (the scorer's fifth row is js_parses in some kits; we check every game
// JS file parses by loading it through the browser playtest instead, and
// here we verify the file inventory and the dossier rebuild).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) { console.error('usage: node check-gate.mjs <out-dir>'); process.exit(2); }
const N = process.env.NODE22 || '/home/hatch/workspace/makefun/node22/node-v22.23.5-linux-x64/bin/node';

let failures = 0;
function row(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

function walk(dir, base = '') {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = statSync(p);
    if (st.isSymbolicLink()) entries.push({ rel, symlink: true });
    else if (st.isDirectory()) { entries.push({ rel, dir: true }); entries.push(...walk(p, rel)); }
    else if (st.isFile()) entries.push({ rel, size: st.size });
  }
  return entries;
}

// --- game_files ---
const gameDir = join(out, 'game');
const gameEntries = walk(gameDir);
const gameFiles = gameEntries.filter((e) => !e.dir);
const gameBytes = gameFiles.reduce((a, e) => a + e.size, 0);
const longPaths = gameEntries.filter((e) => Buffer.byteLength('game/' + e.rel, 'utf8') > 1000);
const indexHtml = gameFiles.find((e) => e.rel === 'index.html');
row('game_files', gameEntries.length <= 993 && gameBytes <= 50331648 && !gameEntries.some((e) => e.symlink) && longPaths.length === 0 && indexHtml && indexHtml.size <= 1048576,
  `${gameEntries.length} entries, ${gameBytes} bytes, index.html ${indexHtml ? indexHtml.size : 'MISSING'} bytes`);

// --- references: no http/https or external refs from index.html or any JS ---
const textFiles = gameFiles.filter((e) => /\.(html|js|mjs|css|json)$/.test(e.rel));
const bad = [];
const urlRe = /https?:\/\/[^\s"'`)>]+/g;
for (const f of textFiles) {
  const text = readFileSync(join(gameDir, f.rel), 'utf8');
  const hits = text.match(urlRe);
  if (hits) bad.push(`${f.rel}: ${hits.slice(0, 3).join(', ')}`);
  // External-looking refs: src/href/import specifiers that are not relative or data:.
  const refs = [...text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map((m) => m[1])
    .concat([...text.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))
    .concat([...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]));
  for (const r of refs) {
    if (r.startsWith('data:') || r.startsWith('./') || r.startsWith('../')) continue;
    bad.push(`${f.rel}: external ref ${r}`);
  }
}
row('references', bad.length === 0, bad.length ? bad.join(' | ') : `${textFiles.length} text files, all refs under game/ or data:`);

// --- screenshots ---
const shotDir = join(out, 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)) : [];
let shotDetail = [];
let shotsOk = shots.length >= 3 && shots.length <= 4;
for (const s of shots) {
  const buf = readFileSync(join(shotDir, s));
  const size = buf.length;
  // JPEG SOF0/SOF2 gives dimensions; PNG IHDR does.
  let w = 0; let h = 0;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length - 9) {
      if (buf[off] !== 0xff) break;
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        h = buf.readUInt16BE(off + 5);
        w = buf.readUInt16BE(off + 7);
        break;
      }
      off += 2 + len;
    }
  } else if (buf.readUInt32BE(0) === 0x89504e47) {
    w = buf.readUInt32BE(16);
    h = buf.readUInt32BE(20);
  }
  const ok = size <= 262144 && Math.max(w, h) <= 1280 && Math.min(w, h) >= 480;
  if (!ok) shotsOk = false;
  shotDetail.push(`${s} ${w}x${h} ${Math.round(size / 1024)}KiB`);
}
const hashes = shots.map((s) => createHash('sha256').update(readFileSync(join(shotDir, s))).digest('hex'));
const distinct = new Set(hashes).size === hashes.length;
if (!distinct) shotsOk = false;
row('screenshots', shotsOk && distinct, `${shots.length} files — ${shotDetail.join(' · ')} — all distinct: ${distinct}`);

// --- dossier_matches: rebuild with main.ts into a second dir and compare ---
const out2 = out.replace(/\/$/, '') + '-rebuild';
execFileSync(N, ['main.ts'], { cwd: process.cwd(), env: { ...process.env, MAKEFUN_OUTPUT_DIR: out2 }, stdio: 'pipe' });
const d1 = readFileSync(join(out, 'dossier.json'));
const d2 = readFileSync(join(out2, 'dossier.json'));
row('dossier_matches', d1.equals(d2), `dossier.json ${d1.length} bytes, rebuild byte-identical: ${d1.equals(d2)}`);

// --- determinism: the two output trees must be identical file for file ---
function treeHash(dir) {
  const h = createHash('sha256');
  const entries = walk(dir).filter((e) => !e.dir).sort((a, b) => a.rel.localeCompare(b.rel));
  for (const e of entries) {
    h.update(e.rel);
    h.update(readFileSync(join(dir, e.rel)));
  }
  return h.digest('hex');
}
const t1 = treeHash(out);
const t2 = treeHash(out2);
row('determinism', t1 === t2, `output trees identical: ${t1 === t2}`);

console.log(failures === 0 ? 'GATE: ALL PASS' : `GATE: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
