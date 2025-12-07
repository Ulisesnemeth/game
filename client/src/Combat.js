import { getItemType } from './systems/ItemTypes.js';

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

        const attackPos = this.game.player.getAttackPosition();
        const attackRadius = this.game.player.getAttackRadius();
        const { damage, isCrit } = this.game.player.getDamage();

        // Find mobs in range
        const mobsHit = this.game.mobManager.getMobsInRange(attackPos, attackRadius);

        for (const mob of mobsHit) {
            // Send hit to server
            this.game.network.sendMobHit(mob.id, damage);

            // Show damage number
            this.showDamageNumber(mob.mesh.position, damage, isCrit);
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

        const screenPos = this.worldToScreen(position);
        element.style.left = `${screenPos.x}px`;
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
