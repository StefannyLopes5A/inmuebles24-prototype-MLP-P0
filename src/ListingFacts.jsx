import React from 'react';
import {Icon} from './App';
import {areaLabel} from './data';
import {useLanguage, roomCount, bathCount} from './i18n';
import agencies from '../AGENCY-SOURCES.json';
import {listingDetails} from './listingPresentation';
import {contactRecipient} from './contactFlow';

const asset = name => `/assets/mini-listing/${name}.svg`;

export function ListingAttributes({home}) {
  const {language, t} = useLanguage();
  const pt = language === 'pt-BR', extra = listingDetails(home);
  const say = (br, es) => pt ? br : es;
  const items = [
    ['area', t(areaLabel(home))], ['bed', roomCount(home.beds, language)], ['bath', bathCount(home.baths, language)],
    ['car', extra.parking === null ? say('Vagas a confirmar', 'Estacionamiento a confirmar') : `${extra.parking} ${say(extra.parking === 1 ? 'vaga' : 'vagas', extra.parking === 1 ? 'estacionamiento' : 'estacionamientos')}`],
    ['pets', extra.pets === null ? say('Pets a confirmar', 'Mascotas a confirmar') : extra.pets ? say('Aceita pets', 'Acepta mascotas') : say('Não aceita pets', 'No acepta mascotas')],
    ['floor', extra.floor === null ? say('Andar a confirmar', 'Piso a confirmar') : say(`${extra.floor}º andar`, `Piso ${extra.floor}`)],
  ];
  return <ul className="mini-attributes">{items.map(([name, label]) => <li key={name}><img src={asset(name)} alt=""/><span>{label}</span></li>)}</ul>;
}

export function ListingBroker({home}) {
  const {language} = useLanguage();
  const recipient = contactRecipient(home, agencies.logos, language);
  return <div className="mini-broker">
    {recipient.logo ? <img className="mini-broker-logo" src={recipient.logo} alt=""/> : <span className="mini-broker-placeholder" aria-hidden="true"><Icon name="home" size={24}/></span>}
    <div><strong>{recipient.verified ? recipient.name : language === 'pt-BR' ? 'Anunciante do imóvel' : 'Anunciante del inmueble'}</strong><p>{home.street}, {home.area}</p></div>
  </div>;
}
