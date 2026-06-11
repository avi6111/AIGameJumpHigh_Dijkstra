import * as THREE from "three";
import type { BVHEcctrlState } from "./BVHEcctrlState";
import { isCollisionCheckCollider } from "./ColliderUtils";

export function handleCollisionResponse(
  state: BVHEcctrlState,
  colliderMeshesArray: THREE.Mesh[],
  delta: number
) {
  if (colliderMeshesArray.length === 0) return;
  for (let i = 0; i < state.options.collisionCheckIteration; i++) {
    for (const mesh of colliderMeshesArray) {
      if (mesh instanceof THREE.InstancedMesh) {
        for (let index = 0; index < mesh.count; index++) {
          mesh.getMatrixAt(index, state.instancedContactMatrix);
          collisionCheck(state, mesh, state.instancedContactMatrix, delta);
        }
      } else {
        collisionCheck(state, mesh, mesh.matrixWorld, delta);
      }
    }
  }
}

export function handleFloatingResponse(
  state: BVHEcctrlState,
  colliderMeshesArray: THREE.Mesh[],
  jump: boolean,
  delta: number
) {
  if (colliderMeshesArray.length === 0) return;
  state.globalMinDistance = Infinity;
  state.globalClosestPoint.set(Infinity, Infinity, Infinity);
  state.floatHitMesh = null;

  const useRaycastCheck = () => {
    state.floatRaycastCandidates.length = 0;
    state.floatRaycastHits.length = 0;
    for (const mesh of colliderMeshesArray) {
      if (mesh.geometry.boundsTree && !(mesh instanceof THREE.InstancedMesh)) {
        state.floatRaycastCandidates.push(mesh);
      }
    }
    state.floatRaycaster.set(state.floatSensorSegment.start, state.gravityDir);
    const intersects = state.floatRaycaster.intersectObjects(
      state.floatRaycastCandidates,
      false,
      state.floatRaycastHits
    );
    if (intersects.length === 0) return false;
    const validHit = intersects.find((hit) => {
      if (!hit.normal || !hit.object.visible || hit.object.userData.excludeFloatHit) {
        return false;
      }
      state.floatNormalMatrix.getNormalMatrix(hit.object.matrixWorld);
      state.floatHitNormal
        .copy(hit.normal)
        .applyMatrix3(state.floatNormalMatrix)
        .normalize();
      return state.floatHitNormal.angleTo(state.upAxis) < state.options.maxSlope;
    });
    if (!validHit) return false;

    state.globalMinDistance = validHit.distance;
    state.globalClosestPoint.copy(validHit.point);
    state.floatNormalMatrix.getNormalMatrix(validHit.object.matrixWorld);
    state.floatHitNormal
      .copy(validHit.normal!)
      .applyMatrix3(state.floatNormalMatrix)
      .normalize();
    state.currSlopeAngle = state.floatHitNormal.angleTo(state.upAxis);
    state.groundFriction = validHit.object.userData.friction;
    state.floatHitMesh = validHit.object;
    return true;
  };

  const useShapecastCheck = () => {
    for (const mesh of colliderMeshesArray) {
      if (!mesh.visible || !mesh.geometry.boundsTree || mesh.userData.excludeFloatHit) {
        continue;
      }
      if (mesh instanceof THREE.InstancedMesh) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, state.instancedHitMatrix);
          floatingCheck(state, mesh, state.instancedHitMatrix);
        }
      } else {
        floatingCheck(state, mesh, mesh.matrixWorld);
      }
    }
  };

  switch (state.options.floatCheckType) {
    case "RAYCAST":
      useRaycastCheck();
      break;
    case "SHAPECAST":
      useShapecastCheck();
      break;
    case "BOTH":
      if (!useRaycastCheck()) useShapecastCheck();
      break;
  }

  if (state.globalMinDistance < Infinity) {
    if (state.globalMinDistance < state.options.floatHeight + state.capsuleRadius) {
      state.isOnGround = true;
      state.isFalling = false;
      jump = false;
    }
    if (!jump) {
      state.floatHitVec.subVectors(
        state.floatSensorSegment.start,
        state.globalClosestPoint
      );
      const springDist =
        state.options.floatHeight +
        state.capsuleRadius -
        state.floatHitVec.dot(state.upAxis);
      const springForce = state.options.floatSpringK * springDist;
      const dampingForce =
        state.options.floatDampingC * state.currentLinVel.dot(state.upAxis);
      if (state.isOnGround) {
        state.currentLinVel.addScaledVector(
          state.upAxis,
          ((springForce - dampingForce) * delta) / state.options.mass
        );
      }
    } else {
      state.isOnGround = false;
    }
  } else {
    state.isOnGround = false;
    state.currSlopeAngle = 0;
  }
}

