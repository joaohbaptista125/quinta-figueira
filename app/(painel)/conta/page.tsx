import type { Metadata } from 'next'
import { exigirPessoa, obterOrigem } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { SubscreverCalendario } from '@/components/subscrever-calendario'
import { ActivarNotificacoes } from '@/components/activar-notificacoes'
import { FormularioDefinirPassword } from '@/app/(publico)/definir-password/formulario'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  TituloCartao,
} from '@/components/ui/superficie'
import { ROTULOS_PAPEL, ROTULOS_PERFIL } from '@/lib/rotulos'
import type { PapelPessoa } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'A minha conta' }

export default async function PaginaConta() {
  const sessao = await exigirPessoa()
  const supabase = await criarClienteServidor()
  const origem = await obterOrigem()

  const [ficha, calendario] = await Promise.all([
    supabase
      .from('pessoas')
      .select('nome, email, telefone, pessoa_papeis(papel)')
      .eq('id', sessao.id)
      .maybeSingle(),
    supabase.from('calendarios').select('token').maybeSingle(),
  ])

  const papeis = ((ficha.data?.pessoa_papeis ?? []) as { papel: PapelPessoa }[])
    .map((relacao) => ROTULOS_PAPEL[relacao.papel])

  // A chave pública das notificações é mesmo pública: é com ela que o
  // browser identifica quem tem direito a mandar avisos para este aparelho.
  // Sem ela configurada, o cartão explica-se e não mostra botão nenhum.
  const chaveVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ''

  return (
    <>
      <CabecalhoPagina
        titulo="A minha conta"
        descricao={sessao.email ?? undefined}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao className="h-fit">
          <CabecalhoCartao>
            <TituloCartao>{ficha.data?.nome ?? sessao.nome}</TituloCartao>
            <DescricaoCartao>
              Para corrigir estes dados, fale com a gestão do centro.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Perfil de acesso</dt>
                <dd>
                  {sessao.perfil ? ROTULOS_PERFIL[sessao.perfil] : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Telefone</dt>
                <dd>{ficha.data?.telefone ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Papéis no centro</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {papeis.length > 0 ? (
                    papeis.map((papel) => (
                      <Distintivo key={papel} cor="primario">
                        {papel}
                      </Distintivo>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </dd>
              </div>
            </dl>
          </ConteudoCartao>
        </Cartao>

        {/*
          Quem entrou pela primeira vez por um link de convite não tem
          palavra-passe nenhuma: sem isto, só conseguiria voltar a entrar
          pedindo outro link de cada vez.
        */}
        <FormularioDefinirPassword
          titulo="Palavra-passe"
          descricao="Defina-a ou mude-a. Mínimo de 8 caracteres."
          destino="/conta"
          focoAutomatico={false}
        />

        <Cartao className="h-fit">
          <CabecalhoCartao>
            <TituloCartao>Notificações</TituloCartao>
            <DescricaoCartao>
              Ser avisado no telemóvel quando há novidades suas: uma resposta
              do centro, uma convocatória, um recado da gestão.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            <ActivarNotificacoes chavePublica={chaveVapid} />
          </ConteudoCartao>
        </Cartao>

        <Cartao className="h-fit">
          <CabecalhoCartao>
            <TituloCartao>Calendário no telemóvel</TituloCartao>
            <DescricaoCartao>
              As suas aulas, treinos e competições no calendário do telemóvel, a
              actualizarem-se sozinhas.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            <SubscreverCalendario
              origem={origem}
              tokenInicial={calendario.data?.token ?? null}
            />
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
