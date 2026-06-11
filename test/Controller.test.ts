import assert from "node:assert/strict";
import { test } from "vitest";
import { isMousePunchClick } from "../src/app/Controller";

test("mouse punch accepts a left click without drag", () => {
  assert.equal(
    isMousePunchClick(
      { button: 0, x: 100, y: 100 },
      { button: 0, clientX: 103, clientY: 104 }
    ),
    true
  );
});

test("mouse punch rejects camera drag movement", () => {
  assert.equal(
    isMousePunchClick(
      { button: 0, x: 100, y: 100 },
      { button: 0, clientX: 120, clientY: 100 }
    ),
    false
  );
});

test("mouse punch requires a left-button press and release", () => {
  assert.equal(
    isMousePunchClick(null, { button: 0, clientX: 100, clientY: 100 }),
    false
  );
  assert.equal(
    isMousePunchClick(
      { button: 2, x: 100, y: 100 },
      { button: 0, clientX: 100, clientY: 100 }
    ),
    false
  );
  assert.equal(
    isMousePunchClick(
      { button: 0, x: 100, y: 100 },
      { button: 2, clientX: 100, clientY: 100 }
    ),
    false
  );
});
