# Depth Descent - Documentación Técnica

## Índice
1. [Arquitectura General](#arquitectura-general)
2. [Estructura de Archivos](#estructura-de-archivos)
3. [Cliente - Módulos](#cliente---módulos)
4. [Servidor - Módulos](#servidor---módulos)
5. [Comunicación de Red](#comunicación-de-red)
6. [Constantes y Configuración](#constantes-y-configuración)
7. [Guía para Modificaciones](#guía-para-modificaciones)

---

## Arquitectura General

```
┌─────────────────┐         WebSocket         ┌─────────────────┐
│     CLIENTE     │◄────────────────────────►│    SERVIDOR     │
│   (Three.js)    │      Socket.IO            │   (Node.js)     │
│   Puerto: 5173  │                           │   Puerto: 3000  │
└─────────────────┘                           └─────────────────┘
        │                                             │
        ▼                                             ▼
┌─────────────────┐                           ┌─────────────────┐
│  Renderizado    │                           │   GameState     │
│  - Scene        │                           │   - Players     │
│  - Camera       │                           │   - Broadcasts  │
│  - Renderer     │                           └─────────────────┘
└─────────────────┘
```

---

## Estructura de Archivos

```
game/
├── client/
│   ├── src/
│   │   ├── main.js          # Entry point, inicializa Game
│   │   ├── Game.js          # Loop principal, orquesta sistemas
│   │   ├── Player.js        # Jugador local, stats, movimiento
│   │   ├── World.js         # Terreno, portales, decoración
│   │   ├── Mob.js           # Entidad enemiga individual
│   │   ├── MobManager.js    # Spawn y gestión de mobs
│   │   ├── Combat.js        # Sistema de daño y XP
│   │   ├── Network.js       # Cliente Socket.IO
│   │   └── UI.js            # Actualización del HUD
│   ├── index.html           # HTML base con HUD
│   ├── style.css            # Estilos del HUD
│   └── package.json
├── server/
│   ├── server.js            # Express + Socket.IO
│   ├── GameState.js         # Estado compartido
│   └── package.json
├── docs/
│   ├── MANUAL.md            # Manual de usuario
│   └── ARCHITECTURE.md      # Este archivo
└── README.md
```

---

## Cliente - Módulos

### main.js
**Propósito**: Entry point del juego.

```javascript
// Flujo de inicialización
1. DOMContentLoaded
2. new Game(canvas)
3. game.start()
4. window.onresize → game.onWindowResize()
```

**Dependencias**: `Game.js`

---

### Game.js
**Propósito**: Clase principal que orquesta todos los sistemas.

#### Constructor
```javascript
constructor(canvas) {
    // Three.js
    this.renderer      // WebGLRenderer
    this.scene         // Scene
    this.camera        // PerspectiveCamera
    this.playerLight   // PointLight que sigue al jugador
    
    // Sistemas
    this.world         // World
    this.player        // Player
    this.mobManager    // MobManager
    this.combat        // Combat
    this.network       // Network
    this.ui            // UI
    
    // Estado
    this.currentDepth  // int: profundidad actual
    this.players       // Map<id, {mesh, targetPosition, name}>
    this.keys          // {KeyW: bool, KeyS: bool, ...}
    this.mouse         // {x, y, clicked}
}
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `initRenderer()` | Configura WebGLRenderer con shadows |
| `initScene()` | Crea Scene con Fog |
| `initCamera()` | Crea PerspectiveCamera a 25 unidades de altura |
| `initLights()` | AmbientLight + DirectionalLight + PointLight |
| `setupInput()` | Event listeners para teclado/mouse |
| `tryChangeDepth()` | Verifica portal cercano y cambia profundidad |
| `changeDepth(n)` | Actualiza profundidad, respawnea mobs, notifica red |
| `start()` | Conecta red, spawn inicial, inicia loop |
| `gameLoop()` | requestAnimationFrame → update → render |
| `update(delta)` | Actualiza player, camera, mobs, combat, network |
| `addOtherPlayer(id, data)` | Crea mesh para otro jugador |
| `removeOtherPlayer(id)` | Elimina mesh de jugador |
| `updateOtherPlayerPosition(id, x, z, rot)` | Interpola posición |
| `onWindowResize()` | Actualiza aspect ratio y renderer size |

#### Configuración de Cámara
```javascript
this.cameraOffset = new THREE.Vector3(0, 25, 15);
// La cámara está 25 unidades arriba y 15 unidades hacia atrás
// Se interpola hacia el jugador: camera.position.lerp(target, 0.1)
```

---

### Player.js
**Propósito**: Controla al jugador local.

#### Propiedades
```javascript
// Stats
this.name              // "Jugador XXX" (aleatorio)
this.level = 1
this.xp = 0
this.maxHp = 100
this.hp = 100
this.baseDamage = 10
this.attackCooldown = 0
this.attackCooldownMax = 0.5  // segundos
this.speed = 8                // unidades/segundo

// Three.js
this.mesh              // CapsuleGeometry, color #00d4ff
this.directionIndicator  // ConeGeometry hijo del mesh
this.attackIndicator   // RingGeometry hijo del mesh
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `createMesh()` | Crea CapsuleGeometry con emissive |
| `createAttackIndicator()` | Ring que aparece al atacar |
| `update(delta, keys, mouse)` | Movimiento + rotación + cooldown |
| `handleMovement(delta, keys)` | WASD → Vector3 normalizado × speed |
| `faceMouseDirection(mouse)` | Raycast al plano Y=0, calcula ángulo |
| `canAttack()` | `attackCooldown <= 0` |
| `attack()` | Resetea cooldown, muestra indicator |
| `getDamage()` | Retorna `{damage, isCrit}` |
| `getAttackPosition()` | Posición 1.5u frente al jugador |
| `getAttackRadius()` | Retorna `2` |
| `takeDamage(amount)` | Resta HP, flash rojo, die() si HP=0 |
| `addXp(amount)` | Suma XP, llama levelUp() si necesario |
| `getXpForNextLevel()` | `Math.floor(100 × 1.5^(nivel-1))` |
| `levelUp()` | Incrementa nivel, recalcula stats, full heal |
| `die()` | Reset posición y HP, dispara evento |

---

### World.js
**Propósito**: Terreno, portales y decoración.

#### Propiedades
```javascript
this.currentDepth = 0
this.portals = []      // Array de objetos portal
this.ground            // Mesh del suelo
this.depthColors = [   // Colores predefinidos para profundidades 0-4
    { ground: 0x2d5a27, ambient: 0x4a7c59 },  // Verde
    { ground: 0x8b7355, ambient: 0xa08060 },  // Amarillo
    { ground: 0x8b4513, ambient: 0xa0522d },  // Naranja
    { ground: 0x722f37, ambient: 0x8b3a3a },  // Rojo
    { ground: 0x4a2040, ambient: 0x5d2a52 },  // Púrpura
]
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `getDepthColor(depth)` | Retorna color, oscurece 15% por nivel >4 |
| `createGround()` | PlaneGeometry 100×100 con vertex displacement |
| `createPortals()` | Crea portal down en (10,0) y up en (-10,0) |
| `createPortal(x, z, type)` | Torus + Circle + Points + Cone animados |
| `setDepth(depth)` | Actualiza colores y visibilidad de portales |
| `getNearestPortal(pos)` | Retorna portal si distancia < 3 |
| `createDecoration()` | 30 rocas aleatorias (DodecahedronGeometry) |
| `update(delta)` | Anima portales (rotación, glow, partículas) |

---

### Mob.js
**Propósito**: Entidad enemiga individual.

#### Propiedades
```javascript
this.type              // {name, color, minDepth}
this.maxHp, this.hp
this.damage
this.xpReward
this.speed
this.level
this.isAlive = true
this.state = 'patrol'  // 'patrol' | 'chase' | 'attack'
this.attackCooldown = 0
this.attackRange = 1.5
this.aggroRange = 12
this.mesh              // Geometry varía por tipo
this.healthBarBg       // Mesh
this.healthBarFill     // Mesh
```

#### Estados de IA
```
PATROL                          CHASE                           ATTACK
├─ patrolTarget = null?         ├─ distancia < 12?              ├─ distancia < 1.5?
│  └─ Esperar patrolWaitTime    │  └─ Mover hacia jugador       │  └─ Atacar cada 1s
│     └─ Elegir punto random    └─ Si no, volver a PATROL       └─ Dispara 'mobAttack'
└─ Mover hacia patrolTarget           
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `createMesh(x, z)` | Sphere/Box/Octahedron según tipo |
| `createHealthBar()` | Dos Planes sobre el mob |
| `updateHealthBar()` | Escala y color según HP |
| `update(delta, playerPos)` | Billboard healthbar + estado IA |
| `handlePatrol(delta)` | Movimiento aleatorio lento |
| `handleChase(delta, playerPos)` | Persigue a velocidad completa |
| `handleAttack(delta)` | Dispara evento 'mobAttack' |
| `takeDamage(amount)` | Flash blanco, muere si HP=0 |
| `die()` | Animación de escala → destroy() |
| `destroy()` | Remove mesh, dispose geometry/material |

---

### MobManager.js
**Propósito**: Gestión de spawn y colección de mobs.

#### Propiedades
```javascript
this.mobs = []
this.mobTypes = [
    { name: 'Slime',   color: 0x7bed9f, minDepth: 0 },
    { name: 'Goblin',  color: 0xffa502, minDepth: 1 },
    { name: 'Orc',     color: 0xff6348, minDepth: 2 },
    { name: 'Demon',   color: 0xff4757, minDepth: 3 },
    { name: 'Shadow',  color: 0x5f27cd, minDepth: 5 },
    { name: 'Void',    color: 0x2c2c54, minDepth: 8 },
    { name: 'Ancient', color: 0x1e1e1e, minDepth: 12 }
]
```

#### Fórmulas de Escalado
```javascript
getStatsForDepth(depth) {
    const multiplier = Math.pow(1.4, depth);
    return {
        hp: Math.floor(30 * multiplier),
        damage: Math.floor(5 * multiplier),
        xp: Math.floor(15 * multiplier),
        speed: Math.min(2 + depth * 0.2, 6),
        level: depth + 1
    };
}
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `getMobTypeForDepth(depth)` | Retorna el mob tipo más alto disponible |
| `getStatsForDepth(depth)` | Calcula stats con escalado exponencial |
| `spawnMobsForDepth(depth)` | Spawn `5 + depth×1.5` mobs (máx 25) |
| `spawnMob(depth)` | Crea Mob en posición aleatoria |
| `clearMobs()` | Destruye todos los mobs |
| `update(delta, playerPos)` | Update todos, respawn si < 3 vivos |
| `getMobsInRange(pos, radius)` | Filtra mobs vivos en rango |

---

### Combat.js
**Propósito**: Sistema de daño, XP y feedback visual.

#### Event Listeners
```javascript
window.addEventListener('mobAttack', ...)   // Mob ataca al jugador
window.addEventListener('mobDeath', ...)    // Mob muere → XP
window.addEventListener('playerDeath', ...) // Jugador muere → reset
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `playerAttack()` | Obtiene mobs en rango, aplica daño, muestra números |
| `onMobAttack({mob, damage})` | Aplica daño al jugador si en rango |
| `onMobDeath({mob, xp})` | Da XP al jugador, actualiza UI |
| `onPlayerDeath()` | Cambia a profundidad 0 |
| `showDamageNumber(pos, amount, isCrit)` | Crea div animado |
| `showXpGain(pos, amount)` | Crea div "+X XP" |
| `worldToScreen(pos)` | Proyecta Vector3 a coordenadas de pantalla |

---

### Network.js
**Propósito**: Cliente Socket.IO para multijugador.

#### Propiedades
```javascript
this.socket            // Socket.IO instance
this.playerId          // socket.id
this.connected = false
this.positionSendRate = 50  // ms entre envíos
```

#### Eventos Emitidos (Cliente → Servidor)
| Evento | Payload | Cuándo |
|--------|---------|--------|
| `playerJoin` | `{name, x, z, depth}` | Al conectar |
| `playerMove` | `{x, z, rotation}` | Cada 50ms |
| `playerDepthChange` | `{depth}` | Al cambiar nivel |
| `mobHit` | `{x, z, damage}` | Al atacar mob |

#### Eventos Recibidos (Servidor → Cliente)
| Evento | Payload | Acción |
|--------|---------|--------|
| `currentPlayers` | `{id: playerData, ...}` | Crear meshes de otros jugadores |
| `playerJoined` | `{id, name, x, z, depth}` | Añadir nuevo jugador |
| `playerLeft` | `{id}` | Eliminar jugador |
| `playerMoved` | `{id, x, z, rotation}` | Actualizar posición |
| `playerChangedDepth` | `{id, depth}` | Mostrar/ocultar jugador |

---

### UI.js
**Propósito**: Actualización del HUD HTML.

#### Elementos DOM Cacheados
```javascript
this.elements = {
    playerLevel,      // #player-level
    healthBar,        // #health-bar .bar-fill
    healthText,       // #health-bar .bar-text
    xpBar,            // #xp-bar .bar-fill
    xpText,           // #xp-bar .bar-text
    currentDepth,     // #current-depth
    connectedPlayers, // #connected-players
    levelUpPopup,     // #level-up-popup
    newLevel          // #level-up-popup .new-level
}
```

#### Métodos Principales
| Método | Descripción |
|--------|-------------|
| `updateHealth(current, max)` | Actualiza barra y texto de HP |
| `updateXp(current, needed, level)` | Actualiza barra XP |
| `updateLevel(level)` | Actualiza número de nivel |
| `updateDepth(depth)` | Actualiza número y gradiente de color |
| `updatePlayerList(players, localName)` | Reconstruye lista de jugadores |
| `showLevelUp(level)` | Muestra popup animado |
| `showMessage(text, duration)` | Mensaje flotante genérico |

---

## Servidor - Módulos

### server.js
**Propósito**: Servidor Express + Socket.IO.

```javascript
const PORT = 3000;
const app = express();
const io = new Server(httpServer, { cors: { origin: "*" } });
const gameState = new GameState();
```

#### Endpoints HTTP
| Ruta | Respuesta |
|------|-----------|
| `GET /` | `{status: 'ok', players: N, uptime: X}` |

#### Socket.IO Handlers
| Evento | Acción |
|--------|--------|
| `connection` | Log, setup handlers |
| `playerJoin` | Añade a gameState, broadcast `playerJoined` |
| `playerMove` | Actualiza posición, broadcast `playerMoved` |
| `playerDepthChange` | Actualiza depth, broadcast `playerChangedDepth` |
| `mobHit` | Broadcast `mobHit` a otros |
| `disconnect` | Elimina de gameState, broadcast `playerLeft` |

---

### GameState.js
**Propósito**: Estado compartido en memoria.

```javascript
class GameState {
    players = new Map();  // id → {id, name, x, z, rotation, depth, joinedAt}
    
    addPlayer(id, data)
    getPlayer(id)
    removePlayer(id)
    getPlayerCount()
    getAllPlayers()
    getPlayersForDepth(depth)
    updatePlayerPosition(id, x, z, rotation)
    updatePlayerDepth(id, depth)
}
```

---

## Comunicación de Red

### Flujo de Conexión
```
Cliente                          Servidor
   │ connect                         │
   ├────────────────────────────────►│
   │                                 │ log "Jugador conectado"
   │ emit 'playerJoin'               │
   ├────────────────────────────────►│
   │                                 │ gameState.addPlayer()
   │◄────────────────────────────────┤ emit 'currentPlayers'
   │                                 │
   │◄─────────────[broadcast]────────┤ emit 'playerJoined' a otros
```

### Flujo de Movimiento
```
Cliente                          Servidor
   │ emit 'playerMove' (cada 50ms)   │
   ├────────────────────────────────►│
   │                                 │ gameState.updatePosition()
   │◄─────────────[broadcast]────────┤ emit 'playerMoved' a otros
```

---

## Constantes y Configuración

### Archivo: Player.js
```javascript
speed = 8                    // Cambiar para velocidad de movimiento
attackCooldownMax = 0.5      // Segundos entre ataques
baseDamage = 10              // Daño inicial
maxHp = 100                  // HP inicial
```

### Archivo: MobManager.js
```javascript
// Escalado exponencial
const multiplier = Math.pow(1.4, depth);  // Cambiar 1.4 para ajustar curva

// Stats base de mobs
const baseHp = 30;
const baseDamage = 5;
const baseXp = 15;
const baseSpeed = 2;

// Cantidad de mobs
const mobCount = Math.min(5 + Math.floor(depth * 1.5), 25);
```

### Archivo: Mob.js
```javascript
attackRange = 1.5     // Distancia para atacar
aggroRange = 12       // Distancia para perseguir
attackCooldown = 1    // Segundos entre ataques
```

### Archivo: World.js
```javascript
// Posiciones de portales
portal down: (10, 0)
portal up: (-10, 0)

// Distancia para usar portal
threshold = 3

// Oscurecimiento para profundidad >4
darkenFactor = Math.pow(0.85, depth - 4)
```

### Archivo: Network.js
```javascript
positionSendRate = 50  // ms entre actualizaciones de posición
serverUrl = 'http://localhost:3000'
```

---

## Guía para Modificaciones

### Cambiar velocidad del jugador
**Archivo**: `client/src/Player.js`, línea ~15
```javascript
this.speed = 8;  // Cambiar a nuevo valor
```

### Cambiar daño/HP base del jugador
**Archivo**: `client/src/Player.js`, línea ~12-14
```javascript
this.maxHp = 100;      // HP inicial
this.baseDamage = 10;  // Daño base
```

### Cambiar curva de dificultad
**Archivo**: `client/src/MobManager.js`, método `getStatsForDepth()`
```javascript
const multiplier = Math.pow(1.4, depth);  // 1.4 = factor exponencial
// Menor = más fácil, Mayor = más difícil
```

### Añadir nuevo tipo de mob
**Archivo**: `client/src/MobManager.js`, array `mobTypes`
```javascript
this.mobTypes.push({
    name: 'NuevoMob',
    color: 0xFF00FF,
    minDepth: 15
});
```

### Cambiar posición de portales
**Archivo**: `client/src/World.js`, método `createPortals()`
```javascript
this.createPortal(10, 0, 'down');   // x, z, tipo
this.createPortal(-10, 0, 'up');
```

### Cambiar tamaño del mundo
**Archivo**: `client/src/World.js`, método `createGround()`
```javascript
const groundGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
// Cambiar 100, 100 para diferente tamaño
```

**Archivo**: `client/src/Player.js`, método `handleMovement()`
```javascript
const bounds = 40;  // Límite de movimiento
```

### Cambiar puerto del servidor
**Archivo**: `server/server.js`, línea final
```javascript
const PORT = process.env.PORT || 3000;  // Cambiar 3000
```

**Archivo**: `client/src/Network.js`, método `connect()`
```javascript
const serverUrl = 'http://localhost:3000';  // Cambiar puerto
```

### Añadir nuevo stat al jugador
1. **Player.js**: Añadir propiedad en constructor
2. **Player.js**: Actualizar en `levelUp()`
3. **UI.js**: Añadir elemento y método de update
4. **index.html**: Añadir elemento HTML
5. **style.css**: Añadir estilos

### Cambiar colores del HUD
**Archivo**: `client/style.css`, variables CSS al inicio
```css
:root {
    --accent-primary: #00d4ff;    // Color principal
    --health-color: #ff4757;      // Color de vida
    --xp-color: #7bed9f;          // Color de XP
}
```
