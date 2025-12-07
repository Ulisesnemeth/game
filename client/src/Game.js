import * as THREE from 'three';
import { PlayerModel } from './models/PlayerModel.js';
import { World } from './World.js';
import { MobManager } from './MobManager.js';
import { Combat } from './Combat.js';
import { Network } from './Network.js';
import { UI } from './UI.js';
import { Inventory } from './systems/Inventory.js';
import { Survival } from './systems/Survival.js';
import { Crafting } from './systems/Crafting.js';
import { Building, BUILDING_TYPES } from './systems/Building.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { SurvivalUI } from './ui/SurvivalUI.js';
import { CraftingUI } from './ui/CraftingUI.js';
import { BuildingUI } from './ui/BuildingUI.js';

export class Game {
    constructor(canvas, userData) {
        this.canvas = canvas;
        this.userData = userData;
        this.clock = new THREE.Clock();
        this.isRunning = false;

        // Game state
        this.currentDepth = 0;
        this.players = new Map();
        this.allPlayersData = new Map();

        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffset = new THREE.Vector3();

        // Initialize Three.js
        this.initRenderer();
        this.initScene();
        this.initCamera();
        this.initLights();

        // Initialize game systems
        this.world = new World(this.scene);
        this.initPlayer(userData);
        this.mobManager = new MobManager(this.scene, this);
        this.combat = new Combat(this);
        this.network = new Network(this);
        this.ui = new UI(this);

        // New systems
        this.survival = new Survival(this);
        this.crafting = new Crafting(this);
        this.building = new Building(this);
        this.particles = new ParticleSystem(this.scene);

        // New UIs
        this.inventoryUI = new InventoryUI(this);
        this.survivalUI = new SurvivalUI(this);
        this.craftingUI = new CraftingUI(this);
        this.buildingUI = new BuildingUI(this);

        // Input state
        this.keys = {};
        this.mouse = { x: 0, y: 0, clicked: false };
        this.mouseWorldPos = null;

        this.setupInput();
    }

    initPlayer(userData) {
        // Player with new model
        this.player = {
            name: userData.displayName || userData.username || 'Jugador',
            username: userData.username,
            level: userData.level || 1,
            xp: userData.xp || 0,
            color: userData.color || 0x00d4ff,
            maxHp: 100 + (userData.level - 1) * 20,
            hp: 100 + (userData.level - 1) * 20,
            baseDamage: 10 + (userData.level - 1) * 5,
            attackCooldown: 0,
            attackCooldownMax: 0.5,
            speed: 8,
            inventory: new Inventory(4, 3),
            model: new PlayerModel(userData.color || 0x00d4ff),
            mesh: null, // Will be set below
            isMoving: false,
            isAttacking: false
        };

        this.player.mesh = this.player.model.group;
        this.player.mesh.position.set(0, 0, 0);
        this.scene.add(this.player.mesh);

        // Attach methods
        this.attachPlayerMethods();
    }

    attachPlayerMethods() {
        const self = this;
        const player = this.player;

        player.update = function (delta, keys, mouse) {
            self.updatePlayerMovement(delta, keys, mouse);
        };

        player.canAttack = function () {
            return this.attackCooldown <= 0;
        };

        player.attack = function () {
            if (!this.canAttack()) return false;
            this.attackCooldown = this.attackCooldownMax;
            this.isAttacking = true;
            return true;
        };

        player.getDamage = function () {
            const bonus = this.inventory.getWeaponBonus();
            const damage = this.baseDamage + bonus;
            const isCrit = Math.random() < 0.1;
            return {
                damage: isCrit ? damage * 2 : damage,
                isCrit
            };
        };

        player.getAttackPosition = function () {
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(this.mesh.quaternion);
            return this.mesh.position.clone().add(forward.multiplyScalar(1.5));
        };

        player.getAttackRadius = function () {
            return 2;
        };

        player.takeDamage = function (amount) {
            this.hp = Math.max(0, this.hp - amount);
            this.model.playHit();

            // Screen shake!
            self.triggerScreenShake(0.5, 0.2);

            // Vignette effect
            self.showDamageVignette();

            if (this.hp <= 0) {
                this.die();
            }

            return this.hp;
        };

        player.addXp = function (amount) {
            this.xp += amount;

            const xpNeeded = this.getXpForNextLevel();
            while (this.xp >= xpNeeded) {
                this.xp -= xpNeeded;
                this.levelUp();
            }

            return this.level;
        };

        player.getXpForNextLevel = function () {
            return Math.floor(100 * Math.pow(1.5, this.level - 1));
        };

        player.levelUp = function () {
            this.level++;
            this.maxHp = 100 + (this.level - 1) * 20;
            this.hp = this.maxHp;
            this.baseDamage = 10 + (this.level - 1) * 5;
            self.ui.showLevelUp(this.level);
            return this.level;
        };

        player.die = function () {
            console.log('¡Has muerto! Respawning...');
            this.hp = this.maxHp;
            this.mesh.position.set(0, 0, 0);
            const event = new CustomEvent('playerDeath', { detail: { player: this } });
            window.dispatchEvent(event);
        };

        player.getPosition = function () {
            return this.mesh.position.clone();
        };
    }

