# Cenas do protótipo para vídeo

Guia para uma IA que vai preparar um vídeo a partir do protótipo. Cada ficha diz o que a superfície significa, como chegar nela e o que não pode ser inventado. As fichas são independentes: não há ordem de cortes nem narração. Quem monta o vídeo escolhe as cenas e a sequência.

O texto guia está em português. Toda frase entre aspas que aparece na tela está em espanhol mexicano, o idioma padrão da interface.

## Antes de gravar

Suba o protótipo conforme o [README](../README.md):

```bash
npm run dev -- --host 127.0.0.1 --port 5180
```

Busca reproduzível usada em todas as fichas (comprar, departamento, Narvarte Poniente, 2 recámaras, até MXN 7.500.000):

```text
/?view=results&mode=buy&type=apartment&areas=Narvarte%20Poniente&budget=7500000&beds=2
```

Regras que valem para qualquer cena:

- Tudo é simulado no navegador. Nenhuma mensagem, pergunta, visita ou login sai do computador. O vídeo não deve sugerir envio real, agenda real ou resposta real da imobiliária.
- Preferência da pessoa não é fato do imóvel. Se a busca pede algo que o anúncio não diz, a interface mostra “a confirmar” ou transforma em pergunta; o vídeo não deve afirmar que o imóvel tem aquilo.
- Use dados fictícios em qualquer formulário (por exemplo `Pessoa Teste`).
- Quadro de referência: desktop, por volta de 1512 × 982. Os widgets da Mora no mapa só existem na tela cheia a partir de 951 px de largura.
- Fora deste guia: recorrido 3D (Torre Olmo), formulário de contato, login simulado e troca de moeda ou idioma. Estão descritos em [FLOW.md](FLOW.md).

Para o tom da Mora em qualquer texto adaptado, siga [MORA.md](MORA.md): amiga especialista, frases curtas, interpreta em vez de descrever, sem exclamação nem emoji.

---

## Fichas de superfície

### 1. Busca na home

**O que é.** A primeira tela (Holofote). Uma frase editável descreve o que a pessoa procura: operação, tipo de imóvel, bairro, recámaras e orçamento. É o ponto de partida de toda a história: a intenção vem antes dos filtros.

**Como chegar.** Abra `/`. Toque na operação e escolha “Comprar”; toque no tipo e escolha “Departamento”. Ajuste bairro, recámaras e orçamento na própria frase. O botão de busca só libera depois das duas primeiras escolhas, mesmo que os valores sugeridos já estejam certos. Uma das ideias da home (carrosséis abaixo) também aplica uma busca completa.

**O que está na tela.** A frase grande com os campos sublinhados, os menus que abrem de cada campo, o histograma de orçamento manipulável e, abaixo, cinco carrosséis de imóveis.

**Estados que valem mostrar.** A frase sendo editada; o menu de orçamento com o histograma; a transição Onda, em que a primeira dobra se recolhe na barra compacta e a grade aparece.

**Limite.** O histograma é ilustrativo: não é contagem real de anúncios.

Referência: [src/Home.jsx](../src/Home.jsx), [src/HomeSearch.jsx](../src/HomeSearch.jsx).

### 2. Página de resultados

**O que é.** A grade de imóveis com a barra compacta no topo. A barra é ao mesmo tempo filtro e conversa com a Mora.

**Como chegar.** URL da busca reproduzível acima, ou buscar a partir da home.

**O que está na tela.** Barra branca com os filtros em laranja; grade de cards em quatro colunas; botão “Ver favoritos”; o mapa flutuante no canto inferior direito.

**Estados que valem mostrar.**

- Tocar um filtro expande a frase e abre o menu; mudar o valor atualiza a grade sem botão Aplicar.
- Smart Input: digitar `3 recámaras` ou `hasta 8 millones` vira token editável. Digitar uma pergunta não muda filtros.
- Digitar `vigilancia 24 horas` (ou `portería 24 horas`) cria o token `Vigilancia 24h`. É a preparação para a ficha 4.
- Depois de rolar e pausar, a Mora pode sugerir bairros vizinhos; a pessoa pode recusar.

**Limite.** Nem todo card corresponde exatamente à busca: a grade completa com sugestões do catálogo para ter pelo menos 40 imóveis.

Referência: [src/ResultsFlowPage.jsx](../src/ResultsFlowPage.jsx), [src/SearchBar.jsx](../src/SearchBar.jsx).

### 3. Mini-listing: o resumo da Mora

