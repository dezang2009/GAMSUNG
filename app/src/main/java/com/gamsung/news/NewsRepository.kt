package com.gamsung.news

import android.content.Context
import android.util.Xml
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.MessageCreateParams
import org.json.JSONArray
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class Headline(val title: String, val link: String, val source: String)

data class Brief(val items: List<String>, val headlines: List<Headline>, val updatedAt: Long)

object NewsRepository {
    private const val PREFS = "news"
    private const val MODEL = "claude-opus-5-5"

    private const val GN = "https://news.google.com/rss"
    private const val KR = "hl=ko&gl=KR&ceid=KR:ko"
    private val FEEDS = listOf(
        "주요" to "$GN?$KR",
        "경제" to "$GN/headlines/section/topic/BUSINESS?$KR",
        "IT" to "$GN/headlines/section/topic/TECHNOLOGY?$KR",
        "국제" to "$GN/headlines/section/topic/WORLD?$KR",
    )

    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun apiKey(ctx: Context): String = prefs(ctx).getString("api_key", "") ?: ""
    fun setApiKey(ctx: Context, key: String) = prefs(ctx).edit().putString("api_key", key.trim()).apply()
    fun hour(ctx: Context): Int = prefs(ctx).getInt("hour", 7)
    fun setHour(ctx: Context, h: Int) = prefs(ctx).edit().putInt("hour", h).apply()
    fun lastError(ctx: Context): String? = prefs(ctx).getString("error", null)

    fun load(ctx: Context): Brief? {
        val raw = prefs(ctx).getString("brief", null) ?: return null
        val o = JSONObject(raw)
        val items = o.getJSONArray("items").let { a -> List(a.length()) { a.getString(it) } }
        val hs = o.getJSONArray("headlines").let { a ->
            List(a.length()) {
                val h = a.getJSONObject(it)
                Headline(h.getString("t"), h.getString("l"), h.getString("s"))
            }
        }
        return Brief(items, hs, o.getLong("at"))
    }

    private fun save(ctx: Context, b: Brief) {
        val o = JSONObject()
            .put("items", JSONArray(b.items))
            .put("headlines", JSONArray(b.headlines.map {
                JSONObject().put("t", it.title).put("l", it.link).put("s", it.source)
            }))
            .put("at", b.updatedAt)
        prefs(ctx).edit().putString("brief", o.toString()).remove("error").apply()
    }

    private fun saveError(ctx: Context, msg: String) = prefs(ctx).edit().putString("error", msg).apply()

    /** Fetches headlines, summarizes them with Claude, stores the result. Returns an error message or null. */
    fun refresh(ctx: Context): String? {
        val key = apiKey(ctx)
        if (key.isBlank()) return "API 키가 없습니다. 앱에서 입력하세요.".also { saveError(ctx, it) }

        val headlines = FEEDS.flatMap { (name, url) ->
            runCatching { fetchRss(url, name) }.getOrDefault(emptyList())
        }.distinctBy { it.title }.take(50)
        if (headlines.isEmpty()) return "뉴스를 가져오지 못했습니다. 인터넷 연결을 확인하세요.".also { saveError(ctx, it) }

        return try {
            val items = summarize(key, headlines)
            save(ctx, Brief(items, headlines, System.currentTimeMillis()))
            null
        } catch (e: UnauthorizedException) {
            "API 키가 올바르지 않습니다.".also { saveError(ctx, it) }
        } catch (e: RateLimitException) {
            "요청이 많습니다. 잠시 후 다시 시도하세요.".also { saveError(ctx, it) }
        } catch (e: AnthropicServiceException) {
            "요약 실패 (${e.statusCode()}): ${e.message}".also { saveError(ctx, it) }
        } catch (e: AnthropicIoException) {
            "네트워크 오류로 요약하지 못했습니다.".also { saveError(ctx, it) }
        } catch (e: IllegalStateException) {
            (e.message ?: "요약 실패").also { saveError(ctx, it) }
        }
    }

    private fun summarize(key: String, headlines: List<Headline>): List<String> {
        val client = AnthropicOkHttpClient.builder().apiKey(key).build()
        val today = SimpleDateFormat("yyyy년 M월 d일 (E)", Locale.KOREAN).format(Date())
        val list = headlines.joinToString("\n") { "- [${it.source}] ${it.title}" }

        val params = MessageCreateParams.builder()
            .model(MODEL)
            .maxTokens(16000L)
            .outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
            .addBeta("server-side-fallback-2026-07-01")
            .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            .system(
                "너는 바쁜 직장인을 위한 한국어 뉴스 브리핑 편집자다. " +
                "주어진 헤드라인 목록만 근거로 오늘 꼭 알아야 할 뉴스를 고른다. 목록에 없는 사실은 지어내지 않는다. " +
                "같은 사건을 다룬 헤드라인은 하나로 합친다. 정치·경제·사회·국제·IT 등 분야가 고루 섞이게 한다."
            )
            .addUserMessage(
                "오늘은 $today 이다. 아래 헤드라인에서 가장 중요한 뉴스 7개를 중요도 순으로 골라 요약해라.\n" +
                "형식: 한 줄에 하나씩, 반드시 '• [분야] 핵심 내용 한 문장' 형태. 인사말이나 다른 문장은 쓰지 마라.\n\n$list"
            )
            .build()

        val res = client.beta().messages().create(params)
        if (res.stopReason().map { it.toString() }.orElse("") == "refusal") {
            throw IllegalStateException("요약 요청이 거절되었습니다. 잠시 후 다시 시도하세요.")
        }
        val text = res.content().flatMap { b -> b.text().map { listOf(it.text()) }.orElse(emptyList()) }
            .joinToString("\n")
        val items = text.lines().map { it.trim() }.filter { it.startsWith("•") }
            .map { it.removePrefix("•").trim() }
        if (items.isEmpty()) throw IllegalStateException("요약 결과가 비어 있습니다.")
        return items
    }

    private fun fetchRss(url: String, source: String): List<Headline> {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000; readTimeout = 15000
            setRequestProperty("User-Agent", "Mozilla/5.0 (Android) NewsBrief/1.0")
        }
        conn.inputStream.use { input ->
            val p = Xml.newPullParser()
            p.setInput(input, null)
            val out = mutableListOf<Headline>()
            var inItem = false; var tag = ""; var title = ""; var link = ""
            while (p.next() != XmlPullParser.END_DOCUMENT) {
                when (p.eventType) {
                    XmlPullParser.START_TAG -> {
                        tag = p.name
                        if (tag == "item") { inItem = true; title = ""; link = "" }
                    }
                    XmlPullParser.TEXT -> if (inItem) when (tag) {
                        "title" -> title += p.text
                        "link" -> link += p.text
                    }
                    XmlPullParser.END_TAG -> {
                        if (p.name == "item") {
                            inItem = false
                            val t = title.trim()
                            if (t.isNotEmpty()) out += Headline(t, link.trim(), source)
                            if (out.size >= 15) break
                        }
                        tag = ""
                    }
                }
            }
            return out
        }
    }
}
