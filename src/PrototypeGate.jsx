import React, {useId, useState} from 'react';
import {BrandMark} from './BrandMark.jsx';
import {passwordMatches} from './prototypeAccess.js';

/** Full-screen door shown before the prototype. A wrong value stays on this screen. */
export function PrototypeGate({expected, onUnlock}) {
  const titleId = useId();
  const errorId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = event => {
    event.preventDefault();
    if (!value) {
      setError('Informe a senha.');
      return;
    }
    if (passwordMatches(value, expected)) {
      onUnlock();
      return;
    }
    setError('Senha incorreta.');
  };

  return <main className="prototype-gate">
    <form onSubmit={submit} aria-labelledby={titleId}>
      <BrandMark className="prototype-gate-logo" title="inmuebles24"/>
      <h1 id={titleId}>Informe a senha para<br/>visualizar o protótipo</h1>
      <label className="sr-only" htmlFor="prototype-password">Senha</label>
      <input id="prototype-password" type="password" name="password" autoComplete="current-password" autoFocus
        value={value} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
        onChange={event => {setValue(event.target.value); if (error) setError('');}}/>
      {error ? <p id={errorId} className="prototype-gate-error" role="alert">{error}</p> : null}
      <button type="submit">Enviar</button>
    </form>
  </main>;
}
