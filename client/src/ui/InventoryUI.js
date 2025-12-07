import { getItemType } from '../systems/ItemTypes.js';

/**
 * Grid-based inventory UI with drag and drop
 */
export class InventoryUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.draggedItem = null;
        this.dragOffset = { x: 0, y: 0 };

        this.cellSize = 50;

        this.createUI();
        this.setupEvents();
    }

    createUI() {
        // Container
        this.container = document.createElement('div');
        this.container.id = 'inventory-ui';
        this.container.className = 'game-panel hidden';
        this.container.innerHTML = `
            <div class="panel-header">
                <span>🎒 Inventario</span>
                <button class="close-btn">×</button>
            </div>
            <div class="inventory-grid" id="inventory-grid"></div>
            <div class="equipped-slots">
                <div class="equipped-slot" data-slot="weapon">
                    <span class="slot-label">Arma</span>
                    <div class="slot-content" id="equipped-weapon"></div>
                </div>
                <div class="equipped-slot" data-slot="tool">
                    <span class="slot-label">Herramienta</span>
                    <div class="slot-content" id="equipped-tool"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        // Drag ghost
        this.dragGhost = document.createElement('div');
        this.dragGhost.className = 'drag-ghost hidden';
        document.body.appendChild(this.dragGhost);

        // Add styles
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('inventory-styles')) return;

        const style = document.createElement('style');
        style.id = 'inventory-styles';
        style.textContent = `
            .game-panel {
                position: fixed;
                background: rgba(15, 15, 25, 0.95);
                border: 1px solid rgba(100, 200, 255, 0.3);
                border-radius: 12px;
                padding: 16px;
                backdrop-filter: blur(10px);
                color: white;
                font-family: 'Outfit', sans-serif;
                z-index: 1000;
            }
            
            .game-panel.hidden {
                display: none;
            }
            
            .game-panel .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                font-weight: 600;
            }
            
            .game-panel .close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                opacity: 0.7;
            }
            
            .game-panel .close-btn:hover {
                opacity: 1;
            }
            
            #inventory-ui {
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                min-width: 250px;
            }
            
            .inventory-grid {
                display: grid;
                gap: 2px;
                background: rgba(0, 0, 0, 0.3);
                padding: 4px;
                border-radius: 8px;
            }
            
            .inventory-cell {
                width: 50px;
                height: 50px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                position: relative;
            }
            
            .inventory-item {
                position: absolute;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 212, 255, 0.2);
                border: 1px solid rgba(0, 212, 255, 0.5);
                border-radius: 4px;
                cursor: grab;
                z-index: 10;
            }
            
            .inventory-item:hover {
                background: rgba(0, 212, 255, 0.3);
            }
            
            .inventory-item .item-icon {
                font-size: 24px;
            }
            
            .inventory-item .item-quantity {
                position: absolute;
                bottom: 2px;
                right: 4px;
                font-size: 11px;
                font-weight: bold;
            }
            
            .equipped-slots {
                display: flex;
                gap: 12px;
                margin-top: 12px;
                justify-content: center;
            }
            
            .equipped-slot {
                text-align: center;
            }
            
            .equipped-slot .slot-label {
                font-size: 10px;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.5);
                display: block;
                margin-bottom: 4px;
            }
            
            .equipped-slot .slot-content {
                width: 50px;
                height: 50px;
                background: rgba(255, 107, 53, 0.2);
                border: 1px solid rgba(255, 107, 53, 0.5);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            
            .drag-ghost {
                position: fixed;
                pointer-events: none;
                z-index: 2000;
                opacity: 0.8;
                font-size: 32px;
            }
            
            .drag-ghost.hidden {
                display: none;
            }
            
            .item-tooltip {
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid rgba(100, 200, 255, 0.5);
                border-radius: 6px;
                padding: 8px 12px;
                color: white;
                font-size: 12px;
                z-index: 3000;
                pointer-events: none;
                max-width: 200px;
            }
            
            .item-tooltip .tooltip-name {
                font-weight: 600;
                color: #00d4ff;
            }
            
            .item-tooltip .tooltip-desc {
                opacity: 0.7;
                margin-top: 4px;
            }
        `;
        document.head.appendChild(style);
    }

    setupEvents() {
        // Close button
        this.container.querySelector('.close-btn').addEventListener('click', () => this.close());

        // Keyboard toggle
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI') {
                this.toggle();
            }
            if (e.code === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.container.classList.remove('hidden');
        this.render();
    }

    close() {
        this.isOpen = false;
        this.container.classList.add('hidden');
    }

    render() {
        const inventory = this.game.player.inventory;
        if (!inventory) return;

        const grid = this.container.querySelector('#inventory-grid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${inventory.width}, ${this.cellSize}px)`;

        // Create cells
        for (let y = 0; y < inventory.height; y++) {
            for (let x = 0; x < inventory.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'inventory-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                grid.appendChild(cell);
            }
        }

        // Add items
        inventory.items.forEach((slot, index) => {
            const type = getItemType(slot.item.typeId);
            if (!type) return;

            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.dataset.index = index;
            itemEl.style.left = `${slot.x * (this.cellSize + 2) + 4}px`;
            itemEl.style.top = `${slot.y * (this.cellSize + 2) + 4}px`;
            itemEl.style.width = `${type.width * this.cellSize - 4}px`;
            itemEl.style.height = `${type.height * this.cellSize - 4}px`;

            itemEl.innerHTML = `
                <span class="item-icon">${type.icon}</span>
                ${slot.item.quantity > 1 ? `<span class="item-quantity">${slot.item.quantity}</span>` : ''}
            `;

            // Drag events
            itemEl.draggable = true;
            itemEl.addEventListener('dragstart', (e) => this.onDragStart(e, index));
            itemEl.addEventListener('contextmenu', (e) => this.onRightClick(e, index));
            itemEl.addEventListener('mouseenter', (e) => this.showTooltip(e, type));
            itemEl.addEventListener('mouseleave', () => this.hideTooltip());

            grid.appendChild(itemEl);
        });

        // Update equipped slots
        this.updateEquippedSlots(inventory);
    }

    updateEquippedSlots(inventory) {
        const weaponSlot = document.getElementById('equipped-weapon');
        const toolSlot = document.getElementById('equipped-tool');

        if (inventory.equippedWeapon) {
            const type = getItemType(inventory.equippedWeapon.typeId);
            weaponSlot.textContent = type?.icon || '?';
        } else {
            weaponSlot.textContent = '';
        }

        if (inventory.equippedTool) {
            const type = getItemType(inventory.equippedTool.typeId);
            toolSlot.textContent = type?.icon || '?';
        } else {
            toolSlot.textContent = '';
        }
    }

    onDragStart(e, index) {
        this.draggedItem = index;
        e.dataTransfer.setData('text/plain', index);
    }

    onRightClick(e, index) {
        e.preventDefault();
        const inventory = this.game.player.inventory;
        const result = inventory.useItem(index);

        if (result) {
            if (result.action === 'eat') {
                // Consume food
                inventory.removeItem(index, 1);
                this.game.survival?.eat(result.item);
            }
            this.render();
        }
    }

    showTooltip(e, type) {
        let tooltip = document.querySelector('.item-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'item-tooltip';
            document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = `
            <div class="tooltip-name">${type.name}</div>
            <div class="tooltip-desc">${type.description}</div>
        `;
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.style.display = 'block';
    }

    hideTooltip() {
        const tooltip = document.querySelector('.item-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
}
