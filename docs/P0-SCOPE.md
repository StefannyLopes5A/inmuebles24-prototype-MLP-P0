# Escopo P0 · MLP H1 2027

Fonte: *CL 2.0 Seekers XP MLP Plan H1 2027* (rascunho preliminar), seções 2.2 a 2.4. Tudo que não é P0 sai desta versão. O plano diz que o MLP não terá nova listing primária, novo mapa, componentes sociais (compartilhar favoritos) nem incentivos de login.

Decisões desta revisão:
- **Mini-listing: remover** (P1). O card abre direto o imóvel completo; o contato sai do painel e vai para a página do imóvel. `AGENTS.md` precisa ser atualizado junto.
- **Vida no bairro: manter só a seção "Neighborhood life"** (P0 de SEO). Saem POIs, custo de vida e o contexto de bairro da Mora (P1).
- **Mora na interna: manter o veredito de preço** (acima, abaixo ou dentro da faixa, com o motivo factual). Sai a comparação de ofertas.

## Fica (P0)

| Área | Item | Código atual |
| --- | --- | --- |
| Home | Novo card e tags, carrossel de listagens | `Home.jsx`, `DiscoveryRail.jsx`, `ListingCardChrome.jsx`, `listingCardTags.js` |
| Home | Header e footer novos, top cidades, cidades e bairros com anúncios, guias de cidade, blog, links internos | `HomeHeader` em `Home.jsx`, `CatalogFooter.jsx`, `HomePopularCities.jsx`, `HomeCityGuide.jsx`, `HomeBlog.jsx`, `HomeInternalLinks.jsx` |
| Resultados | Painel de filtros, fluxo de salvar busca, sinais de preço e ordenação, filtros rápidos, conteúdo de preço e cidade, H1, contagens e breadcrumbs | `AllFilters.jsx`, `SavedSearches.jsx`, `FairPriceScore.jsx`, `resultSort.js` (só preço), `PriceInsights.jsx`, `RegionInsights.jsx`, `SearchFaq.jsx`, `ResultsFlowPage.jsx` |
| Imóvel | Navegação global e interna, avaliações da imobiliária, imóveis similares, veredito de preço da Mora, Neighborhood life | `PropertyDetail.jsx`, `ListingReviews.jsx`, `SimilarListings.jsx`, `ListingSimilarPrices.jsx`, `MoraInsight.jsx` (veredito) |
| Lead | Fluxo de contato; pontos de entrada da Bianca | `ContactFlow.jsx`, `ListingContact.jsx`, `contactFlow.js`, `contactProfile.js`, `MoraChannels.jsx` |

## Sai (P1 ou P2)

| Item | Prioridade | Código atual |
| --- | --- | --- |
| Busca conversacional na home | P2 | Smart Input e chat em `HomeSearch.jsx`, `SearchBar.jsx`, `moraChat.jsx`, `SelectionMora.jsx`, `selectionAsk.js` |
| Mini-listing | P1 | `ListingPanel.jsx`, `PanelContext.jsx`, `listingPanelMotion.js`, `mini-listing.css`, `listing-panel.css`, `ListingAskMora.jsx` |
| Mapa com painel lateral | P1 | `SearchMap.jsx`, `MapWidgetStack.jsx`, `MapPlaceSearch.jsx`, `search-map.css`, `map-widgets.css` e módulos `map*` |
| Sinais de demanda e ordenação | P1 | `seekerSignals.js`, ordenação "Rareza" |
| Busca multi-localização com autocomplete | P1 | multi-lugar em `LocationMenu.jsx` e `locationSearch.js` |
| Galeria e tour virtual | P2 | `ListingGallery.jsx`, `PhotoLightbox.jsx`, `development/` (Recorrido 3D) |
| Descrição por IA, comparação de ofertas, calculadora de custos, custo de vida | P1/P2 | `ListingOffers.jsx`, `ListingCosts.jsx`, `CostOfLiving.jsx`, `purchaseCosts.js`, `costOfLiving.js`, `offerIdeas.js` |
| Comparação de imóveis próximos, características por cômodo, perguntas à imobiliária, POIs | P1 | `NearbyPlaces.jsx`, `NearbyResults.jsx`, `NeighborhoodRail.jsx`, `pois.js`, `poiLayers.js`, `ListingSections.jsx` (trechos) |
| Favoritos, pastas, comparação, compartilhamento e "Decidir juntos" | P1 | `FavoriteFolders.jsx`, `FolderPage.jsx`, `FolderBoard.jsx`, `FolderViews.jsx`, `FolderViewSwap.jsx`, `CompareFavorites.jsx`, `ShareSheet.jsx`, `InviteLayer.jsx`, `Collaboration.jsx`, `favoriteLists.js`, `collaborativeLists.js`, `boardModel.js`, `compareReading.js` |
| Envio de contato em lote | P2 | fluxo em lote de `ContactFlow.jsx` |
| Contatos enviados, acompanhamento, chat com a imobiliária | P1/P2 | recibos e área de contatos enviados |
| Contexto de bairro, intenção guiada, perfilamento, sinais de preço e demanda, calculadora (Mora) | P1/P2 | `moraInsights.js`, `moraTopics.js`, `refineSteps.js`, `priceHistory.js`, `ListingPriceHistory.jsx` |
| Guia do protótipo | n/a | `ProjectGuide.jsx`, `guideStops.js` (todas as paradas apontam para itens removidos) |

## Pontos de atenção

