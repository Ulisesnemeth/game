import * as THREE from 'three';
import { createMobModel } from './models/MobModels.js';

/**
 * MobManager - Client-side mob rendering with server sync
 * Uses new procedural mob models with animations
 */
export class MobManager {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.mobs = new Map(); // mobId → {model, data}
    }

    // Called when server sends full mob list
    syncMobs(mobsData) {
        const receivedIds = new Set();

        for (const mobData of mobsData) {
            receivedIds.add(mobData.id);

            if (this.mobs.has(mobData.id)) {
                // Update existing mob
                const mob = this.mobs.get(mobData.id);
                mob.targetX = mobData.x;
                mob.targetZ = mobData.z;
                mob.targetRotation = mobData.rotation;
                mob.data = mobData;
            } else {
                // Create new mob
                this.createMob(mobData);
            }
        }

        // Remove mobs that no longer exist
        for (const [id, mob] of this.mobs) {
            if (!receivedIds.has(id)) {
                this.removeMob(id);
            }
        }
    }

    createMob(data) {
        const typeName = data.type?.name || 'Slime';
        const color = data.type?.color || 0x7bed9f;
        const level = data.level || 1;

        // Create model using new MobModels system
        const model = createMobModel(typeName, color, level);
        model.group.position.set(data.x, 0, data.z);
        model.group.rotation.y = data.rotation || 0;

        this.scene.add(model.group);

        // Add health bar
        const healthBar = this.createHealthBar();
        model.group.add(healthBar.container);

        this.mobs.set(data.id, {
            model,
            healthBar,
            data,
            targetX: data.x,
            targetZ: data.z,
            targetRotation: data.rotation || 0
        });

        this.updateMobHealthBar(data.id);
    }

    createHealthBar() {
        const container = new THREE.Group();
        container.position.y = 1.5;

        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const bg = new THREE.Mesh(bgGeometry, bgMaterial);
        container.add(bg);

        const fillGeometry = new THREE.PlaneGeometry(1, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0x7bed9f,
            side: THREE.DoubleSide
        });
        const fill = new THREE.Mesh(fillGeometry, fillMaterial);
        fill.position.z = 0.01;
        container.add(fill);

        return { container, bg, fill, fillMaterial };
    }

    updateMobHealthBar(mobId) {
        const mob = this.mobs.get(mobId);
        if (!mob || !mob.healthBar) return;

        const healthPercent = mob.data.hp / mob.data.maxHp;
        mob.healthBar.fill.scale.x = Math.max(0.01, healthPercent);
        mob.healthBar.fill.position.x = -(1 - healthPercent) * 0.5;

        // Color based on health
        if (healthPercent > 0.5) {
            mob.healthBar.fillMaterial.color.setHex(0x7bed9f);
        } else if (healthPercent > 0.25) {
            mob.healthBar.fillMaterial.color.setHex(0xffa502);
        } else {
            mob.healthBar.fillMaterial.color.setHex(0xff4757);
        }
    }

    // Called by server when a mob is damaged
    damageMob(mobId, hp, maxHp) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        mob.data.hp = hp;
        mob.data.maxHp = maxHp;
        this.updateMobHealthBar(mobId);

        // Play hit animation
        mob.model.playHit();
    }

    // Called by server when a mob dies
    killMob(mobId) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        // Spawn debris particles
        const mobType = mob.data.type?.name || 'Slime';
        const color = mob.data.type?.color || 0x7bed9f;
        this.game.particles?.spawnMobDeath(mob.model.group.position, mobType, color);

        mob.model.die();

        // Remove after death animation
        setTimeout(() => {
            this.removeMob(mobId);
        }, 600);
    }

    // Called when server spawns a new mob
    spawnMob(data) {
        this.createMob(data);
    }

    removeMob(mobId) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        this.scene.remove(mob.model.group);
        mob.model.dispose();
        this.mobs.delete(mobId);
    }

    clearMobs() {
        for (const [id, mob] of this.mobs) {
            this.scene.remove(mob.model.group);
            mob.model.dispose();
        }
        this.mobs.clear();
    }

    // Update positions and animations from server data
    updateVisuals(delta) {
        for (const [id, mob] of this.mobs) {
            // Interpolate position
            mob.model.group.position.x += (mob.targetX - mob.model.group.position.x) * 0.15;
            mob.model.group.position.z += (mob.targetZ - mob.model.group.position.z) * 0.15;

            // Interpolate rotation
            let rotDiff = mob.targetRotation - mob.model.group.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            mob.model.group.rotation.y += rotDiff * 0.15;

            // Update model animation
            const state = mob.data.state || 'idle';
            mob.model.update(delta, state);

            // Billboard health bar
            const playerPos = this.game.player.mesh.position;
            mob.healthBar.container.lookAt(playerPos.x, playerPos.y + 5, playerPos.z);
        }
    }

    getMob(mobId) {
        return this.mobs.get(mobId);
    }

    getMobsInRange(position, radius) {
        const result = [];
        for (const [id, mob] of this.mobs) {
            if (mob.data.hp <= 0) continue;
            const distance = position.distanceTo(mob.model.group.position);
            if (distance <= radius) {
                result.push({ id, mesh: mob.model.group, ...mob });
            }
        }
        return result;
    }
}
