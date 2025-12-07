// Mob types with scaling
const MOB_TYPES = [
    { name: 'Slime', color: 0x7bed9f, minDepth: 0, shape: 'sphere' },
    { name: 'Goblin', color: 0xffa502, minDepth: 1, shape: 'box' },
    { name: 'Orc', color: 0xff6348, minDepth: 2, shape: 'box' },
    { name: 'Demon', color: 0xff4757, minDepth: 3, shape: 'box' },
    { name: 'Shadow', color: 0x5f27cd, minDepth: 5, shape: 'octahedron' },
    { name: 'Void', color: 0x2c2c54, minDepth: 8, shape: 'octahedron' },
    { name: 'Ancient', color: 0x1e1e1e, minDepth: 12, shape: 'octahedron' }
];

export class ServerMobManager {
    constructor() {
        this.mobs = new Map(); // mobId → mobData
        this.nextMobId = 1;
        this.depths = new Map(); // depth → Set of mobIds
    }

    getMobTypeForDepth(depth) {
        let selectedType = MOB_TYPES[0];
        for (const type of MOB_TYPES) {
            if (depth >= type.minDepth) {
                selectedType = type;
            }
        }
        return selectedType;
    }

    getStatsForDepth(depth) {
        const multiplier = Math.pow(1.4, depth);
        return {
            maxHp: Math.floor(30 * multiplier),
            damage: Math.floor(5 * multiplier),
            xp: Math.floor(15 * multiplier),
            speed: Math.min(2 + depth * 0.2, 6),
            level: depth + 1
        };
    }

    spawnMob(depth, playerPositions = []) {
        const type = this.getMobTypeForDepth(depth);
        const stats = this.getStatsForDepth(depth);

        // Spawn outside camera view (minimum distance 20 units from any player)
        let x, z;
        const minDistance = 20; // Outside typical camera view
        const maxDistance = 35;

        // Try to find a spot away from all players
        let attempts = 0;
        do {
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            x = Math.cos(angle) * distance;
            z = Math.sin(angle) * distance;
            attempts++;

            // Check distance from all players
            let tooClose = false;
            for (const p of playerPositions) {
                const dx = x - p.x;
                const dz = z - p.z;
                if (Math.sqrt(dx * dx + dz * dz) < minDistance) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose || attempts > 10) break;
        } while (true);

        const mob = {
            id: this.nextMobId++,
            depth: depth,
            type: type,
            x: x,
            z: z,
            rotation: Math.random() * Math.PI * 2,
            hp: stats.maxHp,
            maxHp: stats.maxHp,
            damage: stats.damage,
            xp: stats.xp,
            speed: stats.speed,
            level: stats.level,
            state: 'patrol',
            targetX: 0,
            targetZ: 0,
            patrolWaitTime: 0,
            attackCooldown: 0
        };

        this.mobs.set(mob.id, mob);

        // Track by depth
        if (!this.depths.has(depth)) {
            this.depths.set(depth, new Set());
        }
        this.depths.get(depth).add(mob.id);

        return mob;
    }

    spawnMobsForDepth(depth, count = null) {
        const mobCount = count || Math.min(5 + Math.floor(depth * 1.5), 25);
        const spawned = [];

        for (let i = 0; i < mobCount; i++) {
            spawned.push(this.spawnMob(depth));
        }

        return spawned;
    }

    getMobsForDepth(depth) {
        const mobIds = this.depths.get(depth);
        if (!mobIds) return [];

        return Array.from(mobIds).map(id => this.mobs.get(id)).filter(m => m);
    }

    getMob(id) {
        return this.mobs.get(id);
    }

    damageMob(id, damage, attackerId) {
        const mob = this.mobs.get(id);
        if (!mob || mob.hp <= 0) return null;

        mob.hp = Math.max(0, mob.hp - damage);

        if (mob.hp <= 0) {
            return { died: true, xp: mob.xp, mob };
        }

        return { died: false, hp: mob.hp, maxHp: mob.maxHp, mob };
    }

