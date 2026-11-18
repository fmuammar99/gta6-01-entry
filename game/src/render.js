// Everything the player sees: the city, cars, people, police, HUD with its
// live minimap, and the title / pause / game-over / victory screens. It
// only reads game state and draws it on a 1280x720 logical canvas; the
// caller scales that canvas to the window.
import { CITY, PALETTE, VIEW } from './config.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './game.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MM_W = 190;
const MM_H = 134;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, angle, color, isPolice, sirenPhase, highlight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (highlight) {
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, -17, -8, 36, 20, 5);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -18, -10, 36, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#1c2733';
  rr(ctx, -6, -8, 12, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(16, -8, 2, 4);
  ctx.fillRect(16, 4, 2, 4);
  ctx.fillStyle = '#ff5a4e';
  ctx.fillRect(-18, -8, 2, 4);
  ctx.fillRect(-18, 4, 2, 4);
  if (isPolice) {
    const on = Math.sin(sirenPhase) > 0;
    ctx.fillStyle = on ? '#ff3b30' : '#2f6bff';
    ctx.fillRect(-4, -9, 4, 4);
    ctx.fillStyle = on ? '#2f6bff' : '#ff3b30';
    ctx.fillRect(0, -9, 4, 4);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 4);
  }
  ctx.restore();
}

function drawCity(ctx, game) {
  const { city, camera } = game;
  const x0 = camera.x - 40;
  const y0 = camera.y - 40;
  const x1 = camera.x + VIEW.width + 40;
  const y1 = camera.y + VIEW.height + 40;
  // Ground and sidewalks.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = PALETTE.sidewalk;
  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const bx = col * CITY.pitch + CITY.road;
      const by = row * CITY.pitch + CITY.road;
      ctx.fillRect(bx, by, CITY.pitch - CITY.road, CITY.pitch - CITY.road);
    }
  }
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i <= CITY.cols; i += 1) {
    const x = i * CITY.pitch;
    if (x < x1 && x + CITY.road > x0) ctx.fillRect(x, y0, CITY.road, y1 - y0);
  }
  for (let i = 0; i <= CITY.rows; i += 1) {
    const y = i * CITY.pitch;
    if (y < y1 && y + CITY.road > y0) ctx.fillRect(x0, y, x1 - x0, CITY.road);
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (let i = 0; i < CITY.cols; i += 1) {
    const x = i * CITY.pitch + CITY.road / 2;
    for (let y = 0; y < CITY.height; y += 56) {
      if (y > y0 - 56 && y < y1) ctx.fillRect(x - 2, y, 4, 26);
    }
  }
  for (let i = 0; i < CITY.rows; i += 1) {
    const y = i * CITY.pitch + CITY.road / 2;
    for (let x = 0; x < CITY.width; x += 56) {
      if (x > x0 - 56 && x < x1) ctx.fillRect(x, y - 2, 26, 4);
    }
  }
  // Parks and trees.
  for (const p of city.parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = PALETTE.parkPath;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h / 2);
    ctx.lineTo(p.x + p.w, p.y + p.h / 2);
    ctx.moveTo(p.x + p.w / 2, p.y);
    ctx.lineTo(p.x + p.w / 2, p.y + p.h);
    ctx.stroke();
  }
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#2c5230';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4d8a44';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Buildings: roof, edge, lit windows.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = PALETTE.buildingEdge;
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    for (const w of b.windows) {
      ctx.fillStyle = w.lit ? PALETTE.windowLit : PALETTE.windowDark;
      ctx.fillRect(w.x, w.y, 12, 10);
    }
  }
}

