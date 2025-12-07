import { getItemType } from './ItemTypes.js';

/**
 * Survival mechanics: Hunger and Energy
 * - Hunger decreases over time, causes damage at 0
 * - Energy decreases when active, slows player when low
 */
export class Survival {
    constructor(game) {
        this.game = game;

        // Stats
        this.hunger = 100;
        this.maxHunger = 100;
        this.energy = 100;
        this.maxEnergy = 100;

        // Decay rates (per second)
        this.hungerDecayRate = 1 / 60; // Lose 1 hunger per minute
        this.energyDecayRate = 0.5 / 60; // Lose 0.5 energy per minute when active
        this.energyRegenRate = 2; // Regen when sleeping

        // Thresholds
        this.starvingDamage = 5; // Damage per second when starving
        this.lowEnergyThreshold = 20;

        // State
        this.isSleeping = false;
        this.sleepInterruptable = true;

        this.onChangeCallbacks = [];
    }

    update(delta, isMoving = false) {
        if (this.isSleeping) {
            this.updateSleeping(delta);
            return;
        }

        // Hunger decay
        this.hunger = Math.max(0, this.hunger - this.hungerDecayRate * delta);

        // Energy decay (faster when moving)
        const energyMultiplier = isMoving ? 2 : 1;
        this.energy = Math.max(0, this.energy - this.energyDecayRate * energyMultiplier * delta);

        // Starving damage
        if (this.hunger <= 0) {
            this.game.player.takeDamage(this.starvingDamage * delta);
        }

        this.notifyChange();
    }

    updateSleeping(delta) {
        // Regenerate energy while sleeping
        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegenRate * delta);

        // Wake up when fully rested
        if (this.energy >= this.maxEnergy) {
            this.wakeUp();
        }

        // Hunger still decreases while sleeping, but slower
        this.hunger = Math.max(0, this.hunger - this.hungerDecayRate * 0.5 * delta);

        this.notifyChange();
    }

    eat(item) {
        const type = getItemType(item.typeId);
        if (!type || type.category !== 'food') return false;

        const hungerRestore = type.hungerRestore || 10;
        this.hunger = Math.min(this.maxHunger, this.hunger + hungerRestore);

        this.notifyChange();
        return true;
    }

    sleep(bed = null) {
        if (this.energy >= this.maxEnergy) {
            // Already fully rested
            return false;
        }

        // Need a bed in later versions
        this.isSleeping = true;
        this.notifyChange();
        return true;
    }

    wakeUp() {
        this.isSleeping = false;
        this.notifyChange();
    }

    // Get movement speed multiplier based on energy
    getSpeedMultiplier() {
        if (this.energy <= 0) return 0.5;
        if (this.energy < this.lowEnergyThreshold) {
            return 0.5 + (this.energy / this.lowEnergyThreshold) * 0.5;
        }
        return 1;
    }

    // Check if player is exhausted
    isExhausted() {
        return this.energy < this.lowEnergyThreshold;
    }

    // Check if player is starving
    isStarving() {
        return this.hunger <= 0;
    }

    // Get hunger as percentage
    getHungerPercent() {
        return (this.hunger / this.maxHunger) * 100;
    }

    // Get energy as percentage
    getEnergyPercent() {
        return (this.energy / this.maxEnergy) * 100;
    }

    // Serialize for saving
    serialize() {
        return {
            hunger: this.hunger,
            energy: this.energy
        };
    }

    deserialize(data) {
        this.hunger = data.hunger ?? this.maxHunger;
        this.energy = data.energy ?? this.maxEnergy;
    }

    // Change notifications
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
    }

    notifyChange() {
        this.onChangeCallbacks.forEach(cb => cb(this));
    }
}
