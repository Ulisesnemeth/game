import * as THREE from 'three';

/**
 * Procedural mob models with animations
 * Each mob type has unique geometry and behavior
 */

// Base class for all mob models
class BaseMobModel {
    constructor(color, level = 1) {
        this.color = color;
        this.level = level;
        this.group = new THREE.Group();
        this.animationTime = 0;
        this.hitFlash = 0;
        this.isDying = false;
        this.deathProgress = 0;
    }

    update(delta, state = 'idle') {
        this.animationTime += delta;

        if (this.isDying) {
            this.animateDeath(delta);
            return;
        }

        // Hit flash decay
        if (this.hitFlash > 0) {
            this.hitFlash -= delta * 5;
        }

        switch (state) {
            case 'chase':
            case 'walk':
                this.animateWalk(delta);
                break;
            case 'attack':
                this.animateAttack(delta);
                break;
            default:
                this.animateIdle(delta);
        }
    }

    animateIdle(delta) {
        // Override in subclass
    }

    animateWalk(delta) {
        // Override in subclass
    }

    animateAttack(delta) {
        // Override in subclass
    }

    animateDeath(delta) {
        this.deathProgress += delta * 2;
        this.group.scale.setScalar(Math.max(0, 1 - this.deathProgress));
        this.group.position.y += delta * 0.5;
        this.group.rotation.y += delta * 5;
    }

    playHit() {
        this.hitFlash = 1;
        if (this.mainMaterial) {
            this.mainMaterial.emissive.setHex(0xffffff);
            setTimeout(() => {
                if (this.mainMaterial) {
                    this.mainMaterial.emissive.setHex(this.color);
                }
            }, 100);
        }
    }

    die() {
        this.isDying = true;
    }

    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}

/**
 * Slime - Bouncy sphere with squash and stretch
 */
export class SlimeModel extends BaseMobModel {
    constructor(color = 0x7bed9f, level = 1) {
        super(color, level);

        const scale = 0.4 + level * 0.03;

        this.mainMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.4,
            emissive: color,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.85
        });

        // Main body
        const bodyGeo = new THREE.SphereGeometry(scale, 16, 16);
        this.body = new THREE.Mesh(bodyGeo, this.mainMaterial);
        this.body.castShadow = true;
        this.group.add(this.body);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(scale * 0.15, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.leftEye.position.set(-scale * 0.3, scale * 0.2, scale * 0.7);
        this.group.add(this.leftEye);

        this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.rightEye.position.set(scale * 0.3, scale * 0.2, scale * 0.7);
        this.group.add(this.rightEye);

        this.baseScale = scale;
    }

    animateIdle(delta) {
        const pulse = Math.sin(this.animationTime * 2) * 0.1;
        this.body.scale.set(1 + pulse * 0.5, 1 - pulse, 1 + pulse * 0.5);
    }

    animateWalk(delta) {
        // Bounce movement
        const bounce = Math.abs(Math.sin(this.animationTime * 6));
        this.body.scale.set(1 + bounce * 0.2, 1 - bounce * 0.3, 1 + bounce * 0.2);
        this.group.position.y = bounce * 0.2;
    }

    animateAttack(delta) {
        // Lunge forward
        const attack = Math.sin(this.animationTime * 10);
        this.body.scale.set(1 - attack * 0.2, 1 + attack * 0.3, 1 - attack * 0.2);
    }
}

/**
 * Goblin - Small humanoid with big head
 */
