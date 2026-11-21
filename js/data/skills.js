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
  whirl: { id: 'whirl', name: '회전 타격', power: 0.95, mp: 5, hits: 2, desc: '제자리에서 돌며 두 번 연속으로 때린다.' },
};
