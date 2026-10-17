-- Resumo e transcrição gerados por IA a partir do áudio da reunião. Ficam na
-- própria reunião: o resumo é gerado uma vez e reaberto de graça depois.
alter table meetings add column transcript text;
alter table meetings add column summary text;
alter table meetings add column summarized_at timestamptz;
