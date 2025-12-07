import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState } from './GameState.js';
import { UserManager, PLAYER_COLORS } from './UserManager.js';
import { ServerMobManager } from './MobManager.js';
import { BuildingManager } from './BuildingManager.js';
import { ResourceManager } from './ResourceManager.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Managers
const gameState = new GameState();
const userManager = new UserManager();
const mobManager = new ServerMobManager();
const buildingManager = new BuildingManager();
const resourceManager = new ResourceManager();

// Track authenticated sockets
const authenticatedSockets = new Map();

// Item drops from mobs
const MOB_DROPS = {
    'Slime': [{ typeId: 'meat', chance: 0.5, quantity: 1 }],
    'Goblin': [
        { typeId: 'meat', chance: 0.6, quantity: 1 },
        { typeId: 'wood', chance: 0.3, quantity: 2 }
    ],
    'Orc': [
        { typeId: 'meat', chance: 0.8, quantity: 2 },
        { typeId: 'leather', chance: 0.4, quantity: 1 },
        { typeId: 'stone', chance: 0.3, quantity: 2 }
    ],
    'Demon': [
        { typeId: 'leather', chance: 0.6, quantity: 2 },
        { typeId: 'stone', chance: 0.5, quantity: 3 }
    ],
    'Shadow': [
        { typeId: 'stone', chance: 0.8, quantity: 3 }
    ]
};

function getDropsForMob(mobType) {
    const drops = [];
    const typeDrops = MOB_DROPS[mobType] || MOB_DROPS['Slime'];

    for (const drop of typeDrops) {
        if (Math.random() < drop.chance) {
            drops.push({ typeId: drop.typeId, quantity: drop.quantity });
        }
    }

    return drops;
}

// ==================== HTTP ENDPOINTS ====================

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        players: gameState.getPlayerCount(),
        uptime: process.uptime()
    });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const result = userManager.register(username, password);
    res.json(result);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const result = userManager.login(username, password);
    res.json(result);
});

app.post('/updateProfile', (req, res) => {
    const { username, displayName, color } = req.body;
    const result = userManager.updateProfile(username, { displayName, color });
    res.json(result);
});