    removeMob(id) {
        const mob = this.mobs.get(id);
        if (!mob) return;

        const depthSet = this.depths.get(mob.depth);
        if (depthSet) {
            depthSet.delete(id);
        }

        this.mobs.delete(id);
    }

    clearDepth(depth) {
        const mobIds = this.depths.get(depth);
        if (!mobIds) return;

        for (const id of mobIds) {
            this.mobs.delete(id);
        }
        this.depths.delete(depth);
    }

    update(delta, players) {
        // Group players by depth
        const playersByDepth = new Map();
        for (const player of players.values()) {
            if (!playersByDepth.has(player.depth)) {
                playersByDepth.set(player.depth, []);
            }
            playersByDepth.get(player.depth).push(player);
        }

        // Update each mob
        for (const mob of this.mobs.values()) {
            if (mob.hp <= 0) continue;

            // Get players on same depth
            const nearbyPlayers = playersByDepth.get(mob.depth) || [];

            // Find closest player
            let closestPlayer = null;
            let closestDist = Infinity;

            for (const player of nearbyPlayers) {
                const dx = player.x - mob.x;
                const dz = player.z - mob.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPlayer = player;
                }
            }

            // Update attack cooldown
            if (mob.attackCooldown > 0) {
                mob.attackCooldown -= delta;
            }

            // State machine
            if (closestPlayer && closestDist <= 1.5) {
                mob.state = 'attack';
                this.handleAttack(mob, closestPlayer, delta);
            } else if (closestPlayer && closestDist <= 12) {
                mob.state = 'chase';
                this.handleChase(mob, closestPlayer, delta);
            } else {
                mob.state = 'patrol';
                this.handlePatrol(mob, delta);
            }
        }
    }

    handlePatrol(mob, delta) {
        if (mob.patrolWaitTime > 0) {
            mob.patrolWaitTime -= delta;
            return;
        }

        // Check if near target or no target
        const dx = mob.targetX - mob.x;
        const dz = mob.targetZ - mob.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.5 || (mob.targetX === 0 && mob.targetZ === 0)) {
            // Pick new random target
            const angle = Math.random() * Math.PI * 2;
            const distance = 3 + Math.random() * 5;
            mob.targetX = mob.x + Math.cos(angle) * distance;
            mob.targetZ = mob.z + Math.sin(angle) * distance;
            mob.patrolWaitTime = 1 + Math.random() * 2;
            return;
        }

        // Move towards target
        const speed = mob.speed * 0.3 * delta;
        const dirX = dx / dist;
        const dirZ = dz / dist;

        mob.x += dirX * speed;
        mob.z += dirZ * speed;
        mob.rotation = Math.atan2(dirX, dirZ);
    }

    handleChase(mob, player, delta) {
        const dx = player.x - mob.x;
        const dz = player.z - mob.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.1) {
            const speed = mob.speed * delta;
            const dirX = dx / dist;
            const dirZ = dz / dist;

            mob.x += dirX * speed;
            mob.z += dirZ * speed;
            mob.rotation = Math.atan2(dirX, dirZ);
        }
    }

    handleAttack(mob, player, delta) {
        // Face player
        const dx = player.x - mob.x;
        const dz = player.z - mob.z;
        mob.rotation = Math.atan2(dx, dz);

        // Attack if cooldown ready
        if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1;
            return { attack: true, targetId: player.id, damage: mob.damage };
        }

        return null;
    }

    getUpdatePacket(depth) {
        const mobs = this.getMobsForDepth(depth);
        return mobs.map(m => ({
            id: m.id,
            x: m.x,
            z: m.z,
            rotation: m.rotation,
            hp: m.hp,
            maxHp: m.maxHp,
            state: m.state,
            type: m.type,
            level: m.level
        }));
    }
}
