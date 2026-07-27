import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm text-ink max-w-none",
        "prose-headings:font-display prose-headings:font-medium prose-headings:text-ink",
        "prose-p:text-ink-2 prose-li:text-ink-2 prose-strong:text-ink",
        "prose-a:text-accent prose-code:text-ink prose-code:before:content-none prose-code:after:content-none",
        "prose-blockquote:border-l-accent prose-blockquote:text-ink-muted",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
