# Handoff de design · extensão do mini-listing

Extensão implementada em **05/10/2026** no sistema existente de Inmuebles24. A referência do novo percurso é o [Figma KcIrcsopqwSQCWp6s8omaI, nó 518:16812](https://www.figma.com/design/KcIrcsopqwSQCWp6s8omaI/?node-id=518-16812), com composição do mini-listing em `518:16845`.

Este documento e [PRODUCT.md](../PRODUCT.md) definem o contrato vigente do snapshot de handoff. O histórico anterior de alternativas não faz parte deste repositório. O código e as capturas são a evidência para medidas e estados abaixo.

## Overview

A busca continua visível como contexto da exploração. A barra branca se expande para mostrar o imóvel e a Mora; suas duas ações levam à pergunta ou ao contato. Resumo, pergunta, formulário, reutilização e confirmação permanecem nessa mesma superfície. A página interna é uma rota própria e devolve o contato à barra.

A home Holofote aprovada, a transição Onda, menus, histograma, tokens, HouseCard, prévias e favoritos permanecem como base. A extensão não redefine o sistema inteiro nem tenta substituir a fotografia de cada anúncio pela do exemplo do Figma.

## Colors

| Valor observado | Uso na extensão |
| --- | --- |
| `#ffffff`, `#000000`, `#000000b8` | Superfície, texto principal e texto secundário. |
| `#00000014` | Divisores suaves e fundo de fechar. |
| `#e45244` | Nome Mora. |
| `#ff5500` → `#ffad85`, borda `#ff925c` | Gradiente do CTA principal herdado da busca. |
| `#dddddd` → `#f7f7f7` | CTA secundário. |
| `#b43c00`, `#b12b1e` | Foco dos controles e erro de campo. |

A Onda e os efeitos animados existentes usam laranja `#FF553B` à esquerda e azul `#07358F` à direita. Essa paleta de movimento não substitui a cor de repouso dos filtros. As cores acima descrevem a implementação; não constituem uma auditoria completa de contraste.

## Typography

A barra herda a declaração `'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. A aparência pode variar com a fonte disponível no sistema. A extensão mantém essa decisão existente; não introduz uma nova regra tipográfica para outros produtos.

| Papel | Desktop | Mobile ≤700 px |
| --- | --- | --- |
| Preço do mini-listing | 32 px / 1,4; peso 600 | 23 px / 1,2; 20 px em ≤360 px. |
| Endereço | 16 px / 1,4; peso 600 | 15 px; 14 px em contato/pergunta/sucesso. |
| Nome Mora | 18 px / 28,8 px; peso 700 | Preservado. |
| Texto de assistência | 16 px / 1,4 | Preservado. |
| Título de estado e campos | 22 px / 1,3; inputs 16 px / 24 px | Preservados para leitura e edição. |

Atributos usam 14 px no desktop e 13 px no resumo mobile. A interna usa título de 32 px no desktop e 26 px no mobile.

## Layout

Na referência de **1512 × 982**, a barra expandida começa sob o header de 96 px e tem altura mínima de 490 px. O header real é medido em execução; não se fixa a mesma altura no mobile. A composição divide **976 px à esquerda / 536 px à direita**, com padding de 48 px, foto de **292 × 290 px** e intervalo de 48 px entre foto e fatos. O anunciante se alinha abaixo dos fatos, à direita da fotografia.

Entre 951 e 1350 px, a foto passa a 240 × 240 px, os espaços principais a 32 px e a coluna Mora a 40%. Até 950 px, as colunas se empilham. O mini-listing reserva 48 px para fechar e mantém um contêiner próprio de rolagem limitado à altura disponível. O botão de fechar fica fora dessa rolagem.

Até 700 px, os paddings são de 24 px e a fotografia de resumo mede 132 × 132 px; até 360 px, a largura cai para 104 px. Nos estados de pergunta, contato e sucesso, a foto reduz para 72 × 72 px e os atributos/anunciante deixam de repetir a apresentação completa. O header mobile tem duas linhas, com Entrar na linha superior; controles e campos permanecem acessíveis em 390 e 320 px.

A interna usa duas colunas no desktop. A ordem semântica é **foto → preço/contato → sobre o imóvel**; o grid posiciona preço/contato à direita no desktop e mantém essa ordem na coluna única do mobile. Não empurrar as ações de contato para depois de uma descrição longa.

## Elevation & Depth

O plano de resultados recebe um escurecimento de 48% abaixo do header quando o mini-listing abre. A barra continua sendo o contêiner da interação, sem portal de diálogo para o imóvel. Divisores translúcidos separam conteúdo e assistência; os CTAs usam os gradientes suaves existentes. O restante do resultado fica `inert` enquanto a superfície do imóvel está aberta.

As mudanças de estado usam fades com pequeno deslocamento e ajuste da altura da barra. A foto pode ampliar 1,04× em hover com ponteiro fino. `prefers-reduced-motion` remove animações e transições da extensão. A Onda preserva retração de 520 ms, sweep de 1200 ms iniciado em 600 ms, revelações de 240 ms e espera de 500 ms antes do crossfade de 200 ms dos resultados. A frase expandida usa relógio 3× e fades de 250 ms; o menu abre ao terminar a animação visível, sem pausa extra.

## Shapes

Fotos usam cantos de 16 px; inputs, 12 px; CTAs em cápsula, 33 px. As ações principais medem pelo menos 56 px no desktop e 52 px no mobile. Fechar tem alvo de 44 px no mobile; os controles de canal e envio de pergunta também passam a 44 px para ponteiro de toque. Foco permanece visível. O coração conserva área de toque de 44 × 44 px e muda somente de cor, sem fundo.

## Components

| Componente | Responsabilidade e estados |
| --- | --- |
| `SearchBar` | `collapsed`, `edit`, `input`, `suggest`, `qualify`, `answer`, `listing`. Filtros e assistência usam o mesmo contexto. |
| `MiniListing` | `summary`, `question`, `contact`, `sent`; reutilização é um estado do contato com opção de editar. |
| `ListingOverview` | Foto do anúncio, operação, endereço, preço, atributos e anunciante. A foto abre a interna. |
| `PropertyDetail` | Página interna com identidade preservada, informações e ações que abrem contato na barra. |
| `HouseCard` | Componente compartilhado entre home e resultados; favorito continua independente da abertura. |

No primeiro contato, mostrar nome e um canal por vez. Erros ficam junto ao campo e recebem foco; os dados válidos permanecem. Durante os 420 ms de registro simulado, bloquear duplicação. Perguntas anteriores acompanham o contato; o segundo imóvel reutiliza o perfil sem reutilizar seu destinatário ou recibo.

**Mesma superfície:** não converter os estados do mini-listing em modais adicionais. O diálogo de “Mais filtros” é outro componente e conserva sua função atual.

**Mesma identidade:** uma foto, fato ou anunciante pertence ao anúncio que lhe dá origem, em todas as telas. Os nove SVGs originais estão em [public/assets/mini-listing/ASSETS.md](../public/assets/mini-listing/ASSETS.md): área, quarto, banheiro, vaga, pets, andar, Mora, fechar e Premium. O asset Premium é preservado como referência e não é exibido sem evidência.

## Do's and Don'ts

1. Preserve a foto local real de cada imóvel. O catálogo dispõe de uma foto por anúncio; o bloco de 292 × 290 px usa esse estado e não promete “+32 fotos”. Galeria adicional só pode usar fotos locais com associação confirmada.
2. Registre o que não está confirmado como “a confirmar”. Não copie selo Premium, andar, pets, vagas, plantas ou fatos do imóvel de exemplo para outros anúncios.
3. Mantenha preferências como intenção do usuário. Um quarto adicional pode influenciar a ordenação; não prova a existência de escritório ou janela.
4. Preserve o gate de operação/tipo, a interrupção das animações, foco, Escape e movimento reduzido. Sugestões após rolagem só podem aparecer nos resultados, nunca durante exploração da interna.
5. Mantenha ajustes compactos no escopo responsivo e confira as duas línguas. Extensões não devem alterar a home desktop aprovada por efeito de cascata.

## Evidências e limites

A revisão final liberou a entrega após resolver a ordem do conteúdo na interna mobile. As capturas ficam em [qa/mini-listing/](../qa/mini-listing/):

| Evidência | Recorte |
| --- | --- |
| [desktop-final.png](../qa/mini-listing/desktop-final.png) | Resumo do mini-listing, 1512 × 982. |
| [desktop-contact-final.png](../qa/mini-listing/desktop-contact-final.png) | Formulário dentro da barra no desktop. |
| [mobile-final.png](../qa/mini-listing/mobile-final.png) | Resumo em 390 px. |
| [mobile-320-final.png](../qa/mini-listing/mobile-320-final.png) | Formulário em 320 px. |
| [mobile-listing-page.png](../qa/mini-listing/mobile-listing-page.png) | Interna mobile com foto, preço/contato e informações. |

A suíte tem 57 testes V2 e 4 de hospedagem; `npm run check` executa ambos e o build. As capturas demonstram estados específicos, não equivalência pixel a pixel em todos os navegadores. Safari nativo, aparelhos físicos e eficácia com usuários não foram validados. O [vídeo conferido](https://github.com/abrantesv/inmuebles24-prototype/releases/tag/v1.0.0) tem 2 min 32 s, 1512 × 982, 30 fps, sem faixa de áudio ou legendas. `npm run check` passou com 57 testes V2, 4 testes Sites e build.


A implementação desta extensão está em `src/mini-listing.css`, `src/mobile-polish.css`, `src/MiniListing.jsx`, `src/PropertyDetail.jsx` e `src/SearchBar.jsx`.
