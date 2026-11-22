package com.gamsung.soccer.data

import kotlin.math.roundToInt

enum class Pos(val label: String) { GK("GK"), CB("CB"), FB("FB"), DM("DM"), CM("CM"), CAM("CAM"), WG("WG"), ST("ST") }

enum class Focus(val label: String) { ATK("공격 훈련"), DEF("수비 훈련"), PHY("체력 훈련"), REST("휴식") }

/** 1차 대상 리그. 구단/로고 데이터는 assets/data/<이름>.json 에 붙는다. */
enum class League(val label: String, val tier: Int) {
    EPL("잉글랜드 1부", 1), EFL("잉글랜드 2부", 2),
    LALIGA("라리가 1부", 1), LALIGA2("라리가 2부", 2),
    SERIEA("세리에 A", 1), SERIEB("세리에 B", 2),
    LIGUE1("프랑스 1부", 1), LIGUE2("프랑스 2부", 2),
    LIGA_PT1("포르투갈 1부", 1), LIGA_PT2("포르투갈 2부", 2),
    SUPER_LIG("튀르키예 1부", 1)
}

data class Stat(val goals: Int = 0, val assists: Int = 0, val apps: Int = 0) {
    operator fun plus(o: Stat) = Stat(goals + o.goals, assists + o.assists, apps + o.apps)
}

data class Player(
    val name: String, val pos: Pos, val age: Int,
    val atk: Int, val def: Int, val phy: Int,
    val stamina: Int = 100, val salary: Long = 1_000_000,
) {
    val ovr: Int
        get() {
            val w = when (pos) {
                Pos.ST, Pos.WG, Pos.CAM -> doubleArrayOf(.6, .1, .3)
                Pos.CM -> doubleArrayOf(.35, .3, .35)
                Pos.DM, Pos.FB, Pos.CB -> doubleArrayOf(.15, .55, .3)
                Pos.GK -> doubleArrayOf(0.0, .7, .3)
            }
            return (atk * w[0] + def * w[1] + phy * w[2]).roundToInt()
        }
}

data class SeasonReport(val season: Int, val ovrBefore: Int, val ovrAfter: Int, val stat: Stat, val salary: Long, val age: Int)

data class GameState(
    val season: Int = 1, val week: Int = 1, val seasonWeeks: Int = 34,
    val player: Player,
    val seasonStat: Stat = Stat(), val career: Stat = Stat(),
    val earned: Long = 0, val peak: Int = player.ovr, val startOvr: Int = player.ovr,
    val last: String? = null, val log: List<String> = emptyList(),
    val report: SeasonReport? = null, val retired: Boolean = false,
)
