-- Diagnóstico de gargalos gerado por IA a partir da transcrição: problemas do
-- processo, cada um com o trecho da conversa que o sustenta. Fica na própria
-- reunião, como o resumo: gerado uma vez, reaberto de graça depois.
alter table meetings add column diagnosis jsonb;
alter table meetings add column diagnosed_at timestamptz;
