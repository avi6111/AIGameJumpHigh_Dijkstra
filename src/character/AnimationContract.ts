import type { CharacterAnimationStatus } from "../lib/ecctrl/index";

export const punchActionName = "Punch_Jab";

export const statusToActionMap = {
  IDLE: "Idle_Loop",
  WALK: "Walk_Loop",
  RUN: "Jog_Fwd_Loop",
  JUMP_START: "Jump_Start",
  JUMP_IDLE: "Jump_Loop",
  JUMP_FALL: "Jump_Loop",
  JUMP_LAND: "Jump_Land",
} as const satisfies Record<CharacterAnimationStatus, string>;

export const requiredAnimationClipNames = Array.from(
  new Set([...Object.values(statusToActionMap), punchActionName])
);
