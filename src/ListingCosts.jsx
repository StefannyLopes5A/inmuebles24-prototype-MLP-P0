import React, {useEffect, useId, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {COST_DEFAULTS, INCOME_SHARE, clampCost, purchaseCosts} from './purchaseCosts';

const MORA_MARK = '/assets/mini-listing/mora.svg';
const ICON = name => `/assets/cost-calculator/${name}.svg`;
const YEAR_CHOICES = [10, 20, 25];

const number = text => {
  const value = Number(String(text).replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
};
const digits = text => {
  const value = Number(String(text).replace(/\D/g, ''));
  return value > 0 ? value : null;
};

/** A summary cell that turns into its inputs; Enter or leaving the cell applies, Escape keeps the last value. */
function Field({label, value, editing, onEdit, onDone, children}) {
  const button = useRef(null), form = useRef(null), was = useRef(false);
  useEffect(() => {
    if (editing) form.current?.querySelector('input')?.focus();
    else if (was.current) button.current?.focus();
    was.current = editing;
  }, [editing]);
  return <div className="pp-cost-field">
    {editing
      ? <form ref={form} className="pp-cost-edit" onSubmit={event => { event.preventDefault(); onDone(true); }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onDone(false); } }}
        onBlur={event => { if (!form.current?.contains(event.relatedTarget)) onDone(true); }}>
        <span className="pp-cost-label">{label}</span>
        <div className="pp-cost-inputs">{children}</div>
        <button type="submit" className="sr-only">OK</button>
      </form>
      : <button ref={button} type="button" className="pp-cost-show" onClick={onEdit}>
        <span className="pp-cost-label">{label}</span>
        <strong className="pp-cost-value">{value}</strong>
      </button>}
  </div>;
}

function Input({label, value, onChange, mode = 'decimal', width}) {
  return <label className="pp-cost-input" style={width ? {'--w':width} : undefined}>
    <span className="sr-only">{label}</span>
    <input type="text" inputMode={mode} value={value} onChange={event => onChange(event.target.value)} autoComplete="off"/>
  </label>;
}

/** Years open in a short menu, the same card as the account menu: white, rounded, one row per option. */
function YearMenu({id, choices, value, say, reduce, onChoose, onClose}) {
  const menu = useRef(null);
  useEffect(() => { menu.current?.querySelector('[aria-checked="true"]')?.focus(); }, []);
  const onKeyDown = event => {
    const list = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
    const index = list.indexOf(document.activeElement);
    const move = next => { event.preventDefault(); list[(next + list.length) % list.length]?.focus(); };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index < 0 ? 0 : index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if (event.key === 'Tab') onClose();
  };
  const hidden = reduce ? {opacity:0} : {opacity:0, transform:'scale(0.95)'};
  return <motion.div ref={menu} id={id} role="menu" aria-label={say('Prazo em anos', 'Plazo en años')} className="pp-cost-menu" onKeyDown={onKeyDown}
    initial={hidden} animate={{opacity:1, transform:'scale(1)'}} exit={hidden} transition={{duration:reduce ? 0.15 : 0.18, ease:[0.2, 0.8, 0.2, 1]}}>
    {choices.map(years => <button key={years} type="button" role="menuitemradio" aria-checked={years === value} tabIndex={-1} onClick={() => onChoose(years)}>
      {say(`${years} anos`, `${years} años`)}
    </button>)}
  </motion.div>;
}

