import { criarClienteServidor } from '@/lib/supabase/servidor'
import { gerarIcal, type EventoIcal } from '@/lib/ical'
import { ROTULOS_TIPO_EVENTO } from '@/lib/rotulos'

/**
 * Agenda de uma pessoa em formato iCalendar, para subscrever no telemóvel.
 *
 * Não há sessão aqui: uma aplicação de calendário não sabe autenticar-se. Quem
 * autentica é o token secreto no endereço, validado por agenda_por_token(),
 * que é SECURITY DEFINER e só devolve os eventos dessa pessoa. É por isso que
 * o token vive numa tabela que nem a equipa lê, e pode ser trocado a qualquer
 * momento em /conta.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Sempre gerado no momento: um calendário em cache é um calendário errado.
export const dynamic = 'force-dynamic'

export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: bruto } = await params
  // O .ics no fim é o que faz alguns clientes reconhecerem o ficheiro.
  const token = bruto.replace(/\.ics$/i, '')

  if (!UUID.test(token)) {
    return new Response('Endereço de calendário inválido.', { status: 404 })
  }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('agenda_por_token', {
    p_token: token,
  })

  if (error) {
    return new Response('Não foi possível gerar o calendário.', { status: 500 })
  }

  const eventos: EventoIcal[] = (data ?? []).map((linha) => {
    // Sem hora de fim conta-se uma hora, a mesma regra que a base usa para
    // decidir se dois eventos se sobrepõem.
    const fim =
      linha.hora_fim ??
      `${String((Number(linha.hora_inicio.slice(0, 2)) + 1) % 24).padStart(2, '0')}${linha.hora_inicio.slice(2)}`

    const descricao = [
      linha.cavalo ? `Cavalo: ${linha.cavalo}` : null,
      linha.responsavel ? `Responsável: ${linha.responsavel}` : null,
      linha.notas,
      linha.avisos,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      uid: linha.id,
      inicio: { data: linha.data, hora: linha.hora_inicio },
      // Passar da meia-noite empurraria o fim para o dia seguinte; a agenda do
      // centro não tem eventos assim, e truncar é melhor do que inverter.
      fim: {
        data: linha.data,
        hora: fim <= linha.hora_inicio ? '23:59:00' : fim,
      },
      resumo:
        linha.titulo?.trim() ||
        `${ROTULOS_TIPO_EVENTO[linha.tipo]}${linha.cavalo ? ` · ${linha.cavalo}` : ''}`,
      local: linha.local,
      descricao: descricao || null,
      cancelado: linha.cancelado,
      actualizadoEm: linha.actualizado_em,
    }
  })

  const ical = gerarIcal({
    nome: 'Quinta da Figueira',
    dominio: 'quintadafigueira.pt',
    eventos,
  })

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="quinta-da-figueira.ics"',
      // Uma hora chega: o telemóvel também tem o seu próprio ritmo.
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  })
}
