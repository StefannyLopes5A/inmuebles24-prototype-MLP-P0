import React, {useId, useMemo} from 'react';
import {useLanguage} from './i18n';
import {normalizeSearch} from './journey';
import {COST_ITEMS, livingCosts} from './costOfLiving.js';

const asset = name => `/assets/cost-of-living/${name}.svg`;

/** Results section from Figma 12900:13506: monthly costs around the searched colonia, estimates labelled as such. */
export function CostOfLiving({search, onPrices}) {
  const {language, money} = useLanguage();
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = normalizeSearch(search);
  const key = JSON.stringify([current.mode, current.areas, current.beds]);
  const costs = useMemo(() => livingCosts(search), [key]);
  const id = useId();
  if (!costs) return null;

  const {area, size, people, items} = costs;
  const peopleText = people === 1 ? say('1 pessoa', '1 persona') : say(`${people} pessoas`, `${people} personas`);
  const {maintenance, insurance} = items;
  const copy = {
    groceries: [say('Mercado', 'Despensa'), say(`Compras do mês para ${peopleText}, estimativa`, `Súper del mes para ${peopleText}, estimado`)],
    electricity: [say('Eletricidade', 'Electricidad'), say(`Estimativa para ${size} m² com tarifa doméstica`, `Estimado para ${size} m² con tarifa doméstica`)],
    gas: [say('Gás LP', 'Gas LP'), say(`Botijão para cozinhar, ${peopleText}, estimativa`, `Cilindro para cocinar, ${peopleText}, estimado`)],
    transport: [say('Transporte', 'Transporte'), say(`Deslocamento do mês para ${peopleText}, estimativa`, `Traslado del mes para ${peopleText}, estimado`)],
    water: [say('Água', 'Agua potable'), say(`Estimativa para ${size} m²`, `Estimado para ${size} m²`)],
    internet: [say('Internet', 'Conexión a internet'), say('Fibra de 200 Mbps, tarifa típica', 'Fibra de 200 Mbps, tarifa típica')],
    maintenance: [say('Condomínio', 'Mantenimiento mensual'), maintenance.count > 1
      ? say(`Mediana de ${maintenance.count} anúncios em ${area}`, `Mediana de ${maintenance.count} anuncios en ${area}`)
      : maintenance.count === 1
        ? say(`Publicado em 1 anúncio de ${area}`, `Publicado en 1 anuncio de ${area}`)
        : say(`Nenhum anúncio de ${area} informa; confirme com a imobiliária`, `Ningún anuncio de ${area} lo publica; confírmalo con la inmobiliaria`)],
    insurance: [say('Seguro residencial', 'Seguro de hogar'), insurance.kind === 'contents'
      ? say('Seguro de conteúdo para inquilinos, estimativa', 'Seguro de contenidos para inquilinos, estimado')
      : say('Estimativa: 0,15% ao ano do preço médio', 'Estimado: 0.15% anual del precio medio')],
  };

  return <section className="cost-of-living" tabIndex={-1} aria-labelledby={`${id}-title`}>
    <div className="cost-of-living-head">
      <div className="cost-of-living-heading">
        <h2 id={`${id}-title`}>{say(`Custo de vida para morar em ${area}`, `Costo de vida para vivir en ${area}`)}</h2>
        <p>{say(`Comparativo de gastos mensais em ${area}`, `Comparativa de gastos mensuales en ${area}`)}</p>
      </div>
      <button type="button" className="cost-of-living-cta" onClick={onPrices}>
        {say('Ver preços da região', 'Ver precios de la zona')}
        <img src="/assets/price-insights/arrow-forward.svg" width="16" height="16" alt=""/>
      </button>
    </div>
    <ul className="cost-of-living-grid">
      {COST_ITEMS.map(item => {
        const {amount} = items[item];
        const [title, detail] = copy[item];
        return <li key={item} className="cost-card" data-item={item} data-basis={items[item].basis}>
          <div className="cost-card-top">
            {amount == null
              ? <p className="cost-card-amount is-unknown">{say('A confirmar', 'Por confirmar')}</p>
              : <p className="cost-card-amount">{money(amount)}/<span>{say('mês', 'mes')}</span></p>}
            <img src={asset(item)} width="24" height="24" alt=""/>
          </div>
          <div className="cost-card-copy">
            <h3>{title}</h3>
            <p>{detail}</p>
          </div>
        </li>;
      })}
    </ul>
  </section>;
}
