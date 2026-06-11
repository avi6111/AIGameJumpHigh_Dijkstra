export function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function scheduleAfterNextFrame(task: () => void) {
  const frame = requestAnimationFrame(task);
  return () => cancelAnimationFrame(frame);
}
