/** DOM 도우미 · 아이콘 */
type Props = Record<string, any> | null;
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, String(sv)) : ((el.style as any)[sk] = sv);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup: string): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}

const I = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS: Record<string, string> = {
  base: I('<path d="M4 19v-8l8-6 8 6v8z"/><path d="M9 19v-5h6v5"/>'),
  planet: I('<circle cx="12" cy="12" r="6"/><path d="M2.5 15.5 7 13.6M17 10.4l4.5-1.9"/>'),
  explore: I('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z"/>'),
  creatures: I('<path d="M12 3.5c3 2.4 5.5 5.6 5.5 10 0 3.6-2.5 7-5.5 7s-5.5-3.4-5.5-7c0-4.4 2.5-7.6 5.5-10z"/><path d="m9 13 2 2 4-4"/>'),
  research: I('<path d="M9.5 3.5v6l-5 9 1 2h13l1-2-5-9v-6M8 3.5h8M7 15h10"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  back: I('<path d="M15 5 8 12l7 7"/>'),
  chev: I('<path d="m9 5 7 7-7 7"/>'),
  lock: I('<path d="M6 11h12v9H6z"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'),
  check: I('<path d="m5 12.5 5 5 9-10.5"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  swords: I('<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l-2 2 4 4 2-2"/>'),
};
export const icon = (name: string, cls = '') => {
  const s = svg(ICONS[name] ?? ICONS.close);
  if (cls) s.setAttribute('class', cls);
  return s;
};

export function ago(t: number, now = Date.now()): string {
  const d = Math.floor((now - t) / 1000);
  if (d < 60) return '방금';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
}
