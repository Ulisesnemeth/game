import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILDINGS_FILE = path.join(__dirname, 'data', 'buildings.json');

export class BuildingManager {
    constructor() {
        this.buildings = new Map(); // buildingId → building data
        this.buildingsByDepth = new Map(); // depth → Set of buildingIds
        this.nextBuildingId = 1;

        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(BUILDINGS_FILE)) {
                const data = JSON.parse(fs.readFileSync(BUILDINGS_FILE, 'utf8'));

                for (const building of data.buildings || []) {
                    this.buildings.set(building.id, building);

                    if (!this.buildingsByDepth.has(building.depth)) {
                        this.buildingsByDepth.set(building.depth, new Set());
                    }
                    this.buildingsByDepth.get(building.depth).add(building.id);

                    if (building.id >= this.nextBuildingId) {
                        this.nextBuildingId = building.id + 1;
                    }
                }

                console.log(`Cargadas ${this.buildings.size} construcciones`);
            }
        } catch (error) {
            console.error('Error loading buildings:', error);
        }
    }

    saveData() {
        try {
            const dir = path.dirname(BUILDINGS_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data = {
                buildings: Array.from(this.buildings.values())
            };

            fs.writeFileSync(BUILDINGS_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving buildings:', error);
        }
    }

    addBuilding(buildingData, depth) {
        const building = {
            ...buildingData,
            id: this.nextBuildingId++,
            depth,
            createdAt: Date.now()
        };

        this.buildings.set(building.id, building);

        if (!this.buildingsByDepth.has(depth)) {
            this.buildingsByDepth.set(depth, new Set());
        }
        this.buildingsByDepth.get(depth).add(building.id);

        this.saveData();
        return building;
    }

    removeBuilding(buildingId) {
        const building = this.buildings.get(buildingId);
        if (!building) return false;

        const depthSet = this.buildingsByDepth.get(building.depth);
        if (depthSet) {
            depthSet.delete(buildingId);
        }

        this.buildings.delete(buildingId);
        this.saveData();
        return true;
    }

    getBuildingsForDepth(depth) {
        const buildingIds = this.buildingsByDepth.get(depth);
        if (!buildingIds) return [];

        return Array.from(buildingIds).map(id => this.buildings.get(id));
    }

    getBuilding(buildingId) {
        return this.buildings.get(buildingId);
    }

    updateBuildingContents(buildingId, contents) {
        const building = this.buildings.get(buildingId);
        if (!building) return false;

        building.contents = contents;
        this.saveData();
        return true;
    }
}
