// Combat on foot: the player's pistol and fists, bullets, and the thugs
// who guard the warehouse in mission three. Enemies chase the player when
// close and shoot back; a thug at zero health drops a cash bundle. The
// module owns bullets and enemies only — the player object lives in game.js.
import { PLAYER } from './config.js';
import { isRoad } from './world.js';
import { randRange } from './random.js';

export function createCombat(random) {
  const bullets = [];
  const enemies = [];
  let fireCooldown = 0;

  function spawnThugs(centre, count) {
    enemies.length = 0;
    for (let i = 0; i < count; i += 1) {
      // Thugs stand on the road near the warehouse, never inside a building.
      let x = centre.x;
      let y = centre.y;
      for (let tries = 0; tries < 20; tries += 1) {
        const cx = centre.x + randRange(random, -150, 150);
        const cy = centre.y + randRange(random, -150, 150);
        if (isRoad(cx, cy) || Math.hypot(cx - centre.x, cy - centre.y) < 40) { x = cx; y = cy; break; }
      }
      enemies.push({
        x, y,
        hp: 60,
        speed: 120,
        shootTimer: randRange(random, 0.6, 1.6),
        flash: 0,
        dead: false,
      });
    }
  }

  function shoot(fromX, fromY, angle, friendly) {
    bullets.push({
      x: fromX + Math.cos(angle) * 22,
      y: fromY + Math.sin(angle) * 22,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 0.9,
      friendly,
    });
  }

  /**
   * Step bullets and enemies. `player` is the game player object; `blocked`
   * tests a point against buildings; `onEvent` receives 'hit' | 'kill' |
   * 'playerHit' | 'enemyShot'. Returns nothing.
   */
  function step(dt, player, blocked, onEvent) {
    if (fireCooldown > 0) fireCooldown -= dt;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || blocked(b.x, b.y, 2);
      if (!dead && b.friendly) {
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy < 18 * 18) {
            e.hp -= PLAYER.shotDamage;
            e.flash = 0.12;
            dead = true;
            if (e.hp <= 0) {
              e.dead = true;
              onEvent('kill', e);
            } else onEvent('hit', e);
            break;
          }
        }
      } else if (!dead && !b.friendly) {
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        if (dx * dx + dy * dy < (player.radius + 4) * (player.radius + 4)) {
          dead = true;
          onEvent('playerHit', null);
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i];
      if (e.dead) { enemies.splice(i, 1); continue; }
      if (e.flash > 0) e.flash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 420) {
        // Chase, but hold a shooting distance.
        const want = dist > 220 ? 1 : dist < 140 ? -0.6 : 0;
        const nx = e.x + (dx / dist) * e.speed * want * dt;
        const ny = e.y + (dy / dist) * e.speed * want * dt;
        if (!blocked(nx, e.y, 12)) e.x = nx;
        if (!blocked(e.x, ny, 12)) e.y = ny;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 380) {
          e.shootTimer = randRange(random, 1.1, 1.9);
          const aim = Math.atan2(dy, dx) + randRange(random, -0.12, 0.12);
          shoot(e.x, e.y, aim, false);
          onEvent('enemyShot', e);
        }
      }
    }
  }

  /** Try to fire the player's pistol toward `angle`; false when cooling down or out of ammo. */
  function playerShoot(player, angle) {
    if (fireCooldown > 0 || player.ammo <= 0) return false;
    fireCooldown = PLAYER.fireCooldown;
    player.ammo -= 1;
    shoot(player.x, player.y, angle, true);
    return true;
  }

  /** A punch in front of the player; returns the enemies it hit. */
  function playerPunch(player) {
    const hit = [];
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > PLAYER.punchRange + 14) continue;
      let diff = Math.atan2(dy, dx) - player.faceAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > PLAYER.punchArc) continue;
      e.hp -= PLAYER.punchDamage;
      e.flash = 0.15;
      hit.push(e);
      if (e.hp <= 0) e.dead = true;
    }
    return hit;
  }

  return { bullets, enemies, spawnThugs, step, playerShoot, playerPunch };
}
