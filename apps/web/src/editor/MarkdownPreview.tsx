import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import type * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { useY } from "../crdt/hooks";
import { assetOf } from "../crdt/assets";

/** If rendering ever fails, show the raw text instead of an error page (EC33). */
class RawFallback extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render() {
    return this.state.failed ? <pre className="whitespace-pre-wrap">{this.props.text}</pre> : this.props.children;
  }
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Images may also point at the doc's own stored images (asset:id); nothing else is added to what's allowed. */
export const schema = { ...defaultSchema, protocols: { ...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src ?? []), "asset"] } };
export const urlTransform = (url: string) => (url.startsWith("asset:") ? url : defaultUrlTransform(url));

/** An image stored in the document, shown from the device; a placeholder if it isn't here (C10, EC38). */
function DocImage({ doc, src, alt }: { doc: Y.Doc | null; src?: string; alt?: string }) {
  const asset = doc && src ? assetOf(doc, src) : undefined;
  const url = useMemo(() => (asset ? URL.createObjectURL(new Blob([asset.data as Uint8Array<ArrayBuffer>], { type: asset.mime })) : src), [asset, src]);
  useEffect(() => () => void (asset && url && URL.revokeObjectURL(url)), [asset, url]);
  if (src?.startsWith("asset:") && !asset) return <span className="text-muted">[Image not available on this device]</span>;
  return <img src={url} alt={alt ?? ""} />;
}

/** Sanitized GitHub-flavoured preview (C3). Scripts and unsafe HTML never run (EC37). */
export default function MarkdownPreview({ ytext }: { ytext: Y.Text }) {
  const live = useY<string>(ytext) ?? "";
  useY(ytext.doc?.getMap(DOC.assets)); // re-render when images arrive (they can sync after the text)
  const text = useDebounced(live, live.length > 300_000 ? 500 : 150); // big docs refresh less often (EC31)
  return (
    <div className="prose prose-neutral dark:prose-invert mx-auto h-full max-w-[800px] overflow-auto px-6 pt-2 pb-24 prose-headings:tracking-tight prose-a:text-brand">
      <RawFallback key={text} text={text}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, schema], rehypeHighlight]}
          urlTransform={urlTransform}
          components={{ img: ({ src, alt }) => <DocImage doc={ytext.doc} src={typeof src === "string" ? src : undefined} alt={alt} /> }}
        >
          {text}
        </ReactMarkdown>
      </RawFallback>
    </div>
  );
}
