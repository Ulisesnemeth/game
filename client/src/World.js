import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.currentDepth = 0;
        this.portals = [];
        this.resources = new Map(); // resourceId → {mesh, data}

        // Colors per depth
        this.depthColors = [
            { ground: 0x2d5a27, ambient: 0x4a7c59 },
            { ground: 0x8b7355, ambient: 0xa08060 },
            { ground: 0x8b4513, ambient: 0xa0522d },
            { ground: 0x722f37, ambient: 0x8b3a3a },
            { ground: 0x4a2040, ambient: 0x5d2a52 },
        ];

        this.createGround();
        this.createPortals();
        this.createDecoration();
    }

    getDepthColor(depth) {
        if (depth < this.depthColors.length) {
            return this.depthColors[depth];
        }

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
        const groundGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: this.depthColors[0].ground,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        const positions = groundGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] = Math.random() * 0.3 - 0.15;
        }
        groundGeometry.computeVertexNormals();

        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createPortals() {
        this.createPortal(10, 0, 'down');
        this.createPortal(-10, 0, 'up');
    }

    createPortal(x, z, type) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

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

        if (type === 'up') {
            group.visible = false;
        }
    }

    // Sync resources from server
    syncResources(resourcesData) {
        const serverIds = new Set(resourcesData.map(r => r.id));

        // Remove resources not on server
        for (const [id, resource] of this.resources) {
            if (!serverIds.has(id)) {
                this.removeResource(id);
            }
        }

        // Add/update resources from server
        for (const data of resourcesData) {
            if (this.resources.has(data.id)) {
                // Update existing
                const resource = this.resources.get(data.id);
                resource.data = data;
                resource.group.visible = data.isHarvestable;
            } else {
                // Create new
                this.createResource(data);
            }
        }
    }

    createResource(data) {
        const group = new THREE.Group();
        group.position.set(data.x, 0, data.z);

        if (data.type === 'tree') {
            this.createTreeMesh(group);
        } else if (data.type === 'rock') {
            this.createRockMesh(group);
        }

        group.visible = data.isHarvestable;
        this.scene.add(group);

        this.resources.set(data.id, {
            id: data.id,
            group,
            data,
            originalY: 0
        });
    }

    createTreeMesh(group) {
        // Trunk
        const trunkHeight = 1.5 + Math.random() * 0.5;
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x5c3317,
            roughness: 0.9,
            metalness: 0.1
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        group.add(trunk);

        // Foliage layers
        const foliageColors = [0x2d5a27, 0x1e4d1e, 0x3c7a3c];
        const foliageHeights = [0.8, 0.7, 0.6];
        let yOffset = trunkHeight;

        for (let i = 0; i < 3; i++) {
            const foliageGeometry = new THREE.ConeGeometry(0.8 - i * 0.15, foliageHeights[i], 8);
            const foliageMaterial = new THREE.MeshStandardMaterial({
                color: foliageColors[i],
                roughness: 0.8,
                metalness: 0.1,
                flatShading: true
            });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.y = yOffset + foliageHeights[i] / 2;
            foliage.castShadow = true;
            group.add(foliage);

            yOffset += foliageHeights[i] * 0.6;
        }
    }

    createRockMesh(group) {
        // Main rock body
        const rockGeometry = new THREE.DodecahedronGeometry(0.6, 1);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            roughness: 0.9,
            metalness: 0.2,
            flatShading: true
        });

        // Deform vertices for more natural look
        const positions = rockGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] *= 0.8 + Math.random() * 0.4;
            positions[i + 1] *= 0.6 + Math.random() * 0.4;
            positions[i + 2] *= 0.8 + Math.random() * 0.4;
        }
        rockGeometry.computeVertexNormals();

        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.y = 0.3;
        rock.rotation.y = Math.random() * Math.PI * 2;
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);

        // Smaller rocks around
        for (let i = 0; i < 2; i++) {
            const smallRock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.15, 0),
                rockMaterial.clone()
            );
            smallRock.position.set(
                (Math.random() - 0.5) * 0.8,
                0.15,
                (Math.random() - 0.5) * 0.8
            );
            smallRock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            smallRock.castShadow = true;
            group.add(smallRock);
        }
    }

    removeResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) return;

        this.scene.remove(resource.group);
        resource.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.resources.delete(resourceId);
    }

    // Called when player hits a resource
    damageResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) return;

        // Shake animation
        const originalX = resource.group.position.x;
        resource.group.position.x += (Math.random() - 0.5) * 0.3;
        setTimeout(() => {
            if (resource.group) {
                resource.group.position.x = originalX;
            }
        }, 50);
    }

    destroyResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) return;

        resource.group.visible = false;
        resource.data.isHarvestable = false;
    }

    getNearestResource(position, maxDistance = 2) {
        let nearest = null;
        let nearestDist = maxDistance;

        for (const [id, resource] of this.resources) {
            if (!resource.data.isHarvestable || !resource.group.visible) continue;

            const dist = position.distanceTo(new THREE.Vector3(resource.data.x, 0, resource.data.z));
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = resource;
            }
        }

        return nearest;
    }

    setDepth(depth) {
        this.currentDepth = depth;

        const colors = this.getDepthColor(depth);
        this.ground.material.color.setHex(colors.ground);
        this.scene.fog.color.setHex(colors.ambient);

        for (const portal of this.portals) {
            if (portal.type === 'up') {
                portal.group.visible = depth > 0;
            }
        }

        // Clear resources (will be synced from server)
        for (const [id, resource] of this.resources) {
            this.scene.remove(resource.group);
        }
        this.resources.clear();
    }

    getNearestPortal(playerPosition) {
        const threshold = 3;

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
        // Static decoration rocks (non-harvestable)
        const rockGeometry = new THREE.DodecahedronGeometry(0.3, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.9,
            flatShading: true
        });

        for (let i = 0; i < 20; i++) {
            const rock = new THREE.Mesh(rockGeometry, rockMaterial.clone());
            rock.position.set(
                (Math.random() - 0.5) * 80,
                0.15,
                (Math.random() - 0.5) * 80
            );
            rock.scale.setScalar(0.3 + Math.random() * 0.5);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    update(delta) {
        // Animate portals
        for (const portal of this.portals) {
            if (!portal.group.visible) continue;

            portal.time += delta;
            portal.ring.rotation.z += delta * 0.5;
            portal.glow.material.opacity = 0.2 + Math.sin(portal.time * 3) * 0.15;

            const positions = portal.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += delta * (portal.type === 'down' ? -0.5 : 0.5);

                if (portal.type === 'down' && positions[i + 1] < 0) {
                    positions[i + 1] = 2;
                } else if (portal.type === 'up' && positions[i + 1] > 2) {
                    positions[i + 1] = 0;
                }
            }
            portal.particles.geometry.attributes.position.needsUpdate = true;

            portal.arrow.position.y = 2 + Math.sin(portal.time * 2) * 0.3;
        }

        // Subtle tree/resource sway
        for (const [id, resource] of this.resources) {
            if (!resource.group.visible) continue;
            if (resource.data.type === 'tree') {
                resource.group.rotation.z = Math.sin(Date.now() * 0.001 + resource.data.x) * 0.02;
            }
        }
    }
}
