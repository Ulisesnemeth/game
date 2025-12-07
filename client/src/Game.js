import * as THREE from 'three';
import { Player } from './Player.js';
import { World } from './World.js';
import { MobManager } from './MobManager.js';
import { Combat } from './Combat.js';
import { Network } from './Network.js';
import { UI } from './UI.js';

export class Game {
    constructor(canvas, userData) {
        this.canvas = canvas;
        this.userData = userData;
        this.clock = new THREE.Clock();
        this.isRunning = false;

        // Game state
        this.currentDepth = 0;
        this.players = new Map(); // Other players: id → {mesh, data}
        this.allPlayersData = new Map(); // All players including other depths

        // Initialize Three.js
        this.initRenderer();
        this.initScene();
        this.initCamera();
        this.initLights();

        // Initialize game systems
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.camera, userData);
        this.mobManager = new MobManager(this.scene, this);
        this.combat = new Combat(this);
        this.network = new Network(this);
        this.ui = new UI(this);

        // Input state
        this.keys = {};
        this.mouse = { x: 0, y: 0, clicked: false };

        this.setupInput();
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
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(10, 30, 10);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.near = 0.5;
        directional.shadow.camera.far = 100;
        directional.shadow.camera.left = -30;
        directional.shadow.camera.right = 30;
        directional.shadow.camera.top = 30;
        directional.shadow.camera.bottom = -30;
        this.scene.add(directional);

        this.playerLight = new THREE.PointLight(0x00d4ff, 0.5, 15);
        this.playerLight.position.set(0, 3, 0);
        this.scene.add(this.playerLight);
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyE') {
                this.tryChangeDepth();
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
                this.combat.playerAttack();
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

    changeDepth(newDepth) {
        const oldDepth = this.currentDepth;
        this.currentDepth = newDepth;

        this.world.setDepth(newDepth);
        this.mobManager.clearMobs();
        this.player.mesh.position.set(0, 0.5, 0);
        this.ui.updateDepth(newDepth);
        this.network.sendDepthChange(newDepth);

        // Clear other players (will be repopulated by server)
        for (const [id, data] of this.players) {
            if (data.mesh) {
                this.scene.remove(data.mesh);
                data.mesh.geometry.dispose();
                data.mesh.material.dispose();
            }
        }
        this.players.clear();

        console.log(`Profundidad cambiada: ${oldDepth} → ${newDepth}`);
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
        this.player.update(delta, this.keys, this.mouse);
        this.updateCamera();

        this.playerLight.position.copy(this.player.mesh.position);
        this.playerLight.position.y += 3;

        // Mobs are now server-controlled, just update visuals
        this.mobManager.updateVisuals(delta);

        this.combat.update(delta);
        this.world.update(delta);

        this.network.sendPosition(this.player.mesh.position, this.player.mesh.rotation.y);
        this.updateOtherPlayers();

        // Update player indicators
        this.ui.updatePlayerIndicators(this.players, this.player, this.camera);
    }

    updateCamera() {
        const target = this.player.mesh.position.clone().add(this.cameraOffset);
        this.camera.position.lerp(target, 0.1);
        this.camera.lookAt(this.player.mesh.position);
    }

    updateOtherPlayers() {
        for (const [id, data] of this.players) {
            if (data.mesh && data.targetPosition) {
                data.mesh.position.lerp(data.targetPosition, 0.15);
            }
        }
    }

    addOtherPlayer(id, data) {
        const geometry = new THREE.CapsuleGeometry(0.4, 0.8, 4, 8);
        const color = data.color || 0x888888;
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.7,
            emissive: color,
            emissiveIntensity: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.x || 0, 0.5, data.z || 0);
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.players.set(id, {
            mesh,
            targetPosition: new THREE.Vector3(data.x || 0, 0.5, data.z || 0),
            name: data.name || 'Jugador',
            color: color,
            level: data.level || 1,
            depth: data.depth || 0
        });

        // Update all players data
        this.allPlayersData.set(id, {
            name: data.name,
            color: color,
            level: data.level || 1,
            depth: data.depth || 0
        });

        this.ui.updatePlayerList(this.allPlayersData, this.player, this.currentDepth);
    }

    removeOtherPlayer(id) {
        const player = this.players.get(id);
        if (player && player.mesh) {
            this.scene.remove(player.mesh);
            player.mesh.geometry.dispose();
            player.mesh.material.dispose();
        }
        this.players.delete(id);
        this.allPlayersData.delete(id);
        this.ui.updatePlayerList(this.allPlayersData, this.player, this.currentDepth);
    }

    updateOtherPlayerPosition(id, x, z, rotation) {
        const player = this.players.get(id);
        if (player) {
            player.targetPosition.set(x, 0.5, z);
            if (player.mesh) {
                player.mesh.rotation.y = rotation;
            }
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
