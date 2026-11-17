package com.abyss.game;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** web/ 폴더의 게임을 표시하는 WebView 껍데기. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0F14);
        web.setFitsSystemWindows(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // 저장(localStorage)
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient()); // confirm() 대화상자
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.ABYSS && ABYSS.onBack ? ABYSS.onBack() : false", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }
}
