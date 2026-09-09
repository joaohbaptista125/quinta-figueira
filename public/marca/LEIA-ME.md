# Logótipo

O logótipo do clube vive aqui, como **`logotipo.jpg`**. Quadrado, de
preferência 512×512 ou maior.

Para o substituir, mantém o mesmo nome. Se mudares a extensão, muda também a
linha do `import` no topo de `components/marca.tsx` — os ficheiros são
importados, não procurados no disco.

> A versão anterior procurava os ficheiros com `fs.existsSync()`. Funcionava em
> local e falhava sempre em produção: na Vercel os ficheiros de `public/` não
> entram no pacote da função, vão para o CDN à parte, e a verificação dava
> falso. Importar resolve-os na compilação e falha o build se faltarem, em vez
> de a marca desaparecer sem se perceber porquê.

A maneira mais simples de trocar o ficheiro é pelo próprio GitHub, sem terminal:
**Add file → Upload files**, com a pasta `public/marca` já aberta. Assim que o ficheiro existir,
`components/marca.tsx` passa a usá-lo na barra lateral, no cabeçalho do
telemóvel e no ecrã de entrada — não é preciso mexer em código nenhum.

Enquanto não existir, fica no lugar dele uma ferradura desenhada, com a mesma
forma e o mesmo tamanho, para o arranjo da página não dar um salto quando o
logótipo entrar.

Depois de o pores, vale a pena regenerar também os ícones da aplicação
instalável — ver `scripts/gerar-icones.mjs`.

## Símbolo

`simbolo.png` é só a cabeça de cavalo, quadrada, e é usado onde a marca aparece
pequena — barra lateral, cabeçalho do telemóvel, ícone da aplicação instalada.
O lockup completo fica reservado para o ecrã de entrada, onde o lettering se lê.

Gera-se a partir do logótipo:

```bash
node scripts/extrair-simbolo.mjs
node scripts/gerar-icones.mjs
```

Se trocares o logótipo, corre os dois — as coordenadas do recorte em
`extrair-simbolo.mjs` são as deste desenho e podem precisar de revisão.
