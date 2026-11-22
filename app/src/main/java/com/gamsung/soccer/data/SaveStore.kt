package com.gamsung.soccer.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** 로컬 저장(SharedPreferences + JSON). */
class SaveStore(ctx: Context) {
    private val sp = ctx.getSharedPreferences("save", Context.MODE_PRIVATE)
    fun load(): GameState? = sp.getString("state", null)?.let { runCatching { decode(it) }.getOrNull() }
    fun save(s: GameState?) = sp.edit().apply { if (s == null) remove("state") else putString("state", encode(s)) }.apply()

    companion object {
        private fun st(s: Stat) = JSONObject().put("g", s.goals).put("a", s.assists).put("n", s.apps)
        private fun st(o: JSONObject) = Stat(o.getInt("g"), o.getInt("a"), o.getInt("n"))

        fun encode(s: GameState): String = JSONObject().apply {
            put("season", s.season); put("week", s.week); put("weeks", s.seasonWeeks)
            val p = s.player
            put("p", JSONObject().put("name", p.name).put("pos", p.pos.name).put("age", p.age).put("atk", p.atk)
                .put("def", p.def).put("phy", p.phy).put("sta", p.stamina).put("sal", p.salary))
            put("ss", st(s.seasonStat)); put("cs", st(s.career))
            put("earned", s.earned); put("peak", s.peak); put("start", s.startOvr)
            put("last", s.last ?: JSONObject.NULL); put("log", JSONArray(s.log)); put("retired", s.retired)
            s.report?.let { r -> put("rep", JSONObject().put("season", r.season).put("b", r.ovrBefore).put("a", r.ovrAfter)
                .put("st", st(r.stat)).put("sal", r.salary).put("age", r.age)) }
        }.toString()

        fun decode(t: String): GameState {
            val o = JSONObject(t); val p = o.getJSONObject("p")
            val log = o.getJSONArray("log").let { a -> List(a.length()) { a.getString(it) } }
            return GameState(
                o.getInt("season"), o.getInt("week"), o.getInt("weeks"),
                Player(p.getString("name"), Pos.valueOf(p.getString("pos")), p.getInt("age"), p.getInt("atk"),
                    p.getInt("def"), p.getInt("phy"), p.getInt("sta"), p.getLong("sal")),
                st(o.getJSONObject("ss")), st(o.getJSONObject("cs")),
                o.getLong("earned"), o.getInt("peak"), o.getInt("start"),
                if (o.isNull("last")) null else o.getString("last"), log,
                o.optJSONObject("rep")?.let { r -> SeasonReport(r.getInt("season"), r.getInt("b"), r.getInt("a"), st(r.getJSONObject("st")), r.getLong("sal"), r.getInt("age")) },
                o.getBoolean("retired"),
            )
        }
    }
}
