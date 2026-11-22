package com.gamsung.soccer.ui

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.gamsung.soccer.R

val Navy = Color(0xFF0B1033)
val NavyCard = Color(0xFF141B4D)
val Mint = Color(0xFF3FF2D2)
val SubText = Color(0xFFA8AED6)

val Paperlogy = FontFamily(
    Font(R.font.paperlogy_regular, FontWeight.Normal),
    Font(R.font.paperlogy_semibold, FontWeight.SemiBold),
    Font(R.font.paperlogy_bold, FontWeight.Bold),
)

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    val base = TextStyle(fontFamily = Paperlogy)
    MaterialTheme(
        colorScheme = darkColorScheme(primary = Mint, background = Navy, surface = NavyCard, onBackground = Color.White, onSurface = Color.White),
        typography = MaterialTheme.typography.run {
            copy(bodyLarge = bodyLarge.merge(base), bodyMedium = bodyMedium.merge(base), titleLarge = titleLarge.merge(base),
                titleMedium = titleMedium.merge(base), labelLarge = labelLarge.merge(base), labelMedium = labelMedium.merge(base),
                headlineMedium = headlineMedium.merge(base), displayMedium = displayMedium.merge(base))
        },
        content = content,
    )
}

/**
 * 글씨가 잘리지 않는 텍스트: 한 줄에 안 들어가면 maxLines 안에서 글자 크기를 줄인다.
 * 앱 안의 모든 텍스트는 이걸 쓴다.
 */
@Composable
fun FitText(
    text: String,
    modifier: Modifier = Modifier,
    size: TextUnit = 16.sp,
    minSize: TextUnit = 9.sp,
    maxLines: Int = 1,
    weight: FontWeight = FontWeight.Normal,
    color: Color = Color.White,
) {
    var s by remember(text, size) { mutableStateOf(size) }
    Text(
        text, modifier, color = color, fontSize = s, fontWeight = weight, fontFamily = Paperlogy,
        maxLines = maxLines, softWrap = maxLines > 1, overflow = TextOverflow.Clip,
        onTextLayout = { r ->
            if ((r.hasVisualOverflow || r.didOverflowWidth) && s > minSize) s = (s.value - 1f).coerceAtLeast(minSize.value).sp
        },
    )
}
