import { BUILDING_TYPES } from '../systems/Building.js';

/**
 * Building UI - Building mode indicator and building list
 */
export class BuildingUI {
    constructor(game) {
        this.game = game;
        this.createUI();
    }

    createUI() {
        // Building mode indicator
        this.indicator = document.createElement('div');
        this.indicator.id = 'building-indicator';
        this.indicator.className = 'hidden';
        this.indicator.innerHTML = `
            <div class="indicator-content">
                <span class="indicator-icon">🏗️</span>
                <span class="indicator-text">Modo Construcción</span>
            </div>
            <div class="indicator-hints">
                <span>Click: Colocar</span>
                <span>R: Rotar</span>
                <span>Esc: Cancelar</span>
            </div>
        `;
        document.body.appendChild(this.indicator);

        // Interaction hint
        this.interactionHint = document.createElement('div');
        this.interactionHint.id = 'interaction-hint';
        this.interactionHint.className = 'hidden';
        document.body.appendChild(this.interactionHint);

        this.addStyles();
        this.setupEvents();
    }

    addStyles() {
        if (document.getElementById('building-styles')) return;

        const style = document.createElement('style');
        style.id = 'building-styles';
        style.textContent = `
            #building-indicator {
                position: fixed;
                top: 50%;
                left: 20px;
                transform: translateY(-50%);
                background: rgba(15, 15, 25, 0.95);
                border: 2px solid #ff6b35;
                border-radius: 12px;
                padding: 16px;
                color: white;
                font-family: 'Outfit', sans-serif;
                z-index: 100;
            }
            
            #building-indicator.hidden {
                display: none;
            }
            
            .indicator-content {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 12px;
            }
            
            .indicator-icon {
                font-size: 24px;
            }
            
            .indicator-hints {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .indicator-hints span {
                padding: 4px 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
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

    setupEvents() {
        window.addEventListener('keydown', (e) => {
            const building = this.game.building;
            if (!building) return;

            if (building.isPlacing) {
                if (e.code === 'KeyR') {
                    building.rotatePlacing();
                }
                if (e.code === 'Escape') {
                    building.cancelPlacing();
                    this.hideIndicator();
                }
            }

            // Interact with nearby building
            if (e.code === 'KeyF' && building.nearbyBuilding) {
                const result = building.interact();
                if (result) {
                    this.handleInteraction(result);
                }
            }
        });

        // Click to place
        window.addEventListener('click', (e) => {
            const building = this.game.building;
            if (!building || !building.isPlacing) return;

            // Get mouse world position
            const mouseWorld = this.getMouseWorldPosition(e);
            if (mouseWorld) {
                const placed = building.confirmPlacing(mouseWorld.x, mouseWorld.z);
                if (placed) {
                    // Notify server
                    this.game.network?.socket?.emit('buildingPlaced', placed);
                    this.hideIndicator();
                }
            }
        });
    }

    getMouseWorldPosition(e) {
        // This should be passed from Game class
        return this.game.mouseWorldPos;
    }

    handleInteraction(result) {
        switch (result.action) {
            case 'openStorage':
                // Open storage UI
                this.game.storageUI?.open(result.building, result.storage);
                break;
            case 'openCrafting':
                this.game.craftingUI?.open();
                break;
            case 'sleep':
                this.game.survival?.sleep();
                break;
        }
    }

    update() {
        const building = this.game.building;
        if (!building) return;

        // Update building mode indicator
        if (building.isPlacing) {
            this.showIndicator();
        } else {
            this.hideIndicator();
        }

        // Update interaction hint
        if (building.nearbyBuilding) {
            const type = BUILDING_TYPES[building.nearbyBuilding.data.type];
            this.showInteractionHint(type);
        } else {
            this.hideInteractionHint();
        }
    }

    showIndicator() {
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
            action = 'Usar mesa';
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
