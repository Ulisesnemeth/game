import * as THREE from 'three';

/**
 * Articulated player model with procedural geometry
 * Animations based on actual movement direction
 */
export class PlayerModel {
    constructor(color = 0x00d4ff) {
        this.color = color;
        this.group = new THREE.Group();

        // Animation state
        this.animationTime = 0;
        this.walkCycle = 0;
        this.isAttacking = false;
        this.attackProgress = 0;
        this.attackType = 0; // 0-3 for different attack animations
        this.hitFlash = 0;

        // Movement tracking
        this.lastPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.isMoving = false;

        this.createBody();
    }

    createBody() {
        const mainColor = this.color;
        const skinColor = 0xffdbac;

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
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333344,
            metalness: 0.2,
            roughness: 0.8
        });
        this.leftLeg = new THREE.Mesh(legGeo, legMaterial);
        this.leftLeg.position.y = -0.25;
        this.leftLeg.castShadow = true;
        this.leftLegPivot.add(this.leftLeg);

        // RIGHT LEG
        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(0.12, 0.45, 0);
        this.group.add(this.rightLegPivot);

        this.rightLeg = new THREE.Mesh(legGeo.clone(), legMaterial.clone());
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
        this.isMoving = isMoving;

        // Handle attack animation
        if (isAttacking && !this.isAttacking) {
            this.isAttacking = true;
            this.attackProgress = 0;
            // Randomly select attack type (0-3)
            this.attackType = Math.floor(Math.random() * 4);
        }

        if (this.isAttacking) {
            this.attackProgress += delta * 5;
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

        // Arms hang naturally with slight swing
        const sway = Math.sin(this.animationTime * 1.5) * 0.05;
        this.leftArmPivot.rotation.x = sway;
        this.leftArmPivot.rotation.z = 0.1;
        this.rightArmPivot.rotation.x = -sway;
        this.rightArmPivot.rotation.z = -0.1;

        // Legs straight
        this.leftLegPivot.rotation.x = 0;
        this.rightLegPivot.rotation.x = 0;
    }

    animateWalk(delta) {
        // Speed based on actual movement
        this.walkCycle += delta * 10;

        // Leg swing
        const legSwing = Math.sin(this.walkCycle) * 0.7;
        this.leftLegPivot.rotation.x = legSwing;
        this.rightLegPivot.rotation.x = -legSwing;

        // Arm swing (opposite to legs)
        const armSwing = Math.sin(this.walkCycle) * 0.5;
        this.leftArmPivot.rotation.x = -armSwing;
        this.leftArmPivot.rotation.z = 0.15;
        this.rightArmPivot.rotation.x = armSwing;
        this.rightArmPivot.rotation.z = -0.15;

        // Body bob and lean
        const bob = Math.abs(Math.sin(this.walkCycle)) * 0.08;
        this.torso.position.y = 0.7 + bob;
        this.head.position.y = 1.1 + bob;

        // Slight torso rotation for natural walk
        const twist = Math.sin(this.walkCycle) * 0.08;
        this.torso.rotation.y = twist;
        this.head.rotation.y = -twist * 0.5;
    }

    animateAttack() {
        const progress = this.attackProgress;

        // Use different attack animations based on attackType
        switch (this.attackType) {
            case 0: // Horizontal swing (right to left)
                this.animateHorizontalSwing(progress);
                break;
            case 1: // Vertical overhead
                this.animateOverheadSwing(progress);
                break;
            case 2: // Diagonal slash
                this.animateDiagonalSlash(progress);
                break;
            case 3: // Thrust/stab
                this.animateThrust(progress);
                break;
            default:
                this.animateHorizontalSwing(progress);
        }
    }

    animateHorizontalSwing(progress) {
        // Horizontal swing from right to left
        if (progress < 0.2) {
            const t = progress / 0.2;
            this.rightArmPivot.rotation.x = -t * 0.5;
            this.rightArmPivot.rotation.z = -t * 1.5;
            this.torso.rotation.y = t * 0.3;
        } else if (progress < 0.5) {
            const t = (progress - 0.2) / 0.3;
            this.rightArmPivot.rotation.x = -0.5 + t * 0.3;
            this.rightArmPivot.rotation.z = -1.5 + t * 3.0;
            this.torso.rotation.y = 0.3 - t * 0.6;
        } else {
            const t = (progress - 0.5) / 0.5;
            this.rightArmPivot.rotation.x = -0.2 * (1 - t);
            this.rightArmPivot.rotation.z = 1.5 * (1 - t);
            this.torso.rotation.y = -0.3 * (1 - t);
        }
        this.leftArmPivot.rotation.x = -Math.sin(progress * Math.PI) * 0.3;
    }

    animateOverheadSwing(progress) {
        // Vertical overhead swing (like a hammer)
        if (progress < 0.3) {
            const t = progress / 0.3;
            this.rightArmPivot.rotation.x = -t * 2.5;
            this.rightArmPivot.rotation.z = -t * 0.2;
            this.torso.rotation.x = -t * 0.15;
        } else if (progress < 0.6) {
            const t = (progress - 0.3) / 0.3;
            this.rightArmPivot.rotation.x = -2.5 + t * 4.0;
            this.rightArmPivot.rotation.z = -0.2 + t * 0.1;
            this.torso.rotation.x = -0.15 + t * 0.25;
        } else {
            const t = (progress - 0.6) / 0.4;
            this.rightArmPivot.rotation.x = 1.5 * (1 - t);
            this.rightArmPivot.rotation.z = -0.1 * (1 - t);
            this.torso.rotation.x = 0.1 * (1 - t);
        }
        this.leftArmPivot.rotation.x = -Math.sin(progress * Math.PI) * 0.5;
    }

    animateDiagonalSlash(progress) {
        // Diagonal slash from upper right to lower left
        if (progress < 0.2) {
            const t = progress / 0.2;
            this.rightArmPivot.rotation.x = -t * 1.5;
            this.rightArmPivot.rotation.z = -t * 1.0;
            this.torso.rotation.z = t * 0.1;
        } else if (progress < 0.5) {
            const t = (progress - 0.2) / 0.3;
            this.rightArmPivot.rotation.x = -1.5 + t * 3.0;
            this.rightArmPivot.rotation.z = -1.0 + t * 2.5;
            this.torso.rotation.z = 0.1 - t * 0.25;
        } else {
            const t = (progress - 0.5) / 0.5;
            this.rightArmPivot.rotation.x = 1.5 * (1 - t);
            this.rightArmPivot.rotation.z = 1.5 * (1 - t);
            this.torso.rotation.z = -0.15 * (1 - t);
        }
        this.leftArmPivot.rotation.x = Math.sin(progress * Math.PI) * 0.4;
        this.leftArmPivot.rotation.z = Math.sin(progress * Math.PI) * 0.2;
    }

    animateThrust(progress) {
        // Forward thrust/stab
        if (progress < 0.15) {
            const t = progress / 0.15;
            this.rightArmPivot.rotation.x = -t * 1.2;
            this.rightArmPivot.rotation.z = -t * 0.3;
            this.torso.rotation.z = t * 0.1;
        } else if (progress < 0.4) {
            const t = (progress - 0.15) / 0.25;
            this.rightArmPivot.rotation.x = -1.2 + t * 2.5;
            this.rightArm.position.z = t * 0.3; // Push arm forward
            this.torso.rotation.z = 0.1 - t * 0.15;
        } else {
            const t = (progress - 0.4) / 0.6;
            this.rightArmPivot.rotation.x = 1.3 * (1 - t);
            this.rightArm.position.z = 0.3 * (1 - t);
            this.rightArmPivot.rotation.z = -0.3 * (1 - t);
            this.torso.rotation.z = -0.05 * (1 - t);
        }
        this.leftArmPivot.rotation.x = -Math.sin(progress * Math.PI) * 0.2;
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
