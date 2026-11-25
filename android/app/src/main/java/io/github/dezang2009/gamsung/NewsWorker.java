package io.github.dezang2009.gamsung;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * 매일 아침 오늘의 요약이 올라왔는지 확인하고 알림을 띄운다.
 * 아직 안 올라왔으면 30분 뒤 다시 확인 (최대 오전 11시까지).
 */
public class NewsWorker extends Worker {
    static final String DATA_BASE = "https://raw.githubusercontent.com/dezang2009/GAMSUNG/main/data/";
    static final String WORK = "daily-news";
    static final String CHANNEL = "daily";
    static final TimeZone KST = TimeZone.getTimeZone("Asia/Seoul");
    static final int NOTIFY_HOUR = 7, NOTIFY_MIN = 10, GIVE_UP_HOUR = 11;

    public NewsWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        SharedPreferences prefs = c.getSharedPreferences("news", Context.MODE_PRIVATE);
        String today = today();
        boolean done = today.equals(prefs.getString("notified", ""));
        if (!done) {
            try {
                JSONObject doc = new JSONObject(get(DATA_BASE + today + ".json?t=" + System.currentTimeMillis()));
                StringBuilder body = new StringBuilder();
                JSONArray topics = doc.getJSONArray("topics");
                for (int i = 0; i < topics.length(); i++) {
                    JSONObject t = topics.getJSONObject(i);
                    JSONArray issues = t.optJSONArray("issues");
                    if (issues == null || issues.length() == 0) continue;
                    if (body.length() > 0) body.append('\n');
                    body.append(t.getString("name")).append(": ").append(issues.getJSONObject(0).getString("title"));
                }
                if (body.length() > 0) {
                    notify(c, "오늘의 뉴스 · " + today.substring(5).replace('-', '/'), body.toString());
                    prefs.edit().putString("notified", today).apply();
                    done = true;
                }
            } catch (Exception ignored) {
                // 아직 오늘 파일이 없거나 네트워크 오류 → 잠시 뒤 재시도
            }
        }
        Calendar now = Calendar.getInstance(KST);
        if (!done && now.get(Calendar.HOUR_OF_DAY) < GIVE_UP_HOUR) schedule(c, TimeUnit.MINUTES.toMillis(30));
        else scheduleNext(c);
        return Result.success();
    }

    /** 다음 오전 7:10(KST) 확인 예약 */
    static void scheduleNext(Context c) {
        Calendar now = Calendar.getInstance(KST);
        Calendar next = (Calendar) now.clone();
        next.set(Calendar.HOUR_OF_DAY, NOTIFY_HOUR);
        next.set(Calendar.MINUTE, NOTIFY_MIN);
        next.set(Calendar.SECOND, 0);
        if (!next.after(now)) next.add(Calendar.DAY_OF_MONTH, 1);
        schedule(c, next.getTimeInMillis() - now.getTimeInMillis());
    }

    static void schedule(Context c, long delayMs) {
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(NewsWorker.class)
                .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        WorkManager.getInstance(c).enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, req);
    }

    static void notify(Context c, String title, String body) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "매일 뉴스 요약", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_news)
                .setContentTitle(title)
                .setContentText(body.split("\n")[0])
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(c).notify(1, b.build());
        } catch (SecurityException ignored) {
            // 알림 권한 없음
        }
    }

    static String today() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(KST);
        return f.format(Calendar.getInstance(KST).getTime());
    }

    static String get(String url) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(15000);
        try (InputStream in = con.getInputStream()) {
            if (con.getResponseCode() != 200) throw new Exception("HTTP " + con.getResponseCode());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } finally {
            con.disconnect();
        }
    }
}
