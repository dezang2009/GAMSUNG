package com.gamsung.adventure;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;

/** Hosts the adventure game page (assets/index.html) in a WebView. */
public class MainActivity extends Activity {
    // The page is served from a fixed https origin so its saved data stays put
    // and the browser treats it as a secure page.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.bg));
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new Client());
        setContentView(web);
        if (savedInstanceState == null) web.loadUrl(START);
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : false", handled -> {
            if (!"true".equals(handled)) moveTaskToBack(true);
        });
    }

    private final class Bridge {
        @JavascriptInterface
        public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("감성모험", text));
        }
    }

    private final class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (!HOST.equals(request.getUrl().getHost())) return null;
            String path = request.getUrl().getPath();
            String name = path == null || path.length() <= 1 ? "index.html" : path.substring(1);
            try {
                String mime = name.endsWith(".html") ? "text/html" : "application/octet-stream";
                return new WebResourceResponse(mime, "utf-8", getAssets().open(name));
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (HOST.equals(request.getUrl().getHost())) return false;
            // Links such as the API key page open in the phone's browser.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
            } catch (Exception ignored) {
            }
            return true;
        }
    }
}
