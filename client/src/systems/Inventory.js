import { getItemType, createItem } from './ItemTypes.js';

/**
 * Grid-based inventory system with physical item placement
 * Items occupy multiple cells based on their width/height
 */
export class Inventory {
    constructor(width = 4, height = 3) {
        this.width = width;
        this.height = height;
        this.grid = this.createGrid();
        this.items = []; // Array of {item, x, y}
        this.equippedWeapon = null;
        this.equippedTool = null;

        this.onChangeCallbacks = [];
    }

    createGrid() {
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                grid[y][x] = null; // null = empty, itemIndex otherwise
            }
        }
        return grid;
    }

    // Check if an item can be placed at position
    canPlaceAt(itemType, x, y, ignoreIndex = -1) {
        if (x < 0 || y < 0 || x + itemType.width > this.width || y + itemType.height > this.height) {
            return false;
        }

        for (let dy = 0; dy < itemType.height; dy++) {
            for (let dx = 0; dx < itemType.width; dx++) {
                const cellValue = this.grid[y + dy][x + dx];
                if (cellValue !== null && cellValue !== ignoreIndex) {
                    return false;
                }
            }
        }
        return true;
    }

    // Find first available position for item
    findSpaceFor(itemType) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.canPlaceAt(itemType, x, y)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    // Add item to inventory
    addItem(item) {
        const type = getItemType(item.typeId);
        if (!type) return false;

        // Try to stack with existing item first
        if (type.stackable) {
            for (const slot of this.items) {
                if (slot.item.typeId === item.typeId) {
                    const canAdd = type.maxStack - slot.item.quantity;
                    if (canAdd > 0) {
                        const toAdd = Math.min(canAdd, item.quantity);
                        slot.item.quantity += toAdd;
                        item.quantity -= toAdd;

                        if (item.quantity <= 0) {
                            this.notifyChange();
                            return true;
                        }
                    }
                }
            }
        }

        // Find space for remaining/non-stackable item
        const pos = this.findSpaceFor(type);
        if (!pos) return false;

        return this.placeAt(item, pos.x, pos.y);
    }

    // Place item at specific position
    placeAt(item, x, y) {
        const type = getItemType(item.typeId);
        if (!type || !this.canPlaceAt(type, x, y)) return false;

        const index = this.items.length;
        this.items.push({ item, x, y });

        // Mark grid cells
        for (let dy = 0; dy < type.height; dy++) {
            for (let dx = 0; dx < type.width; dx++) {
                this.grid[y + dy][x + dx] = index;
            }
        }

        this.notifyChange();
        return true;
    }

    // Remove item from inventory
    removeItem(index, quantity = 1) {
        if (index < 0 || index >= this.items.length) return null;

        const slot = this.items[index];
        const type = getItemType(slot.item.typeId);

        // Clear grid cells
        for (let dy = 0; dy < type.height; dy++) {
            for (let dx = 0; dx < type.width; dx++) {
                this.grid[slot.y + dy][slot.x + dx] = null;
            }
        }

        if (type.stackable && slot.item.quantity > quantity) {
            slot.item.quantity -= quantity;
            // Re-mark cells
            for (let dy = 0; dy < type.height; dy++) {
                for (let dx = 0; dx < type.width; dx++) {
                    this.grid[slot.y + dy][slot.x + dx] = index;
                }
            }
            this.notifyChange();
            return createItem(slot.item.typeId, quantity);
        }

        // Remove entirely
        const removed = this.items.splice(index, 1)[0];

        // Rebuild grid (indices changed)
        this.rebuildGrid();
        this.notifyChange();

        return removed.item;
    }

    // Move item to new position
    moveItem(index, newX, newY) {
        if (index < 0 || index >= this.items.length) return false;

        const slot = this.items[index];
        const type = getItemType(slot.item.typeId);

        if (!this.canPlaceAt(type, newX, newY, index)) return false;

        // Clear old position
        for (let dy = 0; dy < type.height; dy++) {
            for (let dx = 0; dx < type.width; dx++) {
                this.grid[slot.y + dy][slot.x + dx] = null;
            }
        }

        // Set new position
        slot.x = newX;
        slot.y = newY;

        for (let dy = 0; dy < type.height; dy++) {
            for (let dx = 0; dx < type.width; dx++) {
                this.grid[newY + dy][newX + dx] = index;
            }
        }

        this.notifyChange();
        return true;
    }

    // Rebuild grid from items array
    rebuildGrid() {
        this.grid = this.createGrid();

        this.items.forEach((slot, index) => {
            const type = getItemType(slot.item.typeId);
            for (let dy = 0; dy < type.height; dy++) {
                for (let dx = 0; dx < type.width; dx++) {
                    this.grid[slot.y + dy][slot.x + dx] = index;
                }
            }
        });
    }

    // Get item at grid position
    getItemAt(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
        const index = this.grid[y][x];
        if (index === null) return null;
        return { index, ...this.items[index] };
    }

    // Use item (eat, equip)
    useItem(index) {
        if (index < 0 || index >= this.items.length) return false;

        const slot = this.items[index];
        const type = getItemType(slot.item.typeId);

        switch (type.category) {
            case 'food':
                // Will be handled by Survival system
                return { action: 'eat', item: slot.item, type };

            case 'weapon':
                this.equippedWeapon = slot.item;
                return { action: 'equip', item: slot.item, type };

            case 'tool':
                this.equippedTool = slot.item;
                return { action: 'equip', item: slot.item, type };

            default:
                return false;
        }
    }

    // Check if has item
    hasItem(typeId, quantity = 1) {
        let total = 0;
        for (const slot of this.items) {
            if (slot.item.typeId === typeId) {
                total += slot.item.quantity || 1;
                if (total >= quantity) return true;
            }
        }
        return false;
    }

    // Count items of type
    countItem(typeId) {
        let total = 0;
        for (const slot of this.items) {
            if (slot.item.typeId === typeId) {
                total += slot.item.quantity || 1;
            }
        }
        return total;
    }

    // Remove specific quantity of item type
    removeItemByType(typeId, quantity = 1) {
        let remaining = quantity;

        for (let i = this.items.length - 1; i >= 0 && remaining > 0; i--) {
            const slot = this.items[i];
            if (slot.item.typeId === typeId) {
                const has = slot.item.quantity || 1;
                const toRemove = Math.min(has, remaining);
                this.removeItem(i, toRemove);
                remaining -= toRemove;
            }
        }

        return remaining === 0;
    }

    // Get weapon damage bonus
    getWeaponBonus() {
        if (!this.equippedWeapon) return 0;
        const type = getItemType(this.equippedWeapon.typeId);
        return type?.damageBonus || 0;
    }

    // Get tool bonus for a specific resource type (tree, rock)
    getToolBonus(resourceType) {
        if (!this.equippedTool) return 1.0; // No bonus without tool
        const type = getItemType(this.equippedTool.typeId);
        if (!type || !type.resourceBonus) return 1.0;
        return type.resourceBonus[resourceType] || 1.0;
    }

    // Get equipped tool info
    getEquippedTool() {
        if (!this.equippedTool) return null;
        return getItemType(this.equippedTool.typeId);
    }

    // Serialize for network/storage
    serialize() {
        return {
            width: this.width,
            height: this.height,
            items: this.items.map(slot => ({
                item: slot.item,
                x: slot.x,
                y: slot.y
            })),
            equippedWeapon: this.equippedWeapon,
            equippedTool: this.equippedTool
        };
    }

    // Load from serialized data
    deserialize(data) {
        this.width = data.width || 4;
        this.height = data.height || 3;
        this.grid = this.createGrid();
        this.items = [];

        for (const slot of (data.items || [])) {
            this.placeAt(slot.item, slot.x, slot.y);
        }

        this.equippedWeapon = data.equippedWeapon || null;
        this.equippedTool = data.equippedTool || null;
    }

    // Change notifications
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
    }

    notifyChange() {
        this.onChangeCallbacks.forEach(cb => cb(this));
    }
}
