/**
 * 개체 그림 · 행성 그림 (SVG).
 * 개체: species.art 에 최종 그림 경로가 있으면 그 그림, 없으면 종 id 로 모양이 정해지는 임시 그림.
 *   unknown = 검은 실루엣과 ? · seen = 흐린 색 · owned = 선명한 색
 * 행성: 임시 그림 + 지역 표시(잠김·열림·개척 완료). 지역을 누르면 onRegion(id).
 */
import { Data } from '../core/data';
import { rng, hashSeed } from '../core/rng';
import { svg } from './dom';

export type ArtState = 'unknown' | 'seen' | 'owned';

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function creatureArt(speciesId: string, state: ArtState, size = 96, tag = false): SVGElement {
  const sp = Data.get('species', speciesId);
  const el = Data.get('elements', sp?.element ?? '')?.color ?? '#888888';
  if (sp?.art && state !== 'unknown') {
    return svg(`<svg class="art" width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${el}" fill-opacity=".14"/><image href="${sp.art}" x="5" y="5" width="90" height="90" opacity="${state === 'owned' ? 1 : 0.45}"/></svg>`);
  }
  const r = rng(hashSeed(speciesId));
  const stage = sp?.evolution?.stage ?? 1;
  const body = state === 'owned' ? el : state === 'seen' ? shade(el, 0.55) : 'rgba(150,160,190,.18)';
  const bg = state === 'unknown' ? 'rgba(150,160,190,.07)' : el;
  const n = 9 + Math.floor(r() * 6);
  const wob = Array.from({ length: n }, () => 0.78 + r() * 0.4);
  const base = 25 + 4 * stage;
  const pts: string[] = [];
  for (let i = 0; i < 64; i++) {
    const t = i / 64;
    const f = t * n;
    const k = wob[Math.floor(f) % n] * (1 - (f % 1)) + wob[(Math.floor(f) + 1) % n] * (f % 1);
    const a = t * Math.PI * 2;
    pts.push(`${(50 + Math.cos(a) * base * k).toFixed(1)},${(53 + Math.sin(a) * 0.9 * base * k).toFixed(1)}`);
  }
  let horns = '';
  const hn = stage + Math.floor(r() * 2);
  for (let j = 0; j < hn; j++) {
    const a = -Math.PI / 2 + (r() * 1.8 - 0.9);
    const w = 0.18 + r() * 0.12;
    const L = 1.35 + r() * 0.25;
    const p = (ang: number, m: number) => `${(50 + Math.cos(ang) * base * m).toFixed(1)},${(50 + Math.sin(ang) * base * m).toFixed(1)}`;
    horns += `<polygon points="${p(a - w, 0.9)} ${p(a, L)} ${p(a + w, 0.9)}" fill="${body}" opacity=".85"/>`;
  }
  let face = '';
  if (state !== 'unknown') {
    const gap = base * (0.28 + r() * 0.12);
    const ey = 50 - base * 0.15;
    const eo = state === 'owned' ? 0.95 : 0.4;
    face = `<circle cx="50" cy="${53 + base * 0.3}" r="${base * 0.45}" fill="#fff" fill-opacity="${state === 'owned' ? 0.12 : 0.05}"/>` + [-1, 1].map((sx) => `<circle cx="${50 + sx * gap}" cy="${ey}" r="5.6" fill="#fff" fill-opacity="${eo}"/><circle cx="${50 + sx * gap}" cy="${ey + 1}" r="2.8" fill="#0d1220"/>`).join('');
  } else face = `<text x="50" y="62" text-anchor="middle" font-size="32" font-weight="700" fill="rgba(200,210,235,.35)">?</text>`;
  const tagTxt = tag && state !== 'unknown' && !sp?.art ? `<text x="6" y="13" font-size="9" font-weight="700" fill="var(--warn)">임시 그림</text>` : '';
  return svg(`<svg class="art" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${state === 'unknown' ? '알 수 없는 개체' : sp?.name ?? ''}"><circle cx="50" cy="50" r="48" fill="${bg}" fill-opacity="${state === 'unknown' ? 1 : 0.14}"/>${horns}<polygon points="${pts.join(' ')}" fill="${body}"/>${face}${tagTxt}</svg>`);
}

export function planetView(planet: any, regions: any[], states: Record<string, string>, onRegion: (id: string) => void): SVGElement {
  const [base, mid, land] = planet.palette ?? ['#2b3a55', '#3f6f8f', '#c9a66b'];
  const r = rng(hashSeed(planet.id));
  const blobs = Array.from({ length: 9 }, () => {
    const a = r() * Math.PI * 2;
    const d = (0.1 + r() * 0.58) * 43;
    return `<circle cx="${50 + Math.cos(a) * d}" cy="${50 + Math.sin(a) * d}" r="${(0.08 + r() * 0.12) * 43}" fill="${land}" fill-opacity=".22"/>`;
  }).join('');
  const marks = regions
    .map((reg) => {
      const x = 50 + (reg.map[0] - 0.5) * 2 * 43 * 0.82;
      const y = 50 + (reg.map[1] - 0.5) * 2 * 43 * 0.82;
      const st = states[reg.id] ?? 'locked';
      const dot =
        st === 'cleared'
          ? `<circle cx="${x}" cy="${y}" r="3.4" fill="var(--teal)"/><circle cx="${x}" cy="${y}" r="5.2" fill="none" stroke="var(--teal)" stroke-opacity=".5" stroke-width=".8"/>`
          : st === 'open'
            ? `<circle cx="${x}" cy="${y}" r="2.2" fill="var(--accent)"/><circle cx="${x}" cy="${y}" r="4.8" fill="none" stroke="var(--accent)" stroke-width="1"/>`
            : `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="rgba(220,230,250,.4)" stroke-width=".8"/>`;
      return `<g class="region" data-region="${reg.id}"><circle cx="${x}" cy="${y}" r="9" fill="transparent"/>${dot}<text x="${x}" y="${y + 11}" text-anchor="middle" font-size="4.4" font-weight="700" fill="${st === 'locked' ? 'rgba(220,230,250,.55)' : '#eef2fb'}" style="paint-order:stroke" stroke="rgba(0,0,0,.45)" stroke-width="1">${reg.name}</text></g>`;
    })
    .join('');
  const el = svg(`<svg class="planet" viewBox="0 0 100 100" role="img" aria-label="${planet.name} 지도">
<defs><radialGradient id="pg" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${base}"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset=".86" stop-color="${mid}" stop-opacity=".28"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient></defs>
<circle cx="50" cy="50" r="50" fill="url(#glow)"/><circle cx="50" cy="50" r="43" fill="url(#pg)"/>${blobs}
<circle cx="50" cy="50" r="43" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".4"/>${marks}</svg>`);
  el.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('[data-region]');
    if (g) onRegion(g.getAttribute('data-region')!);
  });
  return el;
}
