interface VrmDropTargetOptions {
  overlay: HTMLElement | null;
  onFile(file: File): void;
  onInvalidDrop(): void;
}

export function createVrmDropTarget(options: VrmDropTargetOptions) {
  let dragDepth = 0;

  const onDragEnter = (event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth += 1;
    setOverlayActive(options.overlay, true);
  };

  const onDragOver = (event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: DragEvent) => {
    if (dragDepth === 0 && !isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setOverlayActive(options.overlay, false);
  };

  const onDrop = (event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = 0;
    setOverlayActive(options.overlay, false);
    const file = findVrmFile(event.dataTransfer?.files);
    if (file) {
      options.onFile(file);
      return;
    }
    options.onInvalidDrop();
  };

  window.addEventListener("dragenter", onDragEnter);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);

  return {
    dispose() {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      setOverlayActive(options.overlay, false);
    },
  };
}

function findVrmFile(files?: FileList | null) {
  if (!files) return null;
  return Array.from(files).find((file) => file.name.toLowerCase().endsWith(".vrm")) ?? null;
}

function isFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

function setOverlayActive(overlay: HTMLElement | null, active: boolean) {
  overlay?.toggleAttribute("data-active", active);
  overlay?.setAttribute("aria-hidden", active ? "false" : "true");
}
