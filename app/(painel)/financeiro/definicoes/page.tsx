import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

export const metadata: Metadata = { title: 'Definições do financeiro' }

/**
 * As listas de apoio do financeiro, fora do caminho do trabalho diário.
 *
 * Fornecedores e categorias de despesa ocupavam duas das seis entradas do menu
 * financeiro — e mexe-se nelas uma vez por ano, quando entra um fornecedor
 * novo. O que se faz todos os dias é lançar uma despesa e receber um penso.
 */
export default async function PaginaDefinicoesFinanceiro() {
  await exigirGestao()
  const supabase = await criarClienteServidor()

  const [fornecedores, categorias] = await Promise.all([
    supabase.from('fornecedores').select('id', { count: 'exact', head: true }),
    supabase
      .from('categorias_despesa')
      .select('id', { count: 'exact', head: true }),
  ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro', rotulo: 'Financeiro' }}
        titulo="Definições do financeiro"
        descricao="As listas que os formulários de despesa oferecem"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Lista
          href="/financeiro/fornecedores"
          hrefNovo="/financeiro/fornecedores/novo"
          titulo="Fornecedores"
          descricao="Quem emite as facturas que se lançam em despesas: ração, veterinário, ferrador, seguros."
          quantos={fornecedores.count ?? 0}
          rotuloNovo="Novo fornecedor"
        />
        <Lista
          href="/financeiro/categorias"
          hrefNovo="/financeiro/categorias/nova"
          titulo="Categorias de despesa"
          descricao="Como a despesa se agrupa no painel. Já vêm criadas — acrescente só o que faltar."
          quantos={categorias.count ?? 0}
          rotuloNovo="Nova categoria"
        />
      </div>
    </>
  )
}

function Lista({
  href,
  hrefNovo,
  titulo,
  descricao,
  quantos,
  rotuloNovo,
}: {
  href: string
  hrefNovo: string
  titulo: string
  descricao: string
  quantos: number
  rotuloNovo: string
}) {
  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>{titulo}</TituloCartao>
        <DescricaoCartao>{descricao}</DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {quantos === 1 ? '1 registo' : `${quantos} registos`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={href} className={classesBotao('contorno')}>
            Ver lista
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href={hrefNovo} className={classesBotao('fantasma')}>
            {rotuloNovo}
          </Link>
        </div>
      </ConteudoCartao>
    </Cartao>
  )
}
