import { BUILDING_TYPES } from '../systems/Building.js';

/**
 * Building UI - Build menu and placement controls
 */
export class BuildingUI {
    constructor(game) {
        this.game = game;
        this.isMenuOpen = false;
        this.createUI();
        this.setupEvents();
    }

    createUI() {
        // Build menu
        this.menu = document.createElement('div');
        this.menu.id = 'build-menu';
        this.menu.className = 'hidden';
        this.menu.innerHTML = `
            <div class="menu-header">
                <span>🏗️ Construcción</span>
                <button class="close-btn">×</button>
            </div>
            <div class="menu-items" id="build-menu-items"></div>
            <div class="menu-footer">
                <span>Click para seleccionar • B para cerrar</span>
            </div>
        `;
        document.body.appendChild(this.menu);

        // Building mode indicator
        this.indicator = document.createElement('div');
        this.indicator.id = 'building-indicator';
        this.indicator.className = 'hidden';
        document.body.appendChild(this.indicator);

        // Interaction hint
        this.interactionHint = document.createElement('div');
        this.interactionHint.id = 'interaction-hint';
        this.interactionHint.className = 'hidden';
        document.body.appendChild(this.interactionHint);

        this.addStyles();
        this.populateMenu();
    }

    addStyles() {
        if (document.getElementById('building-styles')) return;

        const style = document.createElement('style');
        style.id = 'building-styles';
        style.textContent = `
            #build-menu {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(15, 15, 25, 0.98);
                border: 2px solid rgba(255, 107, 53, 0.5);
                border-radius: 16px;
                padding: 20px;
                color: white;
                font-family: 'Outfit', sans-serif;
                z-index: 1000;
                min-width: 400px;
                backdrop-filter: blur(10px);
            }
            
            #build-menu.hidden {
                display: none;
            }
            
            .menu-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .menu-header .close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                opacity: 0.7;
                line-height: 1;
            }
            
            .menu-header .close-btn:hover {
                opacity: 1;
            }
            
            .menu-items {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .build-item {
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                padding: 12px;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s;
            }
            
            .build-item:hover {
                background: rgba(255, 107, 53, 0.2);
                border-color: rgba(255, 107, 53, 0.5);
                transform: translateY(-2px);
            }
            
            .build-item-icon {
                font-size: 32px;
                margin-bottom: 8px;
            }
            
            .build-item-name {
                font-size: 12px;
                font-weight: 600;
            }
            
            .menu-footer {
                margin-top: 16px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
                text-align: center;
            }
            
            #building-indicator {
                position: fixed;
                bottom: 150px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 15, 25, 0.95);
                border: 2px solid #ff6b35;
                border-radius: 12px;
                padding: 12px 20px;
                color: white;
                font-family: 'Outfit', sans-serif;
                z-index: 100;
                display: flex;
                gap: 20px;
                align-items: center;
            }
            
            #building-indicator.hidden {
                display: none;
            }
            
            .indicator-name {
                font-weight: 600;
                font-size: 14px;
            }
            
            .indicator-controls {
                display: flex;
                gap: 10px;
                font-size: 12px;
            }
            
            .indicator-controls span {
                background: rgba(255, 255, 255, 0.1);
                padding: 4px 8px;
                border-radius: 4px;
            }
            
            .indicator-controls span b {
                color: #ff6b35;
            }
            
            #interaction-hint {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 15, 25, 0.95);
                border: 1px solid rgba(100, 200, 255, 0.5);
                border-radius: 8px;
                padding: 10px 20px;
                color: white;
                font-family: 'Outfit', sans-serif;
                font-size: 14px;
                z-index: 100;
                animation: pulse-hint 1.5s infinite;
            }
            
            #interaction-hint.hidden {
                display: none;
            }
            
            @keyframes pulse-hint {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);
    }

    populateMenu() {
        const container = document.getElementById('build-menu-items');
        if (!container) return;

        const icons = {
            wall: '🧱',
            floor: '🟫',
            door: '🚪',
            chest_small: '📦',
            chest_large: '🗃️',
            crafting_table: '🔨',
            bed: '🛏️'
        };

        container.innerHTML = '';

        for (const [id, type] of Object.entries(BUILDING_TYPES)) {
            const item = document.createElement('div');
            item.className = 'build-item';
            item.dataset.typeId = id;
            item.innerHTML = `
                <div class="build-item-icon">${icons[id] || '🏗️'}</div>
                <div class="build-item-name">${type.name}</div>
            `;
            item.addEventListener('click', () => this.selectBuildItem(id));
            container.appendChild(item);
        }
    }

    setupEvents() {
        // Close button
        this.menu.querySelector('.close-btn').addEventListener('click', () => {
            this.closeMenu();
        });

        window.addEventListener('keydown', (e) => {
            // Toggle build menu
            if (e.code === 'KeyB') {
                if (this.game.building?.isPlacing) {
                    this.game.building.cancelPlacing();
                    this.hideIndicator();
                } else if (this.isMenuOpen) {
                    this.closeMenu();
                } else {
                    this.openMenu();
                }
            }

            // Building controls when placing
            if (this.game.building?.isPlacing) {
                if (e.code === 'KeyR') {
                    this.game.building.rotatePlacing();
                }
                if (e.code === 'Escape') {
                    this.game.building.cancelPlacing();
                    this.hideIndicator();
                }
            }
        });

        // Click to place
        window.addEventListener('click', (e) => {
            const building = this.game.building;
            if (!building || !building.isPlacing) return;

            // Ignore if menu is open
            if (this.isMenuOpen) return;

            // Ignore if clicking on UI
            if (e.target.closest('#build-menu') ||
                e.target.closest('#inventory-ui') ||
                e.target.closest('#crafting-ui')) return;

            const mouseWorld = this.game.mouseWorldPos;
            if (mouseWorld) {
                const placed = building.confirmPlacing(mouseWorld.x, mouseWorld.z);
                if (placed) {
                    this.game.network?.socket?.emit('buildingPlaced', placed);
                    this.hideIndicator();
                }
            }
        });
    }

    selectBuildItem(typeId) {
        const building = this.game.building;
        if (!building) return;

        if (building.startPlacing(typeId)) {
            this.closeMenu();
            this.showIndicator(BUILDING_TYPES[typeId]);
        }
    }

    openMenu() {
        this.isMenuOpen = true;
        this.menu.classList.remove('hidden');
    }

    closeMenu() {
        this.isMenuOpen = false;
        this.menu.classList.add('hidden');
    }

    update() {
        const building = this.game.building;
        if (!building) return;

        // Update building mode indicator
        if (building.isPlacing) {
            const type = building.placingType;
            if (type) this.showIndicator(type);
        } else {
            this.hideIndicator();
        }

        // Update interaction hint
        if (building.nearbyBuilding && !building.isPlacing) {
            const type = BUILDING_TYPES[building.nearbyBuilding.data.type];
            this.showInteractionHint(type);
        } else {
            this.hideInteractionHint();
        }
    }

    showIndicator(type) {
        const building = this.game.building;
        const degrees = building ? Math.round((building.placingRotation * 180) / Math.PI) : 0;

        this.indicator.innerHTML = `
            <span class="indicator-name">🏗️ ${type.name}</span>
            <span class="indicator-rotation">${degrees}°</span>
            <div class="indicator-controls">
                <span><b>Click</b> Colocar</span>
                <span><b>R</b> Rotar (+10°)</span>
                <span><b>Esc</b> Cancelar</span>
            </div>
        `;
        this.indicator.classList.remove('hidden');
    }

    hideIndicator() {
        this.indicator.classList.add('hidden');
    }

    showInteractionHint(type) {
        let action = 'Interactuar';
        if (type.id === 'chest_small' || type.id === 'chest_large') {
            action = 'Abrir cofre';
        } else if (type.id === 'crafting_table') {
            action = 'Usar mesa de crafteo';
        } else if (type.id === 'bed') {
            action = 'Dormir';
        }

        this.interactionHint.innerHTML = `<span>Presiona <b>F</b> para ${action}</span>`;
        this.interactionHint.classList.remove('hidden');
    }

    hideInteractionHint() {
        this.interactionHint.classList.add('hidden');
    }
}
