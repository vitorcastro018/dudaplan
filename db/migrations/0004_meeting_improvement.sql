-- Sugestão de melhoria de processo gerada por IA a partir da transcrição da
-- reunião: processo atual, processo sugerido e lista de mudanças, em JSON. Fica
-- na própria reunião, como o resumo: gerada uma vez, reaberta de graça depois.
alter table meetings add column improvement jsonb;
alter table meetings add column improved_at timestamptz;
