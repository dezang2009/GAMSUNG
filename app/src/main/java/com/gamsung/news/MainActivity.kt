package com.gamsung.news

import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private lateinit var refreshBtn: Button

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(24), dp(16), dp(16))
        }
        root.addView(TextView(this).apply {
            text = "오늘의 뉴스 요약"; textSize = 24f; setTypeface(null, Typeface.BOLD)
        })
        status = TextView(this).apply { textSize = 13f; alpha = 0.7f; setPadding(0, dp(4), 0, dp(12)) }
        root.addView(status)

        // Settings row
        val keyInput = EditText(this).apply {
            hint = "Claude API 키 (sk-ant-...)"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setText(NewsRepository.apiKey(this@MainActivity))
            textSize = 14f
        }
        val hourInput = EditText(this).apply {
            hint = "시"; inputType = InputType.TYPE_CLASS_NUMBER
            setText(NewsRepository.hour(this@MainActivity).toString()); textSize = 14f
            gravity = Gravity.CENTER
        }
        val settings = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            addView(keyInput, LinearLayout.LayoutParams(0, -2, 1f))
            addView(TextView(this@MainActivity).apply { text = "  매일"; textSize = 14f })
            addView(hourInput, LinearLayout.LayoutParams(dp(52), -2))
            addView(TextView(this@MainActivity).apply { text = "시"; textSize = 14f })
        }
        root.addView(settings)

        refreshBtn = Button(this).apply { text = "저장하고 지금 요약" }
        refreshBtn.setOnClickListener {
            NewsRepository.setApiKey(this, keyInput.text.toString())
            val h = hourInput.text.toString().toIntOrNull()?.coerceIn(0, 23) ?: 7
            NewsRepository.setHour(this, h); hourInput.setText(h.toString())
            NewsWorker.schedule(this)
            refresh()
        }
        root.addView(refreshBtn, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })

        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(ScrollView(this).apply { addView(content) }, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        if (NewsRepository.apiKey(this).isNotBlank()) NewsWorker.schedule(this)
        render()
    }

    private fun refresh() {
        refreshBtn.isEnabled = false
        status.text = "뉴스를 모으고 요약하는 중… (10~30초)"
        lifecycleScope.launch {
            val err = withContext(Dispatchers.IO) { NewsRepository.refresh(applicationContext) }
            NewsWidget.updateAll(applicationContext)
            refreshBtn.isEnabled = true
            render()
            if (err != null) Toast.makeText(this@MainActivity, err, Toast.LENGTH_LONG).show()
        }
    }

    private fun render() {
        content.removeAllViews()
        val b = NewsRepository.load(this)
        val err = NewsRepository.lastError(this)
        status.text = when {
            b != null -> "업데이트: " + SimpleDateFormat("M월 d일 HH:mm", Locale.KOREAN).format(Date(b.updatedAt)) +
                (err?.let { "  ·  최근 오류: $it" } ?: "")
            err != null -> err
            else -> "API 키를 넣고 버튼을 누르세요. 홈 화면에 위젯도 추가할 수 있어요."
        }
        if (b == null) return

        section("핵심 요약")
        b.items.forEachIndexed { i, s ->
            content.addView(TextView(this).apply {
                text = "${i + 1}. $s"; textSize = 16f
                setLineSpacing(dp(3).toFloat(), 1f); setPadding(0, dp(6), 0, dp(6))
            })
        }
        section("원문 헤드라인 (${b.headlines.size})")
        b.headlines.forEach { h ->
            content.addView(TextView(this).apply {
                text = "${h.title}  ·  ${h.source}"; textSize = 14f
                setTextColor(0xFF2F6FED.toInt()); setPadding(0, dp(6), 0, dp(6))
                if (h.link.isNotBlank()) setOnClickListener {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(h.link))) }
                }
            })
        }
    }

    private fun section(t: String) {
        content.addView(TextView(this).apply {
            text = t; textSize = 13f; setTypeface(null, Typeface.BOLD); alpha = 0.6f
            setPadding(0, dp(20), 0, dp(4))
        })
        content.addView(View(this).apply { setBackgroundColor(0x22888888) }, LinearLayout.LayoutParams(-1, dp(1)))
    }
}
