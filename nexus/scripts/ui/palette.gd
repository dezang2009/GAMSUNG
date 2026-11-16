class_name Palette
extends RefCounted
## 화면 색 (어둡게 기본 · 밝게). 화면 코드는 Palette.c.이름 으로만 색을 써요.

const DARK := {
	"bg": Color("#090d16"), "bg2": Color("#0e1422"),
	"card": Color("#141b2b"), "card2": Color("#1b2438"), "card_hi": Color("#222d45"),
	"line": Color("#26314a"), "text": Color("#eaf0fa"), "muted": Color("#9aa6bf"), "faint": Color("#7a87a3"),
	"accent": Color("#7d8cff"), "accent_ink": Color("#0b1030"), "accent_soft": Color("#232b52"),
	"teal": Color("#45d6c0"), "good": Color("#55d68f"), "warn": Color("#ffb454"), "danger": Color("#ff6f6f"),
	"shadow": Color(0, 0, 0, 0.45), "star": Color(0.8, 0.86, 1.0),
}
const LIGHT := {
	"bg": Color("#eef2f9"), "bg2": Color("#e6ebf5"),
	"card": Color("#ffffff"), "card2": Color("#f0f3f9"), "card_hi": Color("#e6ebf6"),
	"line": Color("#dfe5ef"), "text": Color("#141a27"), "muted": Color("#535d72"), "faint": Color("#6f7a90"),
	"accent": Color("#4b5de6"), "accent_ink": Color("#ffffff"), "accent_soft": Color("#e6e9fd"),
	"teal": Color("#14a08c"), "good": Color("#13985f"), "warn": Color("#c77a10"), "danger": Color("#d23c34"),
	"shadow": Color(0.09, 0.12, 0.24, 0.12), "star": Color(0.45, 0.52, 0.7),
}

static var mode := "dark"
static var c: Dictionary = DARK


static func apply(m: String) -> void:
	mode = m if m in ["dark", "light"] else "dark"
	c = DARK if mode == "dark" else LIGHT
