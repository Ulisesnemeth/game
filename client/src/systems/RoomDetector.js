import * as THREE from 'three';

/**
 * Room Detection System
 * Detects closed wall formations and creates floors automatically
 */
export class RoomDetector {
    constructor(game) {
        this.game = game;
        this.rooms = new Map(); // roomId → { bounds, floor, walls }
        this.nextRoomId = 1;
        this.floors = new Map(); // floorMesh → room

        // Check for rooms periodically
        this.lastCheck = 0;
        this.checkInterval = 1000; // ms
    }

    update(delta) {
        const now = Date.now();
        if (now - this.lastCheck < this.checkInterval) return;
        this.lastCheck = now;

        this.detectRooms();
        this.checkPlayerInRoom();
    }

    detectRooms() {
        const building = this.game.building;
        if (!building) return;

        // Get all walls
        const walls = [];
        for (const [id, b] of building.buildings) {
            if (b.data.type === 'wall') {
                walls.push({
                    id,
                    x: b.data.x,
                    z: b.data.z,
                    rotation: b.data.rotation || 0,
                    width: 2,
                    depth: 0.2
                });
            }
        }

        if (walls.length < 4) return; // Need at least 4 walls for a room

        // Try to find closed rectangles
        const foundRooms = this.findClosedRectangles(walls);

        // Create floors for new rooms
        for (const room of foundRooms) {
            const roomKey = this.getRoomKey(room);
            if (!this.rooms.has(roomKey)) {
                this.createRoomFloor(room, roomKey);
            }
        }

        // Remove floors for rooms that no longer exist
        const currentKeys = new Set(foundRooms.map(r => this.getRoomKey(r)));
        for (const [key, room] of this.rooms) {
            if (!currentKeys.has(key)) {
                this.removeRoomFloor(key);
            }
        }
    }

    findClosedRectangles(walls) {
        const rooms = [];

        // Group walls by orientation (horizontal vs vertical)
        const horizontal = walls.filter(w => {
            const angle = ((w.rotation * 180 / Math.PI) + 360) % 180;
            return angle < 45 || angle > 135;
        });
        const vertical = walls.filter(w => {
            const angle = ((w.rotation * 180 / Math.PI) + 360) % 180;
            return angle >= 45 && angle <= 135;
        });

        // Find potential room bounds by looking for wall intersections
        // Simplified: look for rectangular arrangements
        const xPositions = [...new Set(walls.map(w => Math.round(w.x * 2) / 2))].sort((a, b) => a - b);
        const zPositions = [...new Set(walls.map(w => Math.round(w.z * 2) / 2))].sort((a, b) => a - b);

        // Check each potential rectangle
        for (let i = 0; i < xPositions.length - 1; i++) {
            for (let j = i + 1; j < xPositions.length; j++) {
                for (let k = 0; k < zPositions.length - 1; k++) {
                    for (let l = k + 1; l < zPositions.length; l++) {
                        const minX = xPositions[i];
                        const maxX = xPositions[j];
                        const minZ = zPositions[k];
                        const maxZ = zPositions[l];

                        // Check if we have walls on all 4 sides
                        if (this.hasWallsForRoom(walls, minX, maxX, minZ, maxZ)) {
                            rooms.push({
                                minX, maxX, minZ, maxZ,
                                centerX: (minX + maxX) / 2,
                                centerZ: (minZ + maxZ) / 2,
                                width: maxX - minX,
                                depth: maxZ - minZ
                            });
                        }
                    }
                }
            }
        }

        // Remove overlapping/duplicate rooms, keep largest
        return this.filterOverlappingRooms(rooms);
    }

