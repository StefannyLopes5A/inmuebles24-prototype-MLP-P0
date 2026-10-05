// Text history stays independent of the DOM nodes replaced when a phrase becomes a filter.
export function createDetailHistory(text = '') {
  let current = {text, start:text.length, end:text.length};
  const past = [], future = [];
  let group = null;
  return {
    select(selection) { if (selection) current = {...current, ...selection}; },
    record(next, kind = 'replace', now = Date.now()) {
      if (next.text === current.text) {current = next;return;}
      const merge = kind === 'insertText' && group?.kind === kind && now - group.time < 650 && current.start === current.end && current.start === group.end;
      if (!merge) {past.push(current);if (past.length > 100) past.shift();}
      current = next;future.length = 0;group = {kind, time:now, end:next.end};
    },
    undo() {group = null;if (!past.length) return null;future.push(current);current = past.pop();return current;},
    redo() {group = null;if (!future.length) return null;past.push(current);current = future.pop();return current;},
    reset(value) {current = {text:value,start:value.length,end:value.length};past.length = 0;future.length = 0;group = null;},
  };
}
