package com.gamsung.soccer

import com.gamsung.soccer.data.*
import org.junit.Assert.assertEquals
import org.junit.Test

class ModelTest {
    private val g = GameState(player = Player("가", Pos.ST, 17, 60, 1, "c"))
    @Test fun seasonRollsOver() {
        var s = g; repeat(34) { s = s.nextWeek() }
        assertEquals(2, s.season); assertEquals(1, s.week); assertEquals(18, s.player.age)
    }
    @Test fun saveRoundTrip() = assertEquals(g, SaveStore.decode(SaveStore.encode(g)))
}
