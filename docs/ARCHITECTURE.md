# Arquitetura do protótipo

Aplicação cliente em React 19.2.0 e Vite 6.4.2, sem backend de negócio. Requer Node.js ≥22.12.0; `.nvmrc` indica Node 22. Assets e catálogo são locais. As interações não chamam IA, anunciantes, autenticação ou endpoints externos; o único worker entregue serve arquivos estáticos e o fallback da aplicação.

## Onde alterar

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.jsx` | Único ponto de entrada, provider de idioma, migração de links antigos e imports de CSS. |
| `src/App.jsx` | Estado da rota, critérios, perfil, favoritos, recibos, navegação e composição das páginas. |
| `src/Home.jsx`, `src/HomeSearch.jsx` | Header, home, HouseCard, frase e controles de busca. |
| `src/SearchBar.jsx`, `src/ResultsFlowPage.jsx` | Estados da barra Mora, assistência local e grade de resultados. |
| `src/ListingPanel.jsx`, `src/MoraInsight.jsx`, `src/listing-panel.css` | Mini-listing que nasce do card: morph, carrossel e mosaico (as fotos levam à interna), análise da Mora, anunciante, pergunta, contato/reutilização/confirmação, navegação lateral e bottom sheet. |
| `src/listingPanelMotion.js`, `src/listingPreload.js` | Tokens de spring, geometria do morph, posicionamento (lado a lado, empilhado, sheet) e pré-carga por intenção de hover/foco. |
| `src/MoraVoice.jsx`, `src/mora-voice.css` | Assinatura da Mora (logo + nome), linha de trabalho com degradê e frase palavra por palavra, para toda fala fora do stack do mapa. Regras de voz, marca e movimento em [MORA.md](MORA.md). |
| `src/moraAnalysis.js`, `src/moraVerdict.js`, `src/listingAdvertiser.js` | Leitura pura da Mora (síntese, encaixe com a busca, mercado, favoritos, entorno; `verdict`, o resumo do mini-listing em uma frase e até três fatos do anúncio) e identidade estável do anunciante (nome, verificação, nota no Google, Domi e tempo de resposta). O entorno usa os POIs reais de `src/pois.js`. |
| `src/PropertyDetail.jsx`, `src/property-page.css` | A página interna dos anúncios. |
| `src/development/` | Recorrido 3D da Torre Olmo: inventário (`torreOlmo.js`, `buildingConfig.js`), cena three.js (`scene.js`), página (`RecorridoPage.jsx`, `RecorridoPanel.jsx`) e leitura da Mora do empreendimento (`moraDevelopment.js`). A cidade estática vive em `public/data/city.json`. |
| `src/heroMorph.js` | Entrada e saída da interna via View Transitions: a foto do painel ou do card vira a capa (`listing-hero`) — no empreendimento, `.recorrido-cover` — e volta ao card ao sair. Na galeria, a foto clicada no mosaico ou no carrossel cresce até a mesma foto do índice (`gallery-photo`) e volta ao fechar; sem suporte ou com movimento reduzido, a troca é direta. |
| `src/listingStory.js` | Conteúdo da interna, puro e estável por `home.id`: galeria por categoria (`listing-reading.json`; aluguéis de uma foto emprestam um conjunto), ficha, lugares, comodidades, descrição e parecidos. Testes em `tests/listing-story.test.mjs`. |
| `src/ListingGallery.jsx`, `src/PhotoLightbox.jsx` | Mosaico, faixa mobile, índice por categoria e o visualizador em tela cheia da interna. |
| `src/ListingSections.jsx`, `src/ListingMap.jsx`, `src/ListingReviews.jsx`, `src/SimilarListings.jsx` | Seções da interna; o mapa é carregado sob demanda e reusa `mapStyle`, `pois` e `poiLayers`. |
| `src/ListingFacts.jsx` | Atributos e anunciante da interna anterior (sem uso na interna atual). |
| `src/journey.js`, `src/searchCriteria.js`, `src/searchInput.js` | Normalização, correspondências, sugestões para demonstração, URL, critérios e interpretação local. |
| `src/contactFlow.js`, `src/contactProfile.js` | Validação, mensagens/recibos simulados e persistência do perfil. |
| `src/listingPresentation.js`, `src/listing-details.json` | Apresentação baseada no anúncio, fotos e atributos adicionais confirmados. |
| `src/i18n.jsx`, `src/data.js`, `src/real-listings.json` | Idioma, moeda e snapshot do catálogo. |
| `src/homeIntro.js`, `src/homeMotion.js`, `src/searchFlowMotion.js` | Holofote, interações dos cards, expansão da barra e Onda. |
| `src/SearchMap.jsx`, `src/searchMapMotion.js` | Mapa dos resultados (`mini`, `half`, `full`), pins, card de prévia, morph por `clip-path` e overlays do stack. Carregado com `React.lazy`. |
| `src/mapWidgets.js`, `src/mapWidgetContent.js`, `src/MapWidgetStack.jsx` | Contexto cidade/colônia/imóvel, leitura da busca (não do centro do mapa na cidade), spoiler só após login simulado e UI da leitura. |
| `src/pois.js`, `src/poiCategories.js`, `src/poiLayers.js`, `src/data/pois.json`, `public/assets/map/maki/` | POIs locais: o mapa mostra o catálogo inteiro, sem filtro de bairro ou localização; as oito categorias começam ligadas. Categorias com ícone Maki e cor, zoom mínimo por categoria (metrô e escola sempre), vizinhos do imóvel selecionado (todos a 500 m, com contagem por categoria) e sources GeoJSON do MapLibre sem agrupamento (bolinha abaixo do zoom 15,5, pin com ícone a partir dele; camada `poi-near` revelada em onda por opacidade). `poiCategories.js` não importa o JSON, para a comparação usar os ícones sem carregar os pontos. |
| `src/mapStyle.js`, `src/mapLocations.js`, `src/coloniaPolygons.js`, `src/data/colonias.json`, `public/assets/map/` | Estilo MapLibre sobre Protomaps, centroides, polígonos locais do seletor (`properties.name` + `nivel`) e tiles/fontes ([proveniência](../public/assets/map/MAP-SOURCES.md)). Sem fetch de geometria. |

Os CSS entram somente por `main.jsx`. A ordem termina em `home-evolution.css` → `home-motion.css` → `search-flow.css` → `search-transition.css` → `mini-listing.css` → `search-map.css` → `map-widgets.css` → `mobile-polish.css` → `listing-panel.css` → `glass.css` → `recorrido.css`. O CSS do MapLibre chega depois, no chunk do mapa; por isso as regras de `search-map.css` que disputam com `.maplibregl-*` usam o seletor `.map-shell`. Há camadas históricas anteriores; confira a cascata antes de adicionar regras. Ajustes de mobile pertencem às media queries, preservando o desktop.

## Estado e rotas

`App` lê `readJourney()` no carregamento e em `popstate`. `journeyUrl()` produz URLs com `view=home|results|listing|favorites|compare`, critérios, preferência, `property` e, no interior de uma lista, `list` (só o id da lista, nunca ids de anúncio). As listas de favoritos vivem em `src/favoriteLists.js` (lógica pura) e `src/FavoriteFolders.jsx` (modal, aviso e grade, animados com `motion/react`); um id de lista que não existe na sessão abre a grade. A comparação fica em `src/CompareFavorites.jsx` e `src/compare-favorites.css`; a leitura (preço por m² vs. zona, faixa da barra e melhor preço do grupo) é lógica pura em `src/compareReading.js`, com valores de zona fictícios do protótipo para cada bairro do catálogo (venda e aluguel). “Qué hay cerca” mede do pin do imóvel (`homeCoordinates`) até os pontos de `coloniaVision` do widget do mapa, com fator de rua 1,3 e velocidades fictícias (80, 250 e 330 m/min). Bici e carro têm desvio próprio por imóvel e lugar (ciclovias, mãos de direção) e o carro soma 0–4 min de estacionamento, sorteados de forma determinística; por isso o mais rápido de cada tipo pode mudar com o modo. “Lo que destaca” é calculado por `compareReading()` contra as outras colunas: cada imóvel recebe a dimensão em que lidera com folga de pelo menos 10% (preço, área, quartos, vagas de `listing-details.json` ou metrô a pé), sem repetir dimensão entre colunas; quem não lidera em nada diz onde fica atrás, e um imóvel sozinho pede outro favorito. Venda e aluguel não competem em preço, e nesse caso não há “Mejor precio”. A variação contra a zona já fica na barra, então a nota de preço diz onde o m² cai dentro da lista (mais alto, segundo mais baixo, no meio), exceto na coluna de melhor preço. Nenhum texto é escrito à mão por imóvel. A sessão guarda `compare: {hidden: {listId: [ids]}, seen: [listIds]}` para remover da comparação sem tirar dos favoritos e para não repetir a entrada “Comparando…”. Essa rota é suficiente para reabrir a mesma busca ou página interna. O histórico guarda posição de rolagem e camada de navegação; abrir/fechar o mini-listing preserva o anúncio de origem. “Ver inmueble completo” substitui a entrada do painel pela da interna, então voltar da interna leva aos resultados na mesma rolagem, sem reabrir o painel. Trocar de imóvel dentro do painel (setas, ←/→, card recuado, miniatura de favorito) usa `replaceState`, então voltar fecha o painel em vez de percorrer cada imóvel visto.

O estado do mapa vai em `map=half|full` apenas em `results` e `listing`; `mini` é o padrão e não aparece na URL. Entrar na tela cheia cria uma entrada de histórico (camada `map`), então voltar fecha o mapa; flutuante ↔ metade usa `replaceState`. Abaixo de 951 px, `half` é exibido como `mini`. O mapa usa MapLibre GL 6 com o protocolo `pmtiles://` sobre um arquivo local lido por requisições `Range`. O worker do MapLibre é registrado com `setWorkerUrl` a partir de um import `?url`, e `maplibre-gl` fica fora do `optimizeDeps` do Vite; sem isso o mapa fica em branco em desenvolvimento.

