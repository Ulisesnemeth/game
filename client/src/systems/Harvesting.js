import * as THREE from 'three';
import { getItemType } from './ItemTypes.js';

/**
 * Harvesting mini-game system
 * Hold click on a resource to start harvesting
 * A progress bar and timing mini-game appears
 */
export class Harvesting {
    constructor(game) {
        this.game = game;
        this.isHarvesting = false;
        this.targetResource = null;
        this.harvestProgress = 0;
        this.harvestSpeed = 1.0; // Base speed
        this.perfectHits = 0;

        // Mini-game state
        this.sweetSpotPosition = 0.5; // 0-1, where the sweet spot is
        this.sweetSpotSize = 0.15; // Size of sweet spot
        this.indicatorPosition = 0; // Current indicator position
        this.indicatorSpeed = 1.5; // Speed of indicator movement
        this.indicatorDirection = 1;

        // Camera zoom state
        this.originalCameraOffset = null;
        this.zoomedCameraOffset = new THREE.Vector3(0, 12, 8);
        this.isZoomed = false;

        this.createUI();
    }

    createUI() {
        // Create harvesting UI container
        this.container = document.createElement('div');
        this.container.id = 'harvesting-ui';
        this.container.style.cssText = `
            position: fixed;
            bottom: 180px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            z-index: 1000;
        `;

        // Resource name
        this.resourceName = document.createElement('div');
        this.resourceName.style.cssText = `
            color: white;
            font-size: 18px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        `;
        this.container.appendChild(this.resourceName);

        // Mini-game bar container
        this.barContainer = document.createElement('div');
        this.barContainer.style.cssText = `
            width: 300px;
            height: 30px;
            background: rgba(0,0,0,0.7);
            border: 2px solid #444;
            border-radius: 15px;
            position: relative;
            overflow: hidden;
        `;

        // Sweet spot (green zone)
        this.sweetSpot = document.createElement('div');
        this.sweetSpot.style.cssText = `
            position: absolute;
            top: 0;
            height: 100%;
            background: linear-gradient(90deg, rgba(46,204,113,0.3), rgba(46,204,113,0.8), rgba(46,204,113,0.3));
            border-radius: 10px;
        `;
        this.barContainer.appendChild(this.sweetSpot);

        // Moving indicator
        this.indicator = document.createElement('div');
        this.indicator.style.cssText = `
            position: absolute;
            top: 2px;
            width: 6px;
            height: calc(100% - 4px);
            background: white;
            border-radius: 3px;
            box-shadow: 0 0 10px rgba(255,255,255,0.8);
            transition: left 0.02s linear;
        `;
        this.barContainer.appendChild(this.indicator);

        this.container.appendChild(this.barContainer);

        // Progress bar
        this.progressContainer = document.createElement('div');
        this.progressContainer.style.cssText = `
            width: 300px;
            height: 10px;
            background: rgba(0,0,0,0.5);
            border-radius: 5px;
            overflow: hidden;
        `;

        this.progressFill = document.createElement('div');
        this.progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #f39c12, #e74c3c);
            border-radius: 5px;
            transition: width 0.1s;
        `;
        this.progressContainer.appendChild(this.progressFill);
        this.container.appendChild(this.progressContainer);

        // Instructions
        this.instructions = document.createElement('div');
        this.instructions.style.cssText = `
            color: #aaa;
            font-size: 12px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        `;
        this.instructions.textContent = 'Mantén CLICK y suelta en la zona verde para golpes perfectos';
        this.container.appendChild(this.instructions);

        // Perfect hit indicator
        this.perfectIndicator = document.createElement('div');
        this.perfectIndicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #2ecc71;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 0 0 20px rgba(46,204,113,0.8);
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
            z-index: 1001;
        `;

        document.body.appendChild(this.container);
        document.body.appendChild(this.perfectIndicator);
    }

    startHarvesting(resource) {
        if (this.isHarvesting) return;

        this.isHarvesting = true;
        this.targetResource = resource;
        this.harvestProgress = 0;
        this.perfectHits = 0;
        this.indicatorPosition = 0;
        this.indicatorDirection = 1;

        // Get tool bonus
        const toolBonus = this.game.player.inventory.getToolBonus(resource.data.type);
        this.harvestSpeed = 0.8 + (toolBonus - 1) * 0.3; // Faster with right tool

        // Randomize sweet spot position
        this.sweetSpotPosition = 0.3 + Math.random() * 0.4;

        // Update UI
        this.resourceName.textContent = resource.data.type === 'tree' ? '🌲 Árbol' : '🪨 Piedra';
        this.sweetSpot.style.left = `${(this.sweetSpotPosition - this.sweetSpotSize / 2) * 100}%`;
        this.sweetSpot.style.width = `${this.sweetSpotSize * 100}%`;

        this.container.style.display = 'flex';

        // Zoom camera
        this.zoomIn();
    }

