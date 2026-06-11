import * as THREE from "three/webgpu";
import { isCollisionCheckCollider } from "../lib/ecctrl/ColliderUtils";

export interface CameraCollisionScratch {
  raycaster: THREE.Raycaster;
  hits: THREE.Intersection[];
  probePoints: THREE.Vector3[];
  forward: THREE.Vector3;
  viewDir: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  nearCenter: THREE.Vector3;
}

export function resolveCameraCollisionDistance(
  raycaster: THREE.Raycaster,
  hits: THREE.Intersection[],
  target: THREE.Vector3,
  desiredPosition: THREE.Vector3,
  desiredDistance: number,
  padding: number,
  colliders: readonly THREE.Mesh[],
  probePoints: readonly THREE.Vector3[] = [desiredPosition]
) {
  if (desiredDistance <= 1e-5 || colliders.length === 0) {
    return desiredDistance;
  }

  raycaster.near = 0;
  hits.length = 0;
  let closestDistance = desiredDistance;
  for (const probePoint of probePoints) {
    const probeDistance = probePoint.distanceTo(target);
    if (probeDistance <= 1e-5) continue;
    raycaster.far = probeDistance;
    raycaster.ray.origin.copy(target);
    raycaster.ray.direction.subVectors(probePoint, target).normalize();
    for (const mesh of colliders) {
      if (!isCollisionCheckCollider(mesh)) continue;
      raycaster.intersectObject(mesh, false, hits);
      for (const hit of hits) {
        if (hit.distance > 1e-5) {
          const centerDistance =
            (Math.max(0, hit.distance - Math.max(0, padding)) /
              probeDistance) *
            desiredDistance;
          closestDistance = Math.min(closestDistance, centerDistance);
        }
      }
      hits.length = 0;
    }
  }
  if (closestDistance >= desiredDistance) return desiredDistance;
  return closestDistance;
}

export function createCameraCollisionScratch(): CameraCollisionScratch {
  const raycaster = new THREE.Raycaster() as THREE.Raycaster & {
    firstHitOnly?: boolean;
  };
  raycaster.firstHitOnly = true;
  return {
    raycaster,
    hits: [],
    probePoints: Array.from({ length: 5 }, () => new THREE.Vector3()),
    forward: new THREE.Vector3(),
    viewDir: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    nearCenter: new THREE.Vector3(),
  };
}

export function updateCameraCollisionProbePoints(
  scratch: CameraCollisionScratch,
  target: THREE.Vector3,
  desiredPosition: THREE.Vector3,
  desiredDistance: number,
  camera: THREE.PerspectiveCamera
) {
  const [center, topLeft, topRight, bottomLeft, bottomRight] =
    scratch.probePoints;
  center.copy(desiredPosition);
  if (desiredDistance <= camera.near) {
    topLeft.copy(center);
    topRight.copy(center);
    bottomLeft.copy(center);
    bottomRight.copy(center);
    return;
  }

  scratch.forward.subVectors(desiredPosition, target).normalize();
  scratch.viewDir.copy(scratch.forward).multiplyScalar(-1);
  scratch.right.crossVectors(scratch.viewDir, camera.up);
  if (scratch.right.lengthSq() <= 1e-8) {
    scratch.right.set(1, 0, 0);
  } else {
    scratch.right.normalize();
  }
  scratch.up.crossVectors(scratch.right, scratch.viewDir).normalize();

  const halfHeight =
    camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
  const halfWidth = halfHeight * camera.aspect;
  const nearCenterDistance = desiredDistance - camera.near;
  scratch.nearCenter
    .copy(scratch.forward)
    .multiplyScalar(nearCenterDistance)
    .add(target);

  topLeft
    .copy(scratch.nearCenter)
    .addScaledVector(scratch.right, -halfWidth)
    .addScaledVector(scratch.up, halfHeight);
  topRight
    .copy(scratch.nearCenter)
    .addScaledVector(scratch.right, halfWidth)
    .addScaledVector(scratch.up, halfHeight);
  bottomLeft
    .copy(scratch.nearCenter)
    .addScaledVector(scratch.right, -halfWidth)
    .addScaledVector(scratch.up, -halfHeight);
  bottomRight
    .copy(scratch.nearCenter)
    .addScaledVector(scratch.right, halfWidth)
    .addScaledVector(scratch.up, -halfHeight);
}
