import { RECIPES } from '../systems/Crafting.js';
import { getItemType } from '../systems/ItemTypes.js';

/**
 * Crafting UI - Recipe list with craft buttons
 */
export class CraftingUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.selectedRecipe = null;

        this.createUI();
        this.setupEvents();
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'crafting-ui';
        this.container.className = 'game-panel hidden';
        this.container.innerHTML = `
            <div class="panel-header">
                <span>⚒️ Crafteo</span>
                <button class="close-btn">×</button>
            </div>
            <div class="crafting-content">
                <div class="recipe-list" id="recipe-list"></div>
                <div class="recipe-detail" id="recipe-detail">
                    <p class="detail-empty">Selecciona una receta</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('crafting-styles')) return;

        const style = document.createElement('style');
        style.id = 'crafting-styles';
        style.textContent = `
            #crafting-ui {
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                max-height: 80vh;
            }
            
            .crafting-content {
                display: flex;
                gap: 12px;
            }
            
            .recipe-list {
                flex: 1;
                max-height: 300px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .recipe-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .recipe-item:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .recipe-item.selected {
                border-color: #00d4ff;
                background: rgba(0, 212, 255, 0.1);
            }
            
            .recipe-item.disabled {
                opacity: 0.5;
            }
            
            .recipe-item.cant-craft .recipe-name {
                color: rgba(255, 255, 255, 0.5);
            }
            
            .recipe-icon {
                font-size: 24px;
            }
            
            .recipe-name {
                flex: 1;
                font-size: 13px;
            }
            
            .recipe-detail {
                flex: 1;
                padding: 12px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
            }
            
            .detail-empty {
                color: rgba(255, 255, 255, 0.5);
                text-align: center;
                margin: 20px 0;
            }
            
            .detail-title {
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 12px;
                color: #00d4ff;
            }
            
            .detail-ingredients {
                margin-bottom: 16px;
            }
            
            .detail-ingredients h4 {
                font-size: 11px;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 8px;
            }
            
            .ingredient-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 0;
            }
            
            .ingredient-icon {
                font-size: 18px;
            }
            
            .ingredient-count {
                font-size: 12px;
            }
            
            .ingredient-count.has {
                color: #7bed9f;
            }
            
            .ingredient-count.missing {
                color: #ff4757;
            }
            
            .craft-btn {
                width: 100%;
                padding: 10px;
                background: linear-gradient(135deg, #00d4ff, #0099cc);
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .craft-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 212, 255, 0.4);
            }
            
            .craft-btn:disabled {
                background: #444;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    setupEvents() {
        this.container.querySelector('.close-btn').addEventListener('click', () => this.close());

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyC') {
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
        const crafting = this.game.crafting;
        if (!crafting) return;

        const recipes = crafting.getAvailableRecipes();
        const list = this.container.querySelector('#recipe-list');
        list.innerHTML = '';

        recipes.forEach(recipe => {
            const canCraft = crafting.canCraft(recipe.id);
            const resultType = recipe.isBuilding ? null : getItemType(recipe.result.typeId);

            const item = document.createElement('div');
            item.className = `recipe-item ${canCraft ? '' : 'cant-craft'} ${this.selectedRecipe === recipe.id ? 'selected' : ''}`;
            item.dataset.id = recipe.id;

            item.innerHTML = `
                <span class="recipe-icon">${resultType?.icon || '🏠'}</span>
                <span class="recipe-name">${recipe.name}</span>
            `;

            item.addEventListener('click', () => this.selectRecipe(recipe.id));
            list.appendChild(item);
        });
    }

    selectRecipe(recipeId) {
        this.selectedRecipe = recipeId;
        this.render();
        this.renderDetail(recipeId);
    }

    renderDetail(recipeId) {
        const recipe = RECIPES.find(r => r.id === recipeId);
        if (!recipe) return;

        const detail = this.container.querySelector('#recipe-detail');
        const inventory = this.game.player.inventory;
        const crafting = this.game.crafting;
        const canCraft = crafting.canCraft(recipeId);

        let ingredientsHtml = '';
        recipe.ingredients.forEach(ing => {
            const type = getItemType(ing.typeId);
            const has = inventory.countItem(ing.typeId);
            const enough = has >= ing.quantity;

            ingredientsHtml += `
                <div class="ingredient-item">
                    <span class="ingredient-icon">${type?.icon || '?'}</span>
                    <span class="ingredient-count ${enough ? 'has' : 'missing'}">
                        ${has}/${ing.quantity} ${type?.name || ing.typeId}
                    </span>
                </div>
            `;
        });

        detail.innerHTML = `
            <div class="detail-title">${recipe.name}</div>
            <div class="detail-ingredients">
                <h4>Ingredientes</h4>
                ${ingredientsHtml}
            </div>
            <button class="craft-btn" ${canCraft ? '' : 'disabled'}>
                ${canCraft ? 'Craftear' : 'Faltan materiales'}
            </button>
        `;

        const craftBtn = detail.querySelector('.craft-btn');
        craftBtn.addEventListener('click', () => {
            const result = crafting.craft(recipeId);
            if (result) {
                if (result.type === 'building') {
                    // Enter building placement mode
                    this.game.building?.startPlacing(result.buildingTypeId);
                    this.close();
                }
                this.render();
                this.renderDetail(recipeId);
            }
        });
    }
}
