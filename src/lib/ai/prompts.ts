export const ANALYSIS_SYSTEM_PROMPT = `Você é um analista de reuniões experiente. Produza saídas objetivas, em português do Brasil, sem inventar informações. Se algo não foi dito na reunião, deixe o campo vazio, nulo ou com uma lista vazia — nunca invente conteúdo.

Ao escrever "summaryMarkdown" (a ata da reunião), use markdown com as seções:
## Contexto
## Pontos discutidos
## Decisões

Identifique problemas apenas se foram realmente discutidos como problemas (não invente). O plano de ação deve ter itens no imperativo, com responsável quando citado explicitamente na reunião. Prioridade deve refletir a urgência percebida na conversa.`;

export function buildAnalysisUserPrompt(input: {
  projectName: string;
  projectDescription: string | null;
  meetingTitle: string;
  meetingDate: string;
  participants: string[];
  contextNotes: string | null;
  transcript: string;
}) {
  return `Projeto: ${input.projectName}
${input.projectDescription ? `Descrição do projeto: ${input.projectDescription}` : ""}
Reunião: ${input.meetingTitle}
Data: ${input.meetingDate}
${input.participants.length > 0 ? `Participantes: ${input.participants.join(", ")}` : ""}
${input.contextNotes ? `Contexto adicional fornecido pelo usuário: ${input.contextNotes}` : ""}

Transcrição da reunião:
<transcricao>
${input.transcript}
</transcricao>

Analise a transcrição acima e preencha todos os campos solicitados no formato estruturado, em português do Brasil.`;
}

export const FLOWCHART_SYSTEM_PROMPT = `Você gera diagramas Mermaid (flowchart TD) de melhoria de processo a partir de atas de reunião. O diagrama deve representar: estado atual do processo → gargalo/problema identificado → melhoria proposta.

Regras rígidas de sintaxe Mermaid que você DEVE seguir:
- Comece com "flowchart TD".
- IDs de nós curtos (A, B, C... ou N1, N2...).
- Rótulos sempre entre aspas duplas dentro de colchetes: A["texto do nó"].
- Nunca use parênteses, colchetes, ponto e vírgula ou "#" dentro dos rótulos.
- Máximo de 18 nós. Use "subgraph" para separar fases (ex: "Processo atual", "Melhoria proposta").
- Use classDef para destacar problemas e melhorias:
  classDef problema fill:#F3E3DA,stroke:#B3441E
  classDef melhoria fill:#E3EDE8,stroke:#1F4D3D
- Aplique as classes aos nós relevantes com ":::problema" ou ":::melhoria" depois do id do nó.
- Retorne apenas o código Mermaid no campo "mermaid", sem blocos de código markdown (sem \`\`\`).`;

export function buildFlowchartUserPrompt(input: {
  summaryMarkdown: string;
  problems: unknown;
  actionPlan: unknown;
}) {
  return `Ata da reunião:
${input.summaryMarkdown}

Problemas identificados (JSON):
${JSON.stringify(input.problems)}

Plano de ação (JSON):
${JSON.stringify(input.actionPlan)}

Gere um fluxograma de melhoria de processo em Mermaid a partir dessas informações, seguindo rigorosamente as regras de sintaxe.`;
}

export function buildFlowchartRetryPrompt(previousCode: string, validationError: string) {
  return `O código Mermaid a seguir é inválido: ${validationError}

Código anterior:
${previousCode}

Corrija o código seguindo rigorosamente as regras de sintaxe e retorne uma nova versão válida.`;
}
