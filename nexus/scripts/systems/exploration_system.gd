class_name ExplorationSystem
extends RefCounted
## ExplorationSystem — 지역 조사. 결과는 (게임 씨앗, 지역, 몇 번째 조사) 로 정해져서 같은 기록이면 항상 같아요.
##
## state.exploration = { surveys: { 지역 id: 조사한 횟수 } }, state.seed
## 조사 한 번 (n번째):
##   - from_survey == n 인 알(egg) → 확보 (중복이면 연구 데이터)
##   - from_survey == n 인 야생 개체 → 반드시 목격 (깊이 조사해서 드러난 서식지)
##   - 그 밖의 야생 개체 중 from_survey ≤ n 인 것에서 무게(weight)대로 1~2종 목격
## 비용·피로 같은 반복 관리는 없어요. 조사 횟수가 끝나면 그 지역 조사는 완료.

const SIGHTINGS_PER_SURVEY := 2


static func done(state: Dictionary, region_id: String) -> int:
	return int(state.exploration.surveys.get(region_id, 0))


static func remaining(state: Dictionary, region: Dictionary) -> int:
	return maxi(0, int(region.get("surveys", 0)) - done(state, region.id))


## 조사할 수 없는 이유 (가능하면 "")
static func blocked_reason(state: Dictionary, region: Dictionary, unlocked: bool) -> String:
	if not unlocked:
		return "아직 열리지 않은 지역이에요"
	if int(region.get("surveys", 0)) == 0:
		return "조사할 곳이 없는 지역이에요"
	if remaining(state, region) == 0:
		return "이 지역은 조사를 모두 마쳤어요"
	return ""


static func _rng(state: Dictionary, region_id: String, n: int) -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash([int(state.seed), region_id, n])
	return rng


## 조사 한 번. 결과 목록 [{ type: "egg"|"sighting", species, new(처음?), acquire? }]
static func survey(state: Dictionary, region: Dictionary, now: int) -> Array:
	var n := done(state, region.id) + 1
	state.exploration.surveys[region.id] = n
	var rng := _rng(state, region.id, n)
	var results := []
	var encounters: Array = region.get("encounters", [])
	# 알 (이번 조사에서 드러남)
	for e in encounters:
		if e.method == "egg" and int(e.from_survey) == n:
			var first: bool = CollectionSystem.status(state, e.species) == "unknown"
			var acq := CollectionSystem.acquire(state, e.species, "egg", region.id, now)
			results.append({"type": "egg", "species": e.species, "new": first, "acquire": acq})
	# 새로 드러난 서식지의 야생 개체는 반드시
	var picked := {}
	for e in encounters:
		if e.method == "wild" and int(e.from_survey) == n and n > 1:
			picked[e.species] = true
	# 나머지는 무게대로
	var pool := encounters.filter(func(e): return e.method == "wild" and int(e.from_survey) <= n and not picked.has(e.species))
	while picked.size() < SIGHTINGS_PER_SURVEY and not pool.is_empty():
		var total := 0.0
		for e in pool:
			total += float(e.weight)
		var roll := rng.randf() * total
		var idx := 0
		for i in pool.size():
			roll -= float(pool[i].weight)
			if roll <= 0.0:
				idx = i
				break
		picked[pool[idx].species] = true
		pool.remove_at(idx)
	for sid in picked:
		var first := CollectionSystem.see(state, sid, now)
		results.append({"type": "sighting", "species": sid, "new": first})
	return results
