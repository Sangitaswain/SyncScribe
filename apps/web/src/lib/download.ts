/** Saves a file through the browser's download (works offline). */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const downloadText = (filename: string, text: string, type = "text/markdown") =>
  downloadBlob(filename, new Blob([text], { type }));