Nome, e-mail, telefone, mensagens de contato, destinatários e recibos não são serializados pela URL. O texto livre de busca (`note`) faz parte dos critérios compartilháveis; mantenha dados pessoais fora desse campo.

`matchingHomes()` calcula correspondências estritas. `prototypeResults()` começa por elas e completa até pelo menos 40 anúncios distintos com sugestões ordenadas do catálogo. `App` mantém as correspondências na frente e pode priorizar preferência de quartos. Favoritos não alteram a ordem: o card favoritado permanece na mesma posição. Não substitua a contagem estrita usada pela assistência pela quantidade de cards de demonstração.

A barra tem estados `collapsed`, `edit`, `input`, `suggest`, `qualify` e `answer`; ela é só busca e assistência. O imóvel aberto vive em `ListingPanel`, renderizado por `App` dentro de `AnimatePresence` num portal em `document.body`, posicionado em coordenadas do documento na linha do card de origem e na largura do contêiner de resultados (abaixo de 768 px, sheet fixo). `App` guarda o elemento do card clicado (`open(home, event)`); o painel mede card e foto, anima um único `progress` com `spring.morph` (clip-path da casca + `left/top/width/height` da foto) e, ao fechar, volta ao card exibido naquele momento ou faz fade de 150 ms quando ele não está na tela. Os vizinhos de ←/→ vêm dos `[data-home-id]` do contêiner de origem. `html[data-listing-panel]` faz a grade recuar e `[data-panel-source]` esconde o card de origem. Fases `summary`, `question`, `contact` e `sent` trocam só o conteúdo; a reutilização do perfil é um subestado do contato. A página interna usa `PropertyDetail`; suas ações abrem o mesmo painel já em `contact`, com fade, e fechar devolve o foco ao botão. Se o imóvel é um empreendimento (`home.development`), a mesma rota `listing` monta `RecorridoPage` (lazy) no lugar de `PropertyDetail`: some o `HomeHeader` e o rodapé, fica uma barra de 64 px com a marca, e o canvas 3D ocupa o resto. Abaixo de 1280 px o 3D não monta; o painel e as imagens continuam. `tour=3d` na URL é o filtro “Solo con tour 3D”.

