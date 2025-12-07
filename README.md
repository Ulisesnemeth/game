# Depth Descent

Juego 3D cooperativo con vista top-down y niveles infinitos de profundidad.

## 🎮 Cómo Jugar

### Controles
- **WASD** - Mover al personaje
- **Click izquierdo** - Atacar
- **E** - Descender/Ascender (cerca de portales)

### Objetivo
Desciende lo más profundo que puedas. A mayor profundidad:
- Los mobs son más fuertes (escalado exponencial)
- Dan más experiencia
- Es más difícil sobrevivir

### Multijugador
El juego es cooperativo. Otros jugadores en la misma profundidad son visibles y pueden ayudar a derrotar mobs.

## 🚀 Iniciar el Juego

### 1. Instalar dependencias

```bash
# Cliente
cd client
npm install

# Servidor
cd ../server
npm install
```

### 2. Iniciar servidor (en una terminal)

```bash
cd server
npm start
```

### 3. Iniciar cliente (en otra terminal)

```bash
cd client
npm run dev
```

### 4. Abrir el navegador

Ve a `http://localhost:5173`

Para jugar con amigos, ellos deben conectarse a `http://TU_IP:5173` y el servidor debe estar en el puerto 3000.

## 🏗️ Estructura del Proyecto

```
game/
├── client/           # Cliente Three.js
│   ├── src/
│   │   ├── main.js       # Entry point
│   │   ├── Game.js       # Core game loop
│   │   ├── Player.js     # Jugador
│   │   ├── World.js      # Mundo y portales
│   │   ├── Mob.js        # Enemigos
│   │   ├── MobManager.js # Gestión de mobs
│   │   ├── Combat.js     # Sistema de combate
│   │   ├── Network.js    # Multiplayer
│   │   └── UI.js         # Interfaz
│   └── index.html
└── server/           # Servidor Socket.IO
    ├── server.js
    └── GameState.js
```

## ⚔️ Sistema de Escalado

### Estadísticas de Mobs por Profundidad

| Profundidad | HP Base | Daño | XP |
|-------------|---------|------|-----|
| 0 | 30 | 5 | 15 |
| 5 | 160 | 26 | 80 |
| 10 | 869 | 144 | 436 |
| 20 | 25,628 | 4,271 | 12,867 |

*Fórmula: stat × 1.4^profundidad*

### Niveles del Jugador

- XP necesario: `100 × 1.5^(nivel-1)`
- HP: `100 + (nivel-1) × 20`
- Daño: `10 + (nivel-1) × 5`
