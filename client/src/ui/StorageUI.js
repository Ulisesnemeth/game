import * as THREE from 'three';
import { getItemType } from '../systems/ItemTypes.js';

/**
 * Storage UI - Immersive chest interaction with camera zoom
 */
export class StorageUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.currentBuilding = null;
        this.storageConfig = null;
        this.draggedItem = null;
        this.draggedFrom = null; // 'inventory' or 'storage'
        this.draggedIndex = null;

        // Camera state for restoration
        this.originalCameraPos = new THREE.Vector3();
        this.originalCameraLookAt = new THREE.Vector3();

        this.cellSize = 50;

        this.createUI();
    }

    createUI() {
        // Full screen overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'storage-overlay';
        this.overlay.className = 'hidden';
        this.overlay.innerHTML = `
            <div class="storage-container">
                <div class="storage-panel inventory-panel">
                    <div class="panel-title">🎒 Tu Bolso</div>
                    <div class="storage-grid" id="storage-inventory-grid"></div>
                </div>
                <div class="storage-center">
                    <div class="hands-visual">🤲</div>
                    <div class="drag-hint">Arrastra items entre bolso y cofre</div>
                </div>
                <div class="storage-panel chest-panel">
                    <div class="panel-title">📦 Cofre</div>
                    <div class="storage-grid" id="storage-chest-grid"></div>
                </div>
            </div>
            <div class="storage-close-hint">Presiona <b>ESC</b> o <b>F</b> para cerrar</div>
        `;
        document.body.appendChild(this.overlay);

        this.addStyles();
        this.setupEvents();
    }

    addStyles() {
        if (document.getElementById('storage-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'storage-ui-styles';
        style.textContent = `
            #storage-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 100%);
                z-index: 2000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                animation: storage-fade-in 0.3s ease-out;
            }
            
            #storage-overlay.hidden {
                display: none;
            }
            
            @keyframes storage-fade-in {
                from { opacity: 0; transform: scale(1.1); }
                to { opacity: 1; transform: scale(1); }
            }
            
            .storage-container {
                display: flex;
                gap: 40px;
                align-items: center;
            }
            
            .storage-panel {
                background: rgba(20, 20, 35, 0.95);
                border: 2px solid rgba(255, 200, 100, 0.4);
                border-radius: 16px;
                padding: 20px;
                backdrop-filter: blur(10px);
                box-shadow: 0 0 40px rgba(255, 150, 50, 0.2);
            }
            
            .chest-panel {
                border-color: rgba(255, 150, 50, 0.6);
            }
            
            .panel-title {
                font-family: 'Outfit', sans-serif;
                font-size: 18px;
                font-weight: 600;
                color: white;
                margin-bottom: 16px;
                text-align: center;
            }
            
            .storage-grid {
                display: grid;
                gap: 4px;
                background: rgba(0, 0, 0, 0.3);
                padding: 8px;
                border-radius: 8px;
            }
            
            .storage-cell {
                width: 50px;
                height: 50px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: all 0.15s;
            }
            
            .storage-cell:hover {
                background: rgba(255, 200, 100, 0.15);
                border-color: rgba(255, 200, 100, 0.4);
            }
            
            .storage-cell.has-item {
                background: rgba(0, 212, 255, 0.15);
                border-color: rgba(0, 212, 255, 0.4);
                cursor: grab;
            }
            
            .storage-cell.has-item:active {
                cursor: grabbing;
            }
            
            .storage-cell.drag-over {
                background: rgba(100, 255, 100, 0.2);
                border-color: rgba(100, 255, 100, 0.6);
                transform: scale(1.05);
            }
            
            .cell-icon {
                font-size: 24px;
            }
            
            .cell-quantity {
                position: absolute;
                bottom: 2px;
                right: 4px;
                font-size: 11px;
                font-weight: bold;
                color: white;
                text-shadow: 0 0 3px black, 0 0 3px black;
            }
            
            .storage-center {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            }
            
            .hands-visual {
                font-size: 64px;
                animation: hands-float 2s ease-in-out infinite;
            }
            
            @keyframes hands-float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            .drag-hint {
                font-family: 'Outfit', sans-serif;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.5);
                max-width: 120px;
                text-align: center;
            }
            
            .storage-close-hint {
                position: absolute;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'Outfit', sans-serif;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .storage-close-hint b {
                color: #ff6b35;
            }
            
            #drag-preview {
                position: fixed;
                pointer-events: none;
                z-index: 3000;
                font-size: 32px;
                transform: translate(-50%, -50%);
                filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.8));
            }
            
            .item-tooltip {
                position: fixed;
                background: rgba(0, 0, 0, 0.95);
                border: 1px solid rgba(100, 200, 255, 0.5);
                border-radius: 6px;
                padding: 8px 12px;
                color: white;
                font-size: 12px;
                z-index: 3000;
                pointer-events: none;
                max-width: 200px;
            }
        `;
        document.head.appendChild(style);
    }

    setupEvents() {
        window.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;

            if (e.code === 'Escape' || e.code === 'KeyF') {
                this.close();
            }
        });

        // Drag events
        this.overlay.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.overlay.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.overlay.addEventListener('mouseup', (e) => this.onMouseUp(e));
    }

    open(building) {
        if (!building) return;

        this.isOpen = true;
        this.currentBuilding = building;
        this.storageConfig = this.getStorageConfig(building.data.type);

        // Store camera position
        this.originalCameraPos.copy(this.game.camera.position);

        // Dramatic zoom to player
        this.zoomToPlayer();

        // Render grids
        this.renderInventory();
        this.renderStorage();

        this.overlay.classList.remove('hidden');
    }

    close() {
        this.isOpen = false;
        this.currentBuilding = null;
        this.overlay.classList.add('hidden');

        // Restore camera
        this.restoreCamera();

        // Clean up drag preview
        const preview = document.getElementById('drag-preview');
        if (preview) preview.remove();
    }

    getStorageConfig(buildingType) {
        const configs = {
            'chest_small': { width: 3, height: 3 },
            'chest_large': { width: 6, height: 4 }
        };
        return configs[buildingType] || { width: 3, height: 3 };
    }

    zoomToPlayer() {
        const playerPos = this.game.player.mesh.position;
        const targetPos = new THREE.Vector3(
            playerPos.x + 2,
            playerPos.y + 2,
            playerPos.z + 3
        );

        // Animate camera
        const startPos = this.game.camera.position.clone();
        const startTime = Date.now();
        const duration = 300;

        const animate = () => {
            if (!this.isOpen) return;

            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3); // ease out cubic

            this.game.camera.position.lerpVectors(startPos, targetPos, eased);
            this.game.camera.lookAt(playerPos);

            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    restoreCamera() {
        const playerPos = this.game.player.mesh.position;
        const targetPos = playerPos.clone().add(this.game.cameraOffset);

        const startPos = this.game.camera.position.clone();
        const startTime = Date.now();
        const duration = 300;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);

            this.game.camera.position.lerpVectors(startPos, targetPos, eased);
            this.game.camera.lookAt(playerPos);

            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    renderInventory() {
        const grid = document.getElementById('storage-inventory-grid');
        if (!grid) return;

        const inventory = this.game.player?.inventory;
        if (!inventory) return;

        grid.style.gridTemplateColumns = `repeat(${inventory.width}, ${this.cellSize}px)`;
        grid.innerHTML = '';

        // Create cells
        for (let y = 0; y < inventory.height; y++) {
            for (let x = 0; x < inventory.width; x++) {
                const cell = this.createCell('inventory', x, y);
                grid.appendChild(cell);
            }
        }

        // Place items
        inventory.items.forEach((slot, index) => {
            const type = getItemType(slot.item.typeId);
            if (!type) return;

            const cell = grid.children[slot.y * inventory.width + slot.x];
            if (cell) {
                cell.classList.add('has-item');
                cell.dataset.itemIndex = index;
                cell.innerHTML = `
                    <span class="cell-icon">${type.icon}</span>
                    ${slot.item.quantity > 1 ? `<span class="cell-quantity">${slot.item.quantity}</span>` : ''}
                `;
            }
        });
    }

    renderStorage() {
        const grid = document.getElementById('storage-chest-grid');
        if (!grid) return;

        const config = this.storageConfig;
        const contents = this.currentBuilding?.data.contents || [];

        grid.style.gridTemplateColumns = `repeat(${config.width}, ${this.cellSize}px)`;
        grid.innerHTML = '';

        // Create cells
        for (let y = 0; y < config.height; y++) {
            for (let x = 0; x < config.width; x++) {
                const index = y * config.width + x;
                const cell = this.createCell('storage', x, y);

                // Check if item exists at this position
                const item = contents.find(c => c.x === x && c.y === y);
                if (item) {
                    const type = getItemType(item.typeId);
                    if (type) {
                        cell.classList.add('has-item');
                        cell.dataset.storageIndex = index;
                        cell.innerHTML = `
                            <span class="cell-icon">${type.icon}</span>
                            ${item.quantity > 1 ? `<span class="cell-quantity">${item.quantity}</span>` : ''}
                        `;
                    }
                }

                grid.appendChild(cell);
            }
        }
    }

    createCell(source, x, y) {
        const cell = document.createElement('div');
        cell.className = 'storage-cell';
        cell.dataset.source = source;
        cell.dataset.x = x;
        cell.dataset.y = y;
        return cell;
    }

    onMouseDown(e) {
        const cell = e.target.closest('.storage-cell.has-item');
        if (!cell) return;

        e.preventDefault();

        this.draggedFrom = cell.dataset.source;
        this.draggedIndex = parseInt(cell.dataset.itemIndex || cell.dataset.storageIndex);
        this.dragStartX = parseInt(cell.dataset.x);
        this.dragStartY = parseInt(cell.dataset.y);

        // Create drag preview
        const icon = cell.querySelector('.cell-icon');
        if (icon) {
            const preview = document.createElement('div');
            preview.id = 'drag-preview';
            preview.textContent = icon.textContent;
            preview.style.left = `${e.clientX}px`;
            preview.style.top = `${e.clientY}px`;
            document.body.appendChild(preview);
        }

        cell.style.opacity = '0.5';
        this.draggedCell = cell;
    }

    onMouseMove(e) {
        const preview = document.getElementById('drag-preview');
        if (preview) {
            preview.style.left = `${e.clientX}px`;
            preview.style.top = `${e.clientY}px`;
        }

        // Highlight drop target
        const cell = e.target.closest('.storage-cell');
        document.querySelectorAll('.storage-cell.drag-over').forEach(c => {
            c.classList.remove('drag-over');
        });
        if (cell && preview) {
            cell.classList.add('drag-over');
        }
    }

    onMouseUp(e) {
        const preview = document.getElementById('drag-preview');
        if (!preview) return;

        preview.remove();

        if (this.draggedCell) {
            this.draggedCell.style.opacity = '1';
        }

        document.querySelectorAll('.storage-cell.drag-over').forEach(c => {
            c.classList.remove('drag-over');
        });

        const targetCell = e.target.closest('.storage-cell');
        if (!targetCell) return;

        const targetSource = targetCell.dataset.source;
        const targetX = parseInt(targetCell.dataset.x);
        const targetY = parseInt(targetCell.dataset.y);

        // Handle drop
        this.handleDrop(targetSource, targetX, targetY);

        // Reset drag state
        this.draggedFrom = null;
        this.draggedIndex = null;
        this.draggedCell = null;
    }

    handleDrop(targetSource, targetX, targetY) {
        const inventory = this.game.player?.inventory;
        const contents = this.currentBuilding?.data.contents || [];

        if (this.draggedFrom === 'inventory' && targetSource === 'storage') {
            // Move from inventory to chest
            const slot = inventory.items[this.draggedIndex];
            if (slot) {
                // Check if slot is empty
                const existingItem = contents.find(c => c.x === targetX && c.y === targetY);
                if (!existingItem) {
                    // Remove from inventory
                    inventory.removeItem(this.draggedIndex, slot.item.quantity);

                    // Add to chest
                    contents.push({
                        typeId: slot.item.typeId,
                        quantity: slot.item.quantity,
                        x: targetX,
                        y: targetY
                    });

                    this.currentBuilding.data.contents = contents;
                    this.syncToServer();
                }
            }
        } else if (this.draggedFrom === 'storage' && targetSource === 'inventory') {
            // Move from chest to inventory
            const itemIndex = contents.findIndex(c => c.x === this.dragStartX && c.y === this.dragStartY);
            if (itemIndex >= 0) {
                const item = contents[itemIndex];

                // Try to add to inventory
                const added = inventory.addItem({
                    typeId: item.typeId,
                    quantity: item.quantity
                });

                if (added) {
                    // Remove from chest
                    contents.splice(itemIndex, 1);
                    this.currentBuilding.data.contents = contents;
                    this.syncToServer();
                }
            }
        }

        // Re-render
        this.renderInventory();
        this.renderStorage();
    }

    syncToServer() {
        if (!this.currentBuilding) return;

        this.game.network?.sendBuildingContentsUpdate(
            this.currentBuilding.data.id,
            this.currentBuilding.data.contents
        );
    }
}
