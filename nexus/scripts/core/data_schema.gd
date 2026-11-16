class_name DataSchema
extends RefCounted
## 설정 데이터(JSON) 형식 정의와 검사.
## 형식 표기: "id" · "string" · "int" · "number" · "bool" · "color"(#rrggbb) · "array" · "dict" · "vec2"([x, y], 0~1)
##           "ref:표이름" · "array<ref:표이름>" · 끝에 "?" 를 붙이면 생략 가능

const SCHEMAS := {
	"elements": {"id": "id", "name": "string", "color": "color", "placeholder": "bool?"},
	"rarities": {"id": "id", "name": "string", "tier": "int", "color": "color", "placeholder": "bool?"},
	"roles": {"id": "id", "name": "string", "placeholder": "bool?"},
	"resources": {"id": "id", "name": "string", "color": "color", "start": "int", "placeholder": "bool?"},
	"planets": {"id": "id", "name": "string", "order": "int", "palette": "array", "placeholder": "bool?"},
	"regions": {"id": "id", "planet": "ref:planets", "name": "string", "map": "vec2", "unlock": "dict", "placeholder": "bool?"},
	"species": {"id": "id", "name": "string", "rarity": "ref:rarities", "element": "ref:elements", "role": "ref:roles", "base_stats": "dict", "skills": "array?", "evolution": "dict?", "traits": "array?", "eco_abilities": "array?", "art": "string?", "placeholder": "bool?"},
}

## 지역 해금 조건 종류와 필요한 칸
const UNLOCK_TYPES := {
	"start": {},
	"region_cleared": {"region": "ref:regions"},
}

static var _ID := RegEx.create_from_string("^[a-z][a-z0-9_]*$")
static var _COLOR := RegEx.create_from_string("^#[0-9a-fA-F]{6}$")


## 한 항목의 칸 검사 (참조는 tables 가 있을 때만). 오류 문장 목록을 돌려줘요.
static func check_item(table: String, index: int, item, tables: Dictionary) -> Array[String]:
	var errs: Array[String] = []
	var where := "%s.json [%d]" % [table, index]
	if typeof(item) != TYPE_DICTIONARY:
		errs.append("%s: 항목이 객체가 아니에요" % where)
		return errs
	if item.has("id"):
		where = "%s.json '%s'" % [table, item.id]
	var schema: Dictionary = SCHEMAS.get(table, {})
	for field in schema:
		var kind: String = schema[field]
		var optional := kind.ends_with("?")
		kind = kind.trim_suffix("?")
		if not item.has(field):
			if not optional:
				errs.append("%s: '%s' 칸이 없어요" % [where, field])
			continue
		var msg := _check_value(item[field], kind, tables)
		if msg != "":
			errs.append("%s: '%s' %s" % [where, field, msg])
	for field in item:
		if not schema.has(field):
			errs.append("%s: 알 수 없는 칸 '%s'" % [where, field])
	return errs


static func _check_value(v, kind: String, tables: Dictionary) -> String:
	match kind:
		"id":
			return "" if typeof(v) == TYPE_STRING and _ID.search(v) else "는 영문 소문자·숫자·_ 로 된 id 여야 해요"
		"string":
			return "" if typeof(v) == TYPE_STRING and v.strip_edges() != "" else "는 비어 있지 않은 글자여야 해요"
		"int":
			return "" if typeof(v) == TYPE_FLOAT and v == floor(v) else "는 정수여야 해요"
		"number":
			return "" if typeof(v) == TYPE_FLOAT else "는 숫자여야 해요"
		"bool":
			return "" if typeof(v) == TYPE_BOOL else "는 true/false 여야 해요"
		"color":
			return "" if typeof(v) == TYPE_STRING and _COLOR.search(v) else "는 #rrggbb 색이어야 해요"
		"array":
			return "" if typeof(v) == TYPE_ARRAY else "는 목록이어야 해요"
		"dict":
			return "" if typeof(v) == TYPE_DICTIONARY else "는 객체여야 해요"
		"vec2":
			if typeof(v) != TYPE_ARRAY or v.size() != 2:
				return "는 [x, y] 여야 해요"
			for n in v:
				if typeof(n) != TYPE_FLOAT or n < 0.0 or n > 1.0:
					return "의 값은 0~1 사이 숫자여야 해요"
			return ""
	if kind.begins_with("ref:"):
		return _check_ref(v, kind.substr(4), tables)
	if kind.begins_with("array<ref:"):
		if typeof(v) != TYPE_ARRAY:
			return "는 목록이어야 해요"
		var t := kind.substr(10).trim_suffix(">")
		for x in v:
			var m := _check_ref(x, t, tables)
			if m != "":
				return m
		return ""
	return "의 형식(%s)을 알 수 없어요" % kind


static func _check_ref(v, table: String, tables: Dictionary) -> String:
	if typeof(v) != TYPE_STRING:
		return "는 %s 의 id 여야 해요" % table
	if tables.has(table) and not tables[table].has(v):
		return "가 가리키는 %s '%s' 가 없어요" % [table, v]
	return ""


## 지역 해금 조건 검사
static func check_unlock(region_id: String, unlock: Dictionary, tables: Dictionary) -> Array[String]:
	var errs: Array[String] = []
	var where := "regions.json '%s': unlock" % region_id
	var keys := unlock.keys()
	if keys.size() != 1 or not (keys[0] in ["any", "all"]) or typeof(unlock[keys[0]]) != TYPE_ARRAY or unlock[keys[0]].is_empty():
		errs.append("%s 는 { any: [...] } 또는 { all: [...] } 하나여야 해요" % where)
		return errs
	for c in unlock[keys[0]]:
		if typeof(c) != TYPE_DICTIONARY or not UNLOCK_TYPES.has(c.get("type", "")):
			errs.append("%s: 알 수 없는 조건 %s" % [where, JSON.stringify(c)])
			continue
		var need: Dictionary = UNLOCK_TYPES[c.type]
		for f in need:
			var m := _check_value(c.get(f), need[f], tables) if c.has(f) else "칸이 없어요"
			if m != "":
				errs.append("%s: 조건 %s 의 '%s' %s" % [where, c.type, f, m])
			elif c.type == "region_cleared" and c[f] == region_id:
				errs.append("%s: 자기 자신을 조건으로 쓸 수 없어요" % where)
	return errs


## 처음부터 시작해 모든 지역을 언젠가 열 수 있는지 (막다른 길 검사). 열 수 없는 지역 id 목록.
static func unreachable_regions(regions: Array) -> Array[String]:
	var open := {}
	var changed := true
	while changed:
		changed = false
		for r in regions:
			if open.has(r.id):
				continue
			if is_unlocked(r.unlock, open):
				open[r.id] = true
				changed = true
	var out: Array[String] = []
	for r in regions:
		if not open.has(r.id):
			out.append(r.id)
	return out


## 조건 평가 (cleared: 개척한 지역 id 집합)
static func is_unlocked(unlock: Dictionary, cleared: Dictionary) -> bool:
	var mode: String = unlock.keys()[0]
	var hits := 0
	for c in unlock[mode]:
		var ok := false
		match c.type:
			"start":
				ok = true
			"region_cleared":
				ok = cleared.has(c.region)
		if ok:
			hits += 1
	return hits > 0 if mode == "any" else hits == unlock[mode].size()
