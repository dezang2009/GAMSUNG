package com.gamsung.news

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class NewsWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { mgr.updateAppWidget(it, build(ctx, null)) }
    }

    override fun onEnabled(ctx: Context) {
        NewsWorker.schedule(ctx)
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        if (intent.action == ACTION_REFRESH) NewsWorker.runNow(ctx)
    }

    companion object {
        const val ACTION_REFRESH = "com.gamsung.news.REFRESH"

        fun updateAll(ctx: Context) = push(ctx, null)
        fun showLoading(ctx: Context) = push(ctx, "요약하는 중…")

        private fun push(ctx: Context, status: String?) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, NewsWidget::class.java))
            ids.forEach { mgr.updateAppWidget(it, build(ctx, status)) }
        }

        private fun build(ctx: Context, status: String?): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_news)
            val brief = NewsRepository.load(ctx)
            val title = if (brief != null)
                "오늘의 뉴스 · " + SimpleDateFormat("M/d HH:mm", Locale.KOREAN).format(Date(brief.updatedAt))
            else "오늘의 뉴스"
            v.setTextViewText(R.id.widget_title, status?.let { "$title · $it" } ?: title)
            val body = when {
                brief != null -> brief.items.joinToString("\n") { "• $it" }
                else -> NewsRepository.lastError(ctx) ?: "앱을 열어 API 키를 입력하세요."
            }
            v.setTextViewText(R.id.widget_body, body)

            val open = PendingIntent.getActivity(
                ctx, 0, Intent(ctx, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            v.setOnClickPendingIntent(R.id.widget_root, open)
            val refresh = PendingIntent.getBroadcast(
                ctx, 1, Intent(ctx, NewsWidget::class.java).setAction(ACTION_REFRESH),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            v.setOnClickPendingIntent(R.id.widget_refresh, refresh)
            return v
        }
    }
}
