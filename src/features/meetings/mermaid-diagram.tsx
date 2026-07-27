"use client";

import * as React from "react";

export function MermaidDiagram({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const rawId = React.useId();
  const idRef = React.useRef(`mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`);

  React.useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "var(--font-sans)",
            primaryColor: "#F3E3DA",
            primaryTextColor: "#14140F",
            primaryBorderColor: "#B3441E",
            lineColor: "#6E6A5F",
            secondaryColor: "#E3EDE8",
            tertiaryColor: "#F7F4EE",
          },
        });

        await mermaid.parse(code);
        const { svg } = await mermaid.render(idRef.current, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Não foi possível renderizar o diagrama.");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div>
        <p className="text-danger mb-2 text-sm">{error}</p>
        <pre className="bg-paper-sunk text-ink-2 overflow-x-auto rounded-[var(--radius-sm)] p-3 font-mono text-xs">
          {code}
        </pre>
      </div>
    );
  }

  return <div ref={containerRef} className="overflow-x-auto" />;
}
