import * as THREE from 'three';

/**
 * Building types for construction system
 */
export const BUILDING_TYPES = {
    wall: {
        id: 'wall',
        name: 'Pared',
        width: 2,
        height: 2,
        depth: 0.2,
        color: 0x8b4513,
        collision: true
    },
    floor: {
        id: 'floor',
        name: 'Piso',
        width: 4,
        height: 0.1,
        depth: 4,
        color: 0x654321,
        collision: false
    },
    door: {
        id: 'door',
        name: 'Puerta',
        width: 1,
        height: 2,
        depth: 0.2,
        color: 0x5c3317,
        collision: false, // Doors don't block
        interactable: true
    },
    chest_small: {
        id: 'chest_small',
        name: 'Cofre Pequeño',
        width: 0.8,
        height: 0.6,
        depth: 0.5,
        color: 0x8b6914,
        collision: true,
        interactable: true,
        storage: { width: 3, height: 3 }
    },
    chest_large: {
        id: 'chest_large',
        name: 'Cofre Grande',
        width: 1.2,
        height: 0.8,
        depth: 0.6,
        color: 0xa0782c,
        collision: true,
        interactable: true,
        storage: { width: 6, height: 4 }
    },
    crafting_table: {
        id: 'crafting_table',
        name: 'Mesa de Crafteo',
        width: 1,
        height: 0.9,
        depth: 1,
        color: 0x5a3825,
        collision: true,
        interactable: true
    },
    bed: {
        id: 'bed',
        name: 'Cama',
        width: 1,
        height: 0.5,
        depth: 2,
        color: 0x8b0000,
        collision: true,
        interactable: true
    }
};

/**
 * Building system for placing structures
 */
export class Building {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        // Buildings in the world
        this.buildings = new Map(); // buildingId → {mesh, data}

        // Placement mode
        this.isPlacing = false;
        this.placingType = null;
        this.placingPreview = null;
        this.placingRotation = 0;

        // Interaction
        this.nearbyBuilding = null;

