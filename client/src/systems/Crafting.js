import { getItemType, createItem } from './ItemTypes.js';

/**
 * Crafting system with recipes
 */

export const RECIPES = [
    {
        id: 'sword_wood',
        name: 'Espada de Madera',
        result: { typeId: 'sword_wood', quantity: 1 },
        ingredients: [
            { typeId: 'wood', quantity: 3 }
        ],
        requiresCraftingTable: false
    },
    {
        id: 'sword_stone',
        name: 'Espada de Piedra',
        result: { typeId: 'sword_stone', quantity: 1 },
        ingredients: [
            { typeId: 'wood', quantity: 2 },
            { typeId: 'stone', quantity: 3 }
        ],
        requiresCraftingTable: true
    },
    {
        id: 'pickaxe_wood',
        name: 'Pico de Madera',
        result: { typeId: 'pickaxe_wood', quantity: 1 },
        ingredients: [
            { typeId: 'wood', quantity: 3 }
        ],
        requiresCraftingTable: false
    },
    {
        id: 'pickaxe_stone',
        name: 'Pico de Piedra',
        result: { typeId: 'pickaxe_stone', quantity: 1 },
        ingredients: [
            { typeId: 'wood', quantity: 2 },
            { typeId: 'stone', quantity: 3 }
        ],
        requiresCraftingTable: true
    },
    {
        id: 'axe_wood',
        name: 'Hacha de Madera',
        result: { typeId: 'axe_wood', quantity: 1 },
        ingredients: [
            { typeId: 'wood', quantity: 3 }
        ],
        requiresCraftingTable: false
    },
    {
        id: 'axe_stone',
        name: 'Hacha de Piedra',
        result: { typeId: 'axe_stone', quantity: 1 },
        ingredients: [
            { typeId: 'wood', quantity: 2 },
            { typeId: 'stone', quantity: 3 }
        ],
        requiresCraftingTable: true
    },
    {
        id: 'chest_small',
        name: 'Cofre Pequeño',
        result: { buildingTypeId: 'chest_small' },
        ingredients: [
            { typeId: 'wood', quantity: 4 }
        ],
        requiresCraftingTable: false,
        isBuilding: true
    },
    {
        id: 'chest_large',
        name: 'Cofre Grande',
        result: { buildingTypeId: 'chest_large' },
        ingredients: [
            { typeId: 'wood', quantity: 8 }
        ],
        requiresCraftingTable: true,
        isBuilding: true
    },
    {
        id: 'crafting_table',
        name: 'Mesa de Crafteo',
        result: { buildingTypeId: 'crafting_table' },
        ingredients: [
            { typeId: 'wood', quantity: 4 },
            { typeId: 'stone', quantity: 2 }
        ],
        requiresCraftingTable: false,
        isBuilding: true
    },
    {
        id: 'bed',
        name: 'Cama',
        result: { buildingTypeId: 'bed' },
        ingredients: [
            { typeId: 'wood', quantity: 5 },
            { typeId: 'leather', quantity: 2 }
        ],
        requiresCraftingTable: true,
        isBuilding: true
    },
    {
        id: 'wall',
        name: 'Pared',
        result: { buildingTypeId: 'wall' },
        ingredients: [
            { typeId: 'wood', quantity: 4 }
        ],
        requiresCraftingTable: false,
        isBuilding: true
    },
    {
        id: 'floor',
        name: 'Piso',
        result: { buildingTypeId: 'floor' },
        ingredients: [
            { typeId: 'wood', quantity: 6 }
        ],
        requiresCraftingTable: false,
        isBuilding: true
    },
    {
        id: 'door',
        name: 'Puerta',
        result: { buildingTypeId: 'door' },
        ingredients: [
            { typeId: 'wood', quantity: 3 }
        ],
        requiresCraftingTable: false,
        isBuilding: true
    }
];

export class Crafting {
    constructor(game) {
        this.game = game;
        this.nearCraftingTable = false;
    }

    // Get available recipes based on current state
    getAvailableRecipes() {
        return RECIPES.filter(recipe => {
            if (recipe.requiresCraftingTable && !this.nearCraftingTable) {
                return false;
            }
            return true;
        });
    }

    // Check if recipe can be crafted
    canCraft(recipeId) {
        const recipe = RECIPES.find(r => r.id === recipeId);
        if (!recipe) return false;

        if (recipe.requiresCraftingTable && !this.nearCraftingTable) {
            return false;
        }

        const inventory = this.game.player.inventory;
        for (const ingredient of recipe.ingredients) {
            if (!inventory.hasItem(ingredient.typeId, ingredient.quantity)) {
                return false;
            }
        }

        return true;
    }

    // Craft an item
    craft(recipeId) {
        if (!this.canCraft(recipeId)) return false;

        const recipe = RECIPES.find(r => r.id === recipeId);
        const inventory = this.game.player.inventory;

        // Remove ingredients
        for (const ingredient of recipe.ingredients) {
            inventory.removeItemByType(ingredient.typeId, ingredient.quantity);
        }

        // Create result
        if (recipe.isBuilding) {
            // Return building type for placement
            return { type: 'building', buildingTypeId: recipe.result.buildingTypeId };
        } else {
            // Add item to inventory
            const item = createItem(recipe.result.typeId, recipe.result.quantity);
            if (!inventory.addItem(item)) {
                // No space - drop on ground (for now just return false)
                return false;
            }
            return { type: 'item', item };
        }
    }

    // Update (check for nearby crafting table)
    update(buildings) {
        const playerPos = this.game.player.mesh.position;
        this.nearCraftingTable = false;

        if (buildings) {
            for (const building of buildings) {
                if (building.type === 'crafting_table') {
                    const dx = building.x - playerPos.x;
                    const dz = building.z - playerPos.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 3) {
                        this.nearCraftingTable = true;
                        break;
                    }
                }
            }
        }
    }
}
