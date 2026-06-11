import * as THREE from "three";
import type { CharacterAnimationStatus, ResolvedEcctrlOptions } from "./Types";

export class BVHEcctrlState {
  readonly group = new THREE.Group();
  readonly model = new THREE.Group();
  options: ResolvedEcctrlOptions;

  capsuleRadius: number;
  capsuleLength: number;
  elapsedTime = 0;
  idleTime = 0;
  isSleeping = false;
  isFalling = false;
  isOnGround = false;
  prevIsOnGround = false;
  isOnMovingPlatform = false;
  prevAnimation: CharacterAnimationStatus = "IDLE";

  readonly upAxis = new THREE.Vector3(0, 1, 0);
  readonly localUpAxis = new THREE.Vector3();
  readonly gravityDir = new THREE.Vector3(0, -1, 0);
  readonly currentLinVel = new THREE.Vector3();
  readonly currentLinVelOnPlane = new THREE.Vector3();
  readonly camProjDir = new THREE.Vector3();
  readonly camRightDir = new THREE.Vector3();
  readonly inputDir = new THREE.Vector3();
  readonly inputDirOnPlane = new THREE.Vector3();
  readonly movingDir = new THREE.Vector3();
  readonly deltaLinVel = new THREE.Vector3();
  readonly wantToMoveVel = new THREE.Vector3();
  readonly joystickState = new THREE.Vector2();
  readonly characterModelTargetQuat = new THREE.Quaternion();
  readonly characterModelLookMatrix = new THREE.Matrix4();
  readonly characterOrigin = new THREE.Vector3();

  forwardState = false;
  backwardState = false;
  leftwardState = false;
  rightwardState = false;
  runState = false;
  jumpState = false;

  contactDepth = 0;
  totalDepth = 0;
  triangleCount = 0;
  readonly contactNormal = new THREE.Vector3();
  readonly triContactPoint = new THREE.Vector3();
  readonly capsuleContactPoint = new THREE.Vector3();
  readonly accumulatedContactNormal = new THREE.Vector3();
  readonly accumulatedContactPoint = new THREE.Vector3();
  readonly absorbVel = new THREE.Vector3();
  readonly pushBackVel = new THREE.Vector3();
  readonly characterBbox = new THREE.Box3();
  readonly characterSegment = new THREE.Line3();
  readonly localCharacterBbox = new THREE.Box3();
  readonly localCharacterSegment = new THREE.Line3();
  readonly collideInvertMatrix = new THREE.Matrix4();
  readonly relativeCollideVel = new THREE.Vector3();
  readonly relativeContactPoint = new THREE.Vector3();
  readonly contactPointRotationalVel = new THREE.Vector3();
  readonly platformVelocityAtContactPoint = new THREE.Vector3();
  readonly instancedContactMatrix = new THREE.Matrix4();
  readonly contactTempPos = new THREE.Vector3();
  readonly contactTempQuat = new THREE.Quaternion();
  readonly contactTempScale = new THREE.Vector3();
  readonly scaledContactRadiusVec = new THREE.Vector3();
  readonly deltaDist = new THREE.Vector3();

  currSlopeAngle = 0;
  localMinDistance = Infinity;
  globalMinDistance = Infinity;
  groundFriction = 0.8;
  floatHitMesh: THREE.Object3D | THREE.Mesh | null = null;
  readonly localClosestPoint = new THREE.Vector3();
  readonly localHitNormal = new THREE.Vector3();
  readonly triNormal = new THREE.Vector3();
  readonly globalClosestPoint = new THREE.Vector3();
  readonly triHitPoint = new THREE.Vector3();
  readonly segHitPoint = new THREE.Vector3();
  readonly floatHitVec = new THREE.Vector3();
  readonly floatHitNormal = new THREE.Vector3();
  readonly floatSensorBbox = new THREE.Box3();
  readonly floatSensorBboxExpendPoint = new THREE.Vector3();
  readonly floatSensorSegment = new THREE.Line3();
  readonly localFloatSensorBbox = new THREE.Box3();
  readonly localFloatSensorBboxExpendPoint = new THREE.Vector3();
  readonly localFloatSensorSegment = new THREE.Line3();
  readonly floatInvertMatrix = new THREE.Matrix4();
  readonly floatNormalInverseMatrix = new THREE.Matrix3();
  readonly floatNormalMatrix = new THREE.Matrix3();
  readonly floatRaycaster = new THREE.Raycaster();
  readonly floatRaycastCandidates: THREE.Mesh[] = [];
  readonly floatRaycastHits: THREE.Intersection[] = [];
  readonly relativeHitPoint = new THREE.Vector3();
  readonly rotationDeltaPos = new THREE.Vector3();
  readonly yawQuaternion = new THREE.Quaternion();
  readonly totalPlatformDeltaPos = new THREE.Vector3();
  readonly instancedHitMatrix = new THREE.Matrix4();
  readonly floatTempPos = new THREE.Vector3();
  readonly floatTempQuat = new THREE.Quaternion();
  readonly floatTempScale = new THREE.Vector3();
  readonly scaledFloatRadiusVec = new THREE.Vector3();
  readonly deltaHit = new THREE.Vector3();
  debugObjects: ControllerDebugObjects | null = null;

  constructor(options: ResolvedEcctrlOptions) {
    this.options = options;
    this.model.name = "BVHEcctrl-Model";
    this.group.add(this.model);
    this.capsuleRadius = options.colliderCapsuleArgs[0];
    this.capsuleLength = options.colliderCapsuleArgs[1];
    this.refreshDerivedOptions();
  }

  refreshDerivedOptions() {
    this.capsuleRadius = this.options.colliderCapsuleArgs[0];
    this.capsuleLength = this.options.colliderCapsuleArgs[1];
    this.floatRaycaster.far =
      this.capsuleRadius +
      this.options.floatHeight +
      this.options.floatPullBackHeight;
  }
}

export interface ControllerDebugObjects {
  owner: THREE.Object3D;
  capsuleArgsKey: string;
  root: THREE.Group;
  capsule: THREE.Mesh;
  lineStart: THREE.Mesh;
  lineEnd: THREE.Mesh;
  rayStart: THREE.Mesh;
  rayEnd: THREE.Mesh;
  standPoint: THREE.Mesh;
  lookDir: THREE.Mesh;
  inputDir: THREE.ArrowHelper;
  moveDir: THREE.ArrowHelper;
  characterBox: THREE.Box3Helper;
  sensorBox: THREE.Box3Helper;
}
