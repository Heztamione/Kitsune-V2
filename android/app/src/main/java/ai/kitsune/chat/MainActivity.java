package ai.kitsune.chat;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import ai.kitsune.chat.screencapture.KitsuneScreenCapturePlugin;
import ai.kitsune.chat.updater.KitsuneUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    private NativeBridge nativeBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KitsuneUpdaterPlugin.class);
        registerPlugin(KitsuneScreenCapturePlugin.class);
        super.onCreate(savedInstanceState);

        // The Capacitor bridge is NOT injected into external URLs (known Capacitor bug #7454).
        // We add a direct JavascriptInterface that works on ALL pages, including the remote
        // server URL the WebView navigates to. This enables screen capture on the actual app page.
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            nativeBridge = new NativeBridge(this, webView);
            webView.addJavascriptInterface(nativeBridge, "kitsuneNative");
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (nativeBridge != null) {
            nativeBridge.onActivityResult(requestCode, resultCode, data);
        }
    }

    public void requestScreenCapture(Intent intent, int requestCode) {
        startActivityForResult(intent, requestCode);
    }

    @Override
    public void onDestroy() {
        if (nativeBridge != null) {
            nativeBridge.onDestroy();
        }
        super.onDestroy();
    }
}
