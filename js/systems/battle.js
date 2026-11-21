// Battle 시스템 — 턴제 전투 규칙. 화면은 모르고 이벤트로만 통신한다.
//   수신 'battle:request' { monster }       필드에서 몬스터에게 닿음 -> 전투 시작
//   수신 'battle:command' { type, id }      type: 'attack' | 'item' | 'flee'
//   수신 'battle:finish'                    화면이 결과 연출을 마침 -> 전투 종료
//   발신 'battle:start' { enemy, player, intro }
//   발신 'battle:steps' { steps, outcome }  steps 를 차례로 보여 준다. outcome: null | 'win' | 'lose' | 'flee'
//   발신 'battle:end' { outcome, monster }  월드가 결과를 반영한다 (몬스터 제거, 패배 시 마을 복귀 등)
//   발신 'inventory:consume' { id }         물약 사용
// 한 턴: 플레이어가 명령을 내리면 먼저 실행되고, 상대가 살아 있으면 상대가 한 번 공격한다.
Game.register('battle', {
  init({ Events, GameState }) {
    const GROWTH = 0.12;          // 몬스터 레벨이 최소 레벨보다 1 높을 때마다 스탯 +12%
    const CRIT_CHANCE = 0.06;
    let b = null;                 // 진행 중인 전투

    const rand = (a, z) => a + Math.random() * (z - a);

    // 받침 여부에 따라 조사를 붙인다: josa('들쥐', '이/가') -> '들쥐가'
    function josa(word, pair) {
      const [withJong, without] = pair.split('/');
      const code = word.charCodeAt(word.length - 1) - 0xac00;
      const hasJong = code >= 0 && code <= 11171 && code % 28 !== 0;
      return word + (hasJong ? withJong : without);
    }

    function enemyStats(m) {
      const d = m.def;
      const k = 1 + GROWTH * (m.level - d.level[0]);
      return { hp: Math.round(d.stats.hp * k), atk: Math.round(d.stats.atk * k), def: Math.round(d.stats.def * k), spd: d.stats.spd };
    }

    function damage(atk, def) {
      const crit = Math.random() < CRIT_CHANCE;
      const base = atk * rand(0.85, 1.15) - def * 0.5;
      return { dmg: Math.max(1, Math.round(base * (crit ? 1.5 : 1))), crit };
    }

    const heroHp = () => ({ hero: { hp: GameState.get('player').hp, mp: GameState.get('player').mp } });

    // 상대가 한 번 공격
    function enemyTurn(steps) {
      const p = GameState.get('player');
      const { dmg, crit } = damage(b.enemy.atk, p.def);
      const hp = Math.max(0, p.hp - dmg);
      GameState.patch('player', { hp });
      steps.push({ text: `${b.name}의 공격!`, anim: 'enemy-attack' });
      steps.push({ text: `${josa(p.name, '은/는')} ${dmg}의 데미지를 입었다!${crit ? ' 급소에 맞았다!' : ''}`, anim: 'hero-hit', hp: heroHp() });
      if (hp <= 0) {
        steps.push({ text: `${josa(p.name, '은/는')} 쓰러졌다...`, anim: 'hero-faint' });
        b.outcome = 'lose';
      }
    }

    function resolve(cmd) {
      const p = GameState.get('player');
      const steps = [];

      if (cmd.type === 'attack') {
        const { dmg, crit } = damage(p.atk, b.enemy.def);
        b.enemy.hp = Math.max(0, b.enemy.hp - dmg);
        steps.push({ text: `${p.name}의 공격!`, anim: 'hero-attack' });
        steps.push({ text: `${b.name}에게 ${dmg}의 데미지!${crit ? ' 급소에 맞았다!' : ''}`, anim: 'enemy-hit', hp: { enemy: { hp: b.enemy.hp } } });
        if (b.enemy.hp <= 0) {
          steps.push({ text: `${josa(b.name, '을/를')} 쓰러뜨렸다!`, anim: 'enemy-faint' });
          b.outcome = 'win';
        } else {
          enemyTurn(steps);
        }
      } else if (cmd.type === 'item') {
        const def = ItemData[cmd.id];
        const held = GameState.get('inventory').items.find((it) => it.id === cmd.id);
        if (!def || !def.use || !held) return;
        Events.emit('inventory:consume', { id: cmd.id });
        const hp = Math.min(p.maxHp, p.hp + (def.use.hp || 0));
        const mp = Math.min(p.maxMp, p.mp + (def.use.mp || 0));
        GameState.patch('player', { hp, mp });
        steps.push({ text: `${josa(p.name, '은/는')} ${josa(def.name, '을/를')} 사용했다!`, anim: 'heal', hp: heroHp() });
        enemyTurn(steps);
      } else if (cmd.type === 'flee') {
        if (b.boss) {
          steps.push({ text: '이 상대에게서는 도망칠 수 없다!' });          // 턴을 쓰지 않는다
        } else {
          const chance = Math.max(0.25, Math.min(0.9, 0.6 + (p.spd - b.enemy.spd) * 0.03));
          if (Math.random() < chance) {
            steps.push({ text: '무사히 도망쳤다!', anim: 'flee' });
            b.outcome = 'flee';
          } else {
            steps.push({ text: '도망치지 못했다!' });
            enemyTurn(steps);
          }
        }
      } else {
        return;
      }
      Events.emit('battle:steps', { steps, outcome: b.outcome });
    }

    Events.on('battle:request', ({ monster }) => {
      if (b) return;
      const es = enemyStats(monster);
      const boss = monster.def.rarity === 'boss';
      b = { monster, boss, name: monster.def.name, enemy: { ...es, maxHp: es.hp }, outcome: null };
      const p = GameState.get('player');
      Events.emit('battle:start', {
        enemy: { name: b.name, level: monster.level, hp: es.hp, maxHp: es.hp, sprite: monster.def.sprite, rarity: monster.def.rarity, boss },
        player: { name: p.name, level: p.level, hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp },
        intro: [{ text: boss ? `${josa(b.name, '이/가')} 길을 막아섰다!` : `야생의 ${josa(b.name, '이/가')} 나타났다!` }],
      });
    });

    Events.on('battle:command', (cmd) => {
      if (!b || b.outcome) return;
      resolve(cmd);
    });

    Events.on('battle:finish', () => {
      if (!b) return;
      const { outcome, monster } = b;
      b = null;
      Events.emit('battle:end', { outcome: outcome || 'flee', monster });
    });
  },
});
