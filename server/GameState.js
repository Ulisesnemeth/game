export class GameState {
    constructor() {
        this.players = new Map();
    }

    addPlayer(id, data) {
        this.players.set(id, {
            id,
            username: data.username,
            name: data.name || 'Jugador',
            color: data.color || 0x00d4ff,
            level: data.level || 1,
            xp: data.xp || 0,
            x: data.x || 0,
            z: data.z || 0,
            rotation: data.rotation || 0,
            depth: data.depth || 0,
            hp: data.hp || 100,
            maxHp: data.maxHp || 100,
            joinedAt: Date.now()
        });
    }

    getPlayer(id) {
        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    getPlayerCount() {
        return this.players.size;
    }

    getAllPlayers() {
        const result = {};
        for (const [id, player] of this.players) {
            result[id] = player;
        }
        return result;
    }

    getPlayersForDepth(depth) {
        const result = {};
        for (const [id, player] of this.players) {
            if (player.depth === depth) {
                result[id] = {
                    id: player.id,
                    name: player.name,
                    color: player.color,
                    level: player.level,
                    x: player.x,
                    z: player.z,
                    rotation: player.rotation,
                    depth: player.depth,
                    hp: player.hp,
                    maxHp: player.maxHp
                };
            }
        }
        return result;
    }

    getAllPlayersWithDepth() {
        const result = {};
        for (const [id, player] of this.players) {
            result[id] = {
                id: player.id,
                name: player.name,
                color: player.color,
                level: player.level,
                depth: player.depth
            };
        }
        return result;
    }
}