**O que é.** O painel que nasce do próprio card clicado, na mesma linha, com a grade recuada atrás. É onde a Mora resume o imóvel e onde a conversa acontece. Não é um modal, e o imóvel completo é outra página.

**Como chegar.** Nos resultados, clique em qualquer card.

**O que está na tela.** Foto (carrossel ou mosaico), preço, especificações conhecidas, a imobiliária no topo com selo, nota no Google e tempo de resposta. O veredito da Mora: uma frase escrita palavra por palavra, seguida de fatos em linhas. Dois botões: “Hablar de este inmueble con Mora” e “Ver inmueble completo”.

**Estados que valem mostrar.** O morph do card para o painel; a frase da Mora sendo escrita; trocar de imóvel com as setas sem fechar; um critério da busca sem dado aparecendo como “falta confirmar”.

**Limite.** Campos que o catálogo não tem (andar, vagas, pets, metragem por cômodo) não aparecem. Preço de mercado, nota do anunciante e tempos de deslocamento são dados de demonstração.

Referência: [src/ListingPanel.jsx](../src/ListingPanel.jsx), [src/MoraInsight.jsx](../src/MoraInsight.jsx).

### 4. Mini-listing: a pergunta que a Mora não sabe responder

**O que é.** O caso de uso central da conversa. A pessoa pergunta algo que o anúncio não diz, como portaria 24 horas. A Mora não inventa: diz que leu tudo, não achou, e oferece levar a pergunta à imobiliária.

**Como chegar.**

1. Na busca, inclua o token `Vigilancia 24h` (ficha 2) ou adicione `&criterion=security` à URL.
2. Abra um card e toque em “Hablar de este inmueble con Mora”.
3. Toque na sugestão “¿Tiene vigilancia 24 h?”, que aparece primeiro quando o anúncio não menciona o critério, ou digite `¿Tiene portería 24 horas?` no campo.

**O que está na tela.** A pergunta sobe como balão laranja claro. A Mora pensa por 900 ms e responde:

> Revisé el anuncio, las fotos y la descripción, y no encontré esa respuesta. ¿Quieres que le envíe tu pregunta a la inmobiliaria?

Abaixo, um cartão com a foto do imóvel, “Para {imobiliária}”, a pergunta e o tempo de resposta, com “Enviar pregunta” e “Ahora no”.

**Estados que valem mostrar.**

- “Enviar pregunta”: o cartão vira “Enviada a {imobiliária}” com um check, e a Mora diz quando a resposta costuma chegar (“Listo, le pasé tu pregunta a…”).
- “Ahora no”: o cartão vira “No enviada” e a Mora oferece enviar depois.
- Para contraste, “¿Sigue disponible?” é a pergunta que a Mora responde sozinha (“Sí, sigue disponible…”) e leva a “Quiero visitar el inmueble”, com dia e período, sem horário.
- “Volver a ver el resumen”, no rodapé, devolve o resumo.

**Limite.** Nada é enviado. Não há resposta da imobiliária para mostrar; o vídeo não deve encenar uma.

Referência: [src/moraChat.jsx](../src/moraChat.jsx), [src/moraAnalysis.js](../src/moraAnalysis.js).

### 5. A favor / A considerar

**O que é.** A leitura completa da Mora sobre o imóvel, separada no que ajuda e no que pesar. Fica na página interna, não no mini-listing.

**Como chegar.** No mini-listing, “Ver inmueble completo”. A leitura fica na coluna da esquerda, logo abaixo do resumo e do anunciante.

**O que está na tela.** Sem caixa: a mesma frase do veredito do mini-listing, para ser reconhecível, a nota “Mora lee el anuncio…” e duas colunas, “A favor” e “A considerar”, com até quatro linhas cada. Cada linha traz a evidência: a miniatura da foto que prova o espaço (abre a galeria), o metrô ou o trajeto, o m² em duas barras (este imóvel e parecidos da zona) ou uma pergunta pronta para o que o anúncio não diz.

**Estados que valem mostrar.** As linhas entrando uma após a outra; tocar a miniatura para abrir a foto; tocar a pergunta pronta.

**Limite.** A interna completa com conteúdo fictício e estável o que o catálogo não tem (galeria por cômodo, andar, comodidades), mas a leitura da Mora não trata isso como fato verificado.

Referência: `MoraOpening` em [src/MoraInsight.jsx](../src/MoraInsight.jsx), [src/moraDetail.js](../src/moraDetail.js), [src/PropertyDetail.jsx](../src/PropertyDetail.jsx).

### 6. Reseñas

