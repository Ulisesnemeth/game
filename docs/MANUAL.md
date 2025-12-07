# Depth Descent - Manual de Usuario

## Índice
1. [Instalación](#instalación)
2. [Controles](#controles)
3. [Interfaz (HUD)](#interfaz-hud)
4. [Mecánicas del Juego](#mecánicas-del-juego)
5. [Sistema de Profundidad](#sistema-de-profundidad)
6. [Sistema de Combate](#sistema-de-combate)
7. [Progresión del Jugador](#progresión-del-jugador)
8. [Multijugador](#multijugador)
9. [Tipos de Enemigos](#tipos-de-enemigos)

---

## Instalación

### Requisitos
- Node.js v18 o superior
- Navegador moderno (Chrome, Firefox, Edge)

### Pasos

```bash
# 1. Instalar dependencias del cliente
cd client
npm install

# 2. Instalar dependencias del servidor
cd ../server
npm install

# 3. Iniciar servidor (Terminal 1)
cd server
npm start
# Salida esperada: "Puerto: 3000, Estado: Esperando jugadores..."

# 4. Iniciar cliente (Terminal 2)
cd client
npm run dev
# Salida esperada: "VITE ready - Local: http://localhost:5173/"
```

### Acceder al Juego
- **Local**: http://localhost:5173
- **Red local**: http://TU_IP:5173 (otros jugadores en la misma red)

---

## Controles

| Tecla/Acción | Función |
|--------------|---------|
| `W` o `↑` | Mover hacia adelante (norte) |
| `S` o `↓` | Mover hacia atrás (sur) |
| `A` o `←` | Mover hacia la izquierda (oeste) |
| `D` o `→` | Mover hacia la derecha (este) |
| `Click izquierdo` | Atacar (área circular frente al jugador) |
| `E` | Usar portal (descender/ascender cuando estás cerca) |
| `Mouse` | El jugador siempre mira hacia el cursor |

### Notas sobre Controles
- El movimiento es en 8 direcciones (diagonales incluidas)
- La velocidad base del jugador es **8 unidades/segundo**
- El ataque tiene un **cooldown de 0.5 segundos**
- Debes estar a **menos de 3 unidades** del portal para usarlo con `E`

---

## Interfaz (HUD)

### Panel Superior Izquierdo - Stats del Jugador
```
┌─────────────────────┐
│ Nivel         [N]   │  ← Nivel actual del jugador
├─────────────────────┤
│ ████████░░ 85/100   │  ← Barra de vida (roja)
│ ██░░░░░░░░ 30/100   │  ← Barra de experiencia (verde)
└─────────────────────┘
```

### Panel Superior Derecho - Profundidad
```
┌─────────────────────┐
│  ⬇  PROFUNDIDAD     │
│        [0]          │  ← Nivel de profundidad actual
└─────────────────────┘
```
- El número cambia de color según la profundidad
- Verde (0-1) → Amarillo (2) → Naranja (3) → Rojo (4) → Púrpura (5+)

### Panel Derecho - Jugadores
```
┌─────────────────────┐
│ Jugadores           │
├─────────────────────┤
│ ● Jugador 123 (Tú)  │  ← Tu nombre (cian)
│ ● OtroJugador       │  ← Otros jugadores (blanco)
└─────────────────────┘
```

### Panel Inferior Izquierdo - Controles
Muestra recordatorio de teclas: `WASD: Mover | CLICK: Atacar | E: Descender/Subir`

### Panel Inferior Derecho - Conexión
- 🟡 Pulsando = Conectando...
- 🟢 Fijo = Conectado
- 🔴 Fijo = Desconectado

---

## Mecánicas del Juego

### Objetivo
Desciende lo más profundo posible, derrotando enemigos para ganar experiencia y subir de nivel. A mayor profundidad, mayor dificultad y mayores recompensas.

### Flujo de Juego
1. Apareces en la **superficie** (profundidad 0)
2. Camina hacia el **portal naranja** (descenso) ubicado en `x=10, z=0`
3. Presiona `E` para descender
4. Derrota mobs para ganar XP
5. Sube de nivel para ser más fuerte
6. Si mueres, vuelves a la superficie con vida completa

---

## Sistema de Profundidad

### Portales
| Tipo | Color | Posición | Función |
|------|-------|----------|---------|
| Descenso | Naranja | `(10, 0)` | Baja un nivel de profundidad |
| Ascenso | Azul | `(-10, 0)` | Sube un nivel (oculto en superficie) |

### Efectos de Profundidad
- **Color del terreno**: Se oscurece exponencialmente
- **Fog (niebla)**: Se vuelve más densa
- **Cantidad de mobs**: Aumenta `5 + profundidad × 1.5` (máx. 25)
- **Luz ambiental**: Disminuye `0.4 - profundidad × 0.03`

### Colores por Profundidad
| Profundidad | Color del Suelo | Hexadecimal |
|-------------|-----------------|-------------|
| 0 | Verde | `#2d5a27` |
| 1 | Amarillo/Marrón | `#8b7355` |
| 2 | Naranja/Marrón | `#8b4513` |
| 3 | Rojo/Carmesí | `#722f37` |
| 4 | Púrpura Oscuro | `#4a2040` |
| 5+ | Se oscurece 15% por nivel | Fórmula: `× 0.85^(prof-4)` |

---

## Sistema de Combate

### Ataque del Jugador
- **Área de efecto**: Círculo de radio **2 unidades** frente al jugador
- **Posición del área**: 1.5 unidades en la dirección que mira
- **Cooldown**: 0.5 segundos entre ataques
- **Daño base**: `10 + (nivel-1) × 5`
- **Crítico**: 10% de probabilidad, 2× daño

### Ejemplo de Daño
| Nivel Jugador | Daño Normal | Daño Crítico |
|---------------|-------------|--------------|
| 1 | 10 | 20 |
| 5 | 30 | 60 |
| 10 | 55 | 110 |

### Ataque de Mobs
- **Rango de agro**: 12 unidades (te persiguen)
- **Rango de ataque**: 1.5 unidades
- **Cooldown de ataque**: 1 segundo

---

## Progresión del Jugador

### Stats Base (Nivel 1)
| Stat | Valor |
|------|-------|
| HP Máximo | 100 |
| Daño Base | 10 |
| Velocidad | 8 |

### Fórmulas de Nivel
| Stat | Fórmula |
|------|---------|
| XP para subir | `100 × 1.5^(nivel-1)` |
| HP Máximo | `100 + (nivel-1) × 20` |
| Daño | `10 + (nivel-1) × 5` |

### Tabla de XP Requerido
| Nivel | XP Necesario | XP Acumulado |
|-------|--------------|--------------|
| 1→2 | 100 | 100 |
| 2→3 | 150 | 250 |
| 3→4 | 225 | 475 |
| 4→5 | 337 | 812 |
| 5→6 | 506 | 1,318 |
| 10→11 | 3,844 | 11,356 |

### Al Subir de Nivel
1. HP se restaura al máximo
2. Aparece animación "¡NIVEL ARRIBA!"
3. Stats aumentan según fórmulas

---

## Multijugador

### Conexión
- El cliente se conecta automáticamente al servidor en puerto 3000
- Tu nombre es generado aleatoriamente: "Jugador XXX"

### Sincronización
| Dato | Frecuencia |
|------|------------|
| Posición del jugador | Cada 50ms (20 Hz) |
| Cambio de profundidad | Inmediato |
| Golpe a mob | Inmediato |

### Visibilidad
- Solo ves jugadores en **tu misma profundidad**
- Nombre de jugadores aparece en lista lateral
- Jugadores aparecen como cápsulas grises

---

## Tipos de Enemigos

### Por Profundidad Mínima
| Mob | Color | Profundidad Mínima | Forma |
|-----|-------|-------------------|-------|
| Slime | Verde `#7bed9f` | 0 | Esfera |
| Goblin | Naranja `#ffa502` | 1 | Cubo |
| Orc | Rojo `#ff6348` | 2 | Cubo |
| Demon | Rojo oscuro `#ff4757` | 3 | Cubo |
| Shadow | Púrpura `#5f27cd` | 5 | Octaedro |
| Void | Oscuro `#2c2c54` | 8 | Octaedro |
| Ancient | Negro `#1e1e1e` | 12 | Octaedro |

### Estadísticas Base (antes de escalado)
| Stat | Valor Base |
|------|------------|
| HP | 30 |
| Daño | 5 |
| XP | 15 |
| Velocidad | 2 |

### Escalado Exponencial
Fórmula: `stat × 1.4^profundidad`

| Profundidad | HP | Daño | XP | Velocidad |
|-------------|-----|------|-----|-----------|
| 0 | 30 | 5 | 15 | 2.0 |
| 1 | 42 | 7 | 21 | 2.2 |
| 2 | 59 | 10 | 29 | 2.4 |
| 3 | 82 | 14 | 41 | 2.6 |
| 5 | 161 | 27 | 80 | 3.0 |
| 10 | 869 | 145 | 435 | 4.0 |
| 20 | 25,628 | 4,271 | 12,867 | 6.0 (max) |

### IA de Mobs
1. **Patrullar**: Camina aleatoriamente, espera 1-3 segundos entre movimientos
2. **Perseguir**: Si el jugador está a <12 unidades, lo persigue a velocidad completa
3. **Atacar**: Si está a <1.5 unidades, ataca cada 1 segundo

---

## Muerte y Respawn

### Al Morir
1. HP llega a 0
2. Te teletransportas a la **superficie** (profundidad 0)
3. HP se restaura al máximo
4. Posición: `(0, 0.5, 0)`

### No Pierdes
- Nivel actual
- Experiencia acumulada
