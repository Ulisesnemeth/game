import * as THREE from 'three';

export class Player {
    constructor(scene, camera, userData = {}) {
        this.scene = scene;
        this.camera = camera;

        // Stats from saved data
        this.name = userData.displayName || userData.username || 'Jugador';
        this.username = userData.username;
        this.level = userData.level || 1;
        this.xp = userData.xp || 0;
        this.color = userData.color || 0x00d4ff;

        // Calculate stats based on level
        this.maxHp = 100 + (this.level - 1) * 20;
        this.hp = this.maxHp;
        this.baseDamage = 10 + (this.level - 1) * 5;

        this.attackCooldown = 0;
        this.attackCooldownMax = 0.5;
        this.speed = 8;
        this.velocity = new THREE.Vector3();

        this.createMesh();
        this.createAttackIndicator();

        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    }

    createMesh() {
        const bodyGeometry = new THREE.CapsuleGeometry(0.4, 0.8, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.color,
            metalness: 0.5,
            roughness: 0.3,
            emissive: this.color,
            emissiveIntensity: 0.2
        });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.position.set(0, 0.5, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        const dirGeometry = new THREE.ConeGeometry(0.2, 0.4, 4);
        const dirMaterial = new THREE.MeshStandardMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.5
        });
        this.directionIndicator = new THREE.Mesh(dirGeometry, dirMaterial);
        this.directionIndicator.rotation.x = Math.PI / 2;
        this.directionIndicator.position.set(0, 0, 0.6);
        this.mesh.add(this.directionIndicator);

        this.scene.add(this.mesh);
    }

    setColor(hexColor) {
        this.color = hexColor;
        this.mesh.material.color.setHex(hexColor);
        this.mesh.material.emissive.setHex(hexColor);
        this.directionIndicator.material.color.setHex(hexColor);
        this.directionIndicator.material.emissive.setHex(hexColor);
    }

    createAttackIndicator() {
        const geometry = new THREE.RingGeometry(1.8, 2, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff6b35,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        this.attackIndicator = new THREE.Mesh(geometry, material);
        this.attackIndicator.rotation.x = -Math.PI / 2;
        this.attackIndicator.position.y = 0.05;
        this.mesh.add(this.attackIndicator);
    }

    update(delta, keys, mouse) {
        this.handleMovement(delta, keys);
        this.faceMouseDirection(mouse);

        if (this.attackCooldown > 0) {
            this.attackCooldown -= delta;
        }

        this.updateAttackIndicator(delta);
    }

    handleMovement(delta, keys) {
        const direction = new THREE.Vector3();

        if (keys['KeyW'] || keys['ArrowUp']) direction.z -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) direction.z += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) direction.x -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;

        if (direction.length() > 0) {
            direction.normalize();
            direction.multiplyScalar(this.speed * delta);
            this.mesh.position.add(direction);

            const bounds = 40;
            this.mesh.position.x = Math.max(-bounds, Math.min(bounds, this.mesh.position.x));
            this.mesh.position.z = Math.max(-bounds, Math.min(bounds, this.mesh.position.z));
        }
    }

    faceMouseDirection(mouse) {
        this.raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), this.camera);
        const intersectPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint);

        if (intersectPoint) {
            const dx = intersectPoint.x - this.mesh.position.x;
            const dz = intersectPoint.z - this.mesh.position.z;
            const angle = Math.atan2(dx, dz);

            const targetRotation = angle;
            const currentRotation = this.mesh.rotation.y;
            const diff = targetRotation - currentRotation;

            let shortestAngle = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
            if (shortestAngle < -Math.PI) shortestAngle += Math.PI * 2;

            this.mesh.rotation.y += shortestAngle * 0.15;
        }
    }

    updateAttackIndicator(delta) {
        if (this.attackIndicator.material.opacity > 0) {
            this.attackIndicator.material.opacity -= delta * 3;
        }
    }

    canAttack() {
        return this.attackCooldown <= 0;
    }

    attack() {
        if (!this.canAttack()) return false;
        this.attackCooldown = this.attackCooldownMax;
        this.attackIndicator.material.opacity = 0.6;
        return true;
    }

    getDamage() {
        const damage = this.baseDamage;
        const isCrit = Math.random() < 0.1;
        return {
            damage: isCrit ? damage * 2 : damage,
            isCrit
        };
    }

    getAttackPosition() {
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.mesh.quaternion);
        return this.mesh.position.clone().add(forward.multiplyScalar(1.5));
    }

    getAttackRadius() {
        return 2;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);

        this.mesh.material.emissive.setHex(0xff0000);
        this.mesh.material.emissiveIntensity = 0.8;

        setTimeout(() => {
            this.mesh.material.emissive.setHex(this.color);
            this.mesh.material.emissiveIntensity = 0.2;
        }, 100);

        if (this.hp <= 0) {
            this.die();
        }

        return this.hp;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        return this.hp;
    }

    addXp(amount) {
        this.xp += amount;

        const xpNeeded = this.getXpForNextLevel();
        while (this.xp >= xpNeeded) {
            this.xp -= xpNeeded;
            this.levelUp();
        }

        return this.level;
    }

    getXpForNextLevel() {
        return Math.floor(100 * Math.pow(1.5, this.level - 1));
    }

    levelUp() {
        this.level++;
        this.maxHp = 100 + (this.level - 1) * 20;
        this.hp = this.maxHp;
        this.baseDamage = 10 + (this.level - 1) * 5;

        console.log(`¡Nivel ${this.level}! HP: ${this.maxHp}, Daño: ${this.baseDamage}`);
        return this.level;
    }

    die() {
        console.log('¡Has muerto! Respawning en superficie...');
        this.hp = this.maxHp;
        this.mesh.position.set(0, 0.5, 0);

        const event = new CustomEvent('playerDeath', { detail: { player: this } });
        window.dispatchEvent(event);
    }

    getPosition() {
        return this.mesh.position.clone();
    }
}
