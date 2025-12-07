import { Game } from './Game.js';

// Check if user is authenticated
const userData = JSON.parse(sessionStorage.getItem('user'));
if (!userData) {
    window.location.href = 'login.html';
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');

    // Initialize the game with user data
    const game = new Game(canvas, userData);

    // Start the game
    game.start();

    // Handle window resize
    window.addEventListener('resize', () => {
        game.onWindowResize();
    });

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Debug info in console
    console.log('%c🎮 Depth Descent', 'font-size: 24px; font-weight: bold; color: #00d4ff;');
    console.log(`%cJugando como: ${userData.displayName} (Nivel ${userData.level})`, 'color: #7bed9f;');
    console.log('%cControles: WASD para mover, Click para atacar, E para cambiar nivel', 'color: #888;');
});