app.get('/colors', (req, res) => {
    res.json({ colors: PLAYER_COLORS });
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // Player authenticates and joins
    socket.on('playerJoin', (data) => {
        const userData = userManager.getUser(data.username);
        if (!userData) {
            socket.emit('authError', { error: 'Usuario no autenticado' });
            return;
        }

        authenticatedSockets.set(socket.id, data.username);

        const player = {
            id: socket.id,
            username: data.username,
            name: userData.displayName,
            color: userData.color,
            level: userData.level,
            xp: userData.xp,
            x: data.x || 0,
            z: data.z || 0,
            rotation: 0,
            depth: data.depth || 0,
            hp: 100 + (userData.level - 1) * 20,
            maxHp: 100 + (userData.level - 1) * 20
        };

        gameState.addPlayer(socket.id, player);

        // Create mobs for this depth if none exist
        const existingMobs = mobManager.getMobsForDepth(player.depth);
        if (existingMobs.length === 0) {
            mobManager.spawnMobsForDepth(player.depth);
        }

        // Send current data to new player
        socket.emit('currentPlayers', gameState.getPlayersForDepth(player.depth));
        socket.emit('mobsSync', mobManager.getUpdatePacket(player.depth));
        socket.emit('buildingsSync', buildingManager.getBuildingsForDepth(player.depth));
        socket.emit('resourcesSync', resourceManager.getAllResourcesForDepth(player.depth));

        // Notify others
        socket.broadcast.emit('playerJoined', player);

        console.log(`${userData.displayName} (Lvl ${userData.level}) se unió`);
    });

    // Player moves
    socket.on('playerMove', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (player) {
            player.x = data.x;
            player.z = data.z;
            player.rotation = data.rotation || 0;

            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                z: data.z,
                rotation: data.rotation,
                depth: player.depth
            });
        }
    });

    // Player changes depth
    socket.on('playerDepthChange', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (player) {
            const oldDepth = player.depth;
            player.depth = data.depth;

            // Create mobs for new depth if none exist
            const existingMobs = mobManager.getMobsForDepth(data.depth);
            if (existingMobs.length === 0) {
                mobManager.spawnMobsForDepth(data.depth);
            }

            // Send data for new depth
            socket.emit('mobsSync', mobManager.getUpdatePacket(data.depth));
            socket.emit('buildingsSync', buildingManager.getBuildingsForDepth(data.depth));
            socket.emit('resourcesSync', resourceManager.getAllResourcesForDepth(data.depth));
            socket.emit('currentPlayers', gameState.getPlayersForDepth(data.depth));

            // Notify all about depth change
            io.emit('playerChangedDepth', {
                id: socket.id,
                depth: data.depth,
                oldDepth: oldDepth,
                name: player.name,
                level: player.level
            });
        }
    });

    // Player attacks a mob
    socket.on('mobHit', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (!player) return;

        const result = mobManager.damageMob(data.mobId, data.damage, socket.id);
        if (!result) return;

        if (result.died) {
            const drops = getDropsForMob(result.mob.type.name);

            const playersAtDepth = gameState.getPlayersForDepth(player.depth);
            for (const id of Object.keys(playersAtDepth)) {
                io.to(id).emit('mobDied', {
                    mobId: data.mobId,
                    xp: result.xp,
                    killerId: socket.id,
                    drops: id === socket.id ? drops : []
                });
            }

            mobManager.removeMob(data.mobId);

            setTimeout(() => {
                const newMob = mobManager.spawnMob(player.depth);
                const playersAtDepth = gameState.getPlayersForDepth(player.depth);
                for (const id of Object.keys(playersAtDepth)) {
                    io.to(id).emit('mobSpawned', newMob);
                }
            }, 3000);
        } else {
            const playersAtDepth = gameState.getPlayersForDepth(player.depth);
            for (const id of Object.keys(playersAtDepth)) {
                io.to(id).emit('mobDamaged', {
                    mobId: data.mobId,
                    hp: result.hp,
                    maxHp: result.maxHp,
                    attackerId: socket.id
                });
            }
        }
    });

    // Player hits a resource (tree/rock)
    socket.on('resourceHit', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (!player) return;

        const result = resourceManager.hitResource(data.resourceId, data.damage, socket.id);
        if (!result) return;

        const playersAtDepth = gameState.getPlayersForDepth(player.depth);

        if (result.destroyed) {
            // Notify all players at this depth
            for (const id of Object.keys(playersAtDepth)) {
                io.to(id).emit('resourceDestroyed', {
                    resourceId: data.resourceId,
                    harvesterId: socket.id,
                    drops: id === socket.id ? result.drops : []
                });
            }
        } else {
            // Notify all players of damage
            for (const id of Object.keys(playersAtDepth)) {
                io.to(id).emit('resourceDamaged', {
                    resourceId: data.resourceId,
                    hp: result.hp,
                    maxHp: result.maxHp,
                    attackerId: socket.id
                });
            }
        }
    });

    // Player level up
    socket.on('playerLevelUp', (data) => {
        const player = gameState.getPlayer(socket.id);
        const username = authenticatedSockets.get(socket.id);

        if (player && username) {
            player.level = data.level;
            player.xp = data.xp;
            player.maxHp = data.maxHp;

            userManager.saveProgress(username, data.level, data.xp);

            socket.broadcast.emit('playerLeveledUp', {
                id: socket.id,
                level: data.level,
                name: player.name
            });
        }
    });

    // Player damaged
    socket.on('playerDamaged', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (player) {
            player.hp = data.hp;

            socket.broadcast.emit('playerHpChanged', {
                id: socket.id,
                hp: data.hp,
                maxHp: data.maxHp
            });
        }
    });

    // Building placed
    socket.on('buildingPlaced', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (!player) return;

        const building = buildingManager.addBuilding({
            type: data.type,
            x: data.x,
            z: data.z,
            rotation: data.rotation || 0,
            ownerId: socket.id,
            contents: data.contents || []
        }, player.depth);

        const playersAtDepth = gameState.getPlayersForDepth(player.depth);
        for (const id of Object.keys(playersAtDepth)) {
            io.to(id).emit('buildingPlaced', building);
        }
    });

    // Building removed
    socket.on('buildingRemoved', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (!player) return;

        const building = buildingManager.getBuilding(data.buildingId);
        if (!building || building.ownerId !== socket.id) return;

        buildingManager.removeBuilding(data.buildingId);

        const playersAtDepth = gameState.getPlayersForDepth(player.depth);
        for (const id of Object.keys(playersAtDepth)) {
            io.to(id).emit('buildingRemoved', { buildingId: data.buildingId });
        }
    });

    // Building contents updated
    socket.on('buildingContentsUpdate', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (!player) return;

        const building = buildingManager.getBuilding(data.buildingId);
        if (!building) return;

        buildingManager.updateBuildingContents(data.buildingId, data.contents);

        const playersAtDepth = gameState.getPlayersForDepth(player.depth);
        for (const id of Object.keys(playersAtDepth)) {
            if (id !== socket.id) {
                io.to(id).emit('buildingContentsChanged', {
                    buildingId: data.buildingId,
                    contents: data.contents
                });
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        const player = gameState.getPlayer(socket.id);
        const username = authenticatedSockets.get(socket.id);

        if (player && username) {
            userManager.saveProgress(username, player.level, player.xp || 0);
            console.log(`${player.name} se desconectó (progreso guardado)`);
        }

        gameState.removePlayer(socket.id);
        authenticatedSockets.delete(socket.id);

        io.emit('playerLeft', { id: socket.id });
    });
});

