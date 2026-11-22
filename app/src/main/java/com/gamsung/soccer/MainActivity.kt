package com.gamsung.soccer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamsung.soccer.data.*
import com.gamsung.soccer.ui.*

private val TABS = listOf("메인", "훈련", "선수단", "구단", "메시지")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = SaveStore(this)
        setContent {
            AppTheme {
                var state by remember {
                    mutableStateOf(store.load() ?: GameState(player = Player("신인 선수", Pos.CAM, 17, 60, 1_000_000, "TBD")))
                }
                var tab by remember { mutableIntStateOf(0) }
                Column(Modifier.fillMaxSize().background(Navy).systemBarsPadding()) {
                    Box(Modifier.weight(1f).fillMaxWidth().padding(16.dp)) {
                        if (tab == 0) Home(state) { state = state.nextWeek().also(store::save) }
                        else FitText("${TABS[tab]} (준비 중)", size = 20.sp, color = SubText)
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

@Composable
private fun Home(s: GameState, onNext: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FitText("${s.player.name}  ·  ${s.player.pos}", size = 24.sp, weight = FontWeight.Bold)
        FitText("나이 ${s.player.age}  ·  OVR ${s.player.ovr}", size = 16.sp, color = SubText)
        FitText("시즌 ${s.season}  ·  라운드 ${s.week}/${s.seasonWeeks}", size = 16.sp, color = SubText)
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Mint).clickable(onClick = onNext).padding(16.dp), Alignment.Center) {
            FitText("다음 주로 진행", size = 18.sp, weight = FontWeight.Bold, color = Navy)
        }
    }
}
