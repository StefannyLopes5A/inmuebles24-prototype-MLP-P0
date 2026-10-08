import React, {useLayoutEffect, useRef, useState} from 'react';
import {Icon} from './App';
import {listingPrice} from './data';
import {useLanguage} from './i18n';
import {ListingAttributes, ListingBroker, MoraName} from './MiniListing';
import {listingDetails, listingSummary} from './listingPresentation';

/** A local listing page. Contact returns to the same search bar above this page. */
export function PropertyDetail({home, search, onClose, onContact, receipt}) {
  const {language, money, currency} = useLanguage(), pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const [photo, setPhoto] = useState(0), title = useRef(null);
  const details = listingDetails(home), summary = listingSummary(home, search, 'none', language);
  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  return <article className="property-page">
    <button className="property-return" onClick={onClose}><Icon name="back"/>{say('Voltar à busca', 'Volver a la búsqueda')}</button>
    <header className="property-page-title"><p>{say(home.mode === 'rent' ? 'Alugar · Apartamento' : 'Comprar · Apartamento', home.mode === 'rent' ? 'Rentar · Departamento' : 'Comprar · Departamento')}</p><h1 ref={title} tabIndex={-1}>{home.street}, {home.area}</h1><p>{home.location || home.area}, {say('Cidade do México', 'Ciudad de México')}</p></header>
    <div className="property-page-layout">
      <div className="property-page-gallery"><img src={details.gallery[photo]} alt={home.imageAlt}/><span className="mini-photo-tag">{say('Foto do imóvel', 'Foto del inmueble')} · {photo + 1}/{details.gallery.length}</span>{details.gallery.length > 1 && <div className="property-gallery-controls"><button onClick={() => setPhoto((photo + details.gallery.length - 1) % details.gallery.length)} aria-label={say('Foto anterior', 'Foto anterior')}><Icon name="back"/></button><button onClick={() => setPhoto((photo + 1) % details.gallery.length)} aria-label={say('Próxima foto', 'Siguiente foto')}><Icon name="arrow"/></button></div>}</div>

    <aside className="property-page-contact"><p className="property-page-price">{money(listingPrice(home))} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</p><p className="property-page-fee">{home.fee ? say(`Condomínio informado: ${money(home.fee)} ${currency}`, `Mantenimiento publicado: ${money(home.fee)} ${currency}`) : say('Condomínio a confirmar', 'Mantenimiento a confirmar')}</p><MoraName/><div className="mini-highlights"><div><h3>{say('Vale considerar', 'Vale la pena considerar')}</h3><ul>{summary.considerations.map(text => <li key={text}>{text}</li>)}</ul></div></div><div className="property-page-actions"><button className="mini-primary" onClick={() => onContact('message')}>{say('Falar com imobiliária', 'Hablar con inmobiliaria')}</button><button className="mini-secondary" onClick={() => onContact('visit')}>{say('Solicitar visita', 'Solicitar visita')}</button></div>{receipt && <p className="property-page-receipt"><Icon name="check" size={16}/>{say('Contato simulado registrado', 'Contacto simulado registrado')}</p>}</aside>
      <section className="property-page-information"><h2>{say('Sobre o imóvel', 'Sobre el inmueble')}</h2><ListingAttributes home={home}/><p>{home.beds == null || home.baths == null ? say(home.size >= 20 ? `São ${home.size} m² em ${home.area}. Quartos ou banheiros ainda precisam ser confirmados.` : `Apartamento em ${home.area}. Quartos ou banheiros ainda precisam ser confirmados.`, home.size >= 20 ? `Son ${home.size} m² en ${home.area}. Recámaras o baños aún necesitan confirmación.` : `Departamento en ${home.area}. Recámaras o baños aún necesitan confirmación.`) : home.size >= 20 ? say(`São ${home.size} m², com ${home.beds} quartos e ${home.baths} banheiros, em ${home.area}.`, `Son ${home.size} m², con ${home.beds} recámaras y ${home.baths} baños, en ${home.area}.`) : say(`Apartamento com ${home.beds} quartos e ${home.baths} banheiros, em ${home.area}.`, `Departamento con ${home.beds} recámaras y ${home.baths} baños, en ${home.area}.`)}</p><p>{say('Confirme a distribuição, as medidas dos ambientes e a disponibilidade com o anunciante.', 'Confirma la distribución, las medidas de cada ambiente y la disponibilidad con el anunciante.')}</p><ListingBroker home={home}/></section>
    </div>
  </article>;
}