// ==================== GAME LOOP ====================

const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;

let lastTick = Date.now();
let resourceUpdateCounter = 0;

setInterval(() => {
    const now = Date.now();
    const delta = (now - lastTick) / 1000;
    lastTick = now;

    // Update mobs
    mobManager.update(delta, gameState.players);

    // Check for mob attacks
    for (const mob of mobManager.mobs.values()) {
        if (mob.hp <= 0) continue;

        const playersAtDepth = Array.from(gameState.players.values())
            .filter(p => p.depth === mob.depth);

        for (const player of playersAtDepth) {
            const dx = player.x - mob.x;
            const dz = player.z - mob.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= 1.5 && mob.attackCooldown <= 0) {
                io.to(player.id).emit('mobAttackedPlayer', {
                    mobId: mob.id,
                    damage: mob.damage
                });
            }
        }
    }

    // Send mob updates
    const activeDepths = new Set();
    for (const player of gameState.players.values()) {
        activeDepths.add(player.depth);
    }

    for (const depth of activeDepths) {
        const packet = mobManager.getUpdatePacket(depth);
        const playersAtDepth = gameState.getPlayersForDepth(depth);

        for (const id of Object.keys(playersAtDepth)) {
            io.to(id).emit('mobsUpdate', packet);
        }
    }

    // Check resource respawns every second
    resourceUpdateCounter++;
    if (resourceUpdateCounter >= TICK_RATE) {
        resourceUpdateCounter = 0;

        const resourcesChanged = resourceManager.update();
        if (resourcesChanged) {
            // Notify players about respawned resources
            for (const depth of activeDepths) {
                const resources = resourceManager.getAllResourcesForDepth(depth);
                const playersAtDepth = gameState.getPlayersForDepth(depth);

                for (const id of Object.keys(playersAtDepth)) {
                    io.to(id).emit('resourcesSync', resources);
                }
            }
        }
    }

}, TICK_INTERVAL);

// ==================== START ====================

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════╗
║       DEPTH DESCENT - SERVIDOR        ║
╠═══════════════════════════════════════╣
║  Puerto: ${PORT}                          ║
║  Tick Rate: ${TICK_RATE} Hz                    ║
║  Estado: Esperando jugadores...       ║
╚═══════════════════════════════════════╝
    `);
});
