# Quinta da Figueira

Aplicação de gestão do centro hípico Quinta da Figueira: cavalos, pessoas,
boxes, contratos de penso, despesas, recebimentos e pensos do mês.

Next.js (App Router) + Supabase + Vercel. Interface toda em português de
Portugal, moeda EUR, datas DD/MM/AAAA. Instalável como PWA.

> **A aplicação não emite documentos fiscais.** Em Portugal isso exige software
> certificado pela AT. Aqui registam-se pagamentos; o recibo continua a ser
> emitido no software de facturação. Ver `CLAUDE.md`, secção 1.

## Arrancar em desenvolvimento

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem chaves reais a aplicação arranca à mesma e mostra as instruções de
configuração em vez de rebentar.

## Ligar ao Supabase

1. Criar um projecto em [supabase.com](https://supabase.com) (região Frankfurt
   ou Londres, para latência e RGPD).
2. Copiar de **Project Settings → API** para `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Aplicar as migrações de `supabase/migrations/` por ordem alfabética. O CLI
   do Supabase já é uma dependência do projecto e `supabase/config.toml` está
   no repositório:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```

   Em alternativa, colar cada ficheiro no **SQL Editor** do painel, pela mesma
   ordem. As categorias de despesa e os dois buckets de Storage são criados
   pelas migrações — não é preciso criá-los à mão.

   **Nunca correr `supabase/seed.sql` em produção**: são dados de
   demonstração. O `db push` não lhe toca; só o `supabase db reset` local o usa.
4. Em **Authentication → URL Configuration**, definir o *Site URL* e acrescentar
   `https://<dominio>/auth/callback` aos *Redirect URLs*.
5. Abrir a aplicação, criar a conta pelo convite do Supabase
   (**Authentication → Users → Invite**) e visitar `/primeiro-acesso` para ficar
   como administrador.

A partir daí a gestão cria as fichas de pessoas com o respectivo email; quando
essas pessoas forem convidadas, a conta liga-se sozinha à ficha.

## Publicar na Vercel

1. Importar o repositório na Vercel (detecta Next.js sem configuração).
2. Em **Settings → Environment Variables**, definir `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview e Development).
3. Opcionalmente `NEXT_PUBLIC_SITE_URL` com o domínio final. Se ficar em branco,
   é deduzido dos cabeçalhos do pedido.
4. **Voltar a fazer deploy.** As variáveis `NEXT_PUBLIC_*` são fixadas no
   momento da compilação, incluindo no middleware — defini-las sem recompilar
   não tem efeito nenhum, e a aplicação continua a mostrar a página de
   instruções. Na Vercel: **Deployments → … → Redeploy**.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | compila e verifica os tipos |
| `npm run lint` | ESLint |
| `./scripts/validar-esquema.sh` | aplica as migrações a um PostgreSQL descartável e corre os testes de RLS |
| `node scripts/gerar-icones.mjs` | regenera os ícones da PWA |

`validar-esquema.sh` precisa de um PostgreSQL ≥ 15 instalado localmente. Não usa
Docker nem rede.

## Documentação

`CLAUDE.md` tem a arquitectura, o modelo de dados, as decisões estruturantes e
o que fica para as fases seguintes.
