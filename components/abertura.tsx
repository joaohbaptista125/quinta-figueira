import { Marca } from '@/components/marca'

/**
 * O ecrã de abertura da aplicação.
 * =============================================================================
 *
 * **Isto custa tempo, e é bom saber quanto.** Não tapa o arranque a frio da
 * função na Vercel — esse acontece *antes*, enquanto o HTML não chega, e
 * nessa altura não há página nenhuma para mostrar a marca. O que a abertura
 * faz é somar **1,6 segundos ao entrar**, de propósito, para a aplicação
 * começar com a marca em vez de começar a meio. Foi uma escolha, não um
 * efeito secundário.
 *
 * O que a impede de ser um imposto é o resto deste ficheiro — e é por isso
 * que estas três coisas não se mexem sem pensar.
 *
 * **Aparece uma vez por sessão do browser**, e não a cada clique. O `script`
 * aqui dentro corre antes de o elemento ser pintado e tira-o do caminho se
 * esta já não for a primeira abertura. As navegações dentro da aplicação não
 * voltam a passar pelo layout, por isso nem chegam aqui.
 *
 * **Desaparece sozinha mesmo sem JavaScript.** O que a tira do ecrã é uma
 * animação de CSS que acaba em `visibility: hidden` — não há estado de React
 * nem temporizador que possa ficar preso e deixar a aplicação tapada. É
 * também por isso que não é um componente de cliente: não há aqui nada para
 * hidratar, e uma diferença entre o servidor e o browser dava um salto no
 * ecrã logo no primeiro instante.
 *
 * **Respeita quem pediu menos movimento**: a regra global de
 * `prefers-reduced-motion` em `app/globals.css` corta a duração de todas as
 * animações, e esta desaparece de imediato.
 *
 * Para mudar quanto tempo fica: `--abertura-duracao`, em `app/globals.css`.
 */
export function Abertura() {
  return (
    <>
      <div id="abertura" aria-hidden="true">
        <Marca tamanho="grande" />
      </div>

      {/*
       * Corre no sítio onde está, antes do primeiro pintar: sem isto a marca
       * voltava a aparecer sempre que alguém recarregasse a página ou abrisse
       * um link de uma notificação.
       */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem('qf:abriu')){document.getElementById('abertura').remove()}else{sessionStorage.setItem('qf:abriu','1')}}catch(e){}`,
        }}
      />
    </>
  )
}
