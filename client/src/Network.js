import { io } from 'socket.io-client';
import { createItem } from './systems/ItemTypes.js';

export class Network {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.playerId = null;
        this.connected = false;

        this.lastPositionSend = 0;
        this.positionSendRate = 50;
    }

    connect() {
        const serverUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : `http://${window.location.hostname}:3000`;

        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling']
        });

        this.setupEventListeners();
        this.updateConnectionStatus('connecting');
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.playerId = this.socket.id;
            this.updateConnectionStatus('connected');
            console.log('Conectado al servidor:', this.playerId);

            this.socket.emit('playerJoin', {
                username: this.game.userData.username,
                x: this.game.player.mesh.position.x,
                z: this.game.player.mesh.position.z,
                depth: this.game.currentDepth
            });
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.updateConnectionStatus('disconnected');
            console.log('Desconectado del servidor');
        });

        this.socket.on('authError', (data) => {
            console.error('Error de autenticación:', data.error);
            window.location.href = 'login.html';
        });

        this.socket.on('currentPlayers', (players) => {
            // Clear existing players and re-add from server data
            // This ensures we have the correct list when changing depth
            const currentPlayerIds = new Set(Object.keys(players));

            // Remove players not in the new list
            for (const [id, data] of this.game.players) {
                if (!currentPlayerIds.has(id)) {
                    this.game.removeOtherPlayer(id);
                }
            }

            // Add/update players from server
            for (const [id, data] of Object.entries(players)) {
                if (id !== this.playerId) {
                    if (!this.game.players.has(id)) {
                        this.game.addOtherPlayer(id, data);
                    }
                }
            }
        });

        this.socket.on('playerJoined', (data) => {
            if (data.id !== this.playerId) {
                // Only add if at same depth
                if (data.depth === this.game.currentDepth) {
                    if (!this.game.players.has(data.id)) {
                        this.game.addOtherPlayer(data.id, data);
                        console.log(`${data.name} se unió (Nivel ${data.level})`);
                    }
                }
            }
        });

        this.socket.on('playerLeft', (data) => {
            this.game.removeOtherPlayer(data.id);
        });

        this.socket.on('playerMoved', (data) => {
            if (data.id !== this.playerId) {
                // If player doesn't exist yet but is at our depth, add them
                if (!this.game.players.has(data.id) && data.depth === this.game.currentDepth) {
                    this.game.addOtherPlayer(data.id, data);
                }
                this.game.updateOtherPlayerPosition(data.id, data.x, data.z, data.rotation);
            }
        });

        this.socket.on('playerChangedDepth', (data) => {
            if (data.id !== this.playerId) {
                // If player came TO our depth, add them
                if (data.depth === this.game.currentDepth && !this.game.players.has(data.id)) {
                    this.game.addOtherPlayer(data.id, {
                        name: data.name,
                        level: data.level,
                        depth: data.depth,
                        x: 0, z: 0, color: 0x888888
                    });
                }
                // If player LEFT our depth, remove them
                else if (data.oldDepth === this.game.currentDepth && data.depth !== this.game.currentDepth) {
                    this.game.removeOtherPlayer(data.id);
                }

                this.game.updatePlayerData(data.id, { depth: data.depth, level: data.level });
            }
        });

        this.socket.on('playerLeveledUp', (data) => {
            if (data.id !== this.playerId) {
                this.game.updatePlayerData(data.id, { level: data.level });
                console.log(`${data.name} subió a nivel ${data.level}!`);
            }
        });

        // ===== MOB EVENTS =====

        this.socket.on('mobsSync', (mobs) => {
            this.game.mobManager.syncMobs(mobs);
        });

        this.socket.on('mobsUpdate', (mobs) => {
            for (const mobData of mobs) {
                const mob = this.game.mobManager.getMob(mobData.id);
                if (mob) {
                    mob.targetX = mobData.x;
                    mob.targetZ = mobData.z;
                    mob.targetRotation = mobData.rotation;
                    mob.data.hp = mobData.hp;
                    mob.data.state = mobData.state;
                }
            }
        });

        this.socket.on('mobDamaged', (data) => {
            this.game.mobManager.damageMob(data.mobId, data.hp, data.maxHp);
        });

        this.socket.on('mobDied', (data) => {
            this.game.mobManager.killMob(data.mobId);

            if (data.killerId === this.playerId) {
                this.game.player.addXp(data.xp);
                this.game.ui.updateXp(
                    this.game.player.xp,
                    this.game.player.getXpForNextLevel(),
                    this.game.player.level
                );
                this.game.combat.showXpGain(this.game.player.mesh.position, data.xp);

                // Add drops to inventory
                if (data.drops && data.drops.length > 0) {
                    for (const drop of data.drops) {
                        const item = createItem(drop.typeId, drop.quantity);
                        if (item) {
                            this.game.player.inventory.addItem(item);
                            this.game.combat.showItemDrop(this.game.player.mesh.position, drop);
                        }
                    }
                }

                this.sendLevelUpdate();
            }
        });

        this.socket.on('mobSpawned', (data) => {
            this.game.mobManager.spawnMob(data);
        });

        this.socket.on('mobAttackedPlayer', (data) => {
            const newHp = this.game.player.takeDamage(data.damage);
            this.game.ui.updateHealth(newHp, this.game.player.maxHp);
            this.game.combat.showDamageNumber(this.game.player.mesh.position, data.damage, false, true);

            // Apply knockback to player
            if (data.mobX !== undefined && data.mobZ !== undefined) {
                this.applyKnockbackToPlayer(data.mobX, data.mobZ);
            }

            this.socket.emit('playerDamaged', {
                hp: this.game.player.hp,
                maxHp: this.game.player.maxHp
            });
        });

        // ===== RESOURCE EVENTS =====

        this.socket.on('resourcesSync', (resources) => {
            this.game.world.syncResources(resources);
        });

        this.socket.on('resourceDamaged', (data) => {
            this.game.world.damageResource(data.resourceId);
        });

        this.socket.on('resourceDestroyed', (data) => {
            // Get resource data before destroying for particle effect
            const resource = this.game.world.resources.get(data.resourceId);
            if (resource) {
                const pos = resource.group.position.clone();
                this.game.particles?.spawnResourceBreak(pos, resource.data.type);
            }

            this.game.world.destroyResource(data.resourceId);

            // Only harvester gets drops
            if (data.harvesterId === this.playerId && data.drops) {
                for (const drop of data.drops) {
                    const item = createItem(drop.typeId, drop.quantity);
                    if (item) {
                        this.game.player.inventory.addItem(item);
                        this.game.combat.showItemDrop(this.game.player.mesh.position, drop);
                    }
                }
            }
        });

        // ===== BUILDING EVENTS =====

        this.socket.on('buildingsSync', (buildings) => {
            this.game.building?.syncBuildings(buildings);
        });

        this.socket.on('buildingPlaced', (building) => {
            this.game.building?.addBuilding(building);
        });

        this.socket.on('buildingRemoved', (data) => {
            this.game.building?.removeBuilding(data.buildingId);
        });

        this.socket.on('buildingContentsChanged', (data) => {
            const building = this.game.building?.buildings.get(data.buildingId);
            if (building) {
                building.data.contents = data.contents;
            }
        });
    }

    sendPosition(position, rotation) {
        if (!this.connected) return;

        const now = Date.now();
        if (now - this.lastPositionSend < this.positionSendRate) return;
        this.lastPositionSend = now;

        this.socket.emit('playerMove', {
            x: position.x,
            z: position.z,
            rotation: rotation
        });
    }

    sendDepthChange(depth) {
        if (!this.connected) return;
        this.socket.emit('playerDepthChange', { depth });
    }

    sendMobHit(mobId, damage) {
        if (!this.connected) return;
        this.socket.emit('mobHit', { mobId, damage });
    }

    sendResourceHit(resourceId, damage) {
        if (!this.connected) return;
        this.socket.emit('resourceHit', { resourceId, damage });
    }

    sendLevelUpdate() {
        if (!this.connected) return;
        this.socket.emit('playerLevelUp', {
            level: this.game.player.level,
            xp: this.game.player.xp,
            maxHp: this.game.player.maxHp
        });
    }

    sendBuildingPlaced(building) {
        if (!this.connected) return;
        this.socket.emit('buildingPlaced', building);
    }

    sendBuildingRemoved(buildingId) {
        if (!this.connected) return;
        this.socket.emit('buildingRemoved', { buildingId });
    }

    sendBuildingContentsUpdate(buildingId, contents) {
        if (!this.connected) return;
        this.socket.emit('buildingContentsUpdate', { buildingId, contents });
    }

    applyKnockbackToPlayer(mobX, mobZ) {
        const player = this.game.player;
        const playerPos = player.mesh.position;

        // Calculate knockback direction (away from mob)
        const dx = playerPos.x - mobX;
        const dz = playerPos.z - mobZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.1) {
            const knockbackForce = 2.0; // Knockback strength
            const normX = dx / dist;
            const normZ = dz / dist;

            // Apply knockback to player position
            const newX = playerPos.x + normX * knockbackForce;
            const newZ = playerPos.z + normZ * knockbackForce;

            // Check building collision before applying
            if (!this.game.checkBuildingCollision(newX, newZ)) {
                playerPos.x = newX;
                playerPos.z = newZ;
            } else {
                // Try sliding along X or Z axis
                if (!this.game.checkBuildingCollision(newX, playerPos.z)) {
                    playerPos.x = newX;
                } else if (!this.game.checkBuildingCollision(playerPos.x, newZ)) {
                    playerPos.z = newZ;
                }
            }

            // Clamp to bounds
            const bounds = 40;
            playerPos.x = Math.max(-bounds, Math.min(bounds, playerPos.x));
            playerPos.z = Math.max(-bounds, Math.min(bounds, playerPos.z));
        }
    }

    updateConnectionStatus(status) {
        const statusDot = document.querySelector('#connection-status .status-dot');
        const statusText = document.querySelector('#connection-status .status-text');

        if (statusDot && statusText) {
            statusDot.className = 'status-dot';

            switch (status) {
                case 'connected':
                    statusDot.classList.add('connected');
                    statusText.textContent = 'Conectado';
                    break;
                case 'disconnected':
                    statusDot.classList.add('disconnected');
                    statusText.textContent = 'Desconectado';
                    break;
                default:
                    statusText.textContent = 'Conectando...';
            }
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}
