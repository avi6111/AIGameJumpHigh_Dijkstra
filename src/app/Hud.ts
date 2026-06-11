const HUD_UPDATE_INTERVAL = 0.12;

export interface Hud {
  setStatusText(statusText: string): void;
  update(elapsed: number, createStatusText: () => string): void;
}

export function createHud(statusElement: HTMLElement | null): Hud {
  let nextUpdateTime = 0;
  let lastStatusText = "";

  const setStatusText = (statusText: string) => {
    if (!statusElement || statusText === lastStatusText) return;
    statusElement.textContent = statusText;
    lastStatusText = statusText;
  };

  return {
    setStatusText,
    update(elapsed, createStatusText) {
      if (!statusElement || elapsed < nextUpdateTime) return;
      nextUpdateTime = elapsed + HUD_UPDATE_INTERVAL;
      setStatusText(createStatusText());
    },
  };
}
