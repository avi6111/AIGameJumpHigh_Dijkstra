import { MathUtils, Vector3 } from "three";

const MIN_DIRECTION_LENGTH = 1e-8;

export interface SkySunAngles {
  elevation: number;
  azimuth: number;
}

export function skySunAnglesToDirection(
  { elevation, azimuth }: SkySunAngles,
  target = new Vector3()
) {
  const phi = MathUtils.degToRad(90 - elevation);
  const theta = MathUtils.degToRad(azimuth);
  return target.setFromSphericalCoords(1, phi, theta);
}

export function skySunDirectionToAngles(direction: Vector3): SkySunAngles {
  const length = direction.length();
  if (length <= MIN_DIRECTION_LENGTH) return { elevation: 90, azimuth: 0 };
  const elevation = MathUtils.radToDeg(
    Math.asin(MathUtils.clamp(direction.y / length, -1, 1))
  );
  const azimuth = MathUtils.radToDeg(Math.atan2(direction.x, direction.z));
  return { elevation, azimuth };
}
