import * as THREE from 'three';

export const ATTACK_RANGE = 2.5;
export const PLAYER_DAMAGE = 10;

const _flashes = [];

export function handleAttack(player, enemies, scene, onKill) {
  const playerPos = player.getPosition();
  let hit = false;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const dist = playerPos.distanceTo(enemy.mesh.position);
    if (dist <= ATTACK_RANGE) {
      enemy.takeDamage(PLAYER_DAMAGE);
      spawnFlash(enemy.mesh.position.clone(), scene);
      hit = true;
      if (enemy.hp <= 0) {
        enemy.die(scene);
        onKill(enemy);
      }
    }
  }
  return hit;
}

export function handleEnemyAttacks(player, enemies, delta) {
  if (player.isHiding) return;
  const playerPos = player.getPosition();
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const dist = playerPos.distanceTo(enemy.mesh.position);
    if (dist <= enemy.attackRange) {
      enemy.attackCooldown = (enemy.attackCooldown || 0) - delta;
      if (enemy.attackCooldown <= 0) {
        player.takeDamage(enemy.attackDamage);
        enemy.attackCooldown = 1.5;
      }
    }
  }
}

export function updateFlashes(delta, scene) {
  for (let i = _flashes.length - 1; i >= 0; i--) {
    const f = _flashes[i];
    f.life -= delta;
    const s = Math.max(0, f.life / f.maxLife);
    f.mesh.scale.setScalar(s);
    f.mesh.material.opacity = s * 0.8;
    if (f.life <= 0) {
      scene.remove(f.mesh);
      _flashes.splice(i, 1);
    }
  }
}

function spawnFlash(pos, scene) {
  const geo = new THREE.SphereGeometry(0.5, 6, 5);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.position.y += 0.6;
  scene.add(mesh);
  _flashes.push({ mesh, life: 0.3, maxLife: 0.3 });
}
