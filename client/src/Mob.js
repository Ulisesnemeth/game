import * as THREE from 'three';

export class Mob {
    constructor(scene, options) {
        this.scene = scene;

        // Stats from options
        this.type = options.type;
        this.maxHp = options.hp || 30;
        this.hp = this.maxHp;
        this.damage = options.damage || 5;
        this.xpReward = options.xp || 15;
        this.speed = options.speed || 2;
        this.level = options.level || 1;

        // State
        this.isAlive = true;
        this.state = 'patrol'; // patrol, chase, attack
        this.attackCooldown = 0;
        this.attackRange = 1.5;
        this.aggroRange = 12;
        this.patrolTarget = null;
        this.patrolWaitTime = 0;

        // Create mesh
        this.createMesh(options.x, options.z);

        // Create health bar
        this.createHealthBar();
    }

    createMesh(x, z) {
        // Different shapes based on mob type
        let geometry;
        const scale = 0.5 + this.level * 0.05; // Bigger at higher levels

        if (this.type.name === 'Slime') {
            geometry = new THREE.SphereGeometry(0.4 * scale, 8, 8);
        } else if (this.type.name === 'Shadow' || this.type.name === 'Void') {
            geometry = new THREE.OctahedronGeometry(0.5 * scale, 0);
        } else {
            geometry = new THREE.BoxGeometry(0.6 * scale, 0.8 * scale, 0.6 * scale);
        }

        const material = new THREE.MeshStandardMaterial({
            color: this.type.color,
            metalness: 0.3,
            roughness: 0.6,
            emissive: this.type.color,
            emissiveIntensity: 0.1
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 0.5, z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Store reference to this mob
        this.mesh.userData.mob = this;

        this.scene.add(this.mesh);
    }

    createHealthBar() {
        // Background bar
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            side: THREE.DoubleSide
        });
        this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
        this.healthBarBg.position.y = 1.2;
        this.mesh.add(this.healthBarBg);

        // Health fill
        const fillGeometry = new THREE.PlaneGeometry(1, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4757,
            side: THREE.DoubleSide
        });
        this.healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
        this.healthBarFill.position.y = 1.2;
        this.healthBarFill.position.z = 0.01;
        this.mesh.add(this.healthBarFill);

        // Level indicator
        // (Would need sprite text, keeping simple for now)
    }

    updateHealthBar() {
        const healthPercent = this.hp / this.maxHp;
        this.healthBarFill.scale.x = healthPercent;
        this.healthBarFill.position.x = -(1 - healthPercent) * 0.5;

        // Color based on health
        if (healthPercent > 0.5) {
            this.healthBarFill.material.color.setHex(0x7bed9f);
        } else if (healthPercent > 0.25) {
            this.healthBarFill.material.color.setHex(0xffa502);
        } else {
            this.healthBarFill.material.color.setHex(0xff4757);
        }
    }

    update(delta, playerPosition) {
        if (!this.isAlive) return;

        // Make health bar face camera (billboard effect)
        this.healthBarBg.lookAt(playerPosition.x, playerPosition.y + 10, playerPosition.z);
        this.healthBarFill.lookAt(playerPosition.x, playerPosition.y + 10, playerPosition.z);

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= delta;
        }

        // Calculate distance to player
        const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

        // State machine
        if (distanceToPlayer <= this.attackRange) {
            this.state = 'attack';
            this.handleAttack(delta);
        } else if (distanceToPlayer <= this.aggroRange) {
            this.state = 'chase';
            this.handleChase(delta, playerPosition);
        } else {
            this.state = 'patrol';
            this.handlePatrol(delta);
        }

        // Bobbing animation
        this.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + this.mesh.position.x) * 0.1;
    }

    handlePatrol(delta) {
        // Random movement
        if (!this.patrolTarget || this.patrolWaitTime > 0) {
            this.patrolWaitTime -= delta;
            if (this.patrolWaitTime <= 0) {
                // Pick new random target
                const angle = Math.random() * Math.PI * 2;
                const distance = 3 + Math.random() * 5;
                this.patrolTarget = new THREE.Vector3(
                    this.mesh.position.x + Math.cos(angle) * distance,
                    0.5,
                    this.mesh.position.z + Math.sin(angle) * distance
                );
            }
            return;
        }

        // Move towards patrol target
        const direction = new THREE.Vector3()
            .subVectors(this.patrolTarget, this.mesh.position)
            .normalize();

        this.mesh.position.add(direction.multiplyScalar(this.speed * 0.3 * delta));

        // Face movement direction
        this.mesh.rotation.y = Math.atan2(direction.x, direction.z);

        // Check if reached target
        if (this.mesh.position.distanceTo(this.patrolTarget) < 0.5) {
            this.patrolTarget = null;
            this.patrolWaitTime = 1 + Math.random() * 2;
        }
    }

    handleChase(delta, playerPosition) {
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.mesh.position)
            .normalize();

        this.mesh.position.add(direction.multiplyScalar(this.speed * delta));

        // Face player
        this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
    }

    handleAttack(delta) {
        if (this.attackCooldown <= 0) {
            this.attackCooldown = 1; // 1 second between attacks

            // Dispatch attack event
            const event = new CustomEvent('mobAttack', {
                detail: { mob: this, damage: this.damage }
            });
            window.dispatchEvent(event);

            // Visual feedback
            this.mesh.material.emissiveIntensity = 0.8;
            setTimeout(() => {
                if (this.mesh && this.mesh.material) {
                    this.mesh.material.emissiveIntensity = 0.1;
                }
            }, 100);
        }
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this.updateHealthBar();

        // Flash white
        const originalColor = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xffffff);
        this.mesh.material.emissiveIntensity = 1;

        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.color.setHex(originalColor);
                this.mesh.material.emissiveIntensity = 0.1;
            }
        }, 100);

        if (this.hp <= 0) {
            this.die();
        }

        return this.hp;
    }

    die() {
        this.isAlive = false;

        // Death animation
        const scale = { value: 1 };
        const startTime = Date.now();

        const animateDeath = () => {
            const elapsed = (Date.now() - startTime) / 300;
            if (elapsed < 1 && this.mesh) {
                this.mesh.scale.setScalar(1 - elapsed);
                this.mesh.position.y += 0.02;
                this.mesh.rotation.y += 0.1;
                requestAnimationFrame(animateDeath);
            } else {
                this.destroy();
            }
        };
        animateDeath();

        // Dispatch death event
        const event = new CustomEvent('mobDeath', {
            detail: { mob: this, xp: this.xpReward }
        });
        window.dispatchEvent(event);
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}
