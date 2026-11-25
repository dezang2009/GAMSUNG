package com.gamsung.news

import android.content.Context
import androidx.work.*
import java.util.Calendar
import java.util.concurrent.TimeUnit

class NewsWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        NewsWidget.showLoading(applicationContext)
        val err = NewsRepository.refresh(applicationContext)
        NewsWidget.updateAll(applicationContext)
        return if (err == null || runAttemptCount >= 2) Result.success() else Result.retry()
    }

    companion object {
        private val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun runNow(ctx: Context) {
            val req = OneTimeWorkRequestBuilder<NewsWorker>().setConstraints(net).build()
            WorkManager.getInstance(ctx).enqueueUniqueWork("news_now", ExistingWorkPolicy.REPLACE, req)
        }

        fun schedule(ctx: Context) {
            val hour = NewsRepository.hour(ctx)
            val now = Calendar.getInstance()
            val next = (now.clone() as Calendar).apply {
                set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
                if (!after(now)) add(Calendar.DAY_OF_MONTH, 1)
            }
            val req = PeriodicWorkRequestBuilder<NewsWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(next.timeInMillis - now.timeInMillis, TimeUnit.MILLISECONDS)
                .setConstraints(net)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork("news_daily", ExistingPeriodicWorkPolicy.UPDATE, req)
        }
    }
}
