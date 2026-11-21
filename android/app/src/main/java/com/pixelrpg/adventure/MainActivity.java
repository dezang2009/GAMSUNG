package com.pixelrpg.adventure;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * 게임(HTML/JS)을 앱 안의 WebView 로 실행하는 껍데기.
 * 게임 파일은 assets/www/index.html (dist/play.html 과 같은 단일 파일)이다.
 * 저장 데이터는 WebView 의 localStorage 에 들어가며, 앱을 지우기 전에는 유지된다.
 */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFFF2F0EA);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage (세이브 파일)
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    // 상태바/내비게이션 바를 숨기고 전체 화면으로 쓴다
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    // 뒤로 가기 키: 게임의 '뒤로/나가기' 버튼이 있으면 그것을 누르고, 없으면 앱을 종료한다
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){var b=document.getElementById('back-btn');"
                + "if(b&&!b.hidden&&b.offsetParent!==null){b.click();return true;}return false;})()",
            value -> {
                if (!"true".equals(value)) finish();
            });
    }
}
