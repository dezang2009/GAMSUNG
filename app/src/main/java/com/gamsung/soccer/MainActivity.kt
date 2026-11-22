package com.gamsung.soccer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamsung.soccer.data.*
import com.gamsung.soccer.ui.*
import kotlin.random.Random

private val TABS = listOf("메인", "선수", "기록")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = SaveStore(this)
        setContent {
            AppTheme {
                var state by remember { mutableStateOf(store.load()) }
                fun set(s: GameState?) { state = s; store.save(s) }
                var tab by remember { mutableIntStateOf(0) }
                var focus by remember { mutableStateOf(Focus.ATK) }
                val s = state
                Column(Modifier.fillMaxSize().background(Navy).systemBarsPadding()) {
                    when {
                        s == null -> CreateScreen { n, p -> set(GameState(player = Engine.newPlayer(n, p, Random))) }
                        s.retired -> RetiredScreen(s) { set(null); tab = 0 }
                        else -> {
                            Box(Modifier.weight(1f).fillMaxWidth().padding(16.dp)) {
                                when (tab) {
                                    0 -> HomeTab(s, focus, { focus = it }, { set(Engine.play(s, focus, Random)) }, { set(s.copy(report = null)) })
                                    1 -> PlayerTab(s) { set(Engine.retire(s)) }
                                    else -> LogTab(s)
                                }
                            }
                            Row(Modifier.fillMaxWidth().background(NavyCard)) {
                                TABS.forEachIndexed { i, t ->
                                    Box(Modifier.weight(1f).clickable { tab = i }.padding(vertical = 14.dp), Alignment.Center) {
                                        FitText(t, size = 14.sp, weight = FontWeight.SemiBold, color = if (i == tab) Mint else SubText)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
