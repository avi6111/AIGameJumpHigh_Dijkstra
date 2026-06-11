import assert from "node:assert/strict";
import { test } from "vitest";
import {
  punchMinIntervalSeconds,
  shouldStartPunchAction,
} from "../src/character/ActionContract";

test("punch action requires the configured interval", () => {
  assert.equal(punchMinIntervalSeconds, 0.5);
  assert.equal(shouldStartPunchAction(1, 1, false), true);
  assert.equal(shouldStartPunchAction(1.49, 1.5, false), false);
});

test("punch action does not restart while the previous punch is playing", () => {
  assert.equal(shouldStartPunchAction(2, 1.5, true), false);
});
