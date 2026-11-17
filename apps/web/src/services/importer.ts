import { newDocument } from "../crdt/actions";

// Import of .md / .txt files as new documents; works offline (J1, EC35)

const TEXT_FILE = /\.(md|markdown|txt)$/i;

export interface ImportResult {
  imported: string[]; // new doc ids
  failed: { name: string; reason: string }[];
}

/** Imports each file on its own, so one bad file doesn't stop the rest. */
export async function importFiles(files: File[], workspaceId: string, parentId: string | null = null): Promise<ImportResult> {
  const result: ImportResult = { imported: [], failed: [] };
  for (const file of files) {
    if (!TEXT_FILE.test(file.name)) {
      result.failed.push({ name: file.name, reason: "is not a .md or .txt file" });
      continue;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      result.failed.push({ name: file.name, reason: "couldn't be read" });
      continue;
    }
    if (text.includes("\u0000")) {
      result.failed.push({ name: file.name, reason: "isn't a text file" }); // binary or corrupted
      continue;
    }
    result.imported.push(await newDocument(workspaceId, parentId, text, file.name.replace(TEXT_FILE, "")));
  }
  return result;
}