- O botão de favoritar fica em todo card e na interna. Sem favoritos, o coração e o login para favoritar saem; o login continua só para salvar busca.
- `App.jsx` concentra o estado de favoritos, compartilhamento e painel. Os `useState`, os efeitos e as rotas `favorites`, `folder`, `compare` precisam sair juntos.
- Cada módulo removido leva o teste correspondente em `package.json` (`test:v2`) e os docs `FLOW.md`, `ARCHITECTURE.md` e `DESIGN-HANDOFF.md`.
- Conflito no PDF: "Mora analysis & Offer comparison" aparece como P2 na tabela de jornadas, mas o veredito de preço é P0 na seção de Mora. Mantido o veredito.

## Andamento

- **Feito:** pastas de favoritos, comparação, compartilhamento, convites, "Decidir juntos", quadro colaborativo e guia do protótipo removidos. O coração continua como favorito simples (lista plana em `src/favorites.js` e `FavoritesPage.jsx`), sem login obrigatório. As URLs `view=compare`, `view=folder`, `list`, `invite` e `de` deixaram de existir.
- **Feito:** mini-listing removido (`ListingPanel`, `PanelContext`). Os cards abrem o imóvel completo com o morph da foto, e o contato roda no cartão de preço da página (`ListingContact.jsx`, com `ContactStage.jsx` extraído do painel).
- **Feito:** mapa dos resultados (com painel de widgets), Recorrido 3D (Torre Olmo e o modo Desarrollos), filtro "Só com tour 3D", mosaico, lightbox e tour virtual da galeria removidos; a galeria original voltou (mosaico, índice por cômodo e visualizador em tela cheia, `ListingGallery.jsx`), sem o tour virtual. Pontos de interesse e custo de vida saíram dos resultados. **O mapa da página do imóvel fica** (decisão da revisão): miniatura no cabeçalho, seção "Ubicación" e `ListingMap.jsx`. Favoritar e salvar busca exigem o login contextual simulado.
- **Feito:** mapa dos resultados como cartão flutuante (`MapFloat.jsx`) que abre o mapa no lugar do conteúdo principal dos resultados (`ResultsMap.jsx`, `map=full`): cabeçalho, barra de filtros e rodapé continuam, "Ver lista" fica no canto superior direito, o cartão flutuante é quadrado como o original, a roda do mouse rola a página e Ctrl/⌘ + roda aproxima no ponto do cursor, o card do imóvel é o mesmo dos resultados (acima do pin, ou ancorado à esquerda em mapas baixos), e não há divisão de tela; Desarrollos continua como operação, com a Torre Olmo (`primaryMarket.js`) no card e na página padrão, sem tour 3D; calculadora de custos, histórico de preço, comparação de ofertas, comparação de preços próximos, características por cômodo, "pergunte à Mora", seleção de texto com a Mora e o chat da Mora removidos; sinais de demanda e a ordenação "Rareza" removidos (ficam "Recomendados" e "Precio justo").
- **Feito:** a Mora deixou de responder sobre o bairro (lugares próximos, trajeto, metrô, segurança e vizinhança saíram da análise, do veredito e da leitura da página; o resumo escrito dos fixtures não é mais usado). As seções de vida no bairro continuam na página do imóvel ("Así se vive en…") e nos resultados ("Conoce todo sobre cómo es vivir en…"). `moraFactSheet.js`, os fixtures e os scripts `mora:*` ainda leem dados do bairro: são ferramentas offline.
- **Feito:** busca conversacional removida. A home usa o layout de busca livre com "Quiero [operação] [tipo de imóvel]" e um campo de localização (`LocationField.jsx`) que só aceita lugares do catálogo, com autocomplete, sugestões e o limite de três lugares; a busca só começa com um lugar escolhido. Na página de resultados o layout da barra continua, e o campo da Mora virou o campo de localização; "Ciudad de México" saiu da lista de filtros. Saíram o Smart Input, as perguntas da Mora na barra, os passos de refinamento e as variantes híbrida, inline e original da home.
- **Feito:** o guia do apresentador ("Ten stops", `ProjectGuide.jsx` e `guideStops.js`) voltou, reescrito para as dez paradas desta versão: busca da home, barra de resultados, sinais de preço, mapa, mercado primário, página do imóvel, conteúdo SEO, contato, login e favoritos. `?guide=off` esconde o guia. A home volta ao layout de busca livre original ("Describe el hogar que imaginas"), com o campo de localização no lugar do texto livre.
- **Feito:** ponto de entrada da Mora/Bianca (`MoraEntry.jsx`, desenho do Figma "Rediseño del listado 2025") na página do imóvel e nos resultados: sem pergunta ao vivo; os resultados mostram perguntas sugeridas que só levam a pergunta para "No app" ou "No WhatsApp" (atalhos simulados, nada abre nem é enviado). A miniatura do mapa voltou ao bloco da região nos resultados (`RegionMap.jsx`).
- **Pendente:** `searchCriteria.js` ainda tem as funções de linguagem natural (sem uso na interface), perfilamento progressivo e intenção guiada, contatos enviados e o acompanhamento. `listing-panel.css`, `mini-listing.css` e `favorite-folders.css` ainda têm regras de telas removidas e precisam ser migrados e apagados com cuidado, porque o login e o contato usam classes `lp-*` e `folder-*`. `FLOW.md`, `ARCHITECTURE.md` e `DESIGN-HANDOFF.md` serão reescritos ao fim.
- **CSS:** `favorite-folders.css` ainda tem regras das pastas removidas; parte dele (`folder-toast`, `folder-primary`) é usada por `Account.jsx` e precisa ser migrada antes de apagar o resto.
