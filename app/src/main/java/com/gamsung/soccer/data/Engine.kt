package com.gamsung.soccer.data

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

/** 게임 규칙 전부. 순수 함수라 테스트 가능. 숫자는 여기서만 조정한다. */
object Engine {
    const val STAT_MAX = 120
    const val RETIRE_AGE = 38

    fun newPlayer(name: String, pos: Pos, rnd: Random): Player {
        fun b(bias: Int) = 45 + bias + rnd.nextInt(-3, 4)
        val (a, d) = when (pos) { Pos.ST, Pos.WG, Pos.CAM -> 6 to -4; Pos.CM -> 0 to 0; else -> -4 to 6 }
        return Player(name.trim().ifEmpty { "신인 선수" }.take(12), pos, 17, b(a), b(d), b(0))
    }

    private fun growChance(age: Int) = when { age <= 22 -> .5; age <= 26 -> .35; age <= 30 -> .2; else -> 0.0 }

    private fun train(p: Player, f: Focus, rnd: Random): Player {
        if (f == Focus.REST) return p.copy(stamina = min(100, p.stamina + 45))
        val tired = if (p.stamina >= 30) 1.0 else .4
        val up = if (rnd.nextDouble() < growChance(p.age) * tired) 1 else 0
        val q = p.copy(stamina = max(0, p.stamina - 10))
        return when (f) {
            Focus.ATK -> q.copy(atk = min(STAT_MAX, q.atk + up))
            Focus.DEF -> q.copy(def = min(STAT_MAX, q.def + up))
            else -> q.copy(phy = min(STAT_MAX, q.phy + up))
        }
    }

    private fun scoring(pos: Pos) = when (pos) {
        Pos.ST -> .5; Pos.WG -> .35; Pos.CAM -> .3; Pos.CM -> .12; Pos.DM, Pos.FB -> .05; Pos.CB -> .04; Pos.GK -> 0.0
    }

    data class Match(val own: Int, val opp: Int, val rating: Double, val stat: Stat)

    fun match(p: Player, rnd: Random): Match {
        val opp = 55 + rnd.nextInt(-8, 16)
        val perf = p.ovr * (.7 + .3 * p.stamina / 100)
        val diff = perf - opp
        val own = (1.3 + diff / 20 + rnd.nextDouble(-1.0, 1.0)).roundToInt().coerceIn(0, 6)
        val against = (1.3 - diff / 20 + rnd.nextDouble(-1.0, 1.0)).roundToInt().coerceIn(0, 6)
        val rating = (5.5 + diff / 10 + rnd.nextDouble(-.8, .8)).coerceIn(3.0, 10.0)
        val k = scoring(p.pos) * rating / 7
        var g = 0; var a = 0
        repeat(own) { if (rnd.nextDouble() < k) g++ else if (rnd.nextDouble() < k * .6) a++ }
        return Match(own, against, (rating * 10).roundToInt() / 10.0, Stat(g, a, 1))
    }

    fun play(s: GameState, f: Focus, rnd: Random): GameState {
        if (s.retired || s.report != null) return s
        val trained = train(s.player, f, rnd)
        val m = match(trained, rnd)
        val p = trained.copy(stamina = (trained.stamina - 20 + 12).coerceIn(0, 100))
        val res = if (m.own > m.opp) "승" else if (m.own < m.opp) "패" else "무"
        val line = "S${s.season} R${s.week}  $res ${m.own}-${m.opp}  평점 ${m.rating}" +
            (if (m.stat.goals > 0) "  골 ${m.stat.goals}" else "") + (if (m.stat.assists > 0) "  도움 ${m.stat.assists}" else "")
        val n = s.copy(
            week = s.week + 1, player = p, seasonStat = s.seasonStat + m.stat, career = s.career + m.stat,
            peak = max(s.peak, p.ovr), last = line, log = (listOf(line) + s.log).take(60),
        )
        return if (n.week > n.seasonWeeks) endSeason(n, rnd) else n
    }

    private fun endSeason(s: GameState, rnd: Random): GameState {
        val p = s.player; val age = p.age + 1
        val drop = if (age >= 33) 3 else if (age >= 31) 1 else 0
        val aged = p.copy(
            age = age, stamina = 100,
            atk = max(1, p.atk - max(0, drop - 1)), phy = max(1, p.phy - drop),
        )
        val salary = aged.ovr.toLong() * aged.ovr * 1500 + s.seasonStat.goals * 20_000L + s.seasonStat.assists * 10_000L
        val rep = SeasonReport(s.season, p.ovr, aged.ovr, s.seasonStat, salary, age)
        return s.copy(
            season = s.season + 1, week = 1, player = aged.copy(salary = salary), seasonStat = Stat(),
            earned = s.earned + p.salary, report = rep, retired = age >= RETIRE_AGE,
        )
    }

    fun retire(s: GameState) = s.copy(retired = true, report = null)

    fun grade(s: GameState) = when { s.peak >= 110 -> "S"; s.peak >= 95 -> "A"; s.peak >= 80 -> "B"; s.peak >= 65 -> "C"; else -> "D" }
}
