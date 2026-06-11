import assert from "node:assert/strict";
import { test } from "vitest";
import { Vector3 } from "three";
import {
  skySunAnglesToDirection,
  skySunDirectionToAngles,
} from "../src/scene/SkySunMath";

test("sky sun angle conversion round-trips through a direction vector", () => {
  const angles = { elevation: 55, azimuth: -45 };
  const direction = skySunAnglesToDirection(angles, new Vector3());
  const roundTrip = skySunDirectionToAngles(direction);

  assertAlmostEqual(direction.length(), 1);
  assertAlmostEqual(roundTrip.elevation, angles.elevation);
  assertAlmostEqual(roundTrip.azimuth, angles.azimuth);
});

test("sky sun direction conversion is independent of vector length", () => {
  const angles = skySunDirectionToAngles(new Vector3(2, 2, 0));

  assertAlmostEqual(angles.elevation, 45);
  assertAlmostEqual(angles.azimuth, 90);
});

test("sky sun angle conversion supports below-horizon elevation", () => {
  const angles = { elevation: -20, azimuth: 130 };
  const direction = skySunAnglesToDirection(angles, new Vector3());
  const roundTrip = skySunDirectionToAngles(direction);

  assertAlmostEqual(roundTrip.elevation, angles.elevation);
  assertAlmostEqual(roundTrip.azimuth, angles.azimuth);
});

function assertAlmostEqual(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `Expected ${actual} to be nearly ${expected}.`
  );
}