    stopHarvesting(hitSuccess = false) {
        if (!this.isHarvesting) return;

        if (hitSuccess && this.targetResource) {
            // Check if indicator is in sweet spot
            const inSweetSpot = Math.abs(this.indicatorPosition - this.sweetSpotPosition) < this.sweetSpotSize / 2;

            // Calculate damage
            const baseDamage = this.game.player.baseDamage;
            const toolBonus = this.game.player.inventory.getToolBonus(this.targetResource.data.type);
            let damage = Math.floor(baseDamage * toolBonus);

            if (inSweetSpot) {
                this.perfectHits++;
                damage = Math.floor(damage * 1.5); // 50% bonus for perfect hit
                this.showPerfectHit();
            }

            // Apply damage
            this.game.network.sendResourceHit(this.targetResource.id, damage);

            // Show damage number
            const pos = new THREE.Vector3(this.targetResource.data.x, 1, this.targetResource.data.z);
            this.game.combat.showDamageNumber(pos, damage, inSweetSpot);

            // Particles
            const hitColor = this.targetResource.data.type === 'tree' ? 0x5c3317 : 0x888888;
            this.game.particles?.spawnBloodSplatter(pos, hitColor, inSweetSpot ? 1.0 : 0.5);

            // Add progress
            const progressGain = inSweetSpot ? 0.35 : 0.2;
            this.harvestProgress += progressGain * this.harvestSpeed;
            this.progressFill.style.width = `${Math.min(this.harvestProgress * 100, 100)}%`;

            // Randomize sweet spot for next hit
            this.sweetSpotPosition = 0.2 + Math.random() * 0.6;
            this.sweetSpot.style.left = `${(this.sweetSpotPosition - this.sweetSpotSize / 2) * 100}%`;

            // Check if harvesting complete
            if (this.harvestProgress >= 1) {
                this.completeHarvesting();
                return;
            }

            // Continue harvesting - reset indicator
            this.indicatorPosition = 0;
            this.indicatorDirection = 1;
        } else {
            // Cancelled
            this.cancelHarvesting();
        }
    }

    completeHarvesting() {
        this.isHarvesting = false;
        this.container.style.display = 'none';
        this.targetResource = null;
        this.zoomOut();
    }

    cancelHarvesting() {
        this.isHarvesting = false;
        this.container.style.display = 'none';
        this.targetResource = null;
        this.zoomOut();
    }

    showPerfectHit() {
        const messages = ['¡Perfecto!', '¡Excelente!', '¡Genial!', '¡Wow!'];
        this.perfectIndicator.textContent = messages[Math.floor(Math.random() * messages.length)];
        this.perfectIndicator.style.opacity = '1';
        this.perfectIndicator.style.transform = 'translate(-50%, -50%) scale(1.2)';

        setTimeout(() => {
            this.perfectIndicator.style.opacity = '0';
            this.perfectIndicator.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 400);
    }

    zoomIn() {
        if (!this.isZoomed) {
            this.originalCameraOffset = this.game.cameraOffset.clone();
            this.isZoomed = true;
        }
    }

    zoomOut() {
        if (this.isZoomed && this.originalCameraOffset) {
            this.game.cameraOffset.copy(this.originalCameraOffset);
            this.isZoomed = false;
        }
    }

    update(delta) {
        if (!this.isHarvesting) return;

        // Check if still near resource
        if (this.targetResource) {
            const playerPos = this.game.player.mesh.position;
            const resourcePos = new THREE.Vector3(this.targetResource.data.x, 0, this.targetResource.data.z);
            const dist = playerPos.distanceTo(resourcePos);

            if (dist > 3) {
                this.cancelHarvesting();
                return;
            }
        }

        // Update indicator position
        this.indicatorPosition += this.indicatorSpeed * delta * this.indicatorDirection;

        if (this.indicatorPosition >= 1) {
            this.indicatorPosition = 1;
            this.indicatorDirection = -1;
        } else if (this.indicatorPosition <= 0) {
            this.indicatorPosition = 0;
            this.indicatorDirection = 1;
        }

        this.indicator.style.left = `${this.indicatorPosition * 100 - 1}%`;

        // Smoothly zoom camera
        if (this.isZoomed) {
            this.game.cameraOffset.lerp(this.zoomedCameraOffset, 0.05);
        }
    }

    // Check if player is near a harvestable resource
    getNearbyResource() {
        const attackPos = this.game.player.getAttackPosition();
        const attackRadius = this.game.player.getAttackRadius();
        return this.game.world.getNearestResource(attackPos, attackRadius);
    }
}
