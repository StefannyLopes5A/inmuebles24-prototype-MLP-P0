import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {detailTokens} from './homeSearchModel.js';
import {createDetailHistory} from './detailHistory.js';
import {HomePopover, homeAsset} from './HomeSearch.jsx';

const textOf = node => node.nodeType === Node.TEXT_NODE ? node.data.replace(/\u200b/g, '')
  : node.dataset?.token ? node.dataset.label : [...node.childNodes].map(textOf).join('');

function selectionOffset(root) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  const before = range.cloneRange(); before.selectNodeContents(root); before.setEnd(range.startContainer, range.startOffset);
  const start = textOf(before.cloneContents()).length;
  return {start, end:start + textOf(range.cloneContents()).length, collapsed:range.collapsed};
}

function placeCaret(root, offset) {
  const range = document.createRange(); let remaining = offset;
  for (const node of root.childNodes) {
    const size = textOf(node).length;
    if (remaining <= size && node.nodeType === Node.TEXT_NODE) {
      range.setStart(node, Math.min(node.length, remaining)); range.collapse(true);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); return;
    }
    if (remaining < size && node.dataset?.token) {range.setStartAfter(node);range.collapse(true);const selection = window.getSelection();selection.removeAllRanges();selection.addRange(range);return;}
    remaining -= size;
  }
  range.selectNodeContents(root);range.collapse(false);const selection = window.getSelection();selection.removeAllRanges();selection.addRange(range);
}