A sugestão proativa é disparada por rolagem efetiva seguida de 750 ms de pausa, desde que a barra esteja recolhida, sem edição ou imóvel aberto e com alternativa disponível. A home e a rota interna passam `proactive={false}`; resultados conservam esse recurso.

## Armazenamento e reset do perfil

| Local | Chave / conteúdo | Duração |
| --- | --- | --- |
| `localStorage` | `inmuebles24-v2-contact-profile`: `name`, `email`, `phone`. | Entre visitas no mesmo navegador e origem. |
| `sessionStorage` | `inmuebles24-v2-session`: `folders` (`{id, name, homeIds, createdAt}`), `recent` (`{id, viewedAt}`, até 24), `saved` derivado das listas, cópia legada `profile`. Os recibos ficam só em memória e somem ao recarregar. Uma sessão antiga só com `saved` vira a lista “Favoritos”. | Sessão da aba; pode sobreviver a recarregamento. |
| `localStorage` | `inmuebles24-v2-language`, `inmuebles24-v2-currency`. | Idioma e moeda entre visitas. |
| Estado React | Edição, pergunta, canal, animações e estado transitório do contato. | Enquanto o componente está montado. |

`readContactProfile()` prioriza a chave persistente e usa o perfil legado da sessão como fallback. Leitura e escrita tratam armazenamento bloqueado ou JSON inválido sem impedir o fluxo. O perfil é persistido após um contato válido; cada recibo contém somente o canal escolhido e se associa a um imóvel específico.

Para repetir o primeiro contato **sem apagar favoritos, moeda, idioma ou dados de outros sites**:

1. Abra o protótipo e o Console do DevTools dessa página. Feche outras abas desse mesmo protótipo durante o reset.
2. Execute o trecho abaixo. Ele remove somente a chave de perfil da aplicação e sua cópia legada na sessão, depois recarrega.
3. Abra um imóvel e simule um novo contato usando dados fictícios. Recibos anteriores continuam na sessão e ainda contêm sua cópia do canal escolhido.