function collisionCheck(
  state: BVHEcctrlState,
  mesh: THREE.Mesh,
  originMatrix: THREE.Matrix4,
  delta: number
) {
  if (!isCollisionCheckCollider(mesh)) return;

  originMatrix.decompose(
    state.contactTempPos,
    state.contactTempQuat,
    state.contactTempScale
  );
  state.collideInvertMatrix.copy(originMatrix).invert();
  state.localCharacterSegment
    .copy(state.characterSegment)
    .applyMatrix4(state.collideInvertMatrix);
  state.scaledContactRadiusVec.set(
    state.capsuleRadius / state.contactTempScale.x,
    state.capsuleRadius / state.contactTempScale.y,
    state.capsuleRadius / state.contactTempScale.z
  );
  state.localCharacterBbox
    .makeEmpty()
    .expandByPoint(state.localCharacterSegment.start)
    .expandByPoint(state.localCharacterSegment.end);
  state.localCharacterBbox.min.addScaledVector(state.scaledContactRadiusVec, -1);
  state.localCharacterBbox.max.add(state.scaledContactRadiusVec);

  state.contactDepth = 0;
  state.contactNormal.set(0, 0, 0);
  state.absorbVel.set(0, 0, 0);
  state.pushBackVel.set(0, 0, 0);
  state.platformVelocityAtContactPoint.set(0, 0, 0);
  state.totalDepth = 0;
  state.triangleCount = 0;
  state.accumulatedContactNormal.set(0, 0, 0);
  state.accumulatedContactPoint.set(0, 0, 0);

  mesh.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(state.localCharacterBbox),
    intersectsTriangle: (tri) => {
      tri.closestPointToSegment(
        state.localCharacterSegment,
        state.triContactPoint,
        state.capsuleContactPoint
      );
      state.deltaDist
        .copy(state.triContactPoint)
        .sub(state.capsuleContactPoint)
        .divide(state.scaledContactRadiusVec);
      if (state.deltaDist.lengthSq() >= 1) return;

      state.triContactPoint.applyMatrix4(originMatrix);
      state.capsuleContactPoint.applyMatrix4(originMatrix);
      state.contactNormal
        .copy(state.capsuleContactPoint)
        .sub(state.triContactPoint)
        .normalize();
      state.contactDepth =
        state.capsuleRadius -
        state.capsuleContactPoint.distanceTo(state.triContactPoint);
      state.accumulatedContactNormal.addScaledVector(
        state.contactNormal,
        state.contactDepth
      );
      state.accumulatedContactPoint.add(state.triContactPoint);
      state.totalDepth += state.contactDepth;
      state.triangleCount += 1;
    },
  });

  if (state.triangleCount === 0) return;
  state.accumulatedContactNormal.normalize();
  state.accumulatedContactPoint.divideScalar(state.triangleCount);
  const avgDepth = state.totalDepth / state.triangleCount;
  updateRelativeCollisionVelocity(state, mesh);

  const intoSurfaceVel = state.relativeCollideVel.dot(
    state.accumulatedContactNormal
  );
  if (intoSurfaceVel < 0) {
    state.absorbVel
      .copy(state.accumulatedContactNormal)
      .multiplyScalar(-intoSurfaceVel * (1 + mesh.userData.restitution));
    state.currentLinVel.add(state.absorbVel);
  }
  if (avgDepth > state.options.collisionPushBackThreshold) {
    const correction = (state.options.collisionPushBackDamping / delta) * avgDepth;
    state.pushBackVel
      .copy(state.accumulatedContactNormal)
      .multiplyScalar(correction);
    state.currentLinVel.add(state.pushBackVel);
  }
}

