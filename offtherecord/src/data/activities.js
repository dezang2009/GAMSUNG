/**
 * 활동 정의. 숫자는 활동을 마쳤을 때의 변화량이에요.
 * (활동하는 동안 저절로 생기는 배고픔·피로는 LifeSystem 이 시간에 맞춰 따로 더해요)
 *
 *  minutes   걸리는 시간(분)
 *  cost      드는 돈(원)
 *  window    [시작 가능 시각, 끝나야 하는 시각] (분). 없으면 하루 중 아무 때나
 *  perDay    하루 최대 횟수
 *  effects   상태 변화 { energy, fatigue, stress, mood, hunger }
 *  grow      능력치 성장 { 능력치: 기본량 } (컨디션 효율·현재 수준에 따라 달라짐)
 *  needs     추가 조건 (상태를 보고 불가 사유를 돌려줌)
 */
export const CATEGORIES = [
  { id: 'meal', name: '식사' },
  { id: 'work', name: '일' },
  { id: 'growth', name: '자기계발' },
  { id: 'rest', name: '휴식' },
  { id: 'hobby', name: '취미' },
  { id: 'social', name: '사람' },
  { id: 'life', name: '생활' },
];
/** 타임라인에만 쓰는 분류 */
export const TIMELINE_ONLY = [
  { id: 'sleep', name: '수면' },
  { id: 'commute', name: '이동' },
];

const H = 60;

export const ACTIVITIES = [
  // 식사
  { id: 'home_meal', name: '집밥 해 먹기', category: 'meal', minutes: 60, cost: 4500, window: [6 * H, 24 * H], effects: { hunger: -50, mood: 2 }, grow: { diligence: 0.1 }, desc: '장 본 재료로 간단히 차려 먹어요.' },
  { id: 'eat_out', name: '밖에서 사 먹기', category: 'meal', minutes: 60, cost: 12000, window: [7 * H, 22 * H], effects: { hunger: -55, mood: 5, stress: -3 }, desc: '근처 식당에서 든든하게 먹어요.' },
  { id: 'convenience_meal', name: '편의점에서 때우기', category: 'meal', minutes: 20, cost: 5500, effects: { hunger: -35, mood: -2 }, desc: '빠르지만 만족스럽진 않아요.' },

  // 자기계발
  { id: 'reading', name: '독서', category: 'growth', minutes: 120, cost: 0, effects: { fatigue: 5, stress: 2 }, grow: { intelligence: 1.0, creativity: 0.2 }, desc: '책을 읽으며 생각의 폭을 넓혀요.' },
  { id: 'course', name: '온라인 강의 듣기', category: 'growth', minutes: 120, cost: 9900, effects: { fatigue: 7, stress: 4 }, grow: { expertise: 1.2, intelligence: 0.3 }, desc: '직무 강의 한 편을 결제하고 들어요.' },
  { id: 'workout', name: '헬스장 운동', category: 'growth', minutes: 90, cost: 8000, window: [6 * H, 23 * H], effects: { fatigue: 16, energy: -10, stress: -7, mood: 3, hunger: 10 }, grow: { fitness: 1.3, diligence: 0.2 }, needs: (s) => (s.life.energy < 25 ? '운동하기엔 컨디션이 너무 낮아요' : null), desc: '일일권을 끊고 땀을 흘려요.' },
  { id: 'cert', name: '자격증 공부', category: 'growth', minutes: 180, cost: 0, effects: { fatigue: 10, stress: 9 }, grow: { expertise: 1.5, intelligence: 0.8, diligence: 0.4 }, desc: '시험 범위를 붙잡고 오래 앉아 있어요.' },

  // 휴식
  { id: 'rest', name: '집에서 쉬기', category: 'rest', minutes: 60, cost: 0, effects: { fatigue: -8, stress: -6, energy: 4 }, desc: '아무것도 하지 않고 숨을 돌려요.' },
  { id: 'nap', name: '낮잠', category: 'rest', minutes: 60, cost: 0, window: [11 * H, 19 * H], perDay: 1, effects: { fatigue: -18, energy: 12, mood: 1 }, desc: '짧게 눈을 붙여요. 하루 한 번.' },
  { id: 'walk', name: '동네 산책', category: 'rest', minutes: 60, cost: 0, window: [5 * H, 23 * H], effects: { stress: -10, mood: 5, fatigue: 3 }, grow: { fitness: 0.2 }, desc: '바람을 쐬며 걸어요.' },

  // 취미
  { id: 'game', name: '게임', category: 'hobby', minutes: 120, cost: 0, effects: { mood: 8, stress: -10, fatigue: 4 }, desc: '머리를 비우고 한두 판.' },
  { id: 'movie', name: '영화관 가기', category: 'hobby', minutes: 150, cost: 15000, window: [9 * H, 24 * H], effects: { mood: 12, stress: -8, fatigue: 3 }, grow: { creativity: 0.3 }, desc: '보고 싶던 영화를 봐요.' },
  { id: 'create', name: '그림·글쓰기', category: 'hobby', minutes: 120, cost: 0, effects: { mood: 4, stress: -4, fatigue: 4 }, grow: { creativity: 1.0 }, desc: '무언가를 직접 만들어요.' },

  // 사람
  { id: 'friends', name: '친구 만나기', category: 'social', minutes: 180, cost: 35000, window: [11 * H, 24 * H], effects: { mood: 12, stress: -12, fatigue: 8, hunger: -30 }, grow: { sociability: 1.0 }, desc: '밥 먹고 이야기 나눠요. 식사도 해결돼요.' },
  { id: 'meetup', name: '모임 나가기', category: 'social', minutes: 120, cost: 15000, window: [10 * H, 23 * H], effects: { mood: 4, stress: 3, fatigue: 6 }, grow: { sociability: 1.3, creativity: 0.2 }, desc: '처음 보는 사람들과 어울려요. 사교성이 낮으면 지쳐요.' },
  { id: 'call_family', name: '가족과 통화', category: 'social', minutes: 30, cost: 0, window: [8 * H, 23 * H], perDay: 1, effects: { mood: 5, stress: -4 }, grow: { sociability: 0.2 }, desc: '안부를 전해요.' },

  // 생활
  { id: 'chores', name: '집안일', category: 'life', minutes: 60, cost: 0, effects: { mood: 2, stress: -2, fatigue: 4 }, grow: { diligence: 0.3 }, desc: '청소·빨래를 해치워요.' },
];

export const activityById = (id) => ACTIVITIES.find((a) => a.id === id) ?? null;
