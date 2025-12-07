import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.currentDepth = 0;
        this.portals = [];

        // Colors per depth (gradient from green to deep purple)
        this.depthColors = [
            { ground: 0x2d5a27, ambient: 0x4a7c59 },  // 0: Surface - Green
            { ground: 0x8b7355, ambient: 0xa08060 },  // 1: Yellow/Brown
            { ground: 0x8b4513, ambient: 0xa0522d },  // 2: Orange/Brown
            { ground: 0x722f37, ambient: 0x8b3a3a },  // 3: Red/Crimson
            { ground: 0x4a2040, ambient: 0x5d2a52 },  // 4: Deep Purple
        ];

        this.createGround();
        this.createPortals();
        this.createDecoration();
    }

    getDepthColor(depth) {
        // For depths beyond our defined colors, interpolate towards black/void
        if (depth < this.depthColors.length) {
            return this.depthColors[depth];
        }

        // Exponential darkness - deeper = darker
        const baseColor = this.depthColors[this.depthColors.length - 1];
        const darkenFactor = Math.pow(0.85, depth - this.depthColors.length + 1);

        const groundR = ((baseColor.ground >> 16) & 255) * darkenFactor;
        const groundG = ((baseColor.ground >> 8) & 255) * darkenFactor;
        const groundB = (baseColor.ground & 255) * darkenFactor;

        const ambientR = ((baseColor.ambient >> 16) & 255) * darkenFactor;
        const ambientG = ((baseColor.ambient >> 8) & 255) * darkenFactor;
        const ambientB = (baseColor.ambient & 255) * darkenFactor;

        return {
            ground: (Math.floor(groundR) << 16) | (Math.floor(groundG) << 8) | Math.floor(groundB),
            ambient: (Math.floor(ambientR) << 16) | (Math.floor(ambientG) << 8) | Math.floor(ambientB)
        };
    }

    createGround() {
        // Main ground plane
        const groundGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: this.depthColors[0].ground,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        // Add some vertex displacement for terrain effect
        const positions = groundGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] = Math.random() * 0.3 - 0.15;
        }
        groundGeometry.computeVertexNormals();

        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Grid helper for visual reference
        const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createPortals() {
        // Create descent portal
        this.createPortal(10, 0, 'down');

        // Create ascent portal (only visible when not on surface)
        this.createPortal(-10, 0, 'up');
    }

    createPortal(x, z, type) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Base ring
        const ringGeometry = new THREE.TorusGeometry(1.5, 0.2, 8, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: type === 'down' ? 0xff6b35 : 0x00d4ff,
            emissive: type === 'down' ? 0xff6b35 : 0x00d4ff,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        group.add(ring);

        // Portal glow
        const glowGeometry = new THREE.CircleGeometry(1.3, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: type === 'down' ? 0xff6b35 : 0x00d4ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.05;
        group.add(glow);

        // Floating particles effect (using points)
        const particleCount = 30;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 0.5 + Math.random() * 0.8;
            particlePositions[i * 3] = Math.cos(angle) * radius;
            particlePositions[i * 3 + 1] = Math.random() * 2;
            particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: type === 'down' ? 0xff6b35 : 0x00d4ff,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        group.add(particles);

        // Arrow indicator
        const arrowGeometry = new THREE.ConeGeometry(0.3, 0.6, 4);
        const arrowMaterial = new THREE.MeshStandardMaterial({
            color: type === 'down' ? 0xff6b35 : 0x00d4ff,
            emissive: type === 'down' ? 0xff6b35 : 0x00d4ff,
            emissiveIntensity: 0.3
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.y = 2;
        arrow.rotation.x = type === 'down' ? Math.PI : 0;
        group.add(arrow);

        // Store portal data
        const portal = {
            group,
            type,
            position: new THREE.Vector3(x, 0, z),
            ring,
            glow,
            particles,
            arrow,
            time: 0
        };

        this.portals.push(portal);
        this.scene.add(group);

        // Hide up portal on surface
        if (type === 'up') {
            group.visible = false;
        }
    }

    setDepth(depth) {
        this.currentDepth = depth;

        // Update ground color
        const colors = this.getDepthColor(depth);
        this.ground.material.color.setHex(colors.ground);

        // Update scene fog
        this.scene.fog.color.setHex(colors.ambient);

        // Update portals visibility
        for (const portal of this.portals) {
            if (portal.type === 'up') {
                portal.group.visible = depth > 0;
            }
        }

        // Update ambient light based on depth (darker = less light)
        const ambientIntensity = Math.max(0.1, 0.4 - depth * 0.03);
        // Note: Would need reference to ambient light to update
    }

    getNearestPortal(playerPosition) {
        const threshold = 3; // Distance to activate portal

        for (const portal of this.portals) {
            if (!portal.group.visible) continue;

            const distance = playerPosition.distanceTo(portal.position);
            if (distance < threshold) {
                return portal;
            }
        }

        return null;
    }

    createDecoration() {
        // Add some rocks/obstacles
        const rockGeometry = new THREE.DodecahedronGeometry(0.5, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9,
            flatShading: true
        });

        for (let i = 0; i < 30; i++) {
            const rock = new THREE.Mesh(rockGeometry, rockMaterial.clone());
            rock.position.set(
                (Math.random() - 0.5) * 70,
                0.25,
                (Math.random() - 0.5) * 70
            );
            rock.scale.setScalar(0.5 + Math.random() * 1);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    update(delta) {
        // Animate portals
        for (const portal of this.portals) {
            if (!portal.group.visible) continue;

            portal.time += delta;

            // Rotate ring
            portal.ring.rotation.z += delta * 0.5;

            // Pulse glow
            portal.glow.material.opacity = 0.2 + Math.sin(portal.time * 3) * 0.15;

            // Animate particles
            const positions = portal.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += delta * (portal.type === 'down' ? -0.5 : 0.5);

                // Reset particles that go out of bounds
                if (portal.type === 'down' && positions[i + 1] < 0) {
                    positions[i + 1] = 2;
                } else if (portal.type === 'up' && positions[i + 1] > 2) {
                    positions[i + 1] = 0;
                }
            }
            portal.particles.geometry.attributes.position.needsUpdate = true;

            // Bounce arrow
            portal.arrow.position.y = 2 + Math.sin(portal.time * 2) * 0.3;
        }
    }
}
