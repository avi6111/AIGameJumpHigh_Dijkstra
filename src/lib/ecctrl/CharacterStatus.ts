import * as THREE from "three";
import type { CharacterStatus } from "./Types";

export const characterStatus: CharacterStatus = {
  position: new THREE.Vector3(),
  linvel: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  inputDir: new THREE.Vector3(),
  movingDir: new THREE.Vector3(),
  isOnGround: false,
  isOnMovingPlatform: false,
  animationStatus: "IDLE",
};