        this.nextBuildingId = 1;
    }

    // Enter placement mode
    startPlacing(buildingTypeId) {
        const type = BUILDING_TYPES[buildingTypeId];
        if (!type) return false;

        this.isPlacing = true;
        this.placingType = type;
        this.placingRotation = 0;

        // Create preview mesh
        this.placingPreview = this.createBuildingMesh(type, true);
        this.scene.add(this.placingPreview);

        return true;
    }

    // Cancel placement
    cancelPlacing() {
        if (this.placingPreview) {
            this.scene.remove(this.placingPreview);
            this.placingPreview.geometry.dispose();
            this.placingPreview.material.dispose();
            this.placingPreview = null;
        }
        this.isPlacing = false;
        this.placingType = null;
    }

    // Rotate placement
    rotatePlacing() {
        this.placingRotation += Math.PI / 2;
        if (this.placingRotation >= Math.PI * 2) {
            this.placingRotation = 0;
        }
    }

    // Confirm placement
    confirmPlacing(x, z) {
        if (!this.isPlacing || !this.placingType) return null;

        // Snap to grid
        const gridSize = 0.5;
        x = Math.round(x / gridSize) * gridSize;
        z = Math.round(z / gridSize) * gridSize;

        // Check for collision with other buildings
        if (this.checkCollision(x, z, this.placingType, this.placingRotation)) {
            return null;
        }

        const buildingData = {
            id: this.nextBuildingId++,
            type: this.placingType.id,
            x,
            z,
            rotation: this.placingRotation,
            contents: this.placingType.storage ? [] : null,
            ownerId: this.game.network?.playerId
        };

        this.addBuilding(buildingData);
        this.cancelPlacing();

        return buildingData;
    }

    // Add building to world
    addBuilding(data) {
        const type = BUILDING_TYPES[data.type];
        if (!type) return;

        const mesh = this.createBuildingMesh(type, false);
        mesh.position.set(data.x, type.height / 2, data.z);
        mesh.rotation.y = data.rotation || 0;

        this.scene.add(mesh);
        this.buildings.set(data.id, { mesh, data });
    }

    // Remove building
    removeBuilding(buildingId) {
        const building = this.buildings.get(buildingId);
        if (!building) return;

        this.scene.remove(building.mesh);
        building.mesh.geometry.dispose();
        building.mesh.material.dispose();
        this.buildings.delete(buildingId);
    }

    // Create mesh for building type
    createBuildingMesh(type, isPreview = false) {
        const geometry = new THREE.BoxGeometry(type.width, type.height, type.depth);
        const material = new THREE.MeshStandardMaterial({
            color: type.color,
            metalness: 0.1,
            roughness: 0.9,
            transparent: isPreview,
            opacity: isPreview ? 0.5 : 1
        });

        if (isPreview) {
            material.emissive = new THREE.Color(0x00ff00);
            material.emissiveIntensity = 0.3;
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = !isPreview;
        mesh.receiveShadow = !isPreview;

        return mesh;
    }

    // Check collision at position
    checkCollision(x, z, type, rotation) {
        for (const [id, building] of this.buildings) {
            const bType = BUILDING_TYPES[building.data.type];
            // Simple AABB collision
            const dx = Math.abs(x - building.data.x);
            const dz = Math.abs(z - building.data.z);
            const minDist = (type.width + bType.width) / 2;

            if (dx < minDist && dz < minDist) {
                return true;
            }
        }
        return false;
    }

    // Update
    update(delta, playerPos, mouseWorldPos) {
        // Update preview position
        if (this.isPlacing && this.placingPreview && mouseWorldPos) {
            const gridSize = 0.5;
            const x = Math.round(mouseWorldPos.x / gridSize) * gridSize;
            const z = Math.round(mouseWorldPos.z / gridSize) * gridSize;

            this.placingPreview.position.set(x, this.placingType.height / 2, z);
            this.placingPreview.rotation.y = this.placingRotation;

            // Change color based on validity
            const isValid = !this.checkCollision(x, z, this.placingType, this.placingRotation);
            this.placingPreview.material.emissive.setHex(isValid ? 0x00ff00 : 0xff0000);
        }

        // Find nearby interactable building
        this.nearbyBuilding = null;
        let nearestDist = 2; // Interaction range

        for (const [id, building] of this.buildings) {
            const bType = BUILDING_TYPES[building.data.type];
            if (!bType.interactable) continue;

            const dx = building.data.x - playerPos.x;
            const dz = building.data.z - playerPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < nearestDist) {
                nearestDist = dist;
                this.nearbyBuilding = building;
            }
        }
    }

    // Interact with nearby building
    interact() {
        if (!this.nearbyBuilding) return null;

        const type = BUILDING_TYPES[this.nearbyBuilding.data.type];

        switch (type.id) {
            case 'chest_small':
            case 'chest_large':
                return { action: 'openStorage', building: this.nearbyBuilding, storage: type.storage };
            case 'crafting_table':
                return { action: 'openCrafting' };
            case 'bed':
                return { action: 'sleep' };
            case 'door':
                return { action: 'toggleDoor', building: this.nearbyBuilding };
            default:
                return null;
        }
    }

    // Get all buildings for serialization
    getBuildings() {
        return Array.from(this.buildings.values()).map(b => b.data);
    }

    // Load buildings
    loadBuildings(buildingsData) {
        // Clear existing
        for (const [id, building] of this.buildings) {
            this.scene.remove(building.mesh);
            building.mesh.geometry.dispose();
            building.mesh.material.dispose();
        }
        this.buildings.clear();

        // Add new
        for (const data of buildingsData) {
            if (data.id >= this.nextBuildingId) {
                this.nextBuildingId = data.id + 1;
            }
            this.addBuilding(data);
        }
    }

    // Sync buildings from server
    syncBuildings(buildingsData) {
        const serverIds = new Set(buildingsData.map(b => b.id));

        // Remove buildings not on server
        for (const [id, building] of this.buildings) {
            if (!serverIds.has(id)) {
                this.removeBuilding(id);
            }
        }

        // Add/update buildings from server
        for (const data of buildingsData) {
            if (!this.buildings.has(data.id)) {
                this.addBuilding(data);
            }
            if (data.id >= this.nextBuildingId) {
                this.nextBuildingId = data.id + 1;
            }
        }
    }
}
