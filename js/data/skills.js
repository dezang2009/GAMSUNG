// 기술 데이터. 기술은 무기의 숙련 레벨이 오르면 배울 수 있고(items.js 의 weapon.skills), 최대 4개까지 가질 수 있다.
//   power     : 공격 배율 (1.0 = 기본)
//   mp        : 소모 MP
//   ignoreDef : 상대 방어력을 무시하는 비율 (0~1)
//   critBonus : 급소 확률 추가
//   hits      : 연속 타격 횟수 (생략 시 1)
const SkillData = {
  punch: { id: 'punch', name: '맨손치기', power: 0.8, mp: 0, desc: '무기가 없을 때 쓰는 기본 공격.' },
  swing: { id: 'swing', name: '휘두르기', power: 1.0, mp: 0, desc: '무기를 힘껏 휘두른다. MP 소모 없음.' },
  throw: { id: 'throw', name: '던지기', power: 1.3, mp: 2, ignoreDef: 0.5, desc: '무기를 던져 맞힌다. 방어력을 절반 무시한다.' },
  thrust: { id: 'thrust', name: '찌르기', power: 1.5, mp: 3, critBonus: 0.25, desc: '급소를 노려 찌른다. 급소 확률이 높다.' },
  smash: { id: 'smash', name: '내려찍기', power: 2.1, mp: 6, desc: '온 힘을 실어 내려찍는다. 강하지만 MP를 많이 쓴다.' },
  // 철제 단검 계열
  slash: { id: 'slash', name: '베기', power: 1.1, mp: 0, desc: '날카롭게 베어 낸다. MP 소모 없음.' },
  backstab: { id: 'backstab', name: '급소 찌르기', power: 1.3, mp: 3, critBonus: 0.4, desc: '급소를 정확히 노린다. 급소 확률이 매우 높다.' },
  flurry: { id: 'flurry', name: '연속 찌르기', power: 0.6, mp: 5, hits: 3, desc: '눈 깜짝할 새 세 번 연속으로 찌른다.' },
  // 사냥꾼의 도끼 계열
  chop: { id: 'chop', name: '내려치기', power: 1.2, mp: 0, desc: '도끼를 내려친다. MP 소모 없음.' },
  cleave: { id: 'cleave', name: '회전 베기', power: 0.9, mp: 4, hits: 2, desc: '도끼를 휘둘러 두 번 연속으로 벤다.' },
  rage: { id: 'rage', name: '분노의 일격', power: 2.6, mp: 8, desc: '모든 힘을 모아 내리찍는다. 매우 강하지만 MP를 많이 쓴다.' },
  // 고블린 대장의 철퇴 계열
  bash: { id: 'bash', name: '철퇴 강타', power: 1.4, mp: 2, ignoreDef: 0.3, desc: '묵직한 철퇴로 방어를 일부 뚫고 때린다.' },
  crush: { id: 'crush', name: '으스러뜨리기', power: 2.3, mp: 6, ignoreDef: 0.6, desc: '방어를 크게 무시하는 강력한 일격.' },
  whirl: { id: 'whirl', name: '회전 타격', power: 0.95, mp: 5, hits: 2, desc: '제자리에서 돌며 두 번 연속으로 때린다.' },
};
