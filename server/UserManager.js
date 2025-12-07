import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// 12 player colors
export const PLAYER_COLORS = [
    0x00d4ff, // Cyan
    0xff6b35, // Orange
    0x7bed9f, // Green
    0xff4757, // Red
    0xffd43b, // Yellow
    0xcc5de8, // Purple
    0x20c997, // Teal
    0xff8787, // Pink
    0x748ffc, // Blue
    0xffc078, // Peach
    0x63e6be, // Mint
    0xe599f7  // Lavender
];

export class UserManager {
    constructor() {
        this.users = {};
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(USERS_FILE)) {
                const data = fs.readFileSync(USERS_FILE, 'utf8');
                this.users = JSON.parse(data);
                console.log(`Cargados ${Object.keys(this.users).length} usuarios`);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.users = {};
        }
    }

    saveData() {
        try {
            const dir = path.dirname(USERS_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    register(username, password) {
        // Validate
        if (!username || username.length < 3) {
            return { success: false, error: 'Usuario debe tener al menos 3 caracteres' };
        }
        if (!password || password.length < 4) {
            return { success: false, error: 'Contraseña debe tener al menos 4 caracteres' };
        }
        if (this.users[username]) {
            return { success: false, error: 'El usuario ya existe' };
        }

        // Create user with default values
        this.users[username] = {
            password: password,
            displayName: username,
            level: 1,
            xp: 0,
            color: PLAYER_COLORS[Object.keys(this.users).length % PLAYER_COLORS.length],
            createdAt: Date.now()
        };

        this.saveData();

        return {
            success: true,
            user: this.getPublicUserData(username)
        };
    }

    login(username, password) {
        const user = this.users[username];

        if (!user) {
            return { success: false, error: 'Usuario no encontrado' };
        }

        if (user.password !== password) {
            return { success: false, error: 'Contraseña incorrecta' };
        }

        return {
            success: true,
            user: this.getPublicUserData(username)
        };
    }

    getPublicUserData(username) {
        const user = this.users[username];
        if (!user) return null;

        return {
            username: username,
            displayName: user.displayName,
            level: user.level,
            xp: user.xp,
            color: user.color
        };
    }

    updateProfile(username, updates) {
        const user = this.users[username];
        if (!user) {
            return { success: false, error: 'Usuario no encontrado' };
        }

        if (updates.displayName) {
            user.displayName = updates.displayName.substring(0, 20);
        }
        if (updates.color !== undefined && PLAYER_COLORS.includes(updates.color)) {
            user.color = updates.color;
        }

        this.saveData();
        return { success: true, user: this.getPublicUserData(username) };
    }

    saveProgress(username, level, xp) {
        const user = this.users[username];
        if (!user) return false;

        user.level = level;
        user.xp = xp;
        this.saveData();
        return true;
    }

    getUser(username) {
        return this.getPublicUserData(username);
    }
}
