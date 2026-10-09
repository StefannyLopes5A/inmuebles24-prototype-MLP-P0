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
| `CompareFavorites` | Figma `747:21939`. Três linhas em subgrid (296 px; 86vw no mobile, 80vw até 360 px): card 1:1 igual ao da listagem, “Lo que destaca” (rótulo só na primeira coluna no desktop) e “Precio por m²” (rótulo em todas) e “Qué hay cerca” (rótulo só na primeira coluna no desktop; o seletor A pie/Bici/Auto existe em todas e aparece com fade de 150 ms na coluna sob o mouse, ou na primeira quando nenhuma está em hover e em telas sem hover; no mobile, fica visível em todas), com os lugares do widget “Cerca de ti” do mapa em lista: quatro linhas de 40 px, ícone de 20 px, nome em 14/20 e minutos em 14/600 alinhados à direita; o mais rápido da comparação no modo escolhido (empates no mínimo destacam todos; se todos empatam, nenhum) ganha fundo `#f2f2f2` (raio 12) e nome em 600. Barra de preço com quatro faixas (`#9cc29a`, `#529353`, `#f2c037`, `#b23f19`) e ponto de 12 px; selo “Mejor precio” com o ícone de `public/assets/compare`. Pílula flutuante com no mínimo 732 px, que cresce com o conteúdo até 1000 px sem quebrar o texto (abaixo de 700 px, depois do envio, o texto ganha linha própria acima do botão), raio 32, com um único botão laranja; abaixo de 520 px só o botão até o envio. A pílula e o composer são a mesma superfície: o clique a transforma no composer de 400 px com raio 24, centralizado no mesmo eixo da pílula (folha inferior abaixo de 700 px), e o botão laranja vira o “Enviar”. O aviso de consentimento é uma frase curta com a contagem de imobiliárias. Até cinco colunas; o trilho rola na horizontal. “Lo que destaca” reusa o `ink` da home (`SOFT_MOTION` de `homeIntro.js`): cada palavra 620 ms, opacidade + 2 px + blur 2 px, 110 ms entre palavras. Colunas ordenadas do menor ao maior m²; cada uma fica em “Comparando el inmueble…” (16/22,4 px como o resumo, com o degradê laranja→azul da home em loop de 1,8 s) e começa a escrever quando a anterior chega à última palavra; a primeira espera 600 ms. O selo “Mejor precio” entra quando a barra da sua coluna assenta (240 ms + 50 ms por coluna): primeiro um disco de 24 px só com o ícone (`scale(.9)` → 1 e fade em 160 ms), que se abre para a direita revelando o texto (`clip-path` em 280 ms `EASE_OUT`, sem mexer no layout), depois uma passagem de luz laranja→azul de 760 ms linear sobre o texto (só fade com movimento reduzido). Tempos de `favoriteMotion.js`: faixa e ponto 240 ms com 50 ms entre colunas, morph pílula ↔ composer 280 ms com `EASE_IN_OUT` (conteúdo cruza em 180 ms com `EASE_OUT`; movimento reduzido troca o tamanho direto e só faz o fade), saída de coluna 200 ms e reflow 250 ms com `EASE_IN_OUT`. Movimento reduzido mostra o estado final direto. |
| `SearchMap` | `mini`, `half`, `full`; card de prévia só em `full`. Carregado sob demanda. No desktop em `full`, `MapWidgets` empilha cards à esquerda. |
| `MapWidgets` | Cards brancos da Mora (autoria só no resumo), um visual por card, painel de narrativa, pill recolhido, spoiler discreto e camadas/POIs. Só desktop ≥ 951 px. |

No primeiro contato, mostrar nome e um canal por vez. Erros ficam junto ao campo e recebem foco; os dados válidos permanecem. Durante os 420 ms de registro simulado, bloquear duplicação. Perguntas anteriores acompanham o contato; o segundo imóvel reutiliza o perfil sem reutilizar seu destinatário ou recibo.

### Mapa de resultados

Referência do flutuante: [Figma 717:16218](https://www.figma.com/design/KcIrcsopqwSQCWp6s8omaI/-Concepts--Inmuebles24?node-id=717-16218). Em 1512 × 982 ele mede 192 × 192 px, raio 24, a 48 px da direita e da base; o título da área fica no canto superior esquerdo (inset 16, branco sobre sombreado) e o botão circular branco de 48 px no canto inferior direito (inset 8). No mobile mede 128 px a 16 px das bordas. O mapa fica em cinza no flutuante e ganha cor ao abrir.

| Estado | Geometria | Interação |
| --- | --- | --- |
| Flutuante | `position: fixed`, não acompanha a rolagem. | Um único botão: abre metade (≥ 951 px) ou tela cheia. |
| Metade | `clamp(360px, 42vw, 760px)` à direita, 24 px abaixo da barra e das bordas, raio 16. | Coluna de controles à direita: ampliar, reduzir (ícone de picture-in-picture) e zoom. Pins sem card. Hover/foco no card da grade destaca o pin. |
| Tela cheia | 16 px abaixo da barra e 24 px nas laterais (sem margem e sem raio abaixo de 951 px), sobre um fundo branco que esconde a grade (fade de 200 ms). | Pin abre um preview com o próprio `HouseCard` da grade (mesma foto, textos, coração e logo), num painel branco de 296 px com “Localização aproximada” e fechar sobre a foto; no mobile, 280 px na base do mapa. O card leva à interna. No desktop, o stack da Mora ([Figma 743:19582](https://www.figma.com/design/KcIrcsopqwSQCWp6s8omaI/-Concepts--Inmuebles24?node-id=743-19582), 360 px, raio 24, padding 24, fundo branco, sombra `0 6px 16px rgba(0,0,0,.12)`, gap 8) fica à esquerda: autoria só no resumo; barras `#fe6439` de 6 px; os cards entram de cima para baixo. |

Paleta inspirada no Airbnb (`src/mapStyle.js`): terreno `#f5f4f0`, quadras `#efede8`, parques `#d3ebc9`, água `#aad3ee`, vias brancas com contorno `#e2e0db`, rótulos `#6f6f6f` com halo branco; colônias em caixa alta, 11 px. Pin: cápsula branca de 28 px com preço compacto; visto fica `#ebebeb`; hover e selecionado ficam `#222` com texto branco.

Movimento: a mudança de estado anima um `clip-path: inset(... round R)` do retângulo antigo ao novo, com `cubic-bezier(0.77, 0, 0.175, 1)`, em 360 ms (flutuante ↔ metade) ou 420 ms (qualquer troca com tela cheia). O conteúdo do mapa fica parado durante o recorte e a transição pode ser interrompida a partir do ponto atual. A grade some por 120 ms e reaparece com a nova contagem de colunas. O card entra em 200 ms (escala 0,96 → 1) ou sobe como folha em 300 ms no mobile; sai em 150 ms. Pins entram em sequência de 20 ms. Com movimento reduzido, os estados trocam direto com um fade de 150 ms.

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
