/** 캐릭터 만들기 */
import { h, icon } from '../dom.js';
import { BACKGROUNDS, REGIONS, EDUCATIONS, GENDERS, JOBS, STATS, byId } from '../../data/world.js';
import { validate, AGE_MIN, AGE_MAX, NAME_MAX } from '../../systems/CharacterSystem.js';
import * as Economy from '../../systems/EconomySystem.js';

export function createScreen(ui) {
  const form = { name: '', age: BACKGROUNDS[0].defaultAge, gender: 'none', region: 'seoul', background: BACKGROUNDS[0].id, education: BACKGROUNDS[0].defaultEducation };
  let touched = false;
  const errs = {};
  const errEl = (k) => (errs[k] = h('div', { class: 'field__error', role: 'alert', 'data-error': k }));

  const field = (key, label, control, aside) => h('div', { class: 'field' }, h('div', { class: 'field__label' }, h('span', { id: `lbl-${key}` }, label), aside ? h('small', {}, aside) : null), control, errEl(key));

  const choices = (key, list, onPick) => {
    const wrap = h('div', { class: 'choices', role: 'radiogroup', 'aria-labelledby': `lbl-${key}` });
    const paint = () => {
      wrap.replaceChildren(...list.map((it) => h('button', { type: 'button', role: 'radio', class: `choice ${form[key] === it.id ? 'is-on' : ''}`, 'aria-checked': String(form[key] === it.id), disabled: it.disabled ? true : null, dataset: { value: it.id }, onclick: () => ((form[key] = it.id), onPick?.(), paint(), refresh()) }, it.name)));
    };
    paint();
    return { el: wrap, paint };
  };

  // 이름
  const nameInput = h('input', { class: 'input', id: 'name', name: 'name', maxlength: NAME_MAX, autocomplete: 'off', placeholder: '예: 한서윤', 'aria-labelledby': 'lbl-name', oninput: (e) => ((form.name = e.target.value), refresh()) });

  // 나이
  const ageOut = h('output', { class: 'num', 'aria-live': 'polite' });
  const minus = h('button', { type: 'button', 'aria-label': '한 살 적게', onclick: () => setAge(form.age - 1) }, icon('minus', 20));
  const plus = h('button', { type: 'button', 'aria-label': '한 살 많게', onclick: () => setAge(form.age + 1) }, icon('plus', 20));
  const setAge = (a) => {
    form.age = Math.max(AGE_MIN, Math.min(AGE_MAX, a));
    ageOut.textContent = `${form.age}세`;
    minus.disabled = form.age <= AGE_MIN;
    plus.disabled = form.age >= AGE_MAX;
    refresh();
  };
  const stepper = h('div', { class: 'stepper', 'data-testid': 'age' }, minus, ageOut, plus);

  const gender = choices('gender', GENDERS);
  const region = choices('region', REGIONS);
  const eduList = () => EDUCATIONS.map((e) => ({ ...e, disabled: !byId(BACKGROUNDS, form.background).educations.includes(e.id) }));
  const edu = h('div', {});
  let eduCtl;
  const paintEdu = () => {
    eduCtl = choices('education', eduList());
    edu.replaceChildren(eduCtl.el);
  };

  // 초기 배경
  const origins = h('div', { class: 'origins', role: 'radiogroup', 'aria-labelledby': 'lbl-background' });
  const strengths = (bg) => {
    const top = Object.entries(bg.stats).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return top.map(([k]) => STATS.find((x) => x.id === k).name).join('·');
  };
  const paintOrigins = () =>
    origins.replaceChildren(...BACKGROUNDS.map((bg) =>
      h('button', { type: 'button', role: 'radio', class: `origin ${form.background === bg.id ? 'is-on' : ''}`, 'aria-checked': String(form.background === bg.id), dataset: { value: bg.id }, onclick: () => {
        const prev = byId(BACKGROUNDS, form.background);
        form.background = bg.id;
        if (!bg.educations.includes(form.education)) form.education = bg.defaultEducation;
        if (form.age === prev.defaultAge) setAge(bg.defaultAge);
        paintOrigins();
        paintEdu();
        refresh();
      } },
        h('b', {}, bg.name),
        h('p', {}, bg.summary),
        h('dl', {}, h('div', {}, h('dt', {}, '시작 자금'), h('dd', { class: 'num' }, Economy.won(bg.cash))), h('div', {}, h('dt', {}, '일'), h('dd', {}, JOBS[bg.job].title)), h('div', {}, h('dt', {}, '강점'), h('dd', {}, strengths(bg)))))));

  const summary = h('p', { class: 'summary-line num' });
  const startBtn = h('button', { type: 'submit', class: 'btn btn--ink btn--block', 'data-testid': 'start' }, '이 인생 시작하기');

  function refresh() {
    const r = REGIONS.find((x) => x.id === form.region);
    const living = Math.round((r.rent + r.utilities + r.phone + r.transport) / 30);
    summary.textContent = `${r.name}에 살면 하루 생활비가 약 ${Economy.won(living)} 들어요 (월세 ${Economy.won(r.rent)} 포함)`;
    const e = validate(form);
    for (const [k, el] of Object.entries(errs)) el.textContent = touched ? e[k] ?? '' : '';
  }

  const formEl = h('form', { class: 'form', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    touched = true;
    refresh();
    const e = validate(form);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      (first === 'name' ? nameInput : errs[first]).scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      if (first === 'name') nameInput.focus();
      return;
    }
    startBtn.classList.add('is-busy');
    try {
      await ui.engine.start({ ...form, name: form.name.trim() });
    } catch (err) {
      startBtn.classList.remove('is-busy');
      ui.toast('시작하지 못했어요', String(err.message ?? err), true);
    }
  } },
    field('name', '이름', nameInput, `${NAME_MAX}자까지`),
    field('age', '나이', stepper, `${AGE_MIN}~${AGE_MAX}세`),
    field('gender', '성별', gender.el, '수치에는 영향이 없어요'),
    field('background', '초기 배경', origins, '시작 자금·능력치·일이 달라져요'),
    field('education', '학력', edu),
    field('region', '거주 지역', region.el, '생활비·출퇴근 시간'),
    h('div', { class: 'field' }, summary, startBtn));

  paintOrigins();
  paintEdu();
  setAge(form.age);

  return h('div', { class: 'screen', 'data-screen': 'create' },
    h('header', { class: 'title-card' },
      h('h1', {}, 'OFF THE', h('br'), h('span', {}, 'RECORD')),
      h('p', { class: 'slogan' }, '당신이 살아가는 동안, 세상도 살아간다.'),
      h('p', {}, '한 사람의 하루하루를 직접 살아 보는 텍스트 인생 시뮬레이션이에요. 먼저 어떤 사람으로 시작할지 정해 주세요.')),
    formEl);
}