    hasWallsForRoom(walls, minX, maxX, minZ, maxZ) {
        const tolerance = 0.5;

        // Need walls on left side (minX)
        const hasLeft = walls.some(w =>
            Math.abs(w.x - minX) < tolerance &&
            w.z >= minZ - tolerance && w.z <= maxZ + tolerance
        );

        // Need walls on right side (maxX)
        const hasRight = walls.some(w =>
            Math.abs(w.x - maxX) < tolerance &&
            w.z >= minZ - tolerance && w.z <= maxZ + tolerance
        );

        // Need walls on top side (minZ)
        const hasTop = walls.some(w =>
            Math.abs(w.z - minZ) < tolerance &&
            w.x >= minX - tolerance && w.x <= maxX + tolerance
        );

        // Need walls on bottom side (maxZ)
        const hasBottom = walls.some(w =>
            Math.abs(w.z - maxZ) < tolerance &&
            w.x >= minX - tolerance && w.x <= maxX + tolerance
        );

        return hasLeft && hasRight && hasTop && hasBottom;
    }

    filterOverlappingRooms(rooms) {
        // Sort by area (largest first)
        rooms.sort((a, b) => (b.width * b.depth) - (a.width * a.depth));

        const filtered = [];
        for (const room of rooms) {
            // Check if this room overlaps with any already accepted room
            const overlaps = filtered.some(existing =>
                room.minX < existing.maxX && room.maxX > existing.minX &&
                room.minZ < existing.maxZ && room.maxZ > existing.minZ
            );

            if (!overlaps) {
                filtered.push(room);
            }
        }

        return filtered;
    }

    getRoomKey(room) {
        return `${room.minX},${room.minZ},${room.maxX},${room.maxZ}`;
    }

    createRoomFloor(room, key) {
        // Create floor geometry
        const floorGeometry = new THREE.PlaneGeometry(room.width, room.depth);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3728,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(room.centerX, 0.02, room.centerZ);
        floor.receiveShadow = true;

        this.game.scene.add(floor);

        this.rooms.set(key, {
            ...room,
            floor,
            key
        });

        console.log(`Habitación detectada: ${room.width.toFixed(1)}x${room.depth.toFixed(1)}`);
    }

    removeRoomFloor(key) {
        const room = this.rooms.get(key);
        if (room && room.floor) {
            this.game.scene.remove(room.floor);
            room.floor.geometry.dispose();
            room.floor.material.dispose();
        }
        this.rooms.delete(key);
    }

    checkPlayerInRoom() {
        const playerPos = this.game.player?.mesh?.position;
        if (!playerPos) return;

        let insideRoom = null;

        for (const [key, room] of this.rooms) {
            if (playerPos.x > room.minX && playerPos.x < room.maxX &&
                playerPos.z > room.minZ && playerPos.z < room.maxZ) {
                insideRoom = room;
                break;
            }
        }

        // Update camera mode
        if (insideRoom && !this.currentRoom) {
            this.enterRoom(insideRoom);
        } else if (!insideRoom && this.currentRoom) {
            this.exitRoom();
        }

        this.currentRoom = insideRoom;
    }

    enterRoom(room) {
        console.log('Entrando a habitación');

        // Calculate zoom needed to show the whole room
        const roomSize = Math.max(room.width, room.depth);
        const targetHeight = roomSize * 1.2 + 5; // Adjust multiplier as needed

        // Store original camera offset
        this.originalCameraOffset = this.game.cameraOffset.clone();

        // Zoom camera to show room
        this.game.cameraOffset.set(0, targetHeight, roomSize * 0.5);
        this.game.isInRoom = true;
    }

    exitRoom() {
        console.log('Saliendo de habitación');

        // Restore original camera
        if (this.originalCameraOffset) {
            this.game.cameraOffset.copy(this.originalCameraOffset);
        } else {
            this.game.cameraOffset.set(0, 25, 15);
        }
        this.game.isInRoom = false;
    }

    clear() {
        for (const [key, room] of this.rooms) {
            if (room.floor) {
                this.game.scene.remove(room.floor);
                room.floor.geometry.dispose();
                room.floor.material.dispose();
            }
        }
        this.rooms.clear();
        this.currentRoom = null;
    }
}
