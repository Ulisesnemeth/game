/**
 * Item definitions for the game
 * Each item has physical size in the inventory grid
 */
export const ITEM_TYPES = {
    // Food
    MEAT: {
        id: 'meat',
        name: 'Carne',
        description: 'Restaura 30 de hambre',
        category: 'food',
        width: 1,
        height: 1,
        stackable: true,
        maxStack: 10,
        hungerRestore: 30,
        icon: '🍖'
    },
    BERRIES: {
        id: 'berries',
        name: 'Bayas',
        description: 'Restaura 10 de hambre',
        category: 'food',
        width: 1,
        height: 1,
        stackable: true,
        maxStack: 20,
        hungerRestore: 10,
        icon: '🫐'
    },

    // Resources
    WOOD: {
        id: 'wood',
        name: 'Madera',
        description: 'Material de construcción',
        category: 'resource',
        width: 1,
        height: 1,
        stackable: true,
        maxStack: 20,
        icon: '🪵'
    },
    STONE: {
        id: 'stone',
        name: 'Piedra',
        description: 'Material de construcción',
        category: 'resource',
        width: 1,
        height: 1,
        stackable: true,
        maxStack: 20,
        icon: '🪨'
    },
    LEATHER: {
        id: 'leather',
        name: 'Cuero',
        description: 'Se obtiene de mobs',
        category: 'resource',
        width: 1,
        height: 1,
        stackable: true,
        maxStack: 10,
        icon: '🟤'
    },

    // Tools
    PICKAXE_WOOD: {
        id: 'pickaxe_wood',
        name: 'Pico de Madera',
        description: 'Recolecta recursos más rápido',
        category: 'tool',
        width: 1,
        height: 2,
        stackable: false,
        durability: 50,
        miningSpeed: 1.5,
        icon: '⛏️'
    },
    PICKAXE_STONE: {
        id: 'pickaxe_stone',
        name: 'Pico de Piedra',
        description: 'Recolecta recursos mucho más rápido',
        category: 'tool',
        width: 1,
        height: 2,
        stackable: false,
        durability: 100,
        miningSpeed: 2,
        icon: '⛏️'
    },

    // Weapons
    SWORD_WOOD: {
        id: 'sword_wood',
        name: 'Espada de Madera',
        description: '+5 de daño',
        category: 'weapon',
        width: 1,
        height: 2,
        stackable: false,
        damageBonus: 5,
        durability: 50,
        icon: '🗡️'
    },
    SWORD_STONE: {
        id: 'sword_stone',
        name: 'Espada de Piedra',
        description: '+10 de daño',
        category: 'weapon',
        width: 1,
        height: 2,
        stackable: false,
        damageBonus: 10,
        durability: 100,
        icon: '⚔️'
    },

    // Special
    BAG: {
        id: 'bag',
        name: 'Bolsa Grande',
        description: 'Aumenta espacio de inventario',
        category: 'special',
        width: 2,
        height: 2,
        stackable: false,
        extraSlots: 6,
        icon: '🎒'
    }
};

// Get item type by id
export function getItemType(id) {
    for (const type of Object.values(ITEM_TYPES)) {
        if (type.id === id) return type;
    }
    return null;
}

// Create item instance
export function createItem(typeId, quantity = 1) {
    const type = getItemType(typeId);
    if (!type) return null;

    return {
        typeId: type.id,
        quantity: type.stackable ? Math.min(quantity, type.maxStack) : 1,
        durability: type.durability || null
    };
}
