-- Turno e link nas rotinas; anotações nas reuniões.
--
-- `shift` é o turno do dia em que a rotina acontece, e a tela de rotinas passa
-- a agrupar a lista por ele. Entra anulável de propósito: rotina sem hora
-- marcada é caso comum ("beber água", "revisar o inbox"), e exigir turno
-- obrigaria a inventar um. As linhas sem turno caem num bloco próprio na tela.
--
-- `target_time` continua existindo e não é substituída por `shift`: uma guarda
-- um horário exato, a outra uma faixa do dia. Quem quiser as duas coisas pode
-- preencher as duas.
--
-- `link` guarda o endereço que a rotina abre — a pauta no Notion, o painel que
-- se confere de manhã, a planilha que se preenche à noite. Sem CHECK de formato
-- aqui: a validação de esquema (só `http` e `https`, que é o que impede um
-- `javascript:` colado no campo de virar XSS quando renderizado num `<a href>`)
-- mora no Zod, em `src/lib/validation/routines.ts`, onde a mensagem de erro
-- pode explicar o que fazer. Um CHECK devolveria "violates check constraint"
-- e não ajudaria ninguém.
--
-- `meetings.notes` é o campo de anotações da reunião — texto livre, escrito à
-- mão durante ou depois do encontro. Fica separado de `agenda` (o que se
-- pretendia discutir, planejado antes) e de `objective` (por que a reunião
-- existe): as três respondem perguntas diferentes e sobrescrever uma com a
-- outra perderia informação. `text` e não `jsonb` porque é prosa, renderizada
-- como Markdown na tela; não há estrutura para consultar.

alter table routines
  add column link  text,
  add column shift text check (shift is null or shift in ('morning','afternoon','night'));

alter table meetings
  add column notes text;
