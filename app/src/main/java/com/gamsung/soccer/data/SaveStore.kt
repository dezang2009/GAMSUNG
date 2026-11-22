package com.gamsung.soccer.data

import android.content.Context
import org.json.JSONObject

/** 로컬 저장(SharedPreferences + JSON). 모델이 커지면 Room으로 교체. */
class SaveStore(ctx: Context) {
    private val sp = ctx.getSharedPreferences("save", Context.MODE_PRIVATE)

    fun load(): GameState? = sp.getString("state", null)?.let { runCatching { decode(it) }.getOrNull() }
    fun save(s: GameState) = sp.edit().putString("state", encode(s)).apply()

    companion object {
        fun encode(s: GameState): String = JSONObject().apply {
            put("season", s.season); put("week", s.week); put("weeks", s.seasonWeeks)
            put("p", JSONObject().apply {
                val p = s.player
                put("name", p.name); put("pos", p.pos.name); put("age", p.age); put("ovr", p.ovr)
                put("salary", p.salary); put("club", p.clubId); put("stamina", p.stamina)
            })
        }.toString()

        fun decode(t: String): GameState {
            val o = JSONObject(t); val p = o.getJSONObject("p")
            return GameState(
                o.getInt("season"), o.getInt("week"),
                Player(p.getString("name"), Pos.valueOf(p.getString("pos")), p.getInt("age"), p.getInt("ovr"),
                    p.getLong("salary"), p.getString("club"), p.getInt("stamina")),
                o.getInt("weeks"),
            )
        }
    }
}
