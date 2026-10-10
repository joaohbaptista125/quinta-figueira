import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import {
  CAMPOS_EVENTO,
  ListaEventos,
  type Evento,
} from '@/components/lista-eventos'
import { formatarDiaPorExtenso, hoje } from '@/lib/formatos'

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

export async function QuadroDoDia() {
  const supabase = await criarClienteServidor()
  const dia = hoje()

  const { data: eventos } = await supabase
    .from('eventos')
    .select(CAMPOS_EVENTO)
    .eq('data', dia)
    .order('hora_inicio')

  return (
    <Cartao>
      <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
        <div>
          <TituloCartao>Hoje</TituloCartao>
          <DescricaoCartao>{formatarDiaPorExtenso(dia)}</DescricaoCartao>
        </div>
        <Link
          href={`/agenda?vista=dia&dia=${dia}`}
          className={classesBotao('contorno', 'pequeno')}
        >
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
    .select(CAMPOS_EVENTO)
    .gte('data', hoje())
    .order('data')
    .order('hora_inicio')
    .limit(5)

  return (
    <Cartao>
      <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
        <div>
          <TituloCartao>As suas próximas marcações</TituloCartao>
          <DescricaoCartao>
            Aulas, treinos e competições em que está convocado
          </DescricaoCartao>
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