export class GoblinModel extends BaseMobModel {
    constructor(color = 0xffa502, level = 1) {
        super(color, level);

        const scale = 0.35 + level * 0.02;

        this.mainMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a7c4e,
            metalness: 0.2,
            roughness: 0.8,
            emissive: color,
            emissiveIntensity: 0.1
        });

        // Big head
        const headGeo = new THREE.SphereGeometry(scale * 0.6, 12, 12);
        this.head = new THREE.Mesh(headGeo, this.mainMaterial);
        this.head.position.y = scale * 1.2;
        this.head.castShadow = true;
        this.group.add(this.head);

        // Ears
        const earGeo = new THREE.ConeGeometry(scale * 0.15, scale * 0.4, 4);
        this.leftEar = new THREE.Mesh(earGeo, this.mainMaterial);
        this.leftEar.position.set(-scale * 0.5, scale * 0.3, 0);
        this.leftEar.rotation.z = 0.5;
        this.head.add(this.leftEar);

        this.rightEar = new THREE.Mesh(earGeo.clone(), this.mainMaterial);
        this.rightEar.position.set(scale * 0.5, scale * 0.3, 0);
        this.rightEar.rotation.z = -0.5;
        this.head.add(this.rightEar);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(scale * 0.12, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.leftEye.position.set(-scale * 0.2, 0, scale * 0.5);
        this.head.add(this.leftEye);

        this.rightEye = new THREE.Mesh(eyeGeo.clone(), eyeMat);
        this.rightEye.position.set(scale * 0.2, 0, scale * 0.5);
        this.head.add(this.rightEye);

        // Small body
        const bodyGeo = new THREE.CapsuleGeometry(scale * 0.25, scale * 0.4, 4, 8);
        this.body = new THREE.Mesh(bodyGeo, this.mainMaterial);
        this.body.position.y = scale * 0.5;
        this.body.castShadow = true;
        this.group.add(this.body);

        // Arms
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-scale * 0.35, scale * 0.7, 0);
        this.group.add(this.leftArmPivot);

        const armGeo = new THREE.CapsuleGeometry(scale * 0.08, scale * 0.3, 4, 6);
        this.leftArm = new THREE.Mesh(armGeo, this.mainMaterial);
        this.leftArm.position.y = -scale * 0.2;
        this.leftArmPivot.add(this.leftArm);

        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(scale * 0.35, scale * 0.7, 0);
        this.group.add(this.rightArmPivot);

        this.rightArm = new THREE.Mesh(armGeo.clone(), this.mainMaterial);
        this.rightArm.position.y = -scale * 0.2;
        this.rightArmPivot.add(this.rightArm);

        // Legs
        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-scale * 0.15, scale * 0.2, 0);
        this.group.add(this.leftLegPivot);

        const legGeo = new THREE.CapsuleGeometry(scale * 0.1, scale * 0.2, 4, 6);
        this.leftLeg = new THREE.Mesh(legGeo, this.mainMaterial);
        this.leftLeg.position.y = -scale * 0.15;
        this.leftLegPivot.add(this.leftLeg);

        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(scale * 0.15, scale * 0.2, 0);
        this.group.add(this.rightLegPivot);

        this.rightLeg = new THREE.Mesh(legGeo.clone(), this.mainMaterial);
        this.rightLeg.position.y = -scale * 0.15;
        this.rightLegPivot.add(this.rightLeg);
    }

    animateIdle(delta) {
        const bounce = Math.sin(this.animationTime * 3) * 0.05;
        this.head.position.y = 0.42 + bounce;
    }

    animateWalk(delta) {
        const cycle = this.animationTime * 8;
        const swing = Math.sin(cycle) * 0.5;

        this.leftLegPivot.rotation.x = swing;
        this.rightLegPivot.rotation.x = -swing;
        this.leftArmPivot.rotation.x = -swing * 0.7;
        this.rightArmPivot.rotation.x = swing * 0.7;
    }

    animateAttack(delta) {
        const attack = Math.sin(this.animationTime * 12);
        this.rightArmPivot.rotation.x = -1.5 + attack;
        this.body.rotation.z = attack * 0.2;
    }
}

/**
 * Orc - Large muscular humanoid
 */
export class OrcModel extends BaseMobModel {
    constructor(color = 0xff6348, level = 1) {
        super(color, level);

        const scale = 0.5 + level * 0.03;

        this.mainMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d5a27,
            metalness: 0.2,
            roughness: 0.8,
            emissive: color,
            emissiveIntensity: 0.1
        });

        // Head
        const headGeo = new THREE.BoxGeometry(scale * 0.5, scale * 0.45, scale * 0.4);
        this.head = new THREE.Mesh(headGeo, this.mainMaterial);
        this.head.position.y = scale * 1.4;
        this.head.castShadow = true;
        this.group.add(this.head);

        // Tusks
        const tuskGeo = new THREE.ConeGeometry(scale * 0.05, scale * 0.2, 4);
        const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfffff0 });

        this.leftTusk = new THREE.Mesh(tuskGeo, tuskMat);
        this.leftTusk.position.set(-scale * 0.15, -scale * 0.1, scale * 0.2);
        this.leftTusk.rotation.x = Math.PI;
        this.head.add(this.leftTusk);

        this.rightTusk = new THREE.Mesh(tuskGeo.clone(), tuskMat);
        this.rightTusk.position.set(scale * 0.15, -scale * 0.1, scale * 0.2);
        this.rightTusk.rotation.x = Math.PI;
        this.head.add(this.rightTusk);

        // Muscular torso
        const torsoGeo = new THREE.BoxGeometry(scale * 0.7, scale * 0.6, scale * 0.4);
        this.torso = new THREE.Mesh(torsoGeo, this.mainMaterial);
        this.torso.position.y = scale * 0.9;
        this.torso.castShadow = true;
        this.group.add(this.torso);

        // Arms (thick)
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-scale * 0.5, scale * 1.1, 0);
        this.group.add(this.leftArmPivot);

        const armGeo = new THREE.CapsuleGeometry(scale * 0.12, scale * 0.4, 4, 8);
        this.leftArm = new THREE.Mesh(armGeo, this.mainMaterial);
        this.leftArm.position.y = -scale * 0.3;
        this.leftArmPivot.add(this.leftArm);

        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(scale * 0.5, scale * 1.1, 0);
        this.group.add(this.rightArmPivot);

        this.rightArm = new THREE.Mesh(armGeo.clone(), this.mainMaterial);
        this.rightArm.position.y = -scale * 0.3;
        this.rightArmPivot.add(this.rightArm);

        // Legs
        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-scale * 0.2, scale * 0.5, 0);
        this.group.add(this.leftLegPivot);

        const legGeo = new THREE.CapsuleGeometry(scale * 0.12, scale * 0.35, 4, 8);
        this.leftLeg = new THREE.Mesh(legGeo, this.mainMaterial);
        this.leftLeg.position.y = -scale * 0.25;
        this.leftLegPivot.add(this.leftLeg);

        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(scale * 0.2, scale * 0.5, 0);
        this.group.add(this.rightLegPivot);

        this.rightLeg = new THREE.Mesh(legGeo.clone(), this.mainMaterial);
        this.rightLeg.position.y = -scale * 0.25;
        this.rightLegPivot.add(this.rightLeg);
    }

    animateIdle(delta) {
        const breathe = Math.sin(this.animationTime * 1.5) * 0.03;
        this.torso.scale.set(1, 1 + breathe, 1);
    }

    animateWalk(delta) {
        const cycle = this.animationTime * 5;
        const swing = Math.sin(cycle) * 0.4;

        this.leftLegPivot.rotation.x = swing;
        this.rightLegPivot.rotation.x = -swing;
        this.leftArmPivot.rotation.x = -swing * 0.5;
        this.rightArmPivot.rotation.x = swing * 0.5;

        // Heavy stomp
        this.group.position.y = Math.abs(Math.sin(cycle)) * 0.05;
    }

    animateAttack(delta) {
        const attack = Math.sin(this.animationTime * 8);
        this.rightArmPivot.rotation.x = -2 + attack * 1.5;
        this.leftArmPivot.rotation.x = -1.5 + attack;
        this.torso.rotation.z = attack * 0.15;
    }
}

