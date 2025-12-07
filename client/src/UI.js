export class UI {
    constructor(game) {
        this.game = game;

        this.elements = {
            playerLevel: document.getElementById('player-level'),
            healthBar: document.querySelector('#health-bar .bar-fill'),
            healthText: document.querySelector('#health-bar .bar-text'),
            xpBar: document.querySelector('#xp-bar .bar-fill'),
            xpText: document.querySelector('#xp-bar .bar-text'),
            currentDepth: document.getElementById('current-depth'),
            connectedPlayers: document.getElementById('connected-players'),
            levelUpPopup: document.getElementById('level-up-popup'),
            newLevel: document.querySelector('#level-up-popup .new-level'),
            playerIndicators: document.getElementById('player-indicators')
        };

        // Initialize with player data
        this.updateHealth(game.player.hp, game.player.maxHp);
        this.updateXp(game.player.xp, game.player.getXpForNextLevel(), game.player.level);
        this.updateDepth(0);

        // Hook into level up
        this.originalLevelUp = game.player.levelUp.bind(game.player);
        game.player.levelUp = () => {
            const newLevel = this.originalLevelUp();
            this.showLevelUp(newLevel);
            this.updateLevel(newLevel);
            this.updateHealth(game.player.hp, game.player.maxHp);
            return newLevel;
        };
    }

    updateHealth(current, max) {
        const percent = (current / max) * 100;

        if (this.elements.healthBar) {
            this.elements.healthBar.style.width = `${percent}%`;
        }

        if (this.elements.healthText) {
            this.elements.healthText.textContent = `${Math.ceil(current)}/${max}`;
        }
    }

    updateXp(current, needed, level) {
        const percent = (current / needed) * 100;

        if (this.elements.xpBar) {
            this.elements.xpBar.style.width = `${percent}%`;
        }

        if (this.elements.xpText) {
            this.elements.xpText.textContent = `${current}/${needed} XP`;
        }

        this.updateLevel(level);
    }

    updateLevel(level) {
        if (this.elements.playerLevel) {
            this.elements.playerLevel.textContent = level;
        }
    }

    updateDepth(depth) {
        if (this.elements.currentDepth) {
            this.elements.currentDepth.textContent = depth;

            const colors = ['#7bed9f', '#ffd43b', '#ff922b', '#ff6b6b', '#cc5de8', '#845ef7'];
            const colorIndex = Math.min(depth, colors.length - 1);
            this.elements.currentDepth.style.background = `linear-gradient(135deg, ${colors[colorIndex]}, ${colors[Math.max(0, colorIndex - 1)]})`;
            this.elements.currentDepth.style.webkitBackgroundClip = 'text';
            this.elements.currentDepth.style.webkitTextFillColor = 'transparent';
            this.elements.currentDepth.style.backgroundClip = 'text';
        }
    }

    updatePlayerList(allPlayers, localPlayer, currentDepth) {
        if (!this.elements.connectedPlayers) return;

        this.elements.connectedPlayers.innerHTML = '';

        // Add local player first
        const localLi = this.createPlayerListItem({
            name: localPlayer.name + ' (Tú)',
            color: localPlayer.color,
            level: localPlayer.level,
            depth: currentDepth
        }, true);
        this.elements.connectedPlayers.appendChild(localLi);

        // Add other players
        for (const [id, data] of allPlayers) {
            const li = this.createPlayerListItem(data, false);
            this.elements.connectedPlayers.appendChild(li);
        }
    }

    createPlayerListItem(data, isLocal) {
        const li = document.createElement('li');

        // Color dot
        const colorDot = document.createElement('span');
        colorDot.className = 'player-color-dot';
        const hex = '#' + (data.color || 0x888888).toString(16).padStart(6, '0');
        colorDot.style.backgroundColor = hex;
        colorDot.style.color = hex;
        li.appendChild(colorDot);

        // Name
        const name = document.createElement('span');
        name.className = 'player-name';
        name.textContent = data.name || 'Jugador';
        if (isLocal) {
            name.style.color = '#00d4ff';
        }
        li.appendChild(name);

        // Info (level + depth)
        const info = document.createElement('span');
        info.className = 'player-info';

        const level = document.createElement('span');
        level.className = 'player-level';
        level.textContent = `Lv${data.level || 1}`;
        info.appendChild(level);

        const depth = document.createElement('span');
        depth.className = 'player-depth';
        depth.textContent = `P${data.depth !== undefined ? data.depth : 0}`;
        info.appendChild(depth);

        li.appendChild(info);

        return li;
    }

    updatePlayerIndicators(players, localPlayer, camera) {
        if (!this.elements.playerIndicators) return;

        // Clear existing indicators
        this.elements.playerIndicators.innerHTML = '';

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const margin = 50;

        for (const [id, playerData] of players) {
            // Only show indicators for players on same depth
            if (playerData.depth !== this.game.currentDepth) continue;
            if (!playerData.mesh) continue;

            // Project player position to screen
            const pos = playerData.mesh.position.clone();
            pos.project(camera);

            const screenX = (pos.x + 1) / 2 * screenWidth;
            const screenY = -(pos.y - 1) / 2 * screenHeight;

            // Check if player is off-screen
            const isOffScreen = screenX < margin || screenX > screenWidth - margin ||
                screenY < margin || screenY > screenHeight - margin ||
                pos.z > 1;

            if (isOffScreen) {
                // Create indicator
                const indicator = document.createElement('div');
                indicator.className = 'player-indicator';
                indicator.setAttribute('data-name', playerData.name);

                const hex = '#' + (playerData.color || 0x888888).toString(16).padStart(6, '0');
                indicator.style.color = hex;

                // Calculate direction from center
                const centerX = screenWidth / 2;
                const centerY = screenHeight / 2;
                const angle = Math.atan2(screenY - centerY, screenX - centerX);

                // Position on screen edge
                let edgeX, edgeY;

                // Calculate intersection with screen edge
                const tanAngle = Math.tan(angle);

                // Try right/left edges
                if (Math.abs(Math.cos(angle)) > 0.01) {
                    const xSign = Math.cos(angle) > 0 ? 1 : -1;
                    edgeX = xSign > 0 ? screenWidth - margin : margin;
                    edgeY = centerY + (edgeX - centerX) * tanAngle;

                    if (edgeY < margin || edgeY > screenHeight - margin) {
                        // Out of bounds, use top/bottom
                        const ySign = Math.sin(angle) > 0 ? 1 : -1;
                        edgeY = ySign > 0 ? screenHeight - margin : margin;
                        edgeX = centerX + (edgeY - centerY) / tanAngle;
                    }
                } else {
                    // Nearly vertical
                    const ySign = Math.sin(angle) > 0 ? 1 : -1;
                    edgeY = ySign > 0 ? screenHeight - margin : margin;
                    edgeX = centerX;
                }

                // Clamp to screen
                edgeX = Math.max(margin, Math.min(screenWidth - margin, edgeX));
                edgeY = Math.max(margin, Math.min(screenHeight - margin, edgeY));

                indicator.style.left = `${edgeX - 20}px`;
                indicator.style.top = `${edgeY - 20}px`;

                // Arrow direction
                const arrowAngle = angle * (180 / Math.PI);
                indicator.textContent = '➤';
                indicator.style.transform = `rotate(${arrowAngle}deg)`;

                this.elements.playerIndicators.appendChild(indicator);
            }
        }
    }

    showLevelUp(level) {
        if (!this.elements.levelUpPopup || !this.elements.newLevel) return;

        this.elements.newLevel.textContent = level;
        this.elements.levelUpPopup.classList.remove('hidden');

        setTimeout(() => {
            this.elements.levelUpPopup.classList.add('hidden');
        }, 2000);
    }

    showMessage(text, duration = 3000) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 18px;
            z-index: 1000;
            animation: fadeInOut ${duration}ms ease;
        `;
        message.textContent = text;
        document.body.appendChild(message);

        setTimeout(() => message.remove(), duration);
    }
}
