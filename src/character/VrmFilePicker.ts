export function openVrmFilePicker(onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".vrm";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  });
  input.click();
}
