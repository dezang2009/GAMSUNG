/**
 * 텍스트 사건 (선택 카드)과 분위기 기록.
 * 사건은 50~110초마다 하나씩 '소식'에 쌓이고(최대 3개), 고르면 결과가 기록에 남는다.
 * 사건 문구는 앱 하나를 골라 그 이름으로 쓴다(data.app = 앱 위치).
 */
import { revenuePerSec, linesPerSec, projectLines, appName, officeSlots, addLog } from './engine.js';
import { staffCount, totalUsers } from './data.js';
import { won, lines, people } from './format.js';

const buff = (s, now, target, mult, secs, label) => s.buffs.push({ target, mult, until: now + secs * 1000, label });
const pickApp = (s, rng) => Math.floor(rng() * s.apps.length);
const app = (s, p) => s.apps[p.data?.app] ?? s.apps[0];
const rate = (a, d) => (a.rating = Math.round(Math.min(5, Math.max(1, a.rating + d)) * 10) / 10);

export const EVENTS = [
  {
    id: 'bug',
    weight: 3,
    cond: (s) => s.apps.length >= 1,
    data: (s, rng) => ({ app: pickApp(s, rng) }),
    title: '버그 제보',
    text: (s, p) => `“${app(s, p).name}이(가) 가끔 꺼져요.” 사용자 메일이 왔어요.`,
    choices: [
      {
        label: '지금 고친다',
        hint: '만드는 중인 코드 일부를 쓰고 평점 +0.1',
        apply: (s, p) => {
          const cost = Math.min(s.project.progress, projectLines(s) * 0.15);
          s.project.progress -= cost;
          rate(app(s, p), 0.1);
          return `급하게 고쳤어요. 코드 ${lines(cost)}를 썼지만 평점이 올랐어요.`;
        },
      },
      { label: '다음 업데이트에', hint: '평점 −0.2', apply: (s, p) => (rate(app(s, p), -0.2), '미뤘더니 별점이 조금 내려갔어요.') },
    ],
  },
  {
    id: 'review_bad',
    weight: 2,
    cond: (s) => s.apps.length >= 1,
    data: (s, rng) => ({ app: pickApp(s, rng) }),
    title: '별점 1점 리뷰',
    text: (s, p) => `“${app(s, p).name}, 기대 이하예요.” 아픈 리뷰가 달렸어요.`,
    choices: [
      { label: '정중하게 답글', hint: '평점 +0.1', apply: (s, p) => (rate(app(s, p), 0.1), '정성 어린 답글에 별점을 고쳐 줬어요.') },
      { label: '못 본 척', hint: '평점 −0.1', apply: (s, p) => (rate(app(s, p), -0.1), '리뷰가 위로 올라가 버렸어요.') },
    ],
  },
  {
    id: 'review_good',
    weight: 2,
    cond: (s) => s.apps.length >= 1,
    data: (s, rng) => ({ app: pickApp(s, rng) }),
    title: '별점 5점 리뷰',
    text: (s, p) => `“${app(s, p).name} 없으면 못 살아요!” 인생 앱이라는 리뷰예요.`,
    choices: [
      {
        label: '고맙다고 답글',
        hint: '사용자 +8%',
        apply: (s, p) => {
          const a = app(s, p);
          const add = a.users * 0.08;
          a.users += add;
          return `답글이 화제가 돼서 사용자가 ${people(add)} 늘었어요.`;
        },
      },
    ],
  },
  {
    id: 'allnighter',
    weight: 2,
    cond: () => true,
    title: '마감 전날 밤',
    text: () => '새벽 1시. 조금만 더 하면 끝날 것 같아요.',
    choices: [
      { label: '밤새 코딩', hint: '2분 동안 팀 생산 ×2', apply: (s, p, now) => (buff(s, now, 'lps', 2, 120, '밤샘 코딩'), '커피를 내리고 밤을 새웠어요. 팀이 불타올라요!') },
      { label: '푹 잔다', hint: '3분 동안 코드 쓰기 ×2', apply: (s, p, now) => (buff(s, now, 'tap', 2, 180, '개운한 아침'), '푹 자고 일어나니 손이 가벼워요.') },
    ],
  },
  {
    id: 'coffee_out',
    weight: 1,
    cond: () => true,
    title: '커피가 떨어졌어요',
    text: () => '머신 앞에 빈 원두 봉지만 남았어요.',
    choices: [
      {
        label: '편의점 다녀오기',
        hint: '돈 조금, 1분 동안 코드 쓰기 ×1.5',
        apply: (s, p, now) => {
          const c = Math.min(s.money, 3000);
          s.money -= c;
          buff(s, now, 'tap', 1.5, 60, '카페인 충전');
          return `${won(c)} 쓰고 커피를 사 왔어요.`;
        },
      },
      { label: '참는다', hint: '1분 동안 팀 생산 ×0.8', apply: (s, p, now) => (buff(s, now, 'lps', 0.8, 60, '카페인 부족'), '다들 하품만 해요…') },
    ],
  },
  {
    id: 'featured',
    weight: 1,
    cond: (s) => s.apps.length >= 2,
    data: (s, rng) => ({ app: pickApp(s, rng) }),
    title: '스토어 추천 앱 선정!',
    text: (s, p) => `${app(s, p).name}이(가) 이번 주 추천 앱에 올랐어요.`,
    choices: [
      {
        label: '축하 공지 올리기',
        hint: '사용자 +30%',
        apply: (s, p) => {
          const a = app(s, p);
          const add = a.users * 0.3;
          a.users += add;
          return `추천 효과로 ${people(add)}이 새로 들어왔어요!`;
        },
      },
    ],
  },
  {
    id: 'server_down',
    weight: 2,
    cond: (s) => s.apps.length >= 2 && totalUsers(s) > 2000,
    title: '서버가 터졌어요',
    text: () => '사용자가 한꺼번에 몰려 서버가 응답하지 않아요.',
    choices: [
      {
        label: '긴급 증설',
        hint: '1분 치 수익을 써요',
        apply: (s, p, now) => {
          const c = Math.min(s.money, revenuePerSec(s, now) * 60);
          s.money -= c;
          return `${won(c)}을 들여 서버를 늘렸어요. 다행히 금방 살아났어요.`;
        },
      },
      {
        label: '버틴다',
        hint: '전체 사용자 −8%',
        apply: (s) => {
          let lost = 0;
          for (const a of s.apps) (lost += a.users * 0.08), (a.users *= 0.92);
          return `몇 시간 멈춘 사이 ${people(lost)}이 떠났어요.`;
        },
      },
    ],
  },
  {
    id: 'copycat',
    weight: 1,
    cond: (s) => s.apps.length >= 2,
    data: (s, rng) => ({ app: pickApp(s, rng) }),
    title: '따라 한 앱이 나왔어요',
    text: (s, p) => `${app(s, p).name}과(와) 똑같아 보이는 앱이 스토어에 올라왔어요.`,
    choices: [
      { label: '새 기능으로 맞선다', hint: '평점 +0.2, 3분 동안 코드 쓰기 ×0.7', apply: (s, p, now) => (rate(app(s, p), 0.2), buff(s, now, 'tap', 0.7, 180, '기능 추가 중'), '새 기능 덕분에 평점이 올랐어요.') },
      { label: '가격을 내린다', hint: '2분 동안 수익 ×0.8, 사용자 +12%', apply: (s, p, now) => {
          const a = app(s, p);
          a.users *= 1.12;
          buff(s, now, 'rev', 0.8, 120, '할인 중');
          return '할인 덕분에 사용자가 늘었어요.';
        } },
    ],
  },
  {
    id: 'applicant',
    weight: 2,
    cond: (s) => staffCount(s) < officeSlots(s),
    title: '지원서가 왔어요',
    text: () => '“함께 일하고 싶어요!” 인턴 지원서예요.',
    choices: [
      { label: '바로 채용', hint: '인턴 1명 (무료)', apply: (s) => ((s.staff.intern = (s.staff.intern ?? 0) + 1), '새 인턴이 합류했어요. 환영해요!') },
      { label: '다음에', hint: '', apply: () => '정중하게 다음을 기약했어요.' },
    ],
  },
  {
    id: 'conference',
    weight: 1,
    cond: (s) => s.apps.length >= 3,
    title: '개발자 행사 발표 요청',
    text: () => '“1인 개발 이야기”로 발표해 달라는 연락이 왔어요.',
    choices: [
      {
        label: '발표한다',
        hint: '만드는 중인 코드 −10%, 전체 사용자 +10%',
        apply: (s) => {
          s.project.progress *= 0.9;
          for (const a of s.apps) a.users *= 1.1;
          return '발표가 화제가 돼서 앱이 널리 알려졌어요.';
        },
      },
      { label: '코딩에 집중', hint: '2분 동안 팀 생산 ×1.5', apply: (s, p, now) => (buff(s, now, 'lps', 1.5, 120, '집중 모드'), '정중히 거절하고 코드에 집중했어요.') },
    ],
  },
  {
    id: 'investor',
    weight: 1,
    cond: (s) => s.apps.length >= 3,
    title: '투자 제안',
    text: () => '“같이 키워 보시죠.” 투자자가 메일을 보냈어요.',
    choices: [
      {
        label: '투자를 받는다',
        hint: '10분 치 수익을 지금 받아요',
        apply: (s, p, now) => {
          const g = Math.max(5000, revenuePerSec(s, now) * 600);
          s.money += g;
          s.totalEarned += g;
          s.runEarned += g;
          return `${won(g)}을 투자받았어요!`;
        },
      },
      { label: '혼자 간다', hint: '모든 앱 평점 +0.1', apply: (s) => (s.apps.forEach((a) => rate(a, 0.1)), '독립 개발을 지키기로 했어요. 팬들이 응원해요.') },
    ],
  },
  {
    id: 'hackathon',
    weight: 1,
    cond: (s) => linesPerSec(s) > 5,
    title: '사내 해커톤',
    text: () => '팀원들이 주말 해커톤을 열자고 해요.',
    choices: [
      {
        label: '연다',
        hint: '1분 치 팀 코드를 바로',
        apply: (s, p, now) => {
          const v = linesPerSec(s, now) * 60;
          s.project.progress = Math.min(projectLines(s), s.project.progress + v);
          s.totalLines += v;
          return `하룻밤에 ${lines(v)}를 썼어요!`;
        },
      },
      { label: '주말은 쉬자', hint: '3분 동안 팀 생산 ×1.3', apply: (s, p, now) => (buff(s, now, 'lps', 1.3, 180, '푹 쉰 팀'), '푹 쉬고 온 팀이 더 잘해요.') },
    ],
  },
];

