const suppressedWarnings = new Set([
  'THREE.TSL: "transformedNormalView" is deprecated. Use "normalView" instead.',
  'TSL: "transformedNormalView" is deprecated. Use "normalView" instead.',
]);

type WarningFilterGlobal = typeof globalThis & {
  __consoleWarningFilterRestore?: () => void;
};

export function installConsoleWarningFilter() {
  const scope = globalThis as WarningFilterGlobal;
  if (scope.__consoleWarningFilterRestore) {
    return scope.__consoleWarningFilterRestore;
  }

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args[0];
    if (typeof message === "string" && suppressedWarnings.has(message)) return;
    originalWarn.apply(console, args);
  };

  const filteredWarn = console.warn;
  const restore = () => {
    if (console.warn === filteredWarn) console.warn = originalWarn;
    delete scope.__consoleWarningFilterRestore;
  };
  scope.__consoleWarningFilterRestore = restore;
  return restore;
}
