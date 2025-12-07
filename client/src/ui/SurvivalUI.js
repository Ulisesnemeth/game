/**
 * Survival stats UI - Improved design with clear icons and labels
 */
export class SurvivalUI {
    constructor(game) {
        this.game = game;
        this.createUI();
    }

    createUI() {
        const hud = document.getElementById('hud');
        if (!hud) return;

        this.container = document.createElement('div');
        this.container.id = 'survival-ui';
        this.container.innerHTML = `
            <div class="survival-stat" id="hunger-stat">
                <div class="stat-header">
                    <span class="stat-icon">🍖</span>
                    <span class="stat-name">HAMBRE</span>
                    <span class="stat-value" id="hunger-text">100%</span>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" id="hunger-fill"></div>
                </div>
                <div class="stat-hint" id="hunger-hint"></div>
            </div>
            <div class="survival-stat" id="energy-stat">
                <div class="stat-header">
                    <span class="stat-icon">⚡</span>
                    <span class="stat-name">ENERGÍA</span>
                    <span class="stat-value" id="energy-text">100%</span>
                </div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" id="energy-fill"></div>
                </div>
                <div class="stat-hint" id="energy-hint"></div>
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
                top: 180px;
                left: 20px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                min-width: 200px;
            }
            
            .survival-stat {
                background: rgba(15, 15, 25, 0.9);
                border: 1px solid rgba(100, 200, 255, 0.2);
                border-radius: 10px;
                padding: 12px 14px;
                backdrop-filter: blur(10px);
            }
            
            .stat-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .stat-icon {
                font-size: 20px;
            }
            
            .stat-name {
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1px;
                color: rgba(255, 255, 255, 0.6);
                flex: 1;
            }
            
            .stat-value {
                font-size: 14px;
                font-weight: 700;
                color: white;
            }
            
            .stat-bar {
                height: 8px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .stat-bar-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s ease, background 0.3s ease;
            }
            
            #hunger-fill {
                background: linear-gradient(90deg, #ff6b35, #ff922b);
                box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
            }
            
            #energy-fill {
                background: linear-gradient(90deg, #ffd43b, #ffe066);
                box-shadow: 0 0 10px rgba(255, 212, 59, 0.5);
            }
            
            .stat-hint {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.5);
                margin-top: 6px;
                min-height: 14px;
            }
            
            .stat-hint.warning {
                color: #ff6b6b;
                animation: blink 1s infinite;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Critical state */
            .survival-stat.critical {
                border-color: rgba(255, 71, 87, 0.5);
                animation: pulse-danger 1s infinite;
            }
            
            .survival-stat.critical .stat-bar-fill {
                background: linear-gradient(90deg, #ff4757, #ff6b81) !important;
            }
            
            @keyframes pulse-danger {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
                50% { box-shadow: 0 0 15px 2px rgba(255, 71, 87, 0.3); }
            }
        `;
        document.head.appendChild(style);
    }

    update(survival) {
        if (!survival) return;

        // Hunger
        const hungerPercent = survival.getHungerPercent();
        const hungerFill = document.getElementById('hunger-fill');
        const hungerText = document.getElementById('hunger-text');
        const hungerStat = document.getElementById('hunger-stat');
        const hungerHint = document.getElementById('hunger-hint');

        if (hungerFill) {
            hungerFill.style.width = `${hungerPercent}%`;
        }
        if (hungerText) {
            hungerText.textContent = `${Math.ceil(hungerPercent)}%`;
        }
        if (hungerStat) {
            hungerStat.classList.toggle('critical', hungerPercent < 20);
        }
        if (hungerHint) {
            if (hungerPercent <= 0) {
                hungerHint.textContent = '¡Muriendo de hambre!';
                hungerHint.className = 'stat-hint warning';
            } else if (hungerPercent < 20) {
                hungerHint.textContent = 'Necesitas comer pronto';
                hungerHint.className = 'stat-hint warning';
            } else if (hungerPercent < 50) {
                hungerHint.textContent = 'Tienes hambre';
                hungerHint.className = 'stat-hint';
            } else {
                hungerHint.textContent = '';
                hungerHint.className = 'stat-hint';
            }
        }

        // Energy
        const energyPercent = survival.getEnergyPercent();
        const energyFill = document.getElementById('energy-fill');
        const energyText = document.getElementById('energy-text');
        const energyStat = document.getElementById('energy-stat');
        const energyHint = document.getElementById('energy-hint');

        if (energyFill) {
            energyFill.style.width = `${energyPercent}%`;
        }
        if (energyText) {
            energyText.textContent = `${Math.ceil(energyPercent)}%`;
        }
        if (energyStat) {
            energyStat.classList.toggle('critical', energyPercent < 20);
        }
        if (energyHint) {
            if (energyPercent < 20) {
                hungerHint.textContent = '¡Muy cansado! Velocidad -50%';
                energyHint.className = 'stat-hint warning';
            } else if (energyPercent < 40) {
                energyHint.textContent = 'Deberías descansar';
                energyHint.className = 'stat-hint';
            } else {
                energyHint.textContent = '';
                energyHint.className = 'stat-hint';
            }
        }
    }
}
