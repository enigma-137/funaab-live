import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import worldData from '../../worlds/funaab/world.json';

export interface DebugColliderShape {
  type: 'cuboid' | 'cylinder' | 'capsule';
  position: [number, number, number];
  rotation?: [number, number, number];
  halfExtents?: [number, number, number]; // for cuboid: [hx, hy, hz]
  radius?: number; // for cylinder/capsule
  halfHeight?: number; // for cylinder/capsule
  name?: string;
}

class PhysicsWorld {
  public world: RAPIER.World | null = null;
  public isInitialized = false;
  private initPromise: Promise<void> | null = null;
  public debugShapes: DebugColliderShape[] = [];

  // Player physics references
  public playerBody: RAPIER.RigidBody | null = null;
  public playerCollider: RAPIER.Collider | null = null;
  public characterController: RAPIER.KinematicCharacterController | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await RAPIER.init();
      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      this.world = new RAPIER.World(gravity);
      this.buildStaticColliders();
      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  private buildStaticColliders() {
    if (!this.world) return;
    this.debugShapes = [];

    // 1. Ground plane (Floor)
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(85, 0.5, 85);
    this.world.createCollider(groundColliderDesc, groundBody);

    // 2. World Bounds Perimeter Fences / Invisible Walls
    const minX = worldData.bounds.minX;
    const maxX = worldData.bounds.maxX;
    const minZ = worldData.bounds.minZ;
    const maxZ = worldData.bounds.maxZ;
    const wallHeight = 6;
    const wallThickness = 1.5;

    this.addStaticBox([0, wallHeight / 2, minZ - wallThickness / 2], [maxX - minX + 10, wallHeight, wallThickness], 'Boundary North');
    this.addStaticBox([0, wallHeight / 2, maxZ + wallThickness / 2], [maxX - minX + 10, wallHeight, wallThickness], 'Boundary South');
    this.addStaticBox([minX - wallThickness / 2, wallHeight / 2, 0], [wallThickness, wallHeight, maxZ - minZ + 10], 'Boundary West');
    this.addStaticBox([maxX + wallThickness / 2, wallHeight / 2, 0], [wallThickness, wallHeight, maxZ - minZ + 10], 'Boundary East');

    // 3. Ceremonial Main Gate (position: [0, 0, 44])
    this.addStaticBox([0, 3.5, 44], [4.0, 7.0, 4.0], 'Main Gate Pyramid Monument');
    this.addStaticBox([-10.5, 1.6, 44], [2.6, 3.2, 2.6], 'Gatehouse Left');
    this.addStaticBox([10.5, 1.6, 44], [2.6, 3.2, 2.6], 'Gatehouse Right');

    // 4. W-Landmark Plaza (position: [0, 0, 18])
    this.addStaticBox([-7.5, 0.6, 18], [3.2, 1.2, 4.5], 'W-Plaza Left Planter');
    this.addStaticBox([7.5, 0.6, 18], [3.2, 1.2, 4.5], 'W-Plaza Right Planter');
    this.addStaticBox([0, 0.8, 18], [1.2, 1.6, 0.8], 'W-Plaza Center Pedestal');

    // 5. Main Car Park & Keke Terminal (position: [-22, 0, 20])
    this.addStaticBox([-22, 1.0, 14.8], [12.0, 2.0, 1.0], 'Keke Shelter Barrier');

    // 6. Sports Centre Pitch Goalposts (position: [-38, 0, 0])
    this.addStaticBox([-38, 1.2, -16.4], [5.0, 2.4, 0.8], 'Pitch Goalpost North');
    this.addStaticBox([-38, 1.2, 16.4], [5.0, 2.4, 0.8], 'Pitch Goalpost South');

    // 7. Tantalizers & Campus Buka (position: [-20, 0, 5])
    this.addStaticBox([-20, 1.8, 5], [6.0, 3.6, 4.0], 'Tantalizers Kiosk');
    this.addStaticBox([-24.5, 0.4, 8], [2.4, 0.8, 1.6], 'Picnic Table Left');
    this.addStaticBox([-15.5, 0.4, 8], [2.4, 0.8, 1.6], 'Picnic Table Right');
    this.addStaticBox([-22.5, 0.6, 7.5], [1.2, 1.2, 0.8], 'Suya Grill');

    // 8. Health Centre (position: [-20, 0, -10])
    this.addStaticBox([-20, 2.5, -10], [12.0, 5.0, 8.0], 'Health Centre Clinic');

    // 9. Senate & Nimbe Adedipe Library (position: [0, 0, -32])
    this.addStaticBox([0, 3.5, -32], [18.0, 7.0, 10.0], 'Senate & Library');

    // 10. COLFHEC Academic Building (position: [-28, 0, -32])
    // Back Wall
    this.addStaticBox([-28, 4.0, -38.6], [20.0, 8.0, 0.8], 'COLFHEC Back Wall');
    // Left Wall
    this.addStaticBox([-37.6, 4.0, -32], [0.8, 8.0, 14.0], 'COLFHEC Left Wall');
    // Right Wall
    this.addStaticBox([-18.4, 4.0, -32], [0.8, 8.0, 14.0], 'COLFHEC Right Wall');
    // Front Left Wall
    this.addStaticBox([-34.25, 4.0, -25.4], [7.5, 8.0, 0.8], 'COLFHEC Front Left Wall');
    // Front Right Wall
    this.addStaticBox([-21.75, 4.0, -25.4], [7.5, 8.0, 0.8], 'COLFHEC Front Right Wall');

    // 11. COLENG & COLERM Faculty Zones
    this.addStaticBox([-14, 3.0, -44], [14.0, 6.0, 8.0], 'COLENG Complex');
    this.addStaticBox([18, 3.5, -32], [14.0, 7.0, 10.0], 'COLERM & COLPLANT');

    // 12. Bank & ATM Gallery (position: [24, 0, 18])
    this.addStaticBox([24, 2.5, 18], [12.0, 5.0, 8.0], 'Bank Building');
    this.addStaticBox([22, 1.2, 22.2], [1.2, 2.4, 0.8], 'ATM Unit Left');
    this.addStaticBox([26, 1.2, 22.2], [1.2, 2.4, 0.8], 'ATM Unit Right');

    // 13. Agromet Station (position: [36, 0, 5])
    this.addStaticBox([36, 1.5, 5], [12.0, 3.0, 12.0], 'Agromet Station');

    // 14. Hostel & Game Den (position: [26, 0, -12])
    this.addStaticBox([26, 5.0, -20], [22.0, 10.0, 8.0], 'Hostel Dormitory');
    this.addStaticBox([22, 0.5, -10], [4.0, 1.0, 2.0], 'Hostel Pergola Bench');
    this.addStaticBox([28, 2.5, -6], [8.0, 5.0, 6.0], 'FUNAAB Game Den');
  }