**O que é.** A reputação da imobiliária lida pela Mora. Em vez de só uma nota, ela resume o que as pessoas dizem.

**Como chegar.** Na página interna, role até a seção de avaliações, ou toque na nota “★ … reseñas en Google” do anunciante.

**O que está na tela.** A nota grande, uma contagem que corre (“Leyendo … de N reseñas…”) até “leyó las N reseñas”, e um parágrafo assinado pela Mora do tipo “De N reseñas, más de la mitad dice que…”. Abaixo, as avaliações individuais com “Ver reseñas” e “Mostrar las N reseñas”.

**Limite.** São seis avaliações fictícias, por anúncio, e só existem na página interna.

Referência: [src/ListingReviews.jsx](../src/ListingReviews.jsx).

### 7. Mapa dentro do anúncio

**O que é.** A localização do imóvel na página interna, contada como vida no bairro, não só como pino.

**Como chegar.** Na página interna, seção “Ubicación”.

**O que está na tela.** O mapa com POIs, a nota “Ubicación aproximada: la dirección exacta se comparte al confirmar la visita.”, e, sem divisória, “Así se vive en {colônia}”: cápsulas brancas a favor e contra, barras dos vizinhos que crescem uma após a outra, e “A pie de aquí” com lugares e minutos a pé.

**Limite.** Os anúncios não têm coordenadas: o pino fica perto do centro da colônia, com deslocamento fixo. As porcentagens dos vizinhos são uma visão do protótipo.

Referência: [src/ListingSections.jsx](../src/ListingSections.jsx).

### 8. A experiência de mapa da busca

**O que é.** O mapa como forma de buscar, com a Mora explicando o lugar em widgets à esquerda. É a superfície mais rica em widgets (veja o catálogo abaixo).

**Como chegar.** Nos resultados, toque no mapa flutuante (canto inferior direito) para abrir a metade; o botão de expandir no canto do mapa (ícone, rótulo acessível “Ampliar mapa”) leva à tela cheia. Direto pela URL: acrescente `&map=half` ou `&map=full` à busca reproduzível.

**O que está na tela.**

- Flutuante: quadrado fixo no canto, só para abrir o mapa.
- Metade: mapa e grade lado a lado; passar o mouse num card destaca o pino.
- Tela cheia: pinos de preço, faixa de categorias de POI no topo e, no desktop, a pilha de widgets da Mora à esquerda.

**Estados que valem mostrar.**

- Cidade, colônia e imóvel: afastar o zoom muda a leitura para a cidade; tocar uma colônia aproxima; tocar um pino abre o card do imóvel e a leitura vira “Este inmueble en {rua}”.
- Os widgets entram de cima para baixo com o degradê laranja → azul na primeira vez.
- Ao selecionar um imóvel, os POIs a menos de 500 m aparecem em onda a partir dele.
- Recolher a pilha deixa o pill “Descubre más con Mora”; “Pregúntale a Mora” abre a barra com a pergunta pronta; “Volver a tu búsqueda” no rodapé do mapa.
- Esc fecha o painel, depois o card, depois a tela cheia.

**Limite.** Abaixo de 951 px não há metade nem widgets. Os tiles e POIs são locais (dados © OpenStreetMap). Segurança aparece só como percepção comparada à CDMX, sem nota isolada.

Referência: [src/SearchMap.jsx](../src/SearchMap.jsx), [src/MapWidgetStack.jsx](../src/MapWidgetStack.jsx), [src/mapWidgets.js](../src/mapWidgets.js).

### 9. Comparativo de favoritos

**O que é.** Os imóveis salvos de uma lista lado a lado, com a Mora dizendo em que cada um ganha dos outros.

**Como chegar.**

1. Nos resultados, toque no coração vazio de um card. Crie uma lista (o nome vem preenchido com a busca) ou escolha uma existente.
2. Salve pelo menos dois imóveis na mesma lista. No terceiro favorito aparece o convite “No pierdas tus favoritos”; “Ignorar” segue sem conta.
3. Toque em “Ver favoritos” (rota `view=favorites`) e abra a lista (rota `view=compare&list={id}`).

A lista só existe na sessão do navegador: não há URL direta para uma lista nova.

**O que está na tela.** Uma coluna por imóvel (até cinco), do menor ao maior preço por m², com foto quadrada, checkbox e X. Três leituras por coluna: “Lo que destaca”, “Precio por m²” com selo “Mejor precio” e barra de quatro faixas, e “Qué hay cerca” com metrô, parque, escola e comida em minutos a pé, de bici ou de carro.