/** The browser owns editing; React only owns the popover and caret. Conversion never runs during IME composition. */
export function SearchDetails({value, onChange, language, placeholder, mobilePlaceholder, label, onSubmit, onFocus, onSettle, settleDelay=650, autoFocus=false, tokenMatcher=detailTokens}) {
  const editor = useRef(null);
  const wrapper = useRef(null);
  const composing = useRef(false);
  const timer = useRef(null);
  const lastValue = useRef(value);
  const history = useRef(createDetailHistory(value));
  const currentChange = useRef(onChange); currentChange.current = onChange;
  const currentSettle = useRef(onSettle); currentSettle.current = onSettle;
  const [tokenMenu, setTokenMenu] = useState(null);
  const [menuMotion, setMenuMotion] = useState(true);
  const [caret, setCaret] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const pt = language === 'pt-BR';

  function syncCaret(ensureVisible = false) {
    const root = editor.current;
    const selection = window.getSelection();
    if (!root || document.activeElement !== root || !selection?.isCollapsed || !selection.rangeCount || !root.contains(selection.anchorNode)) {setCaret(null);return;}
    const range = selection.getRangeAt(0).cloneRange();
    let rect = range.getClientRects()[0];
    if (!rect?.height) {
      const node = selection.anchorNode;
      if (node === root) {
        const previous = root.childNodes[selection.anchorOffset - 1];
        const next = root.childNodes[selection.anchorOffset];
        const box = (previous?.nodeType === Node.ELEMENT_NODE ? previous : next?.nodeType === Node.ELEMENT_NODE ? next : root).getBoundingClientRect();
        rect = {left:previous ? box.right : box.left, top:box.top, height:box.height};
      } else rect = root.getBoundingClientRect();
    }
    const box = wrapper.current.getBoundingClientRect();
    const height = parseFloat(getComputedStyle(root).fontSize) * 1.2;
    const editorBox = root.getBoundingClientRect();
    const top = rect.top + (Math.min(rect.height, height) - height) / 2;
    if (ensureVisible === true && root.scrollHeight > root.clientHeight) {
      const delta = top < editorBox.top ? top - editorBox.top : top + height > editorBox.bottom ? top + height - editorBox.bottom : 0;
      if (delta) {root.scrollTop += delta;syncCaret();return;}
    }
    if (top + height <= editorBox.top || top >= editorBox.bottom) {setCaret(null);return;}
    setCaret({left:rect.left - box.left, top:top - box.top, height});
  }

  function renderText(text, offset = null, animate = false) {
    const root = editor.current;
    const existingTokens = new Set([...root.querySelectorAll('[data-token]')].map(node => `${node.dataset.token}:${node.dataset.label}`));
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const tokens = tokenMatcher(text);
    for (const token of tokens) {
      fragment.append(document.createTextNode(text.slice(cursor, token.start)));
      const chip = document.createElement('button');
      chip.type = 'button';chip.contentEditable = 'false';chip.className = `detail-token${animate && !existingTokens.has(`${token.kind}:${token.text}`) ? ' token-converted' : ''}`;
      chip.dataset.token = token.kind;chip.dataset.label = token.text;
      chip.dataset.start = String(token.start);chip.dataset.end = String(token.end);
      chip.setAttribute('aria-label', token.kind !== 'furnishing' ? `${pt ? 'Remover' : 'Quitar'} ${token.text}` : `${pt ? 'Mobília' : 'Muebles'}: ${token.text}`);
      if (token.kind === 'furnishing') {chip.setAttribute('aria-haspopup', 'listbox');chip.setAttribute('aria-expanded', 'false');}
      const label = document.createElement('span');label.textContent = token.text;
      const icon = document.createElement('img');icon.src = homeAsset(token.kind !== 'furnishing' ? 'close' : 'chevron');icon.alt = '';
      chip.append(label, icon);fragment.append(chip);cursor = token.end;
    }
    fragment.append(document.createTextNode(text.slice(cursor) || '\u200b'));
    root.replaceChildren(fragment);
    root.dataset.empty = String(!text);
    if (offset !== null) {root.focus({preventScroll:true});placeCaret(root, offset);}
    syncCaret(offset !== null);
    return tokens;
  }

  useLayoutEffect(() => {renderText(value);if(autoFocus) {editor.current.focus({preventScroll:true});placeCaret(editor.current, value.length);syncCaret();}}, []);
  useEffect(() => {
    if (value !== lastValue.current) {clearTimeout(timer.current);lastValue.current = value;history.current.reset(value);renderText(value);}
  }, [value]);
  useEffect(() => {
    const resize = new ResizeObserver(syncCaret);resize.observe(editor.current);
    document.addEventListener('selectionchange', syncCaret);
    const beforeInput = event => {
      history.current.select(selectionOffset(editor.current));
      if (['historyUndo', 'historyRedo'].includes(event.inputType)) {event.preventDefault();restoreHistory(event.inputType === 'historyRedo');}
    };
    const root = editor.current;
    root.addEventListener('beforeinput', beforeInput);
    return () => {clearTimeout(timer.current);resize.disconnect();document.removeEventListener('selectionchange', syncCaret);root.removeEventListener('beforeinput', beforeInput);};
  }, []);
  function publish(text) {lastValue.current = text;currentChange.current(text);}
  function convert(settle = false) {
    if (composing.current || tokenMenu) return;
    const text = textOf(editor.current);
    const selection = selectionOffset(editor.current);
    if (selection && !selection.collapsed) return;
    if (settle) currentSettle.current?.(text);
    const existing = [...editor.current.querySelectorAll('[data-token]')].map(el => `${el.dataset.start}:${el.dataset.label}`).join('|');
    const tokens = tokenMatcher(text);
    if (tokens.map(token => `${token.start}:${token.text}`).join('|') === existing) return;
    renderText(text, document.activeElement === editor.current ? selection?.start ?? text.length : null, true);
    if (tokens.length) setAnnouncement(pt ? 'Detalhes reconhecidos. Você pode ajustar ou remover os filtros.' : 'Detalles reconocidos. Puedes ajustar o quitar los filtros.');
  }
  useLayoutEffect(() => {convert();}, [tokenMatcher]);
  function input(event) {
    clearTimeout(timer.current);
    if (composing.current) return;
    const text = textOf(editor.current).replace(/[\r\n]/g, ' ').slice(0, 600);
    if (textOf(editor.current).length > 600) renderText(text, 600);
    const selection = selectionOffset(editor.current);
    history.current.record({text,start:selection?.start ?? text.length,end:selection?.end ?? text.length}, event?.nativeEvent?.inputType || 'replace');
    editor.current.dataset.empty = String(!text);publish(text);syncCaret(true);
    timer.current = setTimeout(() => convert(true), typeof settleDelay === 'function' ? settleDelay(text) : settleDelay);
  }
  function replaceToken(token, replacement, animate = false) {
    clearTimeout(timer.current);
    const text = textOf(editor.current);
    const start = Number(token.dataset.start), end = Number(token.dataset.end);
    const next = text.slice(0, start) + replacement + text.slice(end);
    history.current.select(selectionOffset(editor.current));
    history.current.record({text:next,start:start + replacement.length,end:start + replacement.length});
    setMenuMotion(animate);setTokenMenu(null);publish(next);currentSettle.current?.(next);renderText(next, start + replacement.length);
    if (animate && replacement) editor.current.querySelector(`[data-token="${token.dataset.token}"]`)?.classList.add('token-selected');
  }
  function restoreHistory(redo = false) {
    clearTimeout(timer.current);
    history.current.select(selectionOffset(editor.current));
    const snapshot = redo ? history.current.redo() : history.current.undo();
    if (!snapshot) return;
    setTokenMenu(null);publish(snapshot.text);currentSettle.current?.(snapshot.text);renderText(snapshot.text, snapshot.start);
  }
  function keydown(event) {
    if (composing.current || event.isComposing) return;
    if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'z' || event.ctrlKey && event.key.toLowerCase() === 'y')) {event.preventDefault();restoreHistory(event.shiftKey || event.key.toLowerCase() === 'y');return;}
    if (event.key === 'Enter' && onSubmit) {event.preventDefault();onSubmit(textOf(editor.current));return;}
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {event.preventDefault();editor.current.closest('form').requestSubmit();return;}
    if (event.key === 'Enter' && !event.target.closest('[data-token]')) {event.preventDefault();return;}
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const selection = selectionOffset(editor.current);
    if (!selection?.collapsed) return;
    const position = selection.start;
    let offset = 0;
    for (const node of editor.current.childNodes) {
      const length = textOf(node).length;
      if (node.dataset?.token && (event.key === 'Backspace' && position === offset + length || event.key === 'Delete' && position === offset)) {
        event.preventDefault();node.dataset.start = String(offset);node.dataset.end = String(offset + length);replaceToken(node, '');return;
      }
      offset += length;
    }
  }
  function click(event) {
    const token = event.target.closest('[data-token]');
    if (!token) return;
    clearTimeout(timer.current);
    let offset = 0;for (const node of editor.current.childNodes) {if (node === token) break;offset += textOf(node).length;}
    token.dataset.start = String(offset);token.dataset.end = String(offset + token.dataset.label.length);
    if (token.dataset.token !== 'furnishing') replaceToken(token, '');
    else if (tokenMenu === token) close(false, event.detail > 0);
    else {token.dataset.motion = String(event.detail > 0);setMenuMotion(event.detail > 0);token.setAttribute('aria-expanded', 'true');setTokenMenu(token);}
  }
  function close(restore, animate = true) {if (tokenMenu) {tokenMenu.dataset.motion = String(animate);tokenMenu.setAttribute('aria-expanded', 'false');}setMenuMotion(animate);if (restore) tokenMenu?.focus();setTokenMenu(null);}
  return <div className="home-details" ref={wrapper}>
    <div ref={editor} className="home-details-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="false" aria-label={label || (pt ? 'Mais detalhes do que você procura' : 'Más detalles de lo que buscas')} data-placeholder={placeholder || (pt ? 'Adicione aqui mais detalhes' : 'Agrega aquí más detalles')} data-mobile-placeholder={mobilePlaceholder||placeholder} spellCheck={false} onInput={input} onKeyDown={keydown} onClick={click} onFocus={() => {syncCaret();onFocus?.();}} onScroll={() => syncCaret()} onBlur={() => setCaret(null)} onCompositionStart={() => {history.current.select(selectionOffset(editor.current));composing.current = true;clearTimeout(timer.current);}} onCompositionEnd={() => {composing.current = false;input();}} onPaste={event => {event.preventDefault();history.current.select(selectionOffset(editor.current));const plain = event.clipboardData.getData('text/plain').replace(/[\r\n]/g, ' ').slice(0, 600);document.execCommand('insertText', false, plain);input();}} onCopy={event => {event.preventDefault();event.clipboardData.setData('text/plain', window.getSelection()?.toString().replace(/\u200b/g, '') || '');}}/>
    {caret && <span className="home-editor-caret" aria-hidden="true" style={caret}/>}
    <span className="sr-only" role="status">{announcement}</span>
    <HomePopover open={!!tokenMenu} animate={menuMotion} anchor={tokenMenu} label={pt ? 'Mobília' : 'Muebles'} variant="furnishing" onClose={close}>
      {[[pt ? 'mobiliado' : 'amueblado', 'furnished'], [pt ? 'sem mobília' : 'sin muebles', 'unfurnished']].map(([text, selected]) => <button type="button" role="option" className="home-option" aria-selected={!!tokenMenu && detailTokens(tokenMenu.dataset.label)[0]?.value === selected} key={selected} onClick={event => replaceToken(tokenMenu, text, event.detail > 0)}>{text}</button>)}
    </HomePopover>
  </div>;
}
