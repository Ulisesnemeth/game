import * as THREE from 'three';

export class MobManager {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.mobs = new Map(); // mobId → {mesh, data}
    }

    // Called when server sends full mob list
    syncMobs(mobsData) {
        // Update or create mobs
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
        const scale = 0.5 + (data.level || 1) * 0.05;
        let geometry;

        if (data.type.shape === 'sphere') {
            geometry = new THREE.SphereGeometry(0.4 * scale, 8, 8);
        } else if (data.type.shape === 'octahedron') {
            geometry = new THREE.OctahedronGeometry(0.5 * scale, 0);
        } else {
            geometry = new THREE.BoxGeometry(0.6 * scale, 0.8 * scale, 0.6 * scale);
        }

        const color = data.type.color || 0x7bed9f;
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.6,
            emissive: color,
            emissiveIntensity: 0.1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.x, 0.5, data.z);
        mesh.rotation.y = data.rotation || 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Health bar
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
        const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
        healthBarBg.position.y = 1.2;
        mesh.add(healthBarBg);

        const fillGeometry = new THREE.PlaneGeometry(1, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x7bed9f, side: THREE.DoubleSide });
        const healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
        healthBarFill.position.y = 1.2;
        healthBarFill.position.z = 0.01;
        mesh.add(healthBarFill);

        this.scene.add(mesh);

        this.mobs.set(data.id, {
            mesh,
            healthBarFill,
            healthBarBg,
            data,
            targetX: data.x,
            targetZ: data.z,
            targetRotation: data.rotation || 0
        });

        this.updateMobHealthBar(data.id);
    }

    updateMobHealthBar(mobId) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        const healthPercent = mob.data.hp / mob.data.maxHp;
        mob.healthBarFill.scale.x = Math.max(0.01, healthPercent);
        mob.healthBarFill.position.x = -(1 - healthPercent) * 0.5;

        if (healthPercent > 0.5) {
            mob.healthBarFill.material.color.setHex(0x7bed9f);
        } else if (healthPercent > 0.25) {
            mob.healthBarFill.material.color.setHex(0xffa502);
        } else {
            mob.healthBarFill.material.color.setHex(0xff4757);
        }
    }

    // Called by server when a mob is damaged
    damageMob(mobId, hp, maxHp) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        mob.data.hp = hp;
        mob.data.maxHp = maxHp;
        this.updateMobHealthBar(mobId);

        // Flash white
        const originalColor = mob.mesh.material.color.getHex();
        mob.mesh.material.color.setHex(0xffffff);
        mob.mesh.material.emissiveIntensity = 1;

        setTimeout(() => {
            if (mob.mesh && mob.mesh.material) {
                mob.mesh.material.color.setHex(originalColor);
                mob.mesh.material.emissiveIntensity = 0.1;
            }
        }, 100);
    }

    // Called by server when a mob dies
    killMob(mobId) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        // Death animation
        const startTime = Date.now();
        const mesh = mob.mesh;

        const animateDeath = () => {
            const elapsed = (Date.now() - startTime) / 300;
            if (elapsed < 1 && mesh) {
                mesh.scale.setScalar(1 - elapsed);
                mesh.position.y += 0.02;
                mesh.rotation.y += 0.1;
                requestAnimationFrame(animateDeath);
            } else {
                this.removeMob(mobId);
            }
        };
        animateDeath();
    }

    // Called when server spawns a new mob
    spawnMob(data) {
        this.createMob(data);
    }

    removeMob(mobId) {
        const mob = this.mobs.get(mobId);
        if (!mob) return;

        this.scene.remove(mob.mesh);
        mob.mesh.geometry.dispose();
        mob.mesh.material.dispose();
        this.mobs.delete(mobId);
    }

    clearMobs() {
        for (const [id, mob] of this.mobs) {
            this.scene.remove(mob.mesh);
            mob.mesh.geometry.dispose();
            mob.mesh.material.dispose();
        }
        this.mobs.clear();
    }

    // Update positions from server data
    updateVisuals(delta) {
        for (const [id, mob] of this.mobs) {
            // Interpolate position
            mob.mesh.position.x += (mob.targetX - mob.mesh.position.x) * 0.15;
            mob.mesh.position.z += (mob.targetZ - mob.mesh.position.z) * 0.15;

            // Interpolate rotation
            mob.mesh.rotation.y += (mob.targetRotation - mob.mesh.rotation.y) * 0.15;

            // Bobbing animation
            mob.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + mob.mesh.position.x) * 0.1;

            // Billboard health bar
            const playerPos = this.game.player.mesh.position;
            mob.healthBarBg.lookAt(playerPos.x, playerPos.y + 10, playerPos.z);
            mob.healthBarFill.lookAt(playerPos.x, playerPos.y + 10, playerPos.z);
        }
    }

    getMob(mobId) {
        return this.mobs.get(mobId);
    }

    getMobsInRange(position, radius) {
        const result = [];
        for (const [id, mob] of this.mobs) {
            if (mob.data.hp <= 0) continue;
            const distance = position.distanceTo(mob.mesh.position);
            if (distance <= radius) {
                result.push({ id, ...mob });
            }
        }
        return result;
    }
}
