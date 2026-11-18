/** Markdown headings with their position in the text, for the table of contents (C13). Skips code blocks. */
export function headingsOf(markdown: string) {
  const found: { level: number; text: string; from: number }[] = [];
  let inCode = false;
  let at = 0;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
    const m = !inCode && line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) found.push({ level: m[1].length, text: m[2], from: at });
    at += line.length + 1;
  }
  return found;
}
