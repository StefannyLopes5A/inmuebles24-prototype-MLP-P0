---
target: mini-listing (ListingPanel)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/giovanni.alberique/Documents/inmuebles24-prototype/src/ListingPanel.jsx"
target_fingerprint: "sha256:7bbb31f3ef459752fdb1d56caedeff6b59a7d1ea3fb45321a1e658659febf843"
target_path: /Users/giovanni.alberique/Documents/inmuebles24-prototype/src/ListingPanel.jsx
timestamp: 2026-10-12T21-25-33Z
slug: src-listingpanel-jsx
---
# Crítica: mini-listing (ListingPanel)

Pontuação Nielsen 28/40. Detector CLI: 0 achados. Overlay no navegador: 1 achado real (contraste do CTA primário, 3.0:1); as oclusões vêm da grade recuada sob o painel.

## Diagnóstico central
O problema não é espaço vazio (só 7% da coluna fica sem conteúdo a 1920×1080), mas textura: a coluna de leitura usa 4 cores (preto, preto 72%, #222, branco), 0 superfícies internas, 0 barras grossas e 0 tags. O stack da Mora no mapa usa vermelho de marca #e45244, laranja #f50, tags, barras de 6 px, números-herói ("Metro a 7 min") e cards aninhados. O painel é um documento; o resto do projeto é um painel de evidências.

## Issues
- P1 A Mora do painel é prosa, não evidência: módulos viram linhas de 14 px a 72%. Fix: cada módulo com número-herói + rótulo + barra/tag, numa superfície #f7f7f7 de raio 16.
- P1 A identidade da Mora diverge do mapa: rótulo preto 14 px contra vermelho 12/700 no mapa. Fix: reaproveitar o kicker de marca e as tags do map-widget.
- P2 Ritmo vertical gasta linhas de Mora: gap de 20, margem de 30 na régua e padding de topo de 28 custam cerca de 2 módulos por causa do fit. Fix: escala 12/16/24.
- P2 Match sem placar: segmentos de 4 px e chips planos. Fix: herói "3 de 5" e segmentos de 6 px laranja.
- P2 CTA primário a 3.0:1 (branco sobre #fe6439, 16/600). Fix: texto 18/700 ou laranja mais escuro no fundo; decisão de marca global.

## Plano
1. Mora como stack de evidências (layout + colorize).
2. Banda comercial: preço e specs mais densos (typeset).
3. Placar do match (bolder + delight).
4. Ritmo e contraste (polish).
