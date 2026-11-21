// Equipment 시스템 — 장비 장착, 무기 숙련(레벨), 무기에서 배우는 기술 제안.
// 무기는 전투를 하면 캐릭터처럼 경험치를 얻어 숙련 레벨이 오르고, 특정 레벨에서 새 기술을 배울 수 있다.
// 등급(grade)은 능력치 배율과 숙련 레벨 한계를 정한다. 등급을 올리는 일은 추후 대장장이(Crafting)가 맡는다.
//   수신 'gear:added' { uid }            새 장비 -> 해당 칸이 비어 있으면 자동 장착
//   수신 'equip:request' { uid }         장착 변경
//   수신 'gear:upgrade' { uid }          장비 등급 +1 (대장간 강화 성공)
//   수신 'battle:rewards' payload         무기 경험치 지급 (payload.steps 에 전투 화면용 메시지를 덧붙인다)
//   수신 'skill:decided' { source, skill } 제안한 기술에 대한 결정이 끝남 -> 다시 제안하지 않도록 기록
//   발신 'equipment:changed'
//   발신 'skill:offer' { skill, source, weaponName, steps }  배울 수 있는 기술이 생김 (Character 가 처리)
Game.register('equipment', {
  init({ Events, GameState }) {
    const gearList = () => GameState.get('gear').list;
    const find = (uid) => gearList().find((g) => g.uid === uid);

    function setSlot(slot, uid) {
      GameState.patch('equipment', { [slot]: uid });
      Events.emit('equipment:changed');
    }

    // 이 무기의 숙련 레벨로 배울 수 있는 기술 중, 아직 제안하지 않은 것을 제안한다
    function offerSkills(inst, steps) {
      const w = ItemData[inst.id].weapon;
      if (!w) return;
      for (const u of w.skills) {
        if (u.level <= inst.level && !inst.offered.includes(u.skill)) {
          Events.emit('skill:offer', { skill: u.skill, source: inst.uid, weaponName: ItemData[inst.id].name, steps });
        }
      }
    }

    Events.on('gear:added', ({ uid }) => {
      const inst = find(uid);
      const slot = ItemData[inst.id].type;
      if (GameState.get('equipment')[slot]) return;
      setSlot(slot, uid);
      if (slot === 'weapon') offerSkills(inst, null);
    });

    Events.on('equip:request', ({ uid }) => {
      const inst = find(uid);
      if (!inst) return;
      const slot = ItemData[inst.id].type;
      if (GameState.get('equipment')[slot] === uid) return;
      setSlot(slot, uid);
      if (slot === 'weapon') offerSkills(inst, null);
      Events.emit('toast', { text: `${Util.josa(ItemData[inst.id].name, '을/를')} 장착했어요.` });
    });

    // 대장간 강화 성공: 등급이 한 단계 오른다
    Events.on('gear:upgrade', ({ uid }) => {
      const inst = find(uid);
      if (!inst || inst.grade >= Forge.maxGrade) return;
      inst.grade += 1;
      GameState.patch('gear', { list: gearList() });
      Events.emit('equipment:changed');
    });

    Events.on('skill:decided', ({ source, skill }) => {
      const inst = find(source);
      if (inst && !inst.offered.includes(skill)) {
        inst.offered.push(skill);
        GameState.patch('gear', { list: gearList() });
      }
    });

    Events.on('battle:rewards', (r) => {
      const inst = Stats.equipped('weapon');
      if (!inst) return;
      const def = ItemData[inst.id];
      const cap = Progression.weaponMaxLevel(inst.grade);
      if (inst.level >= cap) return;   // 한계: 등급을 올려야 더 성장한다

      inst.exp += r.weaponExp;
      r.steps.push({ text: `${def.name}의 숙련 경험치 ${r.weaponExp}을(를) 쌓았다!` });
      while (inst.level < cap && inst.exp >= Progression.weaponExpToNext(inst.level)) {
        inst.exp -= Progression.weaponExpToNext(inst.level);
        inst.level++;
        r.steps.push({ text: `${def.name}의 숙련 레벨이 올랐다! (Lv.${inst.level})`, anim: 'heal' });
        offerSkills(inst, r.steps);
      }
      if (inst.level >= cap) {
        inst.exp = 0;
        r.steps.push({ text: `${def.name}의 숙련이 한계에 이르렀다. 등급을 올리면 더 성장할 수 있다!` });
      }
      GameState.patch('gear', { list: gearList() });
    });
  },
});
