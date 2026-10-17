"use client";

import * as React from "react";

/** As cores do tema do app (globals.css) aplicadas ao Mermaid. */
const THEME = {
  background: "transparent",
  primaryColor: "#2b1f57",
  primaryTextColor: "#f1eefb",
  primaryBorderColor: "#43376e",
  lineColor: "#8a81b0",
  edgeLabelBackground: "#1b1530",
  tertiaryColor: "#1b1530",
  fontFamily: "inherit",
  fontSize: "13px",
};

const CLASS_DEFS = [
  "classDef normal fill:#2b1f57,stroke:#43376e,color:#f1eefb",
  "classDef problem fill:#3d2030,stroke:#ff7a59,color:#ffb4a0,stroke-width:2px",
  "classDef new fill:#12372b,stroke:#5fd8a4,color:#a8f0d0,stroke-width:2px",
  "classDef automated fill:#3b2a8a,stroke:#b79cff,color:#e6dcff,stroke-width:2px",
  "classDef changed fill:#3a2e12,stroke:#f2c14e,color:#f8dd8f,stroke-width:2px",
];

let initialized = false;

/**
 * Desenha um diagrama Mermaid. O Mermaid é pesado e só roda no navegador, então
 * é carregado sob demanda. Se o desenho falhar, mostra o aviso em vez de quebrar a tela.
 */
export function ProcessDiagram({ definition }: { definition: string }) {
  const id = React.useId().replace(/:/g, "");
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        if (!initialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            themeVariables: THEME,
            securityLevel: "strict",
            flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
          });
          initialized = true;
        }
        const result = await mermaid.render(`mmd-${id}`, `${definition}\n${CLASS_DEFS.join("\n")}`);
        if (!cancelled) {
          setSvg(result.svg);
          setFailed(false);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [definition, id]);

  if (failed) {
    return <p className="text-ink-muted text-sm">Não foi possível desenhar este diagrama.</p>;
  }
  if (!svg) {
    return <div className="bg-paper-sunk h-48 animate-pulse rounded-[var(--radius)]" />;
  }
  return (
    <div
      className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
