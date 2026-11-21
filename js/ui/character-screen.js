// 캐릭터 화면: 레벨/경험치, 능력치(장비 포함), 장비, 배운 기술. 보기 전용.
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function section(title) {
    const s = el('section', 'ch-section');
    s.appendChild(el('h3', '', title));
    return s;
  }

  function row(k, v) {
    const r = el('div', 'ch-row');
    r.append(el('span', '', k), el('b', '', v));
    return r;
  }

  Screens.register('char', {
    title: '캐릭터',
    render(body) {
      const p = GameState.get('player');
      const st = Stats.total();
      const next = Progression.charExpToNext(p.level);

      const head = section(`${p.name}  Lv.${p.level}`);
      const bar = el('div', 'ch-exp');
      const fill = el('i');
      fill.style.width = (p.level >= Progression.MAX_LEVEL ? 100 : (p.exp / next) * 100) + '%';
      bar.appendChild(fill);
      head.append(bar, el('p', 'ch-note', p.level >= Progression.MAX_LEVEL ? '최고 레벨' : `경험치 ${p.exp} / ${next}`));

      const stats = section('능력치');
      stats.append(
        row('HP', `${p.hp} / ${p.maxHp}`), row('MP', `${p.mp} / ${p.maxMp}`),
        row('공격', st.atk.toFixed(1)), row('방어', st.def.toFixed(1)), row('속도', String(st.spd)),
      );

      const gear = section('장비');
      gear.append(
        row('무기', st.weapon ? `${ItemData[st.weapon.id].name}  Lv.${st.weapon.level}` : '없음'),
        row('방어구', st.armor ? ItemData[st.armor.id].name : '없음'),
      );

      const skills = section(`기술 (${GameState.get('skills').known.length}/${Progression.MAX_SKILLS})`);
      const known = GameState.get('skills').known;
      if (!known.length) skills.append(el('p', 'ch-note', '배운 기술이 없어요. 무기를 장착하면 기술을 배울 수 있어요.'));
      for (const id of known) {
        const s = SkillData[id];
        const r = el('div', 'ch-skill');
        r.append(el('b', '', s.name), el('span', '', s.mp ? `MP ${s.mp}` : 'MP 0'), el('p', '', s.desc));
        skills.append(r);
      }
      body.append(head, stats, gear, skills);
    },
  });
})();
