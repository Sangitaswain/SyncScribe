import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import JSZip from "jszip";
import type * as Y from "yjs";
import { DOC, WS, docDoc, wsDoc } from "@syncscribe/shared";
import { getDoc, releaseDoc } from "../crdt/registry";
import { resolveTree, type TreeNode } from "../crdt/resolveTree";
import type { TreeItem } from "../crdt/tree";
import { downloadBlob, downloadText } from "../lib/download";
import { assetDataUri, assetOf } from "../crdt/assets";

// Export of documents and whole workspaces; everything happens on the device, so it works offline (J2, EC38)

const titleOf = (doc: Y.Doc) => String(doc.getMap(DOC.meta).get("title") || "Untitled");
const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Untitled";

const STYLE = `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:760px;margin:40px auto;padding:0 16px;
line-height:1.7;color:#121212}pre,code{background:#f6f6f6;border-radius:6px}pre{padding:12px;overflow:auto}
table{border-collapse:collapse}td,th{border:1px solid #e8e8e8;padding:4px 8px}img{max-width:100%}
@media print{body{margin:0}}`;

// Exported pages carry their images inline, so images may be data: URIs here (and only images)
const schema = { ...defaultSchema, protocols: { ...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src ?? []), "data"] } };
const urlTransform = (url: string) => (url.startsWith("data:image/") ? url : defaultUrlTransform(url));

/** A standalone HTML page from markdown, through the same sanitized pipeline as the preview (EC37). */
export function toHtml(title: string, markdown: string, doc?: Y.Doc) {
  // Images stored in the doc become data URIs, so the page works on its own (FP-15.2)
  const withImages = doc ? markdown.replace(/\((asset:[\w-]+)\)/g, (m, src) => (assetOf(doc, src) ? `(${assetDataUri(assetOf(doc, src)!)})` : m)) : markdown;
  const body = renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]} urlTransform={urlTransform}>
      {withImages}
    </ReactMarkdown>,
  );
  const escaped = title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escaped}</title><style>${STYLE}</style></head><body>${body}</body></html>`;
}

export const exportMarkdown = (doc: Y.Doc) => downloadText(`${safeName(titleOf(doc))}.md`, doc.getText(DOC.content).toString());

export const exportHtml = (doc: Y.Doc) =>
  downloadText(`${safeName(titleOf(doc))}.html`, toHtml(titleOf(doc), doc.getText(DOC.content).toString(), doc), "text/html");

/** PDF through the browser's print dialog ("Save as PDF"), from a hidden frame so no window opens. */
export function printPdf(doc: Y.Doc) {
  const frame = Object.assign(document.createElement("iframe"), { srcdoc: toHtml(titleOf(doc), doc.getText(DOC.content).toString(), doc) });
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  frame.onload = () => {
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
  document.body.append(frame);
}

/** Every live document of a workspace as .md files in its folder structure (Trash left out). */
// ponytail: images stay as asset: links in the zip; add an assets/ folder if people export image-heavy docs
export async function workspaceZip(workspaceId: string) {
  const ws = await getDoc(wsDoc(workspaceId));
  const items = [...ws.getMap<Y.Map<unknown>>(WS.items)].map(([id, m]) => ({ id, ...m.toJSON() }) as TreeItem);
  releaseDoc(wsDoc(workspaceId));
  const zip = new JSZip();

  async function add(nodes: TreeNode[], folder: JSZip) {
    const used = new Set<string>();
    const unique = (name: string, ext: string) => {
      let n = name;
      for (let i = 2; used.has(n.toLowerCase()); i++) n = `${name} (${i})`;
      used.add(n.toLowerCase());
      return n + ext;
    };
    for (const { item, children } of nodes) {
      if (item.type === "folder") {
        await add(children, folder.folder(unique(safeName(item.name || "Untitled folder"), ""))!);
        continue;
      }
      const doc = await getDoc(docDoc(item.id));
      folder.file(unique(safeName(titleOf(doc)), ".md"), doc.getText(DOC.content).toString());
      releaseDoc(docDoc(item.id));
    }
  }
  await add(resolveTree(items).roots, zip);
  return zip;
}

export async function exportWorkspace(workspaceId: string, name: string) {
  const zip = await workspaceZip(workspaceId);
  downloadBlob(`${safeName(name)}.zip`, await zip.generateAsync({ type: "blob" }));
}
