package com.gamsung.soccer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamsung.soccer.data.*
import java.text.NumberFormat

private val Card = RoundedCornerShape(12.dp)
private fun won(n: Long) = NumberFormat.getInstance().format(n)

@Composable
fun Btn(text: String, modifier: Modifier = Modifier, on: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(10.dp)).background(if (on) Mint else NavyCard).clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 14.dp),
        Alignment.Center,
    ) { FitText(text, size = 16.sp, weight = FontWeight.Bold, color = if (on) Navy else SubText) }
}

@Composable
private fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth().clip(Card).background(NavyCard).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)

@Composable
private fun Row2(a: String, b: String, ac: Color = SubText) = Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
    FitText(a, Modifier.weight(1f), 15.sp, color = ac); FitText(b, Modifier.weight(1f), 15.sp, weight = FontWeight.SemiBold)
}

@Composable
private fun Bar(label: String, v: Int) = Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    FitText(label, Modifier.width(48.dp), 14.sp, color = SubText)
    Box(Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)).background(Navy)) {
        Box(Modifier.fillMaxWidth(v.coerceIn(0, Engine.STAT_MAX) / Engine.STAT_MAX.toFloat()).fillMaxHeight().background(Mint))
    }
    FitText("$v", Modifier.width(36.dp), 14.sp, weight = FontWeight.Bold)
}

@Composable
fun CreateScreen(onStart: (String, Pos) -> Unit) {
    var name by remember { mutableStateOf("") }
    var pos by remember { mutableStateOf(Pos.CAM) }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        FitText("축구선수키우기", size = 28.sp, weight = FontWeight.Bold)
        FitText("17세 신인으로 시작합니다", size = 15.sp, color = SubText)
        Panel {
            FitText("이름", size = 14.sp, color = SubText)
            BasicTextField(name, { name = it.take(12) }, singleLine = true, cursorBrush = SolidColor(Mint),
                textStyle = TextStyle(color = Color.White, fontFamily = Paperlogy, fontSize = 20.sp),
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Navy).padding(12.dp),
                decorationBox = { inner -> if (name.isEmpty()) FitText("이름 입력 (최대 12자)", size = 16.sp, color = SubText); inner() })
        }
        Panel {
            FitText("포지션", size = 14.sp, color = SubText)
            Pos.entries.chunked(4).forEach { r ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { r.forEach { Btn(it.label, Modifier.weight(1f), it == pos) { pos = it } } }
            }
        }
        Spacer(Modifier.weight(1f))
        Btn("시작하기", Modifier.fillMaxWidth()) { onStart(name, pos) }
    }
}

@Composable
fun HomeTab(s: GameState, focus: Focus, onFocus: (Focus) -> Unit, onPlay: () -> Unit, onAck: () -> Unit) {
    val p = s.player
    Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Panel {
            FitText("${p.name}  ·  ${p.pos.label}", size = 22.sp, weight = FontWeight.Bold)
            FitText("${p.age}세  ·  OVR ${p.ovr}  ·  연봉 ${won(p.salary)}", size = 14.sp, color = SubText)
            FitText("시즌 ${s.season}  ·  라운드 ${minOf(s.week, s.seasonWeeks)}/${s.seasonWeeks}", size = 14.sp, color = SubText)
            Bar("컨디션", p.stamina)
        }
        if (s.report != null) {
            val r = s.report
            Panel {
                FitText("시즌 ${r.season} 종료", size = 18.sp, weight = FontWeight.Bold, color = Mint)
                Row2("OVR", "${r.ovrBefore} → ${r.ovrAfter}")
                Row2("기록", "${r.stat.apps}경기 ${r.stat.goals}골 ${r.stat.assists}도움")
                Row2("새 계약 연봉", won(r.salary))
                Btn("확인", Modifier.fillMaxWidth(), onClick = onAck)
            }
        } else {
            Panel {
                FitText("이번 주 훈련", size = 14.sp, color = SubText)
                Focus.entries.chunked(2).forEach { r ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { r.forEach { Btn(it.label, Modifier.weight(1f), it == focus) { onFocus(it) } } }
                }
            }
            Btn("훈련하고 경기 진행", Modifier.fillMaxWidth(), onClick = onPlay)
        }
        s.last?.let { Panel { FitText("최근 경기", size = 14.sp, color = SubText); FitText(it, size = 16.sp, maxLines = 2) } }
    }
}

@Composable
fun PlayerTab(s: GameState, onRetire: () -> Unit) {
    val p = s.player; var ask by remember { mutableStateOf(false) }
    Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Panel {
            FitText("능력치", size = 18.sp, weight = FontWeight.Bold)
            Bar("공격", p.atk); Bar("수비", p.def); Bar("체력", p.phy)
            Row2("OVR", "${p.ovr}"); Row2("최고 OVR", "${s.peak}")
        }
        Panel {
            FitText("통산", size = 18.sp, weight = FontWeight.Bold)
            Row2("경기", "${s.career.apps}"); Row2("골", "${s.career.goals}"); Row2("도움", "${s.career.assists}")
            Row2("누적 수입", won(s.earned))
        }
        if (ask) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Btn("취소", Modifier.weight(1f), false) { ask = false }; Btn("은퇴 확정", Modifier.weight(1f), onClick = onRetire)
        } else Btn("은퇴하기", Modifier.fillMaxWidth(), false) { ask = true }
    }
}

@Composable
fun LogTab(s: GameState) {
    Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (s.log.isEmpty()) FitText("아직 경기가 없습니다", size = 16.sp, color = SubText)
        s.log.forEach { Panel(Modifier) { FitText(it, size = 14.sp, maxLines = 2) } }
    }
}

@Composable
fun RetiredScreen(s: GameState, onNew: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FitText("은퇴 성적표", size = 26.sp, weight = FontWeight.Bold)
        Panel {
            FitText("${s.player.name} (${s.player.pos.label}) · ${s.player.age}세", size = 18.sp, weight = FontWeight.Bold)
            Row2("등급", Engine.grade(s)); Row2("OVR", "${s.startOvr} → 최고 ${s.peak}")
            Row2("통산", "${s.career.apps}경기 ${s.career.goals}골 ${s.career.assists}도움"); Row2("누적 수입", won(s.earned))
        }
        Spacer(Modifier.weight(1f))
        Btn("새 선수 키우기", Modifier.fillMaxWidth(), onClick = onNew)
    }
}