**Estados que valem mostrar.** “Comparando el inmueble…” com shimmer e a Mora escrevendo “Lo que destaca” uma coluna depois da outra; trocar o modo de deslocamento e ver o mais rápido mudar de destaque.

**Limite.** A comparação não inventa fatos do anúncio. Os checkboxes abrem um composer de contato simulado, fora deste guia.

Referência: [src/CompareFavorites.jsx](../src/CompareFavorites.jsx), [src/compareReading.js](../src/compareReading.js).

---

## Catálogo de widgets

Peças de referência para a outra IA usar e adaptar. Não formam sequência. Para cada uma: onde aparece, o que mostra, o visual e o que não afirma. O texto real muda com a colônia, o imóvel e a busca.

### Stack da Mora no mapa (tela cheia, desktop)

A pilha à esquerda muda com o nível do mapa. Todos os cards são brancos, sem caixa extra, sobre um véu de vidro; o primeiro é sempre o resumo assinado pela Mora.

| Nível | Widgets, de cima para baixo |
| --- | --- |
| Cidade | Resumo, Colonias que encajan, Precio en estas colonias, Tendencia del precio |
| Colônia | Resumo, um adaptativo (Cerca de ti, Traslados ou Riesgo del suelo), Precio en {colônia}, Tendencia del precio |
| Imóvel no pino | Resumo, Este depto vs. la colonia, Cerca de ti, Traslados |

- **Resumo.** Na cidade, “Lo que buscas está en el {região} de {alcaldía}”; na colônia, “Así se vive en {colônia}”; no imóvel, “Este inmueble en {rua}”. Frase da Mora com trechos destacados que acendem o widget ou a camada correspondente no hover. Tags como “{N} deptos” e “Zona en alza”, e barras de vizinhos (pet-friendly, bom para exercício, ruas iluminadas, percepção de segurança). Não é dado oficial de segurança.
- **Colonias que encajan.** As três colônias que concentram a oferta da busca, com barra de quantidade e preço por m². Tocar uma aproxima o mapa.
- **Precio en estas colonias / Precio en {colônia}.** Mediana do preço pedido por m², comparada com a colônia vizinha e a CDMX. Liga a camada de preço no mapa. Mediana do protótipo.
- **Tendencia del precio.** Doze meses em sparkline contra a CDMX, com “Sube más que CDMX”, “Al ritmo de CDMX” ou “Baja frente a CDMX”. Estimativa, não promessa de retorno.
- **Cerca de ti.** Quatro colunas (metrô, parques, escolas, cafés) contadas a partir de POIs reais na colônia ou a 500 m do imóvel. Uma coluna vazia cede lugar a súper, hospital, restaurantes ou comércio. Embaixo, até cinco nomes com minutos a pé.
- **Traslados.** Tempo até um destino declarado na busca, com anéis de 15, 30 e 45 min no mapa. Ilustrativo, não é rota calculada.
- **Riesgo del suelo.** Só em colônias de zona lacustre. Três barras (firme, transição, lacustre) e “Confirma con un especialista”. Não é laudo.
- **Este depto vs. la colonia.** O m² do anúncio numa régua contra a mediana da colônia: abaixo, na mediana ou acima.
- **Detalhe de cadeado.** Faixa discreta em preço e tendência (“Referencia para negociar”, “% exacto en 12 meses”) que leva ao login simulado.

### Peças de outras superfícies

- **Veredito do mini-listing.** Assinatura da Mora, uma frase em 16 px escrita palavra por palavra, fatos em linhas com ícone. A frase recebe um brilho laranja → azul a cada 6 s. Ficha 3.
- **Balão e cartão “Para {imobiliária}”.** Pergunta em balão laranja claro; cartão com foto, pergunta, tempo de resposta e os dois botões, que muda no lugar para “Enviada a…” ou “No enviada”. Ficha 4.
- **Seletor de visita.** Quatro dias (hoje mais três) e Mañana, Tarde ou Noche, sem horário; termina em “Intención enviada”. Ficha 4.
- **Linhas de “A favor” / “A considerar”.** Ícone, título, apoio e uma evidência: miniatura de foto, duas barras de m² ou pergunta pronta. Ficha 5.
- **Parágrafo das reseñas.** Contador que corre e resumo assinado. Ficha 6.
- **“Así se vive”.** Cápsulas a favor e contra, réguas de 4 px dos vizinhos, lista “A pie de aquí”. Ficha 7.
- **Colunas da comparação.** “Lo que destaca”, “Precio por m²” com selo e faixas, “Qué hay cerca” com seletor de modo. Ficha 9.
