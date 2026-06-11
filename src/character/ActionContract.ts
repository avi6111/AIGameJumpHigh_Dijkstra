export const punchButtonId = "punch";
export const punchMinIntervalSeconds = 0.5;

export function shouldStartPunchAction(
  currentTime: number,
  nextAllowedTime: number,
  punchPlaying: boolean
) {
  return !punchPlaying && currentTime >= nextAllowedTime;
}