    updatePlayerMovement(delta, keys, mouse) {
        const player = this.player;

        // Handle attack cooldown
        if (player.attackCooldown > 0) {
            player.attackCooldown -= delta;
        }
        player.isAttacking = false;

        // Movement
        const direction = new THREE.Vector3();
        if (keys['KeyW'] || keys['ArrowUp']) direction.z -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) direction.z += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) direction.x -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;

        // Apply survival speed modifier
        const speedMod = this.survival?.getSpeedMultiplier() || 1;

        player.isMoving = direction.length() > 0;

        if (player.isMoving) {
            direction.normalize();
            direction.multiplyScalar(player.speed * speedMod * delta);

            // Calculate new position
            const newX = player.mesh.position.x + direction.x;
            const newZ = player.mesh.position.z + direction.z;

            // Check building collision
            if (!this.checkBuildingCollision(newX, newZ)) {
                player.mesh.position.x = newX;
                player.mesh.position.z = newZ;
            } else {
                // Try to slide along X or Z axis
                if (!this.checkBuildingCollision(newX, player.mesh.position.z)) {
                    player.mesh.position.x = newX;
                } else if (!this.checkBuildingCollision(player.mesh.position.x, newZ)) {
                    player.mesh.position.z = newZ;
                }
            }

            const bounds = 40;
            player.mesh.position.x = Math.max(-bounds, Math.min(bounds, player.mesh.position.x));
            player.mesh.position.z = Math.max(-bounds, Math.min(bounds, player.mesh.position.z));
        }

        // Face mouse direction
        this.raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), this.camera);
        const intersectPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint);

        if (intersectPoint) {
            this.mouseWorldPos = intersectPoint;
            const dx = intersectPoint.x - player.mesh.position.x;
            const dz = intersectPoint.z - player.mesh.position.z;
            const targetRotation = Math.atan2(dx, dz);

            let diff = targetRotation - player.mesh.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            player.mesh.rotation.y += diff * 0.15;
        }

        // Update player model animation
        player.model.update(delta, player.isMoving, player.isAttacking);
    }

    // Screen shake effect
    triggerScreenShake(intensity = 0.5, duration = 0.3) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    updateScreenShake(delta) {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= delta;
            const decay = this.shakeDuration > 0 ? this.shakeIntensity : 0;

            this.shakeOffset.set(
                (Math.random() - 0.5) * decay * 2,
                (Math.random() - 0.5) * decay,
                (Math.random() - 0.5) * decay * 2
            );
        } else {
            this.shakeOffset.set(0, 0, 0);
        }
    }

    // Damage vignette effect
    showDamageVignette() {
        let vignette = document.getElementById('damage-vignette');
        if (!vignette) {
            vignette = document.createElement('div');
            vignette.id = 'damage-vignette';
            vignette.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none;
                z-index: 999;
                background: radial-gradient(ellipse at center, 
                    transparent 40%, 
                    rgba(255, 0, 0, 0.4) 100%);
                opacity: 0;
                transition: opacity 0.1s;
            `;
            document.body.appendChild(vignette);
        }

        vignette.style.opacity = '1';
        setTimeout(() => {
            vignette.style.opacity = '0';
        }, 150);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x0a0a0f);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0a0a0f, 30, 80);
    }

    initCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 25, 15);
        this.camera.lookAt(0, 0, 0);
        this.cameraOffset = new THREE.Vector3(0, 25, 15);

        // For raycasting
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(10, 30, 10);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        this.scene.add(directional);

        this.playerLight = new THREE.PointLight(0x00d4ff, 0.5, 15);
        this.scene.add(this.playerLight);
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'KeyE') {
                this.tryChangeDepth();
            }
            if (e.code === 'KeyF') {
                this.tryInteract();
            }
            if (e.code === 'KeyR' && this.building?.isPlacing) {
                this.building.rotatePlacing();
            }
            if (e.code === 'Escape' && this.building?.isPlacing) {
                this.building.cancelPlacing();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouse.clicked = true;

                // Check if building mode
                if (this.building?.isPlacing) {
                    // Handled by BuildingUI
                } else {
                    this.combat.playerAttack();
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouse.clicked = false;
            }
        });
    }

    tryChangeDepth() {
        const portal = this.world.getNearestPortal(this.player.mesh.position);
        if (portal) {
            if (portal.type === 'down') {
                this.changeDepth(this.currentDepth + 1);
            } else if (portal.type === 'up' && this.currentDepth > 0) {
                this.changeDepth(this.currentDepth - 1);
            }
        }
    }

    checkBuildingCollision(x, z) {
        if (!this.building) return false;

        const playerRadius = 0.4; // Player collision radius

        for (const [id, building] of this.building.buildings) {
            const type = BUILDING_TYPES[building.data.type];
            if (!type || !type.collision) continue;

            // Get building bounds accounting for rotation
            const bx = building.data.x;
            const bz = building.data.z;
            const rot = building.data.rotation || 0;

            // Simplified AABB (ignoring rotation for now)
            let halfW = type.width / 2;
            let halfD = type.depth / 2;

            // Swap if rotated 90 degrees
            if (Math.abs(rot - Math.PI / 2) < 0.1 || Math.abs(rot - Math.PI * 1.5) < 0.1) {
                [halfW, halfD] = [halfD, halfW];
            }

            // Check collision with padding for player radius
            if (x + playerRadius > bx - halfW &&
                x - playerRadius < bx + halfW &&
                z + playerRadius > bz - halfD &&
                z - playerRadius < bz + halfD) {
                return true;
            }
        }

        return false;
    }

    tryInteract() {
        if (!this.building) return;

        const result = this.building.interact();
        if (!result) return;

        switch (result.action) {
            case 'openStorage':
                console.log('Abriendo cofre...', result.storage);
                this.showStorageUI(result.building);
                break;
            case 'openCrafting':
                console.log('Abriendo mesa de crafteo...');
                this.craftingUI?.open();
                break;
            case 'sleep':
                console.log('Durmiendo...');
                this.survival?.sleep();
                this.showSleepEffect();
                break;
            case 'toggleDoor':
                // Future: animate door
                break;
        }
    }

    showStorageUI(building) {
        // Simple alert for now - TODO: full storage UI
        const contents = building.data.contents || [];
        alert(`Cofre contiene ${contents.length} items. (UI de cofre en desarrollo)`);
    }

    showSleepEffect() {
        let overlay = document.getElementById('sleep-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sleep-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: black;
                opacity: 0;
                transition: opacity 1s;
                pointer-events: none;
                z-index: 2000;
            `;
            document.body.appendChild(overlay);
        }

        overlay.style.opacity = '1';
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 2000);
    }

    changeDepth(newDepth) {
        const oldDepth = this.currentDepth;
        this.currentDepth = newDepth;

        this.world.setDepth(newDepth);
        this.mobManager.clearMobs();
        this.particles?.clear();
        this.player.mesh.position.set(0, 0, 0);
        this.ui.updateDepth(newDepth);
        this.network.sendDepthChange(newDepth);

        // Clean up all other player meshes - will be re-synced from server
        for (const [id, data] of this.players) {
            if (data.mesh) {
                this.scene.remove(data.mesh);
                data.model?.dispose();
            }
        }
        this.players.clear();

        console.log(`Profundidad: ${oldDepth} → ${newDepth}`);
    }

    start() {
        this.isRunning = true;
        this.network.connect();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.gameLoop());

        const delta = this.clock.getDelta();
        this.update(delta);
        this.render();
    }

    update(delta) {
        // Player
        this.player.update(delta, this.keys, this.mouse);
        this.updateCamera();
        this.updateScreenShake(delta);

        // Light follows player
        this.playerLight.position.copy(this.player.mesh.position);
        this.playerLight.position.y += 3;

        // Systems
        this.mobManager.updateVisuals(delta);
        this.combat.update(delta);
        this.world.update(delta);
        this.particles?.update(delta);

        // Survival
        const isMoving = this.player.isMoving;
        this.survival?.update(delta, isMoving);
        this.survivalUI?.update(this.survival);

        // Crafting (check for nearby crafting table)
        this.crafting?.update(this.building?.getBuildings());

        // Building
        this.building?.update(delta, this.player.mesh.position, this.mouseWorldPos);
        this.buildingUI?.update();

        // Network
        this.network.sendPosition(this.player.mesh.position, this.player.mesh.rotation.y);
        this.updateOtherPlayers();

        // UI
        this.ui.updatePlayerIndicators(this.players, this.player, this.camera);
        this.ui.updateHealth(this.player.hp, this.player.maxHp);
        this.ui.updateXp(this.player.xp, this.player.getXpForNextLevel(), this.player.level);
    }

    updateCamera() {
        const target = this.player.mesh.position.clone().add(this.cameraOffset).add(this.shakeOffset);
        this.camera.position.lerp(target, 0.1);
        this.camera.lookAt(this.player.mesh.position.clone().add(this.shakeOffset));
    }

    updateOtherPlayers() {
        for (const [id, data] of this.players) {
            if (data.mesh && data.targetPosition) {
                data.mesh.position.lerp(data.targetPosition, 0.15);
            }
        }
    }

    addOtherPlayer(id, data) {
        const model = new PlayerModel(data.color || 0x888888);
        model.group.position.set(data.x || 0, 0, data.z || 0);
        this.scene.add(model.group);

        this.players.set(id, {
            mesh: model.group,
            model: model,
            targetPosition: new THREE.Vector3(data.x || 0, 0, data.z || 0),
            name: data.name || 'Jugador',
            color: data.color || 0x888888,
            level: data.level || 1,
            depth: data.depth || 0
        });

        this.allPlayersData.set(id, {
            name: data.name,
            color: data.color || 0x888888,
            level: data.level || 1,
            depth: data.depth || 0
        });

        this.ui.updatePlayerList(this.allPlayersData, this.player, this.currentDepth);
    }

    removeOtherPlayer(id) {
        const player = this.players.get(id);
        if (player) {
            this.scene.remove(player.mesh);
            player.model?.dispose();
        }
        this.players.delete(id);
        this.allPlayersData.delete(id);
        this.ui.updatePlayerList(this.allPlayersData, this.player, this.currentDepth);
    }

    updateOtherPlayerPosition(id, x, z, rotation) {
        const player = this.players.get(id);
        if (player) {
            player.targetPosition.set(x, 0, z);
            if (player.mesh) {
                player.mesh.rotation.y = rotation;
            }
            // Update model animation
            const isMoving = player.targetPosition.distanceTo(player.mesh.position) > 0.1;
            player.model?.update(this.clock.getDelta(), isMoving, false);
        }
    }

    updatePlayerData(id, data) {
        const existing = this.allPlayersData.get(id) || {};
        this.allPlayersData.set(id, { ...existing, ...data });

        const player = this.players.get(id);
        if (player) {
            if (data.level) player.level = data.level;
            if (data.depth !== undefined) player.depth = data.depth;
        }

        this.ui.updatePlayerList(this.allPlayersData, this.player, this.currentDepth);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