/** Calculadora de costos: what this sale asks on signing day, and, if the person wants, the monthly payment. */
export function ListingCosts({price, money, currency, language, say, onAsk, expanded = false, insight = null}) {
  const defaults = {offer:price, ...COST_DEFAULTS};
  const [values, setValues] = useState(defaults);
  const [editing, setEditing] = useState(null), [draft, setDraft] = useState({});
  const [yearsOpen, setYearsOpen] = useState(false);
  const [simulate, setSimulate] = useState(false), [income, setIncome] = useState('');
  const reduce = useReducedMotion();
  const yearsRoot = useRef(null), yearsButton = useRef(null);
  const simId = useId(), incomeId = useId(), yearsId = useId();
  const pt = language === 'pt-BR';
  const pct = share => (Math.round(share * 1000) / 10).toLocaleString(pt ? 'pt-BR' : 'es-MX');
  const costs = purchaseCosts(values);

  const edit = key => {
    setYearsOpen(false);
    setDraft({[key]:''});
    setEditing(key);
  };
  const chooseYears = years => {
    setValues(current => ({...current, years:clampCost('years', years)}));
    setYearsOpen(false);
    yearsButton.current?.focus();
  };
  const yearChoices = YEAR_CHOICES.includes(values.years) ? YEAR_CHOICES : [...YEAR_CHOICES, values.years].sort((a, b) => a - b);
  useEffect(() => {
    if (!yearsOpen) return undefined;
    const outside = event => { if (!yearsRoot.current?.contains(event.target)) setYearsOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [yearsOpen]);
  const done = apply => {
    if (apply) setValues(current => {
      const next = {...current};
      if (editing === 'offer' && digits(draft.offer)) next.offer = clampCost('offer', digits(draft.offer));
      if (editing === 'down' && number(draft.down)) next.down = clampCost('down', number(draft.down) / 100);
      return next;
    });
    setEditing(null);
  };
  const set = key => value => setDraft(current => ({...current, [key]:value}));

  const earning = digits(income);
  const share = earning ? costs.monthly / earning : null;
  const fit = share == null ? null
    : share <= INCOME_SHARE ? say(`Cabe: a parcela seria ${pct(share)}% da sua renda, dentro dos ${pct(INCOME_SHARE)}% que os bancos costumam aceitar.`, `Cabe: la mensualidad sería el ${pct(share)}% de tu ingreso, dentro del ${pct(INCOME_SHARE)}% que suelen aceptar los bancos.`)
    : share <= 0.4 ? say(`Fica justo: a parcela seria ${pct(share)}% da sua renda, acima dos ${pct(INCOME_SHARE)}% que os bancos costumam aceitar. Uma entrada maior ou um prazo mais longo ajudam.`, `Queda justo: la mensualidad sería el ${pct(share)}% de tu ingreso, arriba del ${pct(INCOME_SHARE)}% que suelen aceptar los bancos. Más enganche o más plazo ayudan.`)
    : say(`Não cabe: a parcela seria ${pct(share)}% da sua renda. Com esta oferta, os bancos costumam pedir uma renda de ${money(costs.income)} por mês.`, `No cabe: la mensualidad sería el ${pct(share)}% de tu ingreso. Con esta oferta, los bancos suelen pedir un ingreso de ${money(costs.income)} al mes.`);
  const question = say('O que muda com a entrada', 'Qué cambia con el enganche');

  return <div className="pp-block">
    <div className="pp-costs-head">
      <div className="pp-costs-title">
        <h2 id="pp-costs-title" className="pp-section-title">{say('Calculadora de custos', 'Calculadora de costos')}</h2>
        <button type="button" className="pp-mora-pill" aria-expanded={expanded} onClick={event => onAsk?.({section:'costs', question, source:event.currentTarget})}><img src={MORA_MARK} alt="" width="16" height="16"/><span>{question}</span></button>
      </div>
    </div>
    {insight}
    <div className="pp-costs">

      <div className="pp-cost-fields">
        <Field label={say('Valor da oferta', 'Valor de la oferta')} value={`${money(values.offer)} ${currency}`} editing={editing === 'offer'} onEdit={() => edit('offer')} onDone={done}>
          <Input label={say('Valor da oferta em MXN', 'Valor de la oferta en MXN')} mode="numeric" value={draft.offer ?? ''} onChange={set('offer')}/>
        </Field>
        <Field label={say('Entrada', 'Entrada')} value={`${pct(values.down)}% · ${money(costs.enganche)}`} editing={editing === 'down'} onEdit={() => edit('down')} onDone={done}>
          <Input label={say('Entrada em porcentagem', 'Enganche en porcentaje')} value={draft.down ?? ''} onChange={set('down')} width="6ch"/>
        </Field>
        <div className="pp-cost-field pp-cost-term" ref={yearsRoot}>
          <button ref={yearsButton} type="button" className="pp-cost-show" aria-haspopup="menu" aria-expanded={yearsOpen} aria-controls={yearsOpen ? yearsId : undefined}
            onClick={() => { setEditing(null); setYearsOpen(open => !open); }}
            onKeyDown={event => { if (event.key === 'ArrowDown' && !yearsOpen) { event.preventDefault(); setEditing(null); setYearsOpen(true); } }}>
            <span className="pp-cost-label">{say('Prazo em anos', 'Plazo en años')}</span>
            <strong className="pp-cost-value">{say(`${values.years} anos · ${pct(values.rate)}% fixa`, `${values.years} años · ${pct(values.rate)}% fija`)}</strong>
          </button>
          <AnimatePresence>
            {yearsOpen && <YearMenu key="years" id={yearsId} choices={yearChoices} value={values.years} say={say} reduce={reduce} onChoose={chooseYears} onClose={() => { setYearsOpen(false); yearsButton.current?.focus(); }}/>}
          </AnimatePresence>
        </div>
      </div>

      <div className="pp-cost-summary" aria-live="polite">
        <p className="pp-cost-total"><strong>{money(costs.upfront)} {currency}</strong><span>{say('Valor efetivo total', 'Valor efectivo total')}</span></p>
        <dl className="pp-cost-list">
          <div><dt>{say('Entrada', 'Enganche')}</dt><dd>{money(costs.enganche)}</dd></div>
          <div><dt>{say('Imposto de aquisição (ISAI)', 'Impuesto de adquisición (ISAI)')}</dt><dd>{money(costs.isai)}</dd></div>
          <div><dt>{say('Cartório, escritura e avaliação', 'Notaría, escrituración y avalúo')}</dt><dd>{money(costs.closing)}</dd></div>
        </dl>
      </div>

      <div className="pp-cost-foot">
        <div className="pp-cost-foot-copy">
          <p>{say('Quer saber se cabe na sua renda?', '¿Quieres saber si cabe en tus ingresos?')}</p>
          <p>{say('Exercício local, sem consulta ao Buró de Crédito.', 'Ejercicio local, sin impacto en Buró de Crédito.')}</p>
        </div>
        <button type="button" className="mini-primary pp-cost-simulate" aria-expanded={simulate} aria-controls={simId} onClick={() => setSimulate(open => !open)}>
          <span>{say('Simular financiamento', 'Simular financiamiento')}</span><img src={ICON('arrow-forward-light')} alt="" width="16" height="16"/>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {simulate && <motion.div key="sim" id={simId} className="pp-cost-sim" initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}
          transition={reduce ? {duration:0} : {duration:0.25, ease:[0.2, 0.8, 0.2, 1]}}>
          <div className="pp-cost-sim-inner">
            <dl className="pp-cost-sim-facts">
              <div><dt>{say('Parcela estimada', 'Mensualidad estimada')}</dt><dd>{money(costs.monthly)}<small> / {say('mês', 'mes')}</small></dd></div>
              <div><dt>{say('Valor financiado', 'Monto del crédito')}</dt><dd>{money(costs.principal)}</dd></div>
              <div><dt>{say(`Juros em ${values.years} anos`, `Intereses en ${values.years} años`)}</dt><dd>{money(costs.interest)}</dd></div>
            </dl>
            <div className="pp-cost-income">
              <label htmlFor={incomeId}>{say('Sua renda mensal', 'Tu ingreso mensual')}</label>
              <div className="pp-cost-input is-income">
                <input id={incomeId} type="text" inputMode="numeric" autoComplete="off" placeholder={say(`Por exemplo, ${money(costs.income)}`, `Por ejemplo, ${money(costs.income)}`)} value={income} onChange={event => setIncome(event.target.value)}/>
                <span aria-hidden="true">{currency}</span>
              </div>
              <p className="pp-cost-fit" aria-live="polite">{fit || say(`Para a parcela não passar de ${pct(INCOME_SHARE)}% da renda, os bancos costumam pedir uns ${money(costs.income)} por mês.`, `Para que la mensualidad no pase del ${pct(INCOME_SHARE)}% del ingreso, los bancos suelen pedir unos ${money(costs.income)} al mes.`)}</p>
            </div>
            <p className="pp-cost-source">{say('Taxas ilustrativas da CDMX. O cartório e o banco fecham os números; nada sai daqui.', 'Tasas ilustrativas de CDMX. El notario y el banco cierran los números; nada sale de aquí.')}</p>
          </div>
        </motion.div>}
      </AnimatePresence>
    </div>
  </div>;
}
