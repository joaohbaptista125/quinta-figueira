import Link from 'next/link'
import { ChevronRight, Megaphone } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { ROTULOS_TIPO_EVENTO_CURTO } from '@/lib/rotulos'
import {
  formatarDiaCurto,
  formatarDiaPorExtenso,
  formatarHora,
  hoje,
} from '@/lib/formatos'
import type { TipoEvento } from '@/lib/tipos-bd'

/*
 * O que está marcado, no topo do painel.
 *
 * O painel abria nos números do mês — que são para consultar de vez em quando
 * — e o que se vem cá ver todos os dias, que é o que está marcado para hoje e
 * que cavalo leva quem, estava a duas navegações de distância. Isto põe a
 * resposta na primeira coisa que se vê ao entrar.
 *
 * Não leva filtro por pessoa: a RLS já só devolve os eventos que quem consulta
 * pode ver (a equipa vê tudo, o cliente só aqueles em que foi convocado).
 */

const COR_POR_TIPO: Record<TipoEvento, 'primario' | 'aviso' | 'sucesso'> = {
  aula: 'primario',
  treino_horseball: 'sucesso',
  competicao: 'aviso',
}

const CAMPOS = `id, tipo, titulo, data, hora_inicio, hora_fim, local, cancelado,
   pessoas(nome), equipas(nome),
   evento_participantes(id, cavalo_id),
   avisos(id)`

type Evento = {
  id: string
  tipo: TipoEvento
  titulo: string | null
  data: string
  hora_inicio: string
  hora_fim: string
  local: string | null
  cancelado: boolean
  pessoas: { nome: string } | null
  equipas: { nome: string } | null
  evento_participantes: { id: string; cavalo_id: string | null }[] | null
  avisos: { id: string }[] | null
}

export async function QuadroDoDia() {
  const supabase = await criarClienteServidor()
  const dia = hoje()

  const { data: eventos } = await supabase
    .from('eventos')
    .select(CAMPOS)
    .eq('data', dia)
    .order('hora_inicio')

  return (
    <Cartao>
      <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
        <div>
          <TituloCartao>Hoje</TituloCartao>
          <DescricaoCartao>{formatarDiaPorExtenso(dia)}</DescricaoCartao>
        </div>
        <Link href="/agenda" className={classesBotao('contorno', 'pequeno')}>
          Abrir agenda
        </Link>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        {eventos && eventos.length > 0 ? (
          <ListaEventos eventos={eventos as Evento[]} />
        ) : (
          <SemRegistos
            titulo="Nada marcado para hoje"
            descricao="As aulas, treinos e competições do dia aparecem aqui."
          />
        )}
      </ConteudoCartao>
    </Cartao>
  )
}

export async function ProximasMarcacoes() {
  const supabase = await criarClienteServidor()

  const { data: eventos } = await supabase
    .from('eventos')
    .select(CAMPOS)
    .gte('data', hoje())
    .order('data')
    .order('hora_inicio')
    .limit(5)

  return (
    <Cartao>
      <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
        <div>
          <TituloCartao>As suas próximas marcações</TituloCartao>
          <DescricaoCartao>Aulas, treinos e competições em que está convocado</DescricaoCartao>
        </div>
        <Link href="/agenda" className={classesBotao('contorno', 'pequeno')}>
          Abrir agenda
        </Link>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        {eventos && eventos.length > 0 ? (
          <ListaEventos eventos={eventos as Evento[]} mostrarDia />
        ) : (
          <SemRegistos
            titulo="Não tem nada marcado"
            descricao="Quando for convocado para uma aula ou treino, aparece aqui."
          />
        )}
      </ConteudoCartao>
    </Cartao>
  )
}

function ListaEventos({
  eventos,
  mostrarDia,
}: {
  eventos: Evento[]
  mostrarDia?: boolean
}) {
  return (
    <ol className="divide-y divide-border border-t border-border">
      {eventos.map((evento) => {
        const participantes = evento.evento_participantes ?? []
        const semCavalo = participantes.filter((p) => !p.cavalo_id).length
        const avisos = (evento.avisos ?? []).length
        const contexto = [evento.local, evento.pessoas?.nome, evento.equipas?.nome]
          .filter(Boolean)
          .join(' · ')

        return (
          <li key={evento.id} className="relative hover:bg-muted/50">
            <Link
              href={`/agenda/${evento.id}`}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <span className="w-[4.5rem] shrink-0">
                <span className="tabular block text-sm font-semibold">
                  {formatarHora(evento.hora_inicio)}
                </span>
                {mostrarDia ? (
                  <span className="tabular block text-xs text-muted-foreground">
                    {formatarDiaCurto(evento.data)}
                  </span>
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Distintivo cor={COR_POR_TIPO[evento.tipo]}>
                    {ROTULOS_TIPO_EVENTO_CURTO[evento.tipo]}
                  </Distintivo>
                  {evento.titulo ? (
                    <span className="truncate font-medium">{evento.titulo}</span>
                  ) : null}
                  {evento.cancelado ? (
                    <Distintivo cor="perigo">Cancelado</Distintivo>
                  ) : null}
                </span>
                {contexto ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {contexto}
                  </span>
                ) : null}
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>
                    {participantes.length === 1
                      ? '1 convocado'
                      : `${participantes.length} convocados`}
                  </span>
                  {semCavalo > 0 && !evento.cancelado ? (
                    <span className="font-medium text-warning-foreground">
                      {semCavalo === 1
                        ? '1 ainda sem cavalo'
                        : `${semCavalo} ainda sem cavalo`}
                    </span>
                  ) : null}
                  {avisos > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Megaphone className="size-3" aria-hidden />
                      {avisos}
                    </span>
                  ) : null}
                </span>
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
