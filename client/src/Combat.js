import { getItemType, createItem } from './systems/ItemTypes.js';
import * as THREE from 'three';

export class Combat {
    constructor(game) {
        this.game = game;

        window.addEventListener('playerDeath', (e) => this.onPlayerDeath(e.detail));
    }

    update(delta) {
        // Combat updates if needed
    }

    playerAttack() {
        if (!this.game.player.canAttack()) return;

        this.game.player.attack();
        this.game.player.isAttacking = true;

        // Trigger attack animation on model
        this.game.player.model?.update(0, false, true);

        const attackPos = this.game.player.getAttackPosition();
        const attackRadius = this.game.player.getAttackRadius();
        const { damage, isCrit } = this.game.player.getDamage();

        // Check for resources first (trees, rocks)
        const nearestResource = this.game.world.getNearestResource(attackPos, attackRadius);
        if (nearestResource) {
            // Get tool bonus for this resource type
            const resourceType = nearestResource.data.type; // 'tree' or 'rock'
            const toolBonus = this.game.player.inventory.getToolBonus(resourceType);
            const finalDamage = Math.floor(damage * toolBonus);

            // Send hit to server
            this.game.network.sendResourceHit(nearestResource.id, finalDamage);

            // Show damage number at resource position
            const pos = new THREE.Vector3(nearestResource.data.x, 1, nearestResource.data.z);

            // Show effectiveness indicator
            const effectiveHit = toolBonus >= 1.0;
            this.showDamageNumber(pos, finalDamage, isCrit || toolBonus >= 1.5, !effectiveHit);

            // Spawn wood/rock hit particles
            const hitColor = nearestResource.data.type === 'tree' ? 0x5c3317 : 0x888888;
            this.game.particles?.spawnBloodSplatter(pos, hitColor, effectiveHit ? 0.8 : 0.3);

            return;
        }

        // Find mobs in range
        const mobsHit = this.game.mobManager.getMobsInRange(attackPos, attackRadius);

        for (const mob of mobsHit) {
            // Send hit to server
            this.game.network.sendMobHit(mob.id, damage);

            // Show damage number
            this.showDamageNumber(mob.mesh.position, damage, isCrit);

            // Blood splatter effect
            const bloodColor = mob.data.type?.name === 'Slime' ? 0x7bed9f : 0xff4444;
            this.game.particles?.spawnBloodSplatter(mob.mesh.position.clone(), bloodColor, isCrit ? 1.5 : 1);

            // Apply knockback visually (will be synced from server)
            this.applyKnockback(mob, this.game.player.mesh.position);
        }
    }

    applyKnockback(mob, attackerPos) {
        // Calculate knockback direction (away from attacker)
        const mobPos = mob.model.group.position;
        const dx = mobPos.x - attackerPos.x;
        const dz = mobPos.z - attackerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.1) {
            const knockbackForce = 1.5;
            const normX = dx / dist;
            const normZ = dz / dist;

            // Apply immediate visual knockback
            mob.targetX += normX * knockbackForce;
            mob.targetZ += normZ * knockbackForce;
        }
    }

    onPlayerDeath(data) {
        this.game.changeDepth(0);
        this.game.ui.updateHealth(this.game.player.hp, this.game.player.maxHp);
        this.game.ui.updateDepth(0);
    }

    showDamageNumber(position, amount, isCrit = false, isPlayerDamage = false) {
        const container = document.getElementById('damage-numbers');
        if (!container) return;

        const element = document.createElement('div');
        element.className = 'damage-number' + (isCrit ? ' crit' : '');
        element.textContent = isCrit ? `${amount}!` : amount;

        if (isPlayerDamage) {
            element.style.color = '#ff4757';
        }

        // Add random offset for variety
        const offsetX = (Math.random() - 0.5) * 40;

        const screenPos = this.worldToScreen(position);
        element.style.left = `${screenPos.x + offsetX}px`;
        element.style.top = `${screenPos.y}px`;

        container.appendChild(element);
        setTimeout(() => element.remove(), 1000);
    }

    showXpGain(position, amount) {
        const container = document.getElementById('damage-numbers');
        if (!container) return;

        const element = document.createElement('div');
        element.className = 'damage-number heal';
        element.textContent = `+${amount} XP`;

        const screenPos = this.worldToScreen(position);
        element.style.left = `${screenPos.x + 20}px`;
        element.style.top = `${screenPos.y}px`;

        container.appendChild(element);
        setTimeout(() => element.remove(), 1000);
    }

    showItemDrop(position, drop) {
        const container = document.getElementById('damage-numbers');
        if (!container) return;

        const type = getItemType(drop.typeId);
        if (!type) return;

        const element = document.createElement('div');
        element.className = 'damage-number item-drop';
        element.innerHTML = `${type.icon} +${drop.quantity}`;
        element.style.color = '#ffd43b';
        element.style.fontWeight = 'bold';
        element.style.textShadow = '0 0 10px rgba(255, 212, 59, 0.8)';

        const screenPos = this.worldToScreen(position);
        element.style.left = `${screenPos.x - 30}px`;
        element.style.top = `${screenPos.y - 20}px`;

        container.appendChild(element);
        setTimeout(() => element.remove(), 1500);
    }

    worldToScreen(position) {
        const vector = position.clone();
        vector.project(this.game.camera);

        return {
            x: (vector.x + 1) / 2 * window.innerWidth,
            y: -(vector.y - 1) / 2 * window.innerHeight
        };
    }
}
