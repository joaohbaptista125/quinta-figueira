# Logótipo

Põe aqui o logótipo do clube com o nome **`logotipo.png`**:

```
public/marca/logotipo.png
```

Quadrado, de preferência 512×512 ou maior. Assim que o ficheiro existir,
`components/marca.tsx` passa a usá-lo na barra lateral, no cabeçalho do
telemóvel e no ecrã de entrada — não é preciso mexer em código nenhum.

Enquanto não existir, fica no lugar dele uma ferradura desenhada, com a mesma
forma e o mesmo tamanho, para o arranjo da página não dar um salto quando o
logótipo entrar.

Depois de o pores, vale a pena regenerar também os ícones da aplicação
instalável — ver `scripts/gerar-icones.mjs`.
