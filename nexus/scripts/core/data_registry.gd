extends Node
## Data — 설정 데이터 읽기·검사·id 로 찾기.
## 데이터는 res://data/*.json 에만 있어요. 이름·속성·수치를 바꿀 땐 코드가 아니라 그 파일을 고쳐요.
## 시작할 때 형식을 검사해서 errors 에 모아요. 오류가 있으면 화면이 게임 대신 오류 목록을 보여 줘요.

const DEFAULT_DIR := "res://data/"
const TABLES := ["elements", "rarities", "roles", "resources", "planets", "regions", "stats", "traits", "eco_abilities", "species"]

var dir := DEFAULT_DIR
var meta: Dictionary = {}
var affinity: Dictionary = {}
var lists: Dictionary = {}   # 표 이름 → 항목 배열 (파일 순서)
var index: Dictionary = {}   # 표 이름 → { id: 항목 }
var errors: Array[String] = []


func _ready() -> void:
	load_all(DEFAULT_DIR)


## 모두 다시 읽기 (테스트에서 다른 폴더를 줄 수 있어요). 오류 개수를 돌려줘요.
func load_all(from_dir: String) -> int:
	dir = from_dir
	errors.clear()
	lists.clear()
	index.clear()
	meta = _read("meta").get("raw", {})
	for t in TABLES:
		var r := _read(t)
		var raw: Dictionary = r.get("raw", {})
		if raw.is_empty():
			lists[t] = []
			continue
		if raw.get("schema") != t:
			errors.append("%s.json: schema 가 '%s' 여야 해요" % [t, t])
		var items = raw.get("items")
		if typeof(items) != TYPE_ARRAY:
			errors.append("%s.json: items 목록이 없어요" % t)
			items = []
		lists[t] = items
		if t == "elements":
			affinity = raw.get("affinity", {"default": 1.0, "matrix": {}})
	# id 색인 (중복 검사)
	for t in TABLES:
		index[t] = {}
		for i in lists[t].size():
			var it = lists[t][i]
			if typeof(it) == TYPE_DICTIONARY and it.has("id"):
				if index[t].has(it.id):
					errors.append("%s.json: id '%s' 가 두 번 나와요" % [t, it.id])
				index[t][it.id] = it
	# 칸·참조 검사
	for t in TABLES:
		for i in lists[t].size():
			errors.append_array(DataSchema.check_item(t, i, lists[t][i], index))
	# 지역 해금 조건 + 막다른 길
	for r in lists.regions:
		if typeof(r) == TYPE_DICTIONARY and typeof(r.get("unlock")) == TYPE_DICTIONARY:
			errors.append_array(DataSchema.check_unlock(r.get("id", "?"), r.unlock, index))
	for sp in lists.species:
		if typeof(sp) == TYPE_DICTIONARY:
			errors.append_array(DataSchema.check_species(sp, index))
	for r in lists.regions:
		if typeof(r) == TYPE_DICTIONARY:
			errors.append_array(DataSchema.check_encounters(r, index))
	for s in meta.get("starting_creatures", []):
		if not index.species.has(s):
			errors.append("meta.json: 시작 개체 '%s' 가 species.json 에 없어요" % s)
	_check_research()
	if errors.is_empty():
		for sid in DataSchema.unobtainable_species(lists.species, lists.regions, meta.get("starting_creatures", [])):
			errors.append("species.json '%s': 얻을 수 있는 경로가 없어요 (시작 개체·조사·진화 어디에도 없음)" % sid)
		for rid in DataSchema.unreachable_regions(lists.regions):
			errors.append("regions.json '%s': 어떤 경로로도 열 수 없어요 (막다른 길)" % rid)
	_check_affinity()
	return errors.size()


func _check_research() -> void:
	var r = meta.get("research", {})
	if typeof(r) != TYPE_DICTIONARY or typeof(r.get("levels")) != TYPE_ARRAY or r.levels.is_empty():
		errors.append("meta.json: research.levels 목록이 필요해요")
		return
	var prev := 0.0
	for x in r.levels:
		if typeof(x) != TYPE_FLOAT or x <= prev:
			errors.append("meta.json: research.levels 는 커지는 양수여야 해요")
			return
		prev = x
	for k in ["sighting", "duplicate", "owned"]:
		if typeof(r.get(k)) != TYPE_FLOAT or r[k] < 0:
			errors.append("meta.json: research.%s 는 0 이상 숫자여야 해요" % k)


func _check_affinity() -> void:
	if typeof(affinity.get("default")) != TYPE_FLOAT:
		errors.append("elements.json: affinity.default 는 숫자여야 해요")
	var m = affinity.get("matrix", {})
	if typeof(m) != TYPE_DICTIONARY:
		errors.append("elements.json: affinity.matrix 는 객체여야 해요")
		return
	for atk in m:
		if not index.elements.has(atk):
			errors.append("elements.json: 상성표의 공격 속성 '%s' 가 없어요" % atk)
			continue
		for def in m[atk]:
			if not index.elements.has(def):
				errors.append("elements.json: 상성표의 방어 속성 '%s' 가 없어요" % def)
			elif typeof(m[atk][def]) != TYPE_FLOAT:
				errors.append("elements.json: 상성 %s→%s 는 숫자여야 해요" % [atk, def])


func _read(name: String) -> Dictionary:
	var path := dir.path_join(name + ".json")
	if not FileAccess.file_exists(path):
		errors.append("%s.json: 파일이 없어요" % name)
		return {}
	var text := FileAccess.get_file_as_string(path)
	var json := JSON.new()
	if json.parse(text) != OK:
		errors.append("%s.json: JSON 형식 오류 (%d줄: %s)" % [name, json.get_error_line(), json.get_error_message()])
		return {}
	if typeof(json.data) != TYPE_DICTIONARY:
		errors.append("%s.json: 최상위가 객체가 아니에요" % name)
		return {}
	return {"raw": json.data}


# ── 찾기 ──
func all(table: String) -> Array:
	return lists.get(table, [])


func get_item(table: String, id: String) -> Dictionary:
	return index.get(table, {}).get(id, {})


func has_item(table: String, id: String) -> bool:
	return index.get(table, {}).has(id)


## 속성 상성 배율 (정해지지 않았으면 default)
func affinity_multiplier(attack: String, defend: String) -> float:
	return float(affinity.get("matrix", {}).get(attack, {}).get(defend, affinity.get("default", 1.0)))


## 연구 설정 (meta.research)
func research_config() -> Dictionary:
	return meta.get("research", {"levels": [1, 3, 6], "sighting": 1, "duplicate": 3, "owned": 5})


## 행성의 지역들 (파일 순서)
func regions_of(planet_id: String) -> Array:
	return all("regions").filter(func(r): return r.planet == planet_id)


## 임시(미확정) 항목 수
func placeholder_count() -> int:
	var n := 0
	for t in TABLES:
		for it in lists.get(t, []):
			if typeof(it) == TYPE_DICTIONARY and it.get("placeholder", false):
				n += 1
	return n
