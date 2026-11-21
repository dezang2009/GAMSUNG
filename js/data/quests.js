// 의뢰 데이터. 의뢰소에서 받고, 목표를 채운 뒤 다시 의뢰소에서 보상을 받는다.
//   goal   : { type: 'kill', target: 몬스터 id, count } 처치  |  { type: 'collect', item: 아이템 id, count } 수집(보상 받을 때 가방에서 가져간다)
//   reward : { gold, exp, items: [{ id, count }] }
//   after  : 이 의뢰를 끝내야 나타난다 (의뢰 id)
const QuestData = [
  {
    id: 'q_slime', name: '슬라임 퇴치', giver: '의뢰소 직원 리코',
    desc: '초록숲에 푸른 슬라임이 늘어서 길이 막힐 지경이에요. 5마리만 쓰러뜨려 주세요.',
    goal: { type: 'kill', target: 'blue_slime', count: 5 },
    reward: { gold: 60, exp: 30, items: [{ id: 'hp_potion', count: 2 }] },
  },
  {
    id: 'q_rat', name: '들쥐 소탕', giver: '의뢰소 직원 리코',
    desc: '들쥐가 밭을 망치고 있어요. 4마리를 처치해 주세요.',
    goal: { type: 'kill', target: 'forest_rat', count: 4 },
    reward: { gold: 50, exp: 25, items: [{ id: 'mp_potion', count: 2 }] },
  },
  {
    id: 'q_jelly', name: '젤리 납품', giver: '상인 모모',
    desc: '판매소에 슬라임 젤리가 떨어졌대요. 슬라임 젤리 5개를 모아 와 주세요.',
    goal: { type: 'collect', item: 'slime_jelly', count: 5 },
    reward: { gold: 80, items: [{ id: 'upgrade_stone', count: 1 }] },
  },
  {
    id: 'q_mushroom', name: '버섯 수확', giver: '여관 주인 하나',
    desc: '여관 요리에 쓸 버섯 갓이 필요해요. 버섯돌이를 3마리 처치해 주세요.',
    goal: { type: 'kill', target: 'mushroom_kid', count: 3 },
    reward: { gold: 70, exp: 40 },
  },
  {
    id: 'q_boss', name: '고블린 대장 토벌', giver: '촌장 할아버지',
    desc: '초록숲 가장 안쪽에 고블린 대장이 자리를 잡았어. 슬라임과 들쥐 의뢰를 마친 모험가라면 맡길 수 있겠지.',
    after: ['q_slime', 'q_rat'],
    goal: { type: 'kill', target: 'goblin_chief', count: 1 },
    reward: { gold: 300, exp: 150, items: [{ id: 'upgrade_stone', count: 3 }, { id: 'hp_potion', count: 3 }] },
  },
];