```js
(() => {
  const sessionKey = 'inmuebles24-v2-session';
  localStorage.removeItem('inmuebles24-v2-contact-profile');
  const raw = sessionStorage.getItem(sessionKey);
  if (raw) {
    try {
      const session = JSON.parse(raw);
      if (session && typeof session === 'object' && !Array.isArray(session)) {
        delete session.profile;
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
      }
    } catch {
      // A sessão ilegível já é ignorada pelo aplicativo.
    }
  }
  location.reload();
})();
```

Recibos de demonstração somem ao recarregar. Para reiniciar também os favoritos, remova especificamente `inmuebles24-v2-session` no painel Session Storage e `inmuebles24-v2-contact-profile` no Local Storage e recarregue. Não use `localStorage.clear()`, `sessionStorage.clear()` nem a opção de limpar todos os dados do navegador. Endereços locais e o site publicado têm origens distintas, portanto não compartilham esse perfil.

## Dados, assets e contato

O snapshot tem 100 anúncios, com IDs, preço MXN, endereço e foto correspondentes. `LISTING-SOURCES.json` documenta origem e arquivos; `AGENCY-SOURCES.json` registra 13 logos e as associações verificadas. Na interna, o anunciante vem dessa evidência, nunca do fallback decorativo do HouseCard. No painel, `advertiserFor()` usa a mesma evidência ou o anunciante publicado; quando o catálogo só diz “Anunciante en Inmuebles24”, inventa um nome estável para o anúncio e usa uma marca de avatar em `public/assets/agencies/`, distinta das 13 logos verificadas. O selo de verificada, a nota no Google, o uso do Domi e o tempo de resposta são fictícios e derivados do nome, então a mesma imobiliária tem os mesmos sinais em todos os imóveis. O painel não mostra o @. `FIGMA-ASSETS.json`, `ASSET-SOURCES.json` e [o inventário do mini-listing](../public/assets/mini-listing/ASSETS.md) registram os assets visuais.

`listing-details.json` só acrescenta fotos e fatos confirmados. Ausência de informação permanece `null`/“a confirmar”; cada anúncio tem hoje uma foto local. `moraAnalysis()` monta a leitura do painel e da interna sem rede: fatos do catálogo primeiro, e preço de mercado, dias no ar, redução, comparáveis e tempos de deslocamento fictícios e estáveis por anúncio onde o catálogo não tem dado. `peerFacts()` acha parecidos no catálogo (mesma operação e quartos, área a ±25%) para explicar a causa do preço e quantos parecidos saem mais baratos. Critérios da busca que o anúncio não menciona viram o módulo `attention`, com a pergunta pronta para a imobiliária; na interna (`stage: 'deciding'`) ele vem logo depois do preço. A síntese cruza dimensões diferentes e fica do tamanho da leitura: uma frase quando o contraste cabe, mais de uma quando cada ideia precisa da sua. Não há corte por número de palavras. `listingSummary()` segue servindo `compareFavorites()`; `answerListingQuestion()` usa regras locais e pede confirmação quando não tem informação. Não há análise de imagem ou LLM.

`contactValidation()` exige nome e o canal selecionado: e-mail válido ou telefone com `+`, código do país e 10–15 dígitos. A mensagem é formada com imóvel, busca e eventual pergunta. `ListingPanel` usa um guard contra duplicação e um timer de 420 ms; `createContactReceipt()` grava um recibo com `simulated: true`, sem requisição de rede. A intenção de visita não representa agendamento.

## Build, CI e hospedagem

`npm run check` gera o build primeiro e então executa os testes V2 e os testes Sites. A ordem permite validar o pacote de hospedagem também em um clone novo. Os testes usam o runner nativo `node --test`; não há banco de dados ou credenciais para preparar. Eles cobrem lógica, normalização, armazenamento, mensagens, identidade e worker. Conferência de layout, toque, teclado e movimentos segue [FLOW.md](FLOW.md).

Vite gera `dist/client/`. `scripts/prepare-sites-build.mjs` copia o worker para `dist/server/index.js` e a configuração para `dist/.openai/hosting.json`. O worker serve `env.ASSETS`; em uma rota HTML desconhecida de GET/HEAD, devolve o `index.html` para a aplicação resolver a URL. Requisições com `Range` (tiles do mapa) passam sem alteração e o 206 volta intacto. Cada arquivo estático precisa ficar abaixo de 25 MiB; o recorte `cdmx.pmtiles` tem cerca de 22,7 MB. Ele não recebe contatos nem executa IA.

O handoff do GitHub usa `.openai/hosting.json` genérico, sem `project_id`, e não contém destino privado de publicação ou credenciais. `.github/workflows/verify.yml` roda `npm ci` e `npm run check` em pushes para `main` e pull requests, com permissão de leitura. Não faz deploy. A V2 já publicada mantém seu acesso restrito separadamente; clonar o repositório não altera essa audiência.