/**
 * Shadow - Ethereal floating entity
 */
export class ShadowModel extends BaseMobModel {
    constructor(color = 0x5f27cd, level = 1) {
        super(color, level);

        const scale = 0.5 + level * 0.02;

        this.mainMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.5,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.7
        });

        // Core
        const coreGeo = new THREE.OctahedronGeometry(scale * 0.4, 1);
        this.core = new THREE.Mesh(coreGeo, this.mainMaterial);
        this.core.position.y = scale;
        this.core.castShadow = true;
        this.group.add(this.core);

        // Outer shell
        const shellGeo = new THREE.OctahedronGeometry(scale * 0.6, 0);
        const shellMat = this.mainMaterial.clone();
        shellMat.opacity = 0.3;
        shellMat.wireframe = true;
        this.shell = new THREE.Mesh(shellGeo, shellMat);
        this.shell.position.y = scale;
        this.group.add(this.shell);

        // Particles (simplified as smaller octahedrons)
        this.particles = [];
        for (let i = 0; i < 6; i++) {
            const particleGeo = new THREE.OctahedronGeometry(scale * 0.1, 0);
            const particle = new THREE.Mesh(particleGeo, shellMat.clone());
            particle.userData.angle = (i / 6) * Math.PI * 2;
            particle.userData.radius = scale * 0.8;
            particle.userData.speed = 1 + Math.random();
            this.particles.push(particle);
            this.group.add(particle);
        }
    }

    animateIdle(delta) {
        // Floating
        this.core.position.y = 0.5 + Math.sin(this.animationTime * 2) * 0.1;
        this.shell.position.y = this.core.position.y;

        // Rotate
        this.core.rotation.y += delta * 0.5;
        this.shell.rotation.y -= delta * 0.3;

        // Particles orbit
        this.particles.forEach(p => {
            p.userData.angle += delta * p.userData.speed;
            p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
            p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
            p.position.y = this.core.position.y + Math.sin(p.userData.angle * 2) * 0.2;
        });
    }

    animateWalk(delta) {
        this.animateIdle(delta);
        // Faster rotation when moving
        this.core.rotation.y += delta;
    }

    animateAttack(delta) {
        // Pulse
        const pulse = Math.sin(this.animationTime * 15);
        this.core.scale.setScalar(1 + pulse * 0.3);
        this.mainMaterial.emissiveIntensity = 0.3 + pulse * 0.5;
    }
}

// Factory function to create mob model by type
export function createMobModel(typeName, color, level) {
    switch (typeName) {
        case 'Slime':
            return new SlimeModel(color, level);
        case 'Goblin':
            return new GoblinModel(color, level);
        case 'Orc':
            return new OrcModel(color, level);
        case 'Demon':
            return new OrcModel(0xff4757, level); // Demon uses Orc base with different color
        case 'Shadow':
            return new ShadowModel(color, level);
        case 'Void':
            return new ShadowModel(0x2c2c54, level);
        case 'Ancient':
            return new ShadowModel(0x1e1e1e, level);
        default:
            return new SlimeModel(color, level);
    }
}