  public addStaticBox(center: [number, number, number], size: [number, number, number], name?: string) {
    if (!this.world) return;
    const [cx, cy, cz] = center;
    const [sx, sy, sz] = size;
    const halfExtents: [number, number, number] = [sx / 2, sy / 2, sz / 2];

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2]);
    this.world.createCollider(colliderDesc, body);

    this.debugShapes.push({
      type: 'cuboid',
      position: center,
      halfExtents,
      name,
    });
  }

  public addStaticCylinder(center: [number, number, number], radius: number, height: number, name?: string) {
    if (!this.world) return;
    const [cx, cy, cz] = center;
    const halfHeight = height / 2;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
    this.world.createCollider(colliderDesc, body);

    this.debugShapes.push({
      type: 'cylinder',
      position: center,
      radius,
      halfHeight,
      name,
    });
  }

  public setupPlayer(spawn: [number, number, number] = [0, 0, 10]): {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    controller: RAPIER.KinematicCharacterController;
  } | null {
    if (!this.world) return null;

    if (this.playerCollider && this.playerBody) {
      this.world.removeCollider(this.playerCollider, false);
      this.world.removeRigidBody(this.playerBody);
    }

    const capsuleHalfHeight = 0.5;
    const capsuleRadius = 0.35;
    const playerCenterY = spawn[1] + capsuleHalfHeight + capsuleRadius;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      spawn[0],
      playerCenterY,
      spawn[2]
    );
    this.playerBody = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHalfHeight, capsuleRadius);
    this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);

    const offset = 0.04;
    this.characterController = this.world.createCharacterController(offset);
    this.characterController.enableAutostep(0.3, 0.2, true);
    this.characterController.enableSnapToGround(0.5);
    this.characterController.setSlideEnabled(true);
    this.characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((50 * Math.PI) / 180);

    this.world.step();

    return {
      body: this.playerBody,
      collider: this.playerCollider,
      controller: this.characterController,
    };
  }

  public movePlayer(
    desiredMovement: THREE.Vector3,
    delta: number
  ): { x: number; y: number; z: number } | null {
    if (!this.world || !this.playerBody || !this.playerCollider || !this.characterController) {
      return null;
    }

    this.characterController.computeColliderMovement(this.playerCollider, {
      x: desiredMovement.x,
      y: desiredMovement.y,
      z: desiredMovement.z,
    });

    const computed = this.characterController.computedMovement();
    const currentTranslation = this.playerBody.translation();

    const nextTranslation = {
      x: currentTranslation.x + computed.x,
      y: currentTranslation.y + computed.y,
      z: currentTranslation.z + computed.z,
    };

    nextTranslation.x = Math.max(worldData.bounds.minX + 0.5, Math.min(worldData.bounds.maxX - 0.5, nextTranslation.x));
    nextTranslation.z = Math.max(worldData.bounds.minZ + 0.5, Math.min(worldData.bounds.maxZ - 0.5, nextTranslation.z));

    this.playerBody.setNextKinematicTranslation(nextTranslation);
    this.world.step();

    const baseFeetY = Math.max(0, nextTranslation.y - (0.5 + 0.35));

    return {
      x: nextTranslation.x,
      y: baseFeetY,
      z: nextTranslation.z,
    };
  }

  public teleportPlayer(position: [number, number, number]) {
    if (!this.playerBody) return;
    const playerCenterY = position[1] + 0.5 + 0.35;
    this.playerBody.setTranslation(
      { x: position[0], y: playerCenterY, z: position[2] },
      true
    );
    if (this.world) {
      this.world.step();
    }
  }
}

export const physicsWorld = new PhysicsWorld();
