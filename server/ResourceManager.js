import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_FILE = path.join(__dirname, 'data', 'resources.json');

/**
 * Server-side resource manager
 * Handles trees, rocks, and other harvestable resources
 */
export class ResourceManager {
    constructor() {
        this.resources = new Map(); // resourceId → resource data
        this.resourcesByDepth = new Map(); // depth → Set of resourceIds
        this.nextResourceId = 1;

        this.loadData();
        this.initializeDefaultResources();
    }

    loadData() {
        try {
            if (fs.existsSync(RESOURCES_FILE)) {
                const data = JSON.parse(fs.readFileSync(RESOURCES_FILE, 'utf8'));

                for (const resource of data.resources || []) {
                    this.resources.set(resource.id, resource);

                    if (!this.resourcesByDepth.has(resource.depth)) {
                        this.resourcesByDepth.set(resource.depth, new Set());
                    }
                    this.resourcesByDepth.get(resource.depth).add(resource.id);

                    if (resource.id >= this.nextResourceId) {
                        this.nextResourceId = resource.id + 1;
                    }
                }

                console.log(`Cargados ${this.resources.size} recursos`);
            }
        } catch (error) {
            console.error('Error loading resources:', error);
        }
    }

    saveData() {
        try {
            const dir = path.dirname(RESOURCES_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data = {
                resources: Array.from(this.resources.values())
            };

            fs.writeFileSync(RESOURCES_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving resources:', error);
        }
    }

    initializeDefaultResources() {
        // Only initialize if no resources exist
        if (this.resources.size > 0) return;

        console.log('Inicializando recursos del mundo...');

        // Surface (depth 0) - Trees and Rocks
        this.createResourcesForDepth(0, [
            { type: 'tree', count: 15 },
            { type: 'rock', count: 10 }
        ]);

        // Depth 1-3 - More rocks, fewer trees
        for (let depth = 1; depth <= 3; depth++) {
            this.createResourcesForDepth(depth, [
                { type: 'tree', count: Math.max(0, 10 - depth * 3) },
                { type: 'rock', count: 8 + depth * 2 }
            ]);
        }

        // Deeper - Only rocks
        for (let depth = 4; depth <= 6; depth++) {
            this.createResourcesForDepth(depth, [
                { type: 'rock', count: 10 + depth }
            ]);
        }

        this.saveData();
        console.log(`Creados ${this.resources.size} recursos`);
    }

    createResourcesForDepth(depth, resourceTypes) {
        if (!this.resourcesByDepth.has(depth)) {
            this.resourcesByDepth.set(depth, new Set());
        }

        for (const { type, count } of resourceTypes) {
            for (let i = 0; i < count; i++) {
                // Random position avoiding center
                let x, z;
                do {
                    x = (Math.random() - 0.5) * 60;
                    z = (Math.random() - 0.5) * 60;
                } while (Math.abs(x) < 12 && Math.abs(z) < 12);

                const resource = this.createResource(type, x, z, depth);
                this.resources.set(resource.id, resource);
                this.resourcesByDepth.get(depth).add(resource.id);
            }
        }
    }

    createResource(type, x, z, depth) {
        const id = this.nextResourceId++;

        const resourceData = {
            id,
            type,
            x,
            z,
            depth,
            hp: type === 'tree' ? 50 : 80,
            maxHp: type === 'tree' ? 50 : 80,
            isHarvestable: true,
            respawnAt: null,
            drops: type === 'tree'
                ? [{ typeId: 'wood', quantity: 3 + Math.floor(Math.random() * 3) }]
                : [{ typeId: 'stone', quantity: 2 + Math.floor(Math.random() * 3) }]
        };

        return resourceData;
    }

    getResourcesForDepth(depth) {
        const resourceIds = this.resourcesByDepth.get(depth);
        if (!resourceIds) return [];

        return Array.from(resourceIds)
            .map(id => this.resources.get(id))
            .filter(r => r && r.isHarvestable);
    }

    getAllResourcesForDepth(depth) {
        const resourceIds = this.resourcesByDepth.get(depth);
        if (!resourceIds) return [];

        return Array.from(resourceIds)
            .map(id => this.resources.get(id))
            .filter(r => r);
    }

    hitResource(resourceId, damage, playerId) {
        const resource = this.resources.get(resourceId);
        if (!resource || !resource.isHarvestable) return null;

        resource.hp -= damage;

        if (resource.hp <= 0) {
            resource.isHarvestable = false;
            resource.respawnAt = Date.now() + 30000; // 30 seconds

            const drops = resource.drops;

            return {
                destroyed: true,
                resourceId,
                drops
            };
        }

        return {
            destroyed: false,
            resourceId,
            hp: resource.hp,
            maxHp: resource.maxHp
        };
    }

    // Called periodically to respawn resources
    update() {
        const now = Date.now();
        let changed = false;

        for (const resource of this.resources.values()) {
            if (!resource.isHarvestable && resource.respawnAt && now >= resource.respawnAt) {
                resource.isHarvestable = true;
                resource.hp = resource.maxHp;
                resource.respawnAt = null;
                changed = true;
            }
        }

        if (changed) {
            this.saveData();
        }

        return changed;
    }

    getResource(resourceId) {
        return this.resources.get(resourceId);
    }
}
