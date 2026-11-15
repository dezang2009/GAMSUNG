/** 작은 DOM 도우미 (LIFEOS와 같은 방식) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

export const svg = (markup) => {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
};

const I = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  home: I('<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  grow: I('<path d="M4 19h16"/><path d="M7 15v-3M12 15V8M17 15V5"/>'),
  news: I('<path d="M5 5h11a3 3 0 0 1 3 3v11H8a3 3 0 0 1-3-3z"/><path d="M9 10h6M9 14h4"/>'),
  records: I('<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 21l5-2.5 5 2.5-1.5-7.5"/>'),
};
