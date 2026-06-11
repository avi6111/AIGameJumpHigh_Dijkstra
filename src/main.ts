import "./style.css";
import { createApp } from "./app/App";
import { installConsoleWarningFilter } from "./utils/ConsoleWarningFilter";

const uninstallConsoleWarningFilter = installConsoleWarningFilter();

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const statusElement = document.querySelector<HTMLElement>("[data-status]");
const vrmDropOverlay = document.querySelector<HTMLElement>("[data-vrm-drop-overlay]");
if (!canvas) throw new Error("Missing #scene canvas.");

const app = createApp({ canvas, statusElement, vrmDropOverlay });
app.start();

const hot = (
  import.meta as ImportMeta & {
    hot?: { dispose(callback: () => void): void };
  }
).hot;
hot?.dispose(() => {
  app.dispose();
  uninstallConsoleWarningFilter();
});