function floatingCheck(
  state: BVHEcctrlState,
  mesh: THREE.Mesh,
  originMatrix: THREE.Matrix4
) {
  originMatrix.decompose(state.floatTempPos, state.floatTempQuat, state.floatTempScale);
  state.floatInvertMatrix.copy(originMatrix).invert();
  state.floatNormalInverseMatrix.getNormalMatrix(state.floatInvertMatrix);
  state.floatNormalMatrix.getNormalMatrix(originMatrix);
  state.localFloatSensorSegment
    .copy(state.floatSensorSegment)
    .applyMatrix4(state.floatInvertMatrix);
  state.localFloatSensorBboxExpendPoint
    .copy(state.floatSensorBboxExpendPoint)
    .applyMatrix4(state.floatInvertMatrix);
  state.scaledFloatRadiusVec.set(
    state.options.floatSensorRadius / state.floatTempScale.x,
    state.options.floatSensorRadius / state.floatTempScale.y,
    state.options.floatSensorRadius / state.floatTempScale.z
  );
  state.localFloatSensorBbox
    .makeEmpty()
    .expandByPoint(state.localFloatSensorSegment.start)
    .expandByPoint(state.localFloatSensorBboxExpendPoint);
  state.localFloatSensorBbox.min.addScaledVector(state.scaledFloatRadiusVec, -1);
  state.localFloatSensorBbox.max.add(state.scaledFloatRadiusVec);
  state.localMinDistance = Infinity;
  state.localClosestPoint.set(Infinity, Infinity, Infinity);

  mesh.geometry.boundsTree?.shapecast({
    intersectsBounds: (box) => box.intersectsBox(state.localFloatSensorBbox),
    intersectsTriangle: (tri) => {
      tri.closestPointToSegment(
        state.localFloatSensorSegment,
        state.triHitPoint,
        state.segHitPoint
      );
      state.localUpAxis
        .copy(state.upAxis)
        .applyMatrix3(state.floatNormalInverseMatrix)
        .normalize();
      state.deltaHit
        .subVectors(state.triHitPoint, state.localFloatSensorSegment.start)
        .divide(state.scaledFloatRadiusVec);
      const totalLengthSq = state.deltaHit.lengthSq();
      const dot = state.deltaHit.dot(state.localUpAxis);
      const verticalLength =
        Math.abs(dot) /
        ((state.capsuleRadius +
          state.options.floatHeight +
          state.options.floatPullBackHeight) /
          state.options.floatSensorRadius);
      const horizontalLength = Math.sqrt(Math.max(0, totalLengthSq - dot * dot));
      if (horizontalLength >= 1 || verticalLength >= 1) return;

      tri.getNormal(state.triNormal);
      state.triNormal.applyMatrix3(state.floatNormalMatrix).normalize();
      state.triHitPoint.applyMatrix4(originMatrix);
      const slopeAngle = state.triNormal.angleTo(state.upAxis);
      if (verticalLength < state.localMinDistance && slopeAngle < state.options.maxSlope) {
        state.localMinDistance = verticalLength;
        state.localClosestPoint.copy(state.triHitPoint);
        state.localHitNormal.copy(state.triNormal);
      }
    },
  });

  if (state.localMinDistance < state.globalMinDistance) {
    state.globalMinDistance = state.localMinDistance;
    state.globalClosestPoint.copy(state.localClosestPoint);
    state.floatHitNormal.copy(state.localHitNormal);
    state.currSlopeAngle = state.floatHitNormal.angleTo(state.upAxis);
    state.groundFriction = mesh.userData.friction;
    state.floatHitMesh = mesh;
  }
}

function updateRelativeCollisionVelocity(state: BVHEcctrlState, mesh: THREE.Mesh) {
  const isStatic = mesh.userData.type === "STATIC";
  const isKinematic = mesh.userData.type === "KINEMATIC";
  const isActive = mesh.userData.active === true;
  if (isStatic || (isKinematic && !isActive)) {
    state.relativeCollideVel.copy(state.currentLinVel);
    return;
  }
  if (!isKinematic || !isActive) return;

  state.relativeContactPoint
    .copy(state.accumulatedContactPoint)
    .sub(mesh.userData.center);
  state.contactPointRotationalVel.crossVectors(
    mesh.userData.angularVelocity,
    state.relativeContactPoint
  );
  state.platformVelocityAtContactPoint
    .copy(mesh.userData.linearVelocity)
    .add(state.contactPointRotationalVel);
  state.relativeCollideVel
    .copy(state.currentLinVel)
    .sub(state.platformVelocityAtContactPoint);
}
