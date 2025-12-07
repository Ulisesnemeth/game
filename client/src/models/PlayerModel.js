import * as THREE from 'three';

/**
 * Articulated player model with procedural geometry
 * Parts: Head, Torso, Arms (L/R), Legs (L/R)
 * Animations: idle, walk, attack, hit, death
 */
export class PlayerModel {
    constructor(color = 0x00d4ff) {
        this.color = color;
        this.group = new THREE.Group();

        // Animation state
        this.currentAnimation = 'idle';
        this.animationTime = 0;
        this.walkCycle = 0;
        this.attackProgress = 0;
        this.isAttacking = false;
        this.hitFlash = 0;

        // Create body parts
        this.createBody();

        // Set initial position
        this.group.position.y = 0;
    }

    createBody() {
        const mainColor = this.color;
        const skinColor = 0xffdbac;

        // Materials
        this.bodyMaterial = new THREE.MeshStandardMaterial({
            color: mainColor,
            metalness: 0.3,
            roughness: 0.7,
            emissive: mainColor,
            emissiveIntensity: 0.1
        });

        this.skinMaterial = new THREE.MeshStandardMaterial({
            color: skinColor,
            metalness: 0.1,
            roughness: 0.8
        });

        // HEAD
        const headGeo = new THREE.SphereGeometry(0.25, 12, 12);
        this.head = new THREE.Mesh(headGeo, this.skinMaterial);
        this.head.position.y = 1.1;
        this.head.castShadow = true;
        this.group.add(this.head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.leftEye.position.set(-0.08, 0.05, 0.2);
        this.head.add(this.leftEye);

        this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.rightEye.position.set(0.08, 0.05, 0.2);
        this.head.add(this.rightEye);

        // TORSO
        const torsoGeo = new THREE.BoxGeometry(0.4, 0.5, 0.25);
        this.torso = new THREE.Mesh(torsoGeo, this.bodyMaterial);
        this.torso.position.y = 0.7;
        this.torso.castShadow = true;
        this.group.add(this.torso);

        // LEFT ARM
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-0.3, 0.85, 0);
        this.group.add(this.leftArmPivot);

        const armGeo = new THREE.CapsuleGeometry(0.08, 0.35, 4, 8);
        this.leftArm = new THREE.Mesh(armGeo, this.skinMaterial);
        this.leftArm.position.y = -0.25;
        this.leftArm.castShadow = true;
        this.leftArmPivot.add(this.leftArm);

        // RIGHT ARM
        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(0.3, 0.85, 0);
        this.group.add(this.rightArmPivot);

        this.rightArm = new THREE.Mesh(armGeo.clone(), this.skinMaterial);
        this.rightArm.position.y = -0.25;
        this.rightArm.castShadow = true;
        this.rightArmPivot.add(this.rightArm);

        // LEFT LEG
        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-0.12, 0.45, 0);
        this.group.add(this.leftLegPivot);

        const legGeo = new THREE.CapsuleGeometry(0.1, 0.35, 4, 8);
        this.leftLeg = new THREE.Mesh(legGeo, this.bodyMaterial.clone());
        this.leftLeg.material.color.setHex(0x333344);
        this.leftLeg.position.y = -0.25;
        this.leftLeg.castShadow = true;
        this.leftLegPivot.add(this.leftLeg);

        // RIGHT LEG
        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(0.12, 0.45, 0);
        this.group.add(this.rightLegPivot);

        this.rightLeg = new THREE.Mesh(legGeo.clone(), this.leftLeg.material.clone());
        this.rightLeg.position.y = -0.25;
        this.rightLeg.castShadow = true;
        this.rightLegPivot.add(this.rightLeg);
    }

    setColor(hexColor) {
        this.color = hexColor;
        this.bodyMaterial.color.setHex(hexColor);
        this.bodyMaterial.emissive.setHex(hexColor);
    }

    update(delta, isMoving = false, isAttacking = false) {
        this.animationTime += delta;

        // Handle attack animation
        if (isAttacking && !this.isAttacking) {
            this.isAttacking = true;
            this.attackProgress = 0;
        }

        if (this.isAttacking) {
            this.attackProgress += delta * 4;
            if (this.attackProgress >= 1) {
                this.isAttacking = false;
                this.attackProgress = 0;
            }
            this.animateAttack();
        } else if (isMoving) {
            this.animateWalk(delta);
        } else {
            this.animateIdle();
        }

        // Hit flash decay
        if (this.hitFlash > 0) {
            this.hitFlash -= delta * 5;
            const flashIntensity = Math.max(0, this.hitFlash);
            this.bodyMaterial.emissiveIntensity = 0.1 + flashIntensity * 0.9;
        }
    }

    animateIdle() {
        // Subtle breathing
        const breathe = Math.sin(this.animationTime * 2) * 0.02;
        this.torso.scale.y = 1 + breathe;
        this.head.position.y = 1.1 + breathe * 2;

        // Arms hang naturally
        this.leftArmPivot.rotation.x = 0;
        this.leftArmPivot.rotation.z = 0.1;
        this.rightArmPivot.rotation.x = 0;
        this.rightArmPivot.rotation.z = -0.1;

        // Legs straight
        this.leftLegPivot.rotation.x = 0;
        this.rightLegPivot.rotation.x = 0;
    }

    animateWalk(delta) {
        this.walkCycle += delta * 8;

        // Leg swing
        const legSwing = Math.sin(this.walkCycle) * 0.6;
        this.leftLegPivot.rotation.x = legSwing;
        this.rightLegPivot.rotation.x = -legSwing;

        // Arm swing (opposite to legs)
        const armSwing = Math.sin(this.walkCycle) * 0.4;
        this.leftArmPivot.rotation.x = -armSwing;
        this.rightArmPivot.rotation.x = armSwing;

        // Slight torso bob
        const bob = Math.abs(Math.sin(this.walkCycle)) * 0.05;
        this.torso.position.y = 0.7 + bob;
        this.head.position.y = 1.1 + bob;

        // Slight torso rotation
        const twist = Math.sin(this.walkCycle) * 0.05;
        this.torso.rotation.y = twist;
    }

    animateAttack() {
        // Wind up and strike with right arm
        const progress = this.attackProgress;

        if (progress < 0.3) {
            // Wind up
            const t = progress / 0.3;
            this.rightArmPivot.rotation.x = -t * 1.5;
            this.rightArmPivot.rotation.z = -t * 0.5;
        } else if (progress < 0.6) {
            // Strike
            const t = (progress - 0.3) / 0.3;
            this.rightArmPivot.rotation.x = -1.5 + t * 2.5;
            this.rightArmPivot.rotation.z = -0.5 + t * 0.3;
        } else {
            // Recovery
            const t = (progress - 0.6) / 0.4;
            this.rightArmPivot.rotation.x = 1 * (1 - t);
            this.rightArmPivot.rotation.z = -0.2 * (1 - t);
        }

        // Slight body lean
        this.torso.rotation.z = -Math.sin(progress * Math.PI) * 0.1;
    }

    playHit() {
        this.hitFlash = 1;
        this.bodyMaterial.emissive.setHex(0xff0000);

        setTimeout(() => {
            this.bodyMaterial.emissive.setHex(this.color);
        }, 150);
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
