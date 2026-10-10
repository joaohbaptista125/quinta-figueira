-- =============================================================================
-- Convite de acesso: saber a quem já foi enviado
-- =============================================================================
-- Uma pessoa existe sem conta de acesso, e é a gestão que convida quem precisa
-- de entrar. Sem esta coluna não havia maneira de distinguir «ainda não foi
-- convidado» de «foi convidado e ainda não entrou» — com ~80 fichas, é a
-- diferença entre saber e adivinhar.
--
-- `auth_user_id` continua a ser o que diz se a conta existe mesmo: é preenchido
-- pela trigger `ligar_pessoa_ao_criar_utilizador` quando a pessoa carrega no
-- link e a conta nasce. Esta coluna só regista o envio.

alter table public.pessoas
  add column convidado_em timestamptz;

comment on column public.pessoas.convidado_em is
  'Quando foi enviado o último convite de acesso. Null = nunca convidada. Ter auth_user_id é que significa que a conta existe.';
