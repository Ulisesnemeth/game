/**
 * Survival stats UI - Hunger and Energy bars
 */
export class SurvivalUI {
    constructor(game) {
        this.game = game;
        this.createUI();
    }

    createUI() {
        // Add to existing HUD
        const hud = document.getElementById('hud');
        if (!hud) return;

        this.container = document.createElement('div');
        this.container.id = 'survival-ui';
        this.container.innerHTML = `
            <div class="survival-bar hunger-bar">
                <span class="bar-icon">🍖</span>
                <div class="bar-track">
                    <div class="bar-fill" id="hunger-fill"></div>
                </div>
                <span class="bar-value" id="hunger-value">100</span>
            </div>
            <div class="survival-bar energy-bar">
                <span class="bar-icon">⚡</span>
                <div class="bar-track">
                    <div class="bar-fill" id="energy-fill"></div>
                </div>
                <span class="bar-value" id="energy-value">100</span>
            </div>
        `;
        hud.appendChild(this.container);

        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('survival-styles')) return;

        const style = document.createElement('style');
        style.id = 'survival-styles';
        style.textContent = `
            #survival-ui {
                position: absolute;
                top: 160px;
                left: 20px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .survival-bar {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(15, 15, 25, 0.85);
                border: 1px solid rgba(100, 200, 255, 0.3);
                border-radius: 8px;
                padding: 6px 10px;
                min-width: 150px;
            }
            
            .survival-bar .bar-icon {
                font-size: 16px;
            }
            
            .survival-bar .bar-track {
                flex: 1;
                height: 10px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 5px;
                overflow: hidden;
            }
            
            .survival-bar .bar-fill {
                height: 100%;
                border-radius: 5px;
                transition: width 0.3s ease;
            }
            
            .hunger-bar .bar-fill {
                background: linear-gradient(90deg, #ff6b35, #ff922b);
                box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
            }
            
            .energy-bar .bar-fill {
                background: linear-gradient(90deg, #ffd43b, #ffec00);
                box-shadow: 0 0 10px rgba(255, 212, 59, 0.5);
            }
            
            .survival-bar .bar-value {
                font-size: 11px;
                font-weight: 600;
                min-width: 25px;
                text-align: right;
                color: rgba(255, 255, 255, 0.8);
            }
            
            .survival-bar.warning .bar-fill {
                animation: pulse-warning 0.5s infinite;
            }
            
            @keyframes pulse-warning {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }

    update(survival) {
        if (!survival) return;

        const hungerFill = document.getElementById('hunger-fill');
        const hungerValue = document.getElementById('hunger-value');
        const energyFill = document.getElementById('energy-fill');
        const energyValue = document.getElementById('energy-value');

        if (hungerFill) {
            hungerFill.style.width = `${survival.getHungerPercent()}%`;
            hungerValue.textContent = Math.ceil(survival.hunger);

            const hungerBar = hungerFill.closest('.survival-bar');
            hungerBar.classList.toggle('warning', survival.hunger < 20);
        }

        if (energyFill) {
            energyFill.style.width = `${survival.getEnergyPercent()}%`;
            energyValue.textContent = Math.ceil(survival.energy);

            const energyBar = energyFill.closest('.survival-bar');
            energyBar.classList.toggle('warning', survival.energy < 20);
        }
    }
}
