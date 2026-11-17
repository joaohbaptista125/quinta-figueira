/**
 * O endereço de um filtro, com os outros parâmetros intactos.
 * =============================================================================
 *
 * Vive aqui, fora do componente, para poder ser testado — e é testado porque
 * **foi exactamente isto que esteve errado**. Cada listagem construía o
 * endereço de raiz (`/cavalos?regime=penso`), e o efeito era que escolher um
 * regime apagava a pesquisa que estava escrita, e ligar «incluir inactivos»
 * apagava o regime. Quem procurava «Lusitano» e depois filtrava via a
 * pesquisa desaparecer sem perceber porquê.
 *
 * A regra é uma só: **copiar e corrigir, nunca reconstruir.**
 */
export function enderecoComFiltro(
  caminho: string,
  parametrosActuais: string,
  parametro: string,
  valor: string | undefined,
): string {
  const novos = new URLSearchParams(parametrosActuais)
  if (valor) novos.set(parametro, valor)
  else novos.delete(parametro)

  const query = novos.toString()
  return query ? `${caminho}?${query}` : caminho
}
