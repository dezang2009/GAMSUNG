/**
 * 화면 틀: (데이터 오류 | 첫 화면 | 게임) · 상단 자원 막대 · 내용 · 떠 있는 하단 메뉴 · 시트 · 알림 · 전투 화면
 * 탭마다 화면 쌓기가 따로 있어요. 뒤로 가기: 시트 닫기 → 전투(포기 확인) → 쌓인 화면 빼기 → 기지 탭 → 앱 종료
 */
import { Data } from '../core/data';
import * as Save from '../core/save';
import { Game } from '../game/game';
import { h, icon } from './dom';
import { screens } from './screens';
import { openBattle, type BattleHandle } from './battle';

export const TABS = [
  { id: 'base', name: '기지', icon: 'base' },
  { id: 'planet', name: '행성', icon: 'planet' },
  { id: 'explore', name: '탐사', icon: 'explore', center: true },
  { id: 'creatures', name: '개체', icon: 'creatures' },
  { id: 'research', name: '연구', icon: 'research' },
];

type Entry = { screen: string; args: any; title: string };

export class App {
  tab = 'base';
  stacks: Record<string, Entry[]> = {};
  ui: Record<string, any> = {};
  root: HTMLElement;
  main!: HTMLElement;
  nav!: HTMLElement;
  topbar!: HTMLElement;
  toasts!: HTMLElement;
  sheetClose: (() => void) | null = null;
  battle: BattleHandle | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.resetStacks();
    Game.on((reason) => this.onChange(reason));
  }

  resetStacks() {
    for (const t of TABS) this.stacks[t.id] = [{ screen: t.id, args: {}, title: t.name }];
  }

  applyTheme() {
    document.documentElement.dataset.theme = Game.settings.theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', Game.settings.theme === 'dark' ? '#090d16' : '#eef2f9');
  }

  async start() {
    this.applyTheme();
    if (Data.errors.length) return this.renderErrors();
    const r = await Game.load();
    if (r.data) {
      this.build();
      if (r.recovered) this.toast('최근 저장이 손상돼 직전 저장으로 이어서 해요');
    } else {
      await this.renderTitle(r.error);
    }
  }

  renderErrors() {
    this.root.replaceChildren(
      h('div', { class: 'app' }, h('div', { class: 'page', style: { paddingTop: '60px' } }, h('h1', { class: 'h1' }, '설정 데이터 오류'), h('p', { class: 'lead' }, 'src/data 의 설정 파일에 문제가 있어 게임을 시작하지 않았어요.'), h('ul', { class: 'card errors', 'data-testid': 'errors' }, Data.errors.map((e) => h('li', null, e))))),
    );
  }

  async renderTitle(error?: string) {
    const has = await Save.hasSave();
    const els = Data.all('elements');
    this.root.replaceChildren(
      h('div', { class: 'stars' }),
      h('div', { class: 'app' },
        h('div', { class: 'title-screen' },
          h('div', { class: 'logo-big' }, 'NEXUS'),
          h('p', { class: 'lead' }, '미지의 행성을 탐사하고, 생명체를 발견하고, 함께 싸우며 성장하는 이야기'),
          h('div', { class: 'chips' }, els.map((e) => h('span', { class: 'chip', style: { '--c': e.color } }, e.name))),
          error ? h('p', { class: 'small', style: { color: 'var(--danger)' } }, error) : null,
          h('button', { class: 'btn block', 'data-testid': 'new-game', onclick: () => (has ? this.confirm('새로 시작할까요?', '저장된 탐사 기록이 지워지고 처음부터 시작해요. 되돌릴 수 없어요.', '새로 시작', () => Game.newGame()) : Game.newGame()) }, has ? '새로 시작' : '탐사 시작'),
          h('p', { class: 'small faint' }, `버전 ${__APP_VERSION__} · 콘텐츠 ${Data.meta.content_version}`),
        )),
    );
  }

  build() {
    this.topbar = h('header', { class: 'topbar' });
    this.main = h('main', { class: 'page-host' });
    this.nav = h('nav', { class: 'nav', 'aria-label': '메뉴' },
      TABS.map((t) =>
        h('button', { class: t.center ? 'center' : '', dataset: { tab: t.id }, 'aria-label': t.name, onclick: () => this.go(t.id) },
          t.center ? h('span', { class: 'circle' }, icon(t.icon)) : icon(t.icon),
          h('span', null, t.name))));
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.root.replaceChildren(h('div', { class: 'stars' }), h('div', { class: 'app' }, this.topbar, this.main), this.nav, this.toasts);
    this.render();
  }

  renderTop() {
    const s = Game.state;
    this.topbar.replaceChildren(
      h('div', { class: 'logo' }, 'NEXUS'),
      h('div', { class: 'res-pill num', 'data-testid': 'resources' }, Data.all('resources').map((r) => h('span', { title: r.name }, h('i', { style: { '--c': r.color } }), s.resources[r.id] ?? 0))),
      h('button', { class: 'icon-btn', 'aria-label': '설정', 'data-testid': 'settings', onclick: () => this.push('settings', {}, '설정') }, icon('settings')),
    );
  }

  render(keepScroll = false) {
    if (!Game.has() || !this.main) return;
    this.renderTop();
    const top = this.stacks[this.tab].at(-1)!;
    const page = h('div', { class: keepScroll ? 'page' : 'page enter', 'data-screen': top.screen });
    if (this.stacks[this.tab].length > 1) page.append(h('div', { class: 'subhead' }, h('button', { class: 'icon-btn', 'aria-label': '뒤로', 'data-testid': 'back', onclick: () => this.back() }, icon('back')), h('h1', null, top.title)));
    const build = screens[top.screen];
    page.append(build ? build(this, top.args) : h('p', { class: 'empty' }, `알 수 없는 화면: ${top.screen}`));
    const y = window.scrollY;
    this.main.replaceChildren(page);
    window.scrollTo(0, keepScroll ? y : 0);
    for (const b of this.nav.querySelectorAll<HTMLButtonElement>('button')) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('on', on);
      on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    }
  }

  go(id: string) {
    if (id === this.tab) {
      if (this.stacks[id].length > 1) this.stacks[id] = [this.stacks[id][0]];
      else return window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.tab = id;
    this.render();
  }
  push(screen: string, args: any = {}, title = '') {
    this.stacks[this.tab].push({ screen, args, title });
    this.render();
  }
  depth() {
    return this.stacks[this.tab].length;
  }

  /** 뒤로 가기. 처리했으면 true (아니면 앱 종료 차례) */
  back(): boolean {
    if (this.sheetClose) return this.sheetClose(), true;
    if (this.battle) return this.battle.requestQuit(), true;
    if (this.stacks[this.tab].length > 1) {
      this.stacks[this.tab].pop();
      this.render();
      return true;
    }
    if (Game.has() && this.tab !== 'base') return this.go('base'), true;
    return false;
  }

  // ── 시트·확인·알림 ──
  sheet(build: (box: HTMLElement, close: () => void) => void, onClose?: () => void) {
    this.sheetClose?.();
    const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    const ov = h('div', { class: 'overlay', onclick: (e: Event) => e.target === ov && close() }, box);
    const close = () => {
      if (!ov.isConnected) return;
      ov.remove();
      this.sheetClose = null;
      onClose?.();
    };
    build(box, close);
    document.body.append(ov);
    this.sheetClose = close;
    box.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }

  confirm(title: string, text: string, ok: string, onOk: () => void, danger = true) {
    this.sheet((box, close) => {
      box.dataset.testid = 'confirm';
      box.append(h('h2', null, title), h('p', { class: 'lead' }, text), h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', 'data-testid': 'confirm-cancel', onclick: close }, '취소'), h('button', { class: `btn ${danger ? 'danger' : ''}`, 'data-testid': 'confirm-ok', onclick: () => (close(), onOk()) }, ok)));
    });
  }

  toast(text: string, warn = false) {
    if (!this.toasts) return;
    const t = h('div', { class: `toast ${warn ? 'warn' : ''}`, role: 'status' }, text);
    this.toasts.append(t);
    while (this.toasts.children.length > 2) this.toasts.firstChild!.remove();
    setTimeout(() => t.remove(), 2800);
  }

  // ── 전투 ──
  startBattle(stageId: string) {
    try {
      const b = Game.startBattle(stageId);
      this.battle = openBattle(this, stageId, b, () => {
        this.battle = null;
        this.render(true);
      });
    } catch (e: any) {
      this.toast(String(e.message ?? e), true);
    }
  }

  private onChange(reason: string) {
    if (['new_game', 'load', 'import', 'reset'].includes(reason)) {
      this.tab = 'base';
      this.ui = {};
      this.resetStacks();
      if (!Game.has()) return void this.renderTitle();
      if (!this.main || !this.main.isConnected) return this.build();
      return this.render();
    }
    if (reason === 'settings') {
      this.applyTheme();
      return this.render(true);
    }
    if (reason === 'save_error') return this.toast(`저장하지 못했어요: ${Game.saveError}. 저장 공간을 확인해 주세요.`, true);
    if (reason === 'saved') return this.toast('저장했어요');
    if (this.main) this.render(true);
  }
}
