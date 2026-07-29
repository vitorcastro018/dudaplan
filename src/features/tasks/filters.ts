/**
 * Valor do filtro que representa "tarefas soltas, sem projeto".
 *
 * Mora aqui, e não em `@/lib/data/tasks`, porque a tela de tarefas é um Client
 * Component e precisa da constante. Aquele módulo importa o cliente Supabase do
 * servidor, e importar um *valor* de lá arrastaria o módulo inteiro para o
 * bundle do navegador — o build falha com "server-only in Client Component".
 * Tipo pode vir de lá (`import type` é apagado na compilação); valor, não.
 */
export const NO_PROJECT = "sem-projeto";
