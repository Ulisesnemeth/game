import * as THREE from 'three';

/**
 * Simple particle system for destruction effects
 * Creates debris that falls and fades
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.debris = [];
    }

    /**
     * Spawn debris particles when something is destroyed
     */
    spawnDebris(position, color, count = 8, type = 'mob') {
        const geometry = this.getDebrisGeometry(type);

        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.8,
                metalness: 0.2
            });

            const piece = new THREE.Mesh(geometry, material);
            piece.position.copy(position);
            piece.position.y += 0.5;

            const scale = 0.1 + Math.random() * 0.15;
            piece.scale.setScalar(scale);

            piece.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            piece.castShadow = true;
            this.scene.add(piece);

            const angle = Math.random() * Math.PI * 2;
            const force = 2 + Math.random() * 3;

            this.debris.push({
                mesh: piece,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * force,
                    3 + Math.random() * 4,
                    Math.sin(angle) * force
                ),
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                life: 1.5 + Math.random() * 0.5,
                maxLife: 2
            });
        }
    }

    getDebrisGeometry(type) {
        switch (type) {
            case 'tree':
                return new THREE.BoxGeometry(0.15, 0.15, 0.15);
            case 'rock':
                return new THREE.DodecahedronGeometry(0.12, 0);
            case 'slime':
                return new THREE.SphereGeometry(0.1, 6, 6);
            default:
                return new THREE.TetrahedronGeometry(0.12);
        }
    }

    /**
     * Spawn death effect for mobs
     */
    spawnMobDeath(position, mobType, color) {
        let debrisType = 'mob';
        let count = 10;

        if (mobType === 'Slime') {
            debrisType = 'slime';
            count = 12;
        }

        this.spawnDebris(position, color, count, debrisType);
        this.spawnDeathPoof(position, color);
    }

    /**
     * Spawn blood/hit particles
     */
    spawnBloodSplatter(position, color = 0xff3333, intensity = 1) {
        const count = Math.floor(5 * intensity);

        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9
            });

            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            particle.position.y += 0.5 + Math.random() * 0.5;

            this.scene.add(particle);

            const angle = Math.random() * Math.PI * 2;
            const force = 1 + Math.random() * 2;

            this.debris.push({
                mesh: particle,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * force,
                    1 + Math.random() * 2,
                    Math.sin(angle) * force
                ),
                angularVelocity: new THREE.Vector3(0, 0, 0),
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8
            });
        }
    }

    /**
     * Spawn resource destruction effect
     */
    spawnResourceBreak(position, resourceType) {
        let color, count, type;

        if (resourceType === 'tree') {
            color = 0x5c3317;
            count = 15;
            type = 'tree';

            // Also spawn some leaves
            this.spawnDebris(
                position.clone().add(new THREE.Vector3(0, 2, 0)),
                0x2d5a27,
                8,
                'tree'
            );
        } else if (resourceType === 'rock') {
            color = 0x666666;
            count = 12;
            type = 'rock';
        } else {
            color = 0x888888;
            count = 8;
            type = 'mob';
        }

        this.spawnDebris(position, color, count, type);
    }

    /**
     * Spawn a poof effect (expanding circle)
     */
    spawnDeathPoof(position, color) {
        const geometry = new THREE.RingGeometry(0.1, 0.3, 16);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(position);
        ring.position.y = 0.1;
        ring.rotation.x = -Math.PI / 2;

        this.scene.add(ring);

        this.particles.push({
            mesh: ring,
            type: 'poof',
            life: 0.5,
            maxLife: 0.5,
            startScale: 1,
            endScale: 4
        });
    }

    /**
     * Spawn XP orbs that float up
     */
    spawnXpOrbs(position, count = 3) {
        const geometry = new THREE.SphereGeometry(0.08, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x7bed9f,
            transparent: true,
            opacity: 0.9
        });

        for (let i = 0; i < count; i++) {
            const orb = new THREE.Mesh(geometry, material.clone());
            orb.position.copy(position);
            orb.position.x += (Math.random() - 0.5) * 0.5;
            orb.position.z += (Math.random() - 0.5) * 0.5;
            orb.position.y += Math.random() * 0.3;

            this.scene.add(orb);

            this.particles.push({
                mesh: orb,
                type: 'orb',
                life: 1,
                maxLife: 1,
                velocity: new THREE.Vector3(0, 2 + Math.random(), 0)
            });
        }
    }

    update(delta) {
        const gravity = -15;

        // Update debris
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];

            d.velocity.y += gravity * delta;
            d.mesh.position.add(d.velocity.clone().multiplyScalar(delta));

            d.mesh.rotation.x += d.angularVelocity.x * delta;
            d.mesh.rotation.y += d.angularVelocity.y * delta;
            d.mesh.rotation.z += d.angularVelocity.z * delta;

            if (d.mesh.position.y < 0.1) {
                d.mesh.position.y = 0.1;
                d.velocity.y *= -0.3;
                d.velocity.x *= 0.7;
                d.velocity.z *= 0.7;
                d.angularVelocity.multiplyScalar(0.5);
            }

            d.life -= delta;

            if (d.life < 0.3) {
                d.mesh.material.transparent = true;
                d.mesh.material.opacity = d.life / 0.3;
            }

            if (d.life <= 0) {
                this.scene.remove(d.mesh);
                d.mesh.geometry.dispose();
                d.mesh.material.dispose();
                this.debris.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;

            if (p.type === 'poof') {
                const t = 1 - (p.life / p.maxLife);
                const scale = p.startScale + (p.endScale - p.startScale) * t;
                p.mesh.scale.setScalar(scale);
                p.mesh.material.opacity = 0.8 * (1 - t);
            } else if (p.type === 'orb') {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
                p.velocity.y -= delta * 2;
                const t = 1 - (p.life / p.maxLife);
                p.mesh.material.opacity = 0.9 * (1 - t);
                p.mesh.scale.setScalar(1 - t * 0.5);
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    clear() {
        for (const d of this.debris) {
            this.scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            d.mesh.material.dispose();
        }
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this.debris = [];
        this.particles = [];
    }
}
