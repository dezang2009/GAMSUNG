package com.gamsung.soccer

import com.gamsung.soccer.data.*
import org.junit.Assert.*
import org.junit.Test
import kotlin.random.Random

class ModelTest {
    private val rnd = Random(1)
    private val g = GameState(player = Engine.newPlayer("가", Pos.ST, rnd))

    @Test fun seasonRollsOver() {
        var s = g; repeat(34) { s = Engine.play(s, Focus.ATK, rnd) }
        assertEquals(2, s.season); assertEquals(1, s.week); assertEquals(18, s.player.age)
        assertNotNull(s.report); assertEquals(34, s.career.apps)
    }
    @Test fun blockedUntilReportAck() {
        var s = g; repeat(34) { s = Engine.play(s, Focus.REST, rnd) }
        assertSame(s, Engine.play(s, Focus.ATK, rnd))
    }
    @Test fun careerEndsAndStatsStayInRange() {
        var s = g; var guard = 0
        while (!s.retired && guard++ < 5000) { s = Engine.play(s, Focus.entries[guard % 4], rnd); if (s.report != null) s = s.copy(report = null) }
        assertTrue(s.retired); assertEquals(Engine.RETIRE_AGE, s.player.age)
        assertTrue(s.player.atk in 1..Engine.STAT_MAX && s.player.stamina in 0..100)
    }
    @Test fun saveRoundTrip() {
        var s = g; repeat(40) { s = Engine.play(s, Focus.PHY, rnd) }
        assertEquals(s, SaveStore.decode(SaveStore.encode(s)))
    }
}