export const FLAVOR = [
  '커밋 메시지: “진짜 마지막 수정”',
  '커밋 메시지: “왜 되는지 모르겠지만 됨”',
  '새벽 3시, 노트북 팬 소리가 커졌어요.',
  '점심은 또 편의점 김밥이에요.',
  '“내 컴퓨터에선 되는데…”',
  '변수 이름 짓느라 10분을 썼어요.',
  '오늘의 할 일: 어제의 할 일',
  '세미콜론 하나 때문에 한 시간이 날아갔어요.',
  '고무 오리에게 코드를 설명했더니 버그를 찾았어요.',
  '창밖이 밝아 오고 있어요.',
  '키보드 소리가 경쾌해요.',
  '테스트가 모두 초록불이에요. 기분 최고!',
];

/** 사건 하나를 고른다 (조건에 맞는 것 중 가중치로) */
export function rollEvent(s, now = Date.now(), rng = Math.random) {
  const ok = EVENTS.filter((e) => e.cond(s) && !s.pending.some((p) => p.id === e.id));
  if (!ok.length) return null;
  let r = rng() * ok.reduce((a, e) => a + e.weight, 0);
  const e = ok.find((x) => (r -= x.weight) < 0) ?? ok[ok.length - 1];
  return { id: e.id, key: `${e.id}-${now}`, at: now, data: e.data ? e.data(s, rng) : {} };
}

