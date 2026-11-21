// Character 시스템 — 캐릭터 경험치/레벨업, 기술(최대 4개) 습득과 교체.
//   수신 'battle:rewards' payload        경험치 지급 (payload.steps 에 전투 화면용 메시지를 덧붙인다)
//   수신 'exp:gain' { amount }           전투 밖 경험치 (의뢰 보상 등)
//   수신 'skill:offer' { skill, source, weaponName, steps }
//        빈 칸이 있으면 바로 배운다. 가득 찼고 전투 중(steps 있음)이면 'learn' 단계를 넣어 화면이 하나를 잊을지 묻게 한다.
//   수신 'skill:decide' { skill, source, forget }  화면에서 고른 결과 (forget: 잊을 기술 id, 없으면 배우지 않음)
//   발신 'skill:decided' { skill, source, learned }
Game.register('character', {
  init({ Events, GameState }) {
    const G = Progression.charGrowth;

    // 경험치를 더하고 레벨업을 처리한다. 오른 레벨마다 onLevel(level, 상승 후 HP/MP 정보) 를 부른다
    function grantExp(amount, onLevel) {
      const p = GameState.get('player');
      if (p.level >= Progression.MAX_LEVEL) return false;
      let { level, exp, maxHp, maxMp, hp, mp, atk, def, spd } = p;
      exp += amount;
      while (level < Progression.MAX_LEVEL && exp >= Progression.charExpToNext(level)) {
        exp -= Progression.charExpToNext(level);
        level++;
        maxHp += G.maxHp; hp += G.maxHp;
        maxMp += G.maxMp; mp += G.maxMp;
        atk += G.atk; def += G.def; spd += G.spd;
        if (onLevel) onLevel(level, { hp, mp, maxHp, maxMp });
      }
      GameState.patch('player', { level, exp, maxHp, maxMp, hp, mp, atk, def, spd });
      return true;
    }

    Events.on('battle:rewards', (r) => {
      const p = GameState.get('player');
      if (p.level >= Progression.MAX_LEVEL) return;
      r.steps.push({ text: `경험치 ${r.exp}을(를) 얻었다!` });
      grantExp(r.exp, (level, bars) => {
        r.steps.push({ text: `${p.name}의 레벨이 올랐다! (Lv.${level})`, anim: 'heal', hp: { hero: bars } });
        r.steps.push({ text: `최대 HP +${G.maxHp}, 최대 MP +${G.maxMp}, 공격 +${G.atk}, 방어 +${G.def}, 속도 +${G.spd}` });
      });
    });

    // 전투 밖에서 받는 경험치 (의뢰 보상 등)
    Events.on('exp:gain', ({ amount }) => {
      grantExp(amount, (level) => Events.emit('toast', { text: `레벨이 올랐어요! (Lv.${level})` }));
    });

    Events.on('skill:offer', ({ skill, source, steps }) => {
      const known = GameState.get('skills').known;
      const def = SkillData[skill];
      if (known.includes(skill)) {
        Events.emit('skill:decided', { skill, source, learned: true });
        return;
      }
      if (known.length < Progression.MAX_SKILLS) {
        GameState.patch('skills', { known: [...known, skill] });
        if (steps) steps.push({ text: `새로운 기술 ${Util.q(def.name, '을/를')} 배웠다!`, anim: 'heal' });
        else Events.emit('toast', { text: `기술 ${Util.q(def.name, '을/를')} 배웠어요.` });
        Events.emit('skill:decided', { skill, source, learned: true });
      } else if (steps) {
        steps.push({ type: 'learn', skill, source });
      }
    });

    Events.on('skill:decide', ({ skill, source, forget }) => {
      const known = GameState.get('skills').known.slice();
      const i = forget ? known.indexOf(forget) : -1;
      if (i >= 0) {
        known[i] = skill;
        GameState.patch('skills', { known });
      }
      Events.emit('skill:decided', { skill, source, learned: i >= 0 });
    });
  },
});
