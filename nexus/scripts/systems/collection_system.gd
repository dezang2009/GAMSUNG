class_name CollectionSystem
extends RefCounted
## CollectionSystem — 도감·보유 개체·종별 연구 데이터. (화면 없이 state 와 Data 만 다뤄요)
##
## state.collection = {
##   owned: [ { uid, species, level, exp, nickname, obtained_at, method, region } ],
##   seen: { 종 id: 처음 본 시각 },
##   research: { 종 id: 연구 데이터 점수 },
##   party: [uid ×5], next_uid
## }
## 종 상태: unknown(모름) → seen(목격·도감 등록) → owned(확보)
## 중복 확보는 새 개체를 만들지 않고 그 종의 연구 데이터로 바꿔요 (뽑기 없음).


static func status(state: Dictionary, species_id: String) -> String:
	var c: Dictionary = state.collection
	if owns(state, species_id):
		return "owned"
	return "seen" if c.seen.has(species_id) else "unknown"


static func owns(state: Dictionary, species_id: String) -> bool:
	for it in state.collection.owned:
		if it.species == species_id:
			return true
	return false


static func research_points(state: Dictionary, species_id: String) -> int:
	return int(state.collection.research.get(species_id, 0))


## 연구 단계 (0 = 모름, 1 기본 정보, 2 능력치, 3 생태 능력·진화 …)
static func research_level(state: Dictionary, species_id: String) -> int:
	var pts := research_points(state, species_id)
	var lv := 0
	for need in Data.research_config().levels:
		if pts >= need:
			lv += 1
	return lv


static func research_max() -> int:
	return Data.research_config().levels.size()


## 다음 단계까지 필요한 점수 (최고 단계면 -1)
static func next_level_need(state: Dictionary, species_id: String) -> int:
	var pts := research_points(state, species_id)
	for need in Data.research_config().levels:
		if pts < need:
			return int(need)
	return -1


static func _add_research(state: Dictionary, species_id: String, pts: int) -> void:
	state.collection.research[species_id] = research_points(state, species_id) + pts


## 목격: 처음이면 도감 등록. 목격할 때마다 연구 데이터 +sighting. 처음 본 경우 true
static func see(state: Dictionary, species_id: String, now: int) -> bool:
	var first: bool = not state.collection.seen.has(species_id)
	if first:
		state.collection.seen[species_id] = now
	_add_research(state, species_id, int(Data.research_config().sighting))
	return first


## 확보. 결과 { kind: "new" | "duplicate", uid?, research }
static func acquire(state: Dictionary, species_id: String, method: String, region: String, now: int) -> Dictionary:
	var cfg := Data.research_config()
	if not state.collection.seen.has(species_id):
		state.collection.seen[species_id] = now
	if owns(state, species_id):
		_add_research(state, species_id, int(cfg.duplicate))
		return {"kind": "duplicate", "research": int(cfg.duplicate)}
	var uid := "c%d" % int(state.collection.next_uid)
	state.collection.next_uid = int(state.collection.next_uid) + 1
	state.collection.owned.append({"uid": uid, "species": species_id, "level": 1, "exp": 0, "nickname": "", "obtained_at": now, "method": method, "region": region})
	_add_research(state, species_id, int(cfg.owned))
	return {"kind": "new", "uid": uid, "research": int(cfg.owned)}


static func instance(state: Dictionary, uid: String) -> Dictionary:
	for it in state.collection.owned:
		if it.uid == uid:
			return it
	return {}


## 보유 개체 목록 (속성 거르기 · 정렬: recent | rarity | name)
static func owned_list(state: Dictionary, element := "", sort := "recent") -> Array:
	var out: Array = state.collection.owned.filter(func(it): return element == "" or Data.get_item("species", it.species).get("element") == element)
	match sort:
		"rarity":
			out.sort_custom(func(a, b): return _tier(a) > _tier(b) or (_tier(a) == _tier(b) and a.species < b.species))
		"name":
			out.sort_custom(func(a, b): return display_name(a) < display_name(b))
		_:
			out.sort_custom(func(a, b): return a.obtained_at > b.obtained_at or (a.obtained_at == b.obtained_at and int(a.uid.substr(1)) > int(b.uid.substr(1))))
	return out


static func _tier(it: Dictionary) -> int:
	return int(Data.get_item("rarities", Data.get_item("species", it.species).get("rarity", "")).get("tier", 0))


static func display_name(it: Dictionary) -> String:
	return it.nickname if str(it.get("nickname", "")) != "" else Data.get_item("species", it.species).get("name", it.species)


## 능력치 (지금은 기본값. 레벨에 따른 성장은 육성 단계에서 더해요)
static func stats_of(it: Dictionary) -> Dictionary:
	var sp := Data.get_item("species", it.species)
	var out := {}
	for st in Data.all("stats"):
		out[st.id] = int(sp.base_stats.get(st.id, 0))
	return out


## 같은 진화 계통의 종들 (단계 순)
static func evolution_line(species_id: String) -> Array:
	var line: String = Data.get_item("species", species_id).get("evolution", {}).get("line", "")
	var out := Data.all("species").filter(func(s): return s.evolution.line == line)
	out.sort_custom(func(a, b): return a.evolution.stage < b.evolution.stage or (a.evolution.stage == b.evolution.stage and a.id < b.id))
	return out


## 이 종을 만날 수 있는 곳 [{ region, method, from_survey }]
static func habitats(species_id: String) -> Array:
	var out := []
	for r in Data.all("regions"):
		for e in r.get("encounters", []):
			if e.species == species_id:
				out.append({"region": r.id, "method": e.method, "from_survey": int(e.from_survey)})
	return out


## 진화로만 얻는 종인지
static func evolution_only(species_id: String) -> bool:
	return habitats(species_id).is_empty() and not (species_id in Data.meta.get("starting_creatures", []))


## 도감 집계
static func counts(state: Dictionary) -> Dictionary:
	var owned_species := {}
	for it in state.collection.owned:
		owned_species[it.species] = true
	return {"total": Data.all("species").size(), "seen": state.collection.seen.size(), "owned_species": owned_species.size(), "owned": state.collection.owned.size()}