export const eventDef = (id) => EVENTS.find((e) => e.id === id);
export const eventText = (s, p) => eventDef(p.id)?.text(s, p) ?? '';

/** 선택: 결과 문장을 기록에 남기고 사건을 지운다 */
export function choose(s, key, choiceIndex, now = Date.now()) {
  const i = s.pending.findIndex((p) => p.key === key);
  if (i < 0) return null;
  const p = s.pending[i];
  const def = eventDef(p.id);
  const c = def?.choices[choiceIndex];
  s.pending.splice(i, 1);
  if (!c) return null;
  const msg = c.apply(s, p, now);
  addLog(s, `${def.title} · ${msg}`, 'event', now);
  return msg;
}

/** 시간이 되면 사건·분위기 기록을 만든다 (화면이 켜져 있을 때만 부른다) */
export function scheduler(s, now = Date.now(), rng = Math.random) {
  const out = { event: null, flavor: null };
  if (now >= s.nextEventAt) {
    s.nextEventAt = now + (50 + rng() * 60) * 1000;
    if (s.pending.length < 3) {
      const e = rollEvent(s, now, rng);
      if (e) (s.pending.push(e), (out.event = e));
    }
  }
  if (now >= s.nextFlavorAt) {
    s.nextFlavorAt = now + (25 + rng() * 30) * 1000;
    out.flavor = FLAVOR[Math.floor(rng() * FLAVOR.length)];
    addLog(s, out.flavor, 'flavor', now);
  }
  return out;
}

export { appName };
