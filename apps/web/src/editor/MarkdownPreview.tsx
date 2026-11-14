import { Component, useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import type * as Y from "yjs";
import { useY } from "../crdt/hooks";

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

/** Sanitized GitHub-flavoured preview (C3). Scripts and unsafe HTML never run (EC37). */
export default function MarkdownPreview({ ytext }: { ytext: Y.Text }) {
  const live = useY<string>(ytext) ?? "";
  const text = useDebounced(live, live.length > 300_000 ? 500 : 150); // big docs refresh less often (EC31)
  return (
    <div className="prose prose-neutral dark:prose-invert mx-auto h-full max-w-[800px] overflow-auto px-6 pt-2 pb-24 prose-headings:tracking-tight prose-a:text-brand">
      <RawFallback key={text} text={text}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeHighlight]}>
          {text}
        </ReactMarkdown>
      </RawFallback>
    </div>
  );
}
