# Mapa local · proveniência

Todos os arquivos desta pasta são servidos pelo próprio protótipo. O mapa não faz requisições a serviços externos em tempo de execução.

| Arquivo | Origem | Licença |
| --- | --- | --- |
| `cdmx.pmtiles` | Recorte do build diário Protomaps `20261007.pmtiles` (basemap v4.15.2, dados OSM de 07/10/2026), via `pmtiles extract` 1.31.2. | Dados © colaboradores do OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright). Atribuição exibida no mapa. |
| `fonts/Noto Sans {Regular,Medium,Italic}/{0-255,256-511,8192-8447}.pbf` | [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets), pasta `fonts/`. | Noto Sans, SIL Open Font License 1.1. |
| `sprites/light{,@2x}.{json,png}` | [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets), pasta `sprites/v4/`. | Licença do repositório basemaps-assets. |
| `maki/{rail-metro,school,park,hospital,cafe,restaurant,shop,grocery}.svg` | [mapbox/maki](https://github.com/mapbox/maki), pasta `icons/` (commit `28e2a36`), sem edição. | CC0 1.0. |

## Recriar o recorte

```sh
pmtiles extract https://build.protomaps.com/20261007.pmtiles public/assets/map/cdmx.pmtiles \
  --bbox=-99.36,19.25,-99.05,19.55 --maxzoom=15
```

A bbox cobre as colônias do catálogo local (Cidade do México). Zoom acima de 15 usa overzoom dos tiles vetoriais. O arquivo precisa ficar abaixo de 25 MiB, limite por arquivo dos assets estáticos da hospedagem; o worker repassa o cabeçalho `Range` sem alterar (teste em `tests/sites-worker.test.mjs`). Só as faixas latinas dos glifos foram copiadas; rótulos em outros alfabetos não são exibidos.

As coordenadas dos imóveis não vêm do anúncio: `src/mapLocations.js` usa o centroide aproximado da colônia e um deslocamento determinístico. Por isso o mapa sempre apresenta a localização como aproximada.

Os contornos do seletor de localização ficam em `src/data/colonias.json` (arquivo local do protótipo). Cada feature usa `properties.name` igual ao texto do seletor e `properties.nivel` `colonia` ou `alcaldia`. **Ciudad de México** não tem polígono. Nove colonias do catálogo ainda não entram no arquivo; nesses casos o mapa não desenha recorte e só enquadra os anúncios. O runtime não busca geometria em serviço externo.

Os pontos de interesse ficam em `src/data/pois.json` (5.179 pontos, ids `node/…`, `way/…` e `relation/…` do OpenStreetMap, dados © colaboradores do OpenStreetMap, ODbL). Cada feature traz `properties.name`, `properties.categoria` (`metro`, `escola`, `parque`, `hospital`, `cafe`, `bar_restaurante`, `comercio`, `supermercado`) e `properties.areas`, com os mesmos nomes do seletor. O arquivo é lido localmente; nome e categoria vêm do OSM e não foram conferidos ponto a ponto. A camada `pois` do basemap fica oculta para não duplicar esses pontos.
