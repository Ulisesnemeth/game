import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState } from './GameState.js';
import { UserManager, PLAYER_COLORS } from './UserManager.js';
import { ServerMobManager } from './MobManager.js';

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

// Track authenticated sockets
const authenticatedSockets = new Map(); // socketId → username

// ==================== HTTP ENDPOINTS ====================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        players: gameState.getPlayerCount(),
        uptime: process.uptime()
    });
});

// Register
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const result = userManager.register(username, password);
    res.json(result);
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const result = userManager.login(username, password);
    res.json(result);
});

// Update profile
app.post('/updateProfile', (req, res) => {
    const { username, displayName, color } = req.body;
    const result = userManager.updateProfile(username, { displayName, color });
    res.json(result);
});

// Get colors palette
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

        // Send current players to new player
        socket.emit('currentPlayers', gameState.getPlayersForDepth(player.depth));

        // Send current mobs for this depth
        socket.emit('mobsSync', mobManager.getUpdatePacket(player.depth));

        // Notify others
        socket.broadcast.emit('playerJoined', player);

        console.log(`${userData.displayName} (Lvl ${userData.level}) se unió al juego`);
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
                const newMobs = mobManager.spawnMobsForDepth(data.depth);
                // Send new mobs to all players at this depth
                const playersAtDepth = gameState.getPlayersForDepth(data.depth);
                for (const [id, p] of Object.entries(playersAtDepth)) {
                    io.to(id).emit('mobsSync', mobManager.getUpdatePacket(data.depth));
                }
            }

            // Send mobs for new depth to this player
            socket.emit('mobsSync', mobManager.getUpdatePacket(data.depth));

            // Send players at new depth
            socket.emit('currentPlayers', gameState.getPlayersForDepth(data.depth));

            // Notify all about depth change
            io.emit('playerChangedDepth', {
                id: socket.id,
                depth: data.depth,
                oldDepth: oldDepth,
                name: player.name,
                level: player.level
            });

            console.log(`${player.name} bajó a profundidad ${data.depth}`);
        }
    });

    // Player attacks a mob
    socket.on('mobHit', (data) => {
        const player = gameState.getPlayer(socket.id);
        if (!player) return;

        const result = mobManager.damageMob(data.mobId, data.damage, socket.id);
        if (!result) return;

        if (result.died) {
            // Notify all players at this depth
            const playersAtDepth = gameState.getPlayersForDepth(player.depth);
            for (const id of Object.keys(playersAtDepth)) {
                io.to(id).emit('mobDied', {
                    mobId: data.mobId,
                    xp: result.xp,
                    killerId: socket.id
                });
            }

            // Remove mob
            mobManager.removeMob(data.mobId);

            // Spawn replacement after delay
            setTimeout(() => {
                const newMob = mobManager.spawnMob(player.depth);
                const playersAtDepth = gameState.getPlayersForDepth(player.depth);
                for (const id of Object.keys(playersAtDepth)) {
                    io.to(id).emit('mobSpawned', newMob);
                }
            }, 3000);
        } else {
            // Broadcast damage to all at this depth
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

    // Player updates their stats (level up)
    socket.on('playerLevelUp', (data) => {
        const player = gameState.getPlayer(socket.id);
        const username = authenticatedSockets.get(socket.id);

        if (player && username) {
            player.level = data.level;
            player.xp = data.xp;
            player.maxHp = data.maxHp;

            // Save to persistent storage
            userManager.saveProgress(username, data.level, data.xp);

            // Notify others
            socket.broadcast.emit('playerLeveledUp', {
                id: socket.id,
                level: data.level,
                name: player.name
            });
        }
    });

    // Player takes damage
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

    // Disconnect
    socket.on('disconnect', () => {
        const player = gameState.getPlayer(socket.id);
        const username = authenticatedSockets.get(socket.id);

        if (player && username) {
            // Save progress
            userManager.saveProgress(username, player.level, player.xp || 0);
            console.log(`${player.name} se desconectó (progreso guardado)`);
        }

        gameState.removePlayer(socket.id);
        authenticatedSockets.delete(socket.id);

        io.emit('playerLeft', { id: socket.id });
    });
});

// ==================== GAME LOOP ====================

const TICK_RATE = 20; // 20 updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;

let lastTick = Date.now();

setInterval(() => {
    const now = Date.now();
    const delta = (now - lastTick) / 1000;
    lastTick = now;

    // Update mobs with player positions
    mobManager.update(delta, gameState.players);

    // Check for mob attacks
    for (const mob of mobManager.mobs.values()) {
        if (mob.hp <= 0) continue;

        // Check attack result from update
        const playersAtDepth = Array.from(gameState.players.values())
            .filter(p => p.depth === mob.depth);

        for (const player of playersAtDepth) {
            const dx = player.x - mob.x;
            const dz = player.z - mob.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= 1.5 && mob.attackCooldown <= 0) {
                // Attack this player
                io.to(player.id).emit('mobAttackedPlayer', {
                    mobId: mob.id,
                    damage: mob.damage
                });
            }
        }
    }

    // Send mob updates to each depth
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

}, TICK_INTERVAL);

// ==================== START SERVER ====================

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