function drawMarker(ctx, game, time) {
  const stage = game.missions.currentStage();
  if (!stage || game.state.screen !== SCREEN_PLAY) return;
  const pulse = 1 + Math.sin(time * 5) * 0.15;
  const { x, y } = stage.target;
  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(time * 5) * 0.08;
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(x, y - 90);
  ctx.lineTo(x + 14, y - 40);
  ctx.lineTo(x - 14, y - 40);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.marker;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, game) {
  const { camera, state } = game;
  const shx = state.shake ? (Math.random() * 2 - 1) * state.shake : 0;
  const shy = state.shake ? (Math.random() * 2 - 1) * state.shake : 0;
  ctx.save();
  ctx.translate(-camera.x + shx, -camera.y + shy);
  drawCity(ctx, game);
  drawMarker(ctx, game, state.time);
  // Pickups.
  for (const p of game.city.pickups) {
    if (p.taken) continue;
    const bob = Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'cash') {
      ctx.fillStyle = '#57c96b';
      rr(ctx, -11, -8, 22, 15, 3);
      ctx.fill();
      ctx.fillStyle = '#1d5c28';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#f2f2f2';
      rr(ctx, -10, -10, 20, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else {
      ctx.fillStyle = '#c9a44f';
      rr(ctx, -10, -7, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#3a2f10';
      ctx.font = 'bold 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    }
    ctx.restore();
  }
  // Parked and traffic cars (the player's car is drawn with the player).
  for (const car of game.traffic.cars) {
    if (car === game.player.car) continue;
    drawCar(ctx, car.x, car.y, car.angle, car.color, false, 0, false);
  }
  // Police cars.
  for (const car of game.police.cars) {
    drawCar(ctx, car.x, car.y, car.angle, PALETTE.policeCar, true, car.sirenPhase, false);
  }
  // Pedestrians.
  for (const ped of game.traffic.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bob = Math.sin(ped.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, bob * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2b31';
      ctx.beginPath();
      ctx.arc(0, -8 + bob * 0.3, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Thugs.
  for (const e of game.combat.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#a03a3a';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(-14, -24, 28, 5);
    ctx.fillStyle = '#57c96b';
    ctx.fillRect(-14, -24, 28 * Math.max(0, e.hp / 60), 5);
    ctx.restore();
  }
  // Bullets.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of game.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Player.
  const p = game.player;
  if (game.state.screen !== SCREEN_TITLE) {
    if (p.onFoot) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.playerOutline;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Facing: shoulders and gun.
      ctx.strokeStyle = '#241f1c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.faceAngle) * 8, Math.sin(p.faceAngle) * 8);
      ctx.lineTo(Math.cos(p.faceAngle) * 24, Math.sin(p.faceAngle) * 24);
      ctx.stroke();
      ctx.fillStyle = '#f2efe6';
      ctx.beginPath();
      ctx.arc(0, -3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      drawCar(ctx, p.x, p.y, p.carAngle, p.car ? p.car.color : '#c94f43', false, 0, true);
    }
  }
  // Particles.
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Floating texts.
  ctx.font = 'bold 14px ' + FONT;
  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

const PLAYER_RADIUS = 14;

function drawStars(ctx, x, y, wanted) {
  ctx.font = '26px ' + FONT;
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText('★', x + i * 28, y);
  }
}

function drawMinimap(ctx, game) {
  const x = VIEW.width - MM_W - 16;
  const y = VIEW.height - MM_H - 16;
  const sx = MM_W / CITY.width;
  const sy = MM_H / CITY.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 16, 0.78)';
  rr(ctx, x - 6, y - 6, MM_W + 12, MM_H + 12, 8);
  ctx.fill();
  ctx.beginPath();
  rr(ctx, x, y, MM_W, MM_H, 4);
  ctx.clip();
  ctx.fillStyle = '#23232c';
  ctx.fillRect(x, y, MM_W, MM_H);
  ctx.fillStyle = '#3f6b3a';
  for (const park of game.city.parks) ctx.fillRect(x + park.x * sx, y + park.y * sy, park.w * sx, park.h * sy);
  ctx.fillStyle = '#4a4a52';
  for (let i = 0; i < CITY.cols; i += 1) ctx.fillRect(x + i * CITY.pitch * sx, y, CITY.road * sx, MM_H);
  for (let i = 0; i < CITY.rows; i += 1) ctx.fillRect(x, y + i * CITY.pitch * sy, MM_W, CITY.road * sy);
  const stage = game.missions.currentStage();
  if (stage) {
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x + stage.target.x * sx, y + stage.target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#7ac9c9';
  for (const car of game.traffic.cars) {
    if (car === game.player.car) continue;
    ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2, 2);
  }
  ctx.fillStyle = '#ff3b30';
  for (const car of game.police.cars) {
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.onFoot ? p.faceAngle : p.carAngle);
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + game.camera.x * sx, y + game.camera.y * sy, VIEW.width * sx, VIEW.height * sy);
  ctx.restore();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '11px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText('TELUK SENJA', x + MM_W, y - 10);
}

function drawHud(ctx, game) {
  const { player, state } = game;
  // Top-left panel: cash, health, ammo.
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, 14, 12, 250, 86, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.cash;
  ctx.font = 'bold 26px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('$' + player.cash.toLocaleString('en-US'), 28, 42);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px ' + FONT;
  ctx.fillText(player.onFoot ? 'JALAN KAKI' : 'MENGEMUDI · ' + Math.round(Math.abs(player.carSpeed) * 0.36) + ' km/j', 28, 60);
  // Health bar.
  ctx.fillStyle = '#22222a';
  rr(ctx, 28, 68, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = player.hp > 30 ? PALETTE.health : PALETTE.healthLow;
  rr(ctx, 28, 68, 150 * Math.max(0, player.hp / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText(Math.ceil(player.hp) + ' HP', 186, 78);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px ' + FONT;
  ctx.fillText('AMMO ' + player.ammo, 186, 60);
  // Top-right: wanted stars.
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, VIEW.width - 190, 12, 176, 52, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText('WANTED', VIEW.width - 176, 30);
  drawStars(ctx, VIEW.width - 176, 54, game.police.wanted);
  // Objective bar, top centre.
  const objective = game.missions.objective();
  ctx.font = 'bold 15px ' + FONT;
  const ow = Math.min(620, ctx.measureText(objective).width + 36);
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, (VIEW.width - ow) / 2, 12, ow, 40, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.arc((VIEW.width - ow) / 2 + 18, 32, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  ctx.fillText(objective, (VIEW.width - ow) / 2 + 32, 37);
  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(12,12,18,0.55)';
  rr(ctx, 14, VIEW.height - 34, 470, 22, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px ' + FONT;
  ctx.fillText('WASD gerak · Enter curi/keluar mobil · Klik tembak · Space pukul · Shift lari · P jeda · M suara', 24, VIEW.height - 19);
  drawMinimap(ctx, game);
  // Dialogue subtitle.
  if (state.dialogue) {
    ctx.font = '15px ' + FONT;
    const w = Math.min(760, ctx.measureText(state.dialogue.text).width + 36);
    ctx.fillStyle = 'rgba(12,12,18,0.8)';
    rr(ctx, (VIEW.width - w) / 2, VIEW.height - 118, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.subtitle;
    ctx.textAlign = 'center';
    ctx.fillText(state.dialogue.text, VIEW.width / 2, VIEW.height - 96);
  }
  // Mission banner.
  if (state.banner) {
    ctx.fillStyle = 'rgba(12,12,18,0.82)';
    rr(ctx, VIEW.width / 2 - 260, 84, 520, 64, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 24px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.title, VIEW.width / 2, 112);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '14px ' + FONT;
    ctx.fillText(state.banner.sub, VIEW.width / 2, 136);
  }
}

function panel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(10, 10, 16, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || PALETTE.title;
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText(title, VIEW.width / 2, 250);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '18px ' + FONT;
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 300 + i * 30));
}

export function draw(ctx, game) {
  const { state } = game;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawWorld(ctx, game);
  if (state.screen === SCREEN_PLAY || state.screen === SCREEN_PAUSE) {
    drawHud(ctx, game);
    if (state.screen === SCREEN_PAUSE) {
      panel(ctx, 'JEDA', ['Permainan dijeda — tekan P atau Esc untuk lanjut', 'M — suara · R — mulai dari awal'], '#f2efe6');
    }
  } else if (state.screen === SCREEN_TITLE) {
    ctx.fillStyle = 'rgba(10, 10, 16, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 84px ' + FONT;
    ctx.fillText('TELUK SENJA', VIEW.width / 2, 250);
    ctx.fillStyle = PALETTE.subtitle;
    ctx.font = '22px ' + FONT;
    ctx.fillText('Kota ini tidak pernah tidur — dan malam ini, Raka yang mengantarnya.', VIEW.width / 2, 292);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '17px ' + FONT;
    ctx.fillText('WASD / panah — gerak & mengemudi   ·   Enter — curi mobil / keluar', VIEW.width / 2, 350);
    ctx.fillText('Klik — tembak   ·   Space — pukul   ·   Shift — lari   ·   P — jeda   ·   M — suara', VIEW.width / 2, 378);
    ctx.fillStyle = PALETTE.marker;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('TEKAN ENTER UNTUK MULAI', VIEW.width / 2, 440);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '15px ' + FONT;
    const best = state.best;
    ctx.fillText(
      best.bestCash > 0
        ? `Rekor: $${best.bestCash.toLocaleString('en-US')} · Misi selesai: ${best.missionsDone}/3`
        : 'Tiga misi. Satu malam. Jangan sampai tertangkap.',
      VIEW.width / 2, 486,
    );
    ctx.fillText('Curi mobil, kabur dari polisi, selesaikan tiga misi Raka — semua tersimpan di browser ini.', VIEW.width / 2, 514);
  } else if (state.screen === SCREEN_OVER) {
    const wasted = state.overReason === 'WASTED';
    panel(ctx, state.overReason, [
      wasted ? 'Raka tumbang di jalanan Teluk Senja.' : 'Polisi akhirnya menangkap Raka di Teluk Senja.',
      `Uang: $${game.player.cash.toLocaleString('en-US')} · Misi selesai: ${game.missions.state.done}/3 · Polisi dihadapi: ${game.stats.crimes} kejahatan`,
      'Tekan R atau Enter untuk mencoba lagi',
    ], wasted ? '#e5534b' : '#5a8fd6');
  } else if (state.screen === SCREEN_VICTORY) {
    panel(ctx, 'TELUK SENJA', [
      'SEMUA MISI SELESAI — Raka menang malam ini.',
      `Uang akhir: $${game.player.cash.toLocaleString('en-US')} · Musuh dikalahkan: ${game.stats.kills} · Rekor: $${state.best.bestCash.toLocaleString('en-US')}`,
      'Tekan R atau Enter untuk main lagi',
    ]);
  }
}
