package ai.kitsune.chat;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import ai.kitsune.chat.screencapture.ScreenCaptureService;
import ai.kitsune.chat.screencapture.ScreenRecordService;
import ai.kitsune.chat.screencapture.ScreenShareForegroundService;

public class NativeBridge implements ScreenCaptureService.FrameListener, NativeWebRTC.SignalingCallback {
    private final MainActivity activity;
    private final WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final SharedPreferences prefs;

    private static final int REQUEST_CAPTURE = 9001;
    private static final int REQUEST_RECORD = 9002;
    private static final int REQUEST_NATIVE_SCREEN = 9003;

    private boolean captureActive = false;
    private boolean recordActive = false;
    private int captureWidth = 1280;
    private int captureHeight = 720;
    private int captureDensity = 320;

    // Native WebRTC screen share
    private NativeWebRTC nativeWebRTC;
    private String pendingIceServersJson;
    private String pendingPeerIdsJson;

    public NativeBridge(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.prefs = activity.getSharedPreferences("kitsune_native", Context.MODE_PRIVATE);
    }

    // ---- Detection ----

    @JavascriptInterface
    public boolean isNativeApp() { return true; }

    @JavascriptInterface
    public boolean isScreenCaptureSupported() {
        try {
            MediaProjectionManager mpm = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            return mpm != null;
        } catch (Exception e) { return false; }
    }

    @JavascriptInterface
    public boolean isNativeWebRTCScreenSupported() {
        return true;
    }

    // ---- Legacy Screen Capture (canvas frames, kept as fallback) ----

    @JavascriptInterface
    public String startScreenCapture() {
        if (captureActive) return error("Screen capture already active");
        try {
            MediaProjectionManager mpm = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (mpm == null) return error("MediaProjection not available");

            WindowManager wm = (WindowManager) activity.getSystemService(Context.WINDOW_SERVICE);
            Display display = wm.getDefaultDisplay();
            DisplayMetrics metrics = new DisplayMetrics();
            display.getRealMetrics(metrics);
            captureDensity = metrics.densityDpi;
            float aspect = (float) metrics.widthPixels / (float) metrics.heightPixels;
            captureWidth = Math.min(1280, metrics.widthPixels);
            captureHeight = Math.round(captureWidth / aspect);
            if (captureHeight > metrics.heightPixels) captureHeight = metrics.heightPixels;

            ScreenCaptureService.setFrameListener(this);
            activity.requestScreenCapture(mpm.createScreenCaptureIntent(), REQUEST_CAPTURE);
            return ok();
        } catch (Exception e) { return error(e.getMessage()); }
    }

    @JavascriptInterface
    public String stopScreenCapture() {
        captureActive = false;
        try {
            ScreenCaptureService instance = ScreenCaptureService.getInstance();
            if (instance != null) instance.stopCapture();
        } catch (Exception ignored) {}
        return ok();
    }

    // ---- Native WebRTC Screen Share (full FPS, no canvas) ----

    @JavascriptInterface
    public String startNativeScreenShare(String iceServersJson, String peerIdsJson) {
        if (nativeWebRTC != null && nativeWebRTC.isRunning()) return error("Native screen share already active");
        try {
            pendingIceServersJson = iceServersJson;
            pendingPeerIdsJson = peerIdsJson;
            MediaProjectionManager mpm = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (mpm == null) return error("MediaProjection not available");
            activity.requestScreenCapture(mpm.createScreenCaptureIntent(), REQUEST_NATIVE_SCREEN);
            return ok();
        } catch (Exception e) { return error(e.getMessage()); }
    }

    @JavascriptInterface
    public String stopNativeScreenShare() {
        if (nativeWebRTC != null) {
            nativeWebRTC.stop();
            evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenStopped && window.kitsuneNative._onNativeScreenStopped()");
        }
        // Stop the foreground service
        try {
            Intent fgService = new Intent(activity, ScreenShareForegroundService.class);
            fgService.setAction(ScreenShareForegroundService.ACTION_STOP);
            activity.startService(fgService);
        } catch (Exception ignored) {}
        return ok();
    }

    @JavascriptInterface
    public String nativeScreenAddPeer(String peerId) {
        if (nativeWebRTC != null && nativeWebRTC.isRunning()) nativeWebRTC.addPeer(peerId);
        return ok();
    }

    @JavascriptInterface
    public String nativeScreenRemovePeer(String peerId) {
        if (nativeWebRTC != null) nativeWebRTC.removePeer(peerId);
        return ok();
    }

    @JavascriptInterface
    public String nativeScreenReceiveAnswer(String peerId, String sdp) {
        if (nativeWebRTC != null) nativeWebRTC.receiveAnswer(peerId, sdp);
        return ok();
    }

    @JavascriptInterface
    public String nativeScreenReceiveIce(String peerId, String sdp, String sdpMid, int sdpMLineIndex, String serverUrl) {
        if (nativeWebRTC != null) nativeWebRTC.receiveIceCandidate(peerId, sdp, sdpMid, sdpMLineIndex, serverUrl);
        return ok();
    }

    // ---- NativeWebRTC.SignalingCallback ----

    @Override
    public void onStarted() {
        evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenStarted && window.kitsuneNative._onNativeScreenStarted()");
        // Add peers that were pending
        try {
            org.json.JSONArray arr = new org.json.JSONArray(pendingPeerIdsJson);
            for (int i = 0; i < arr.length(); i++) {
                nativeWebRTC.addPeer(arr.getString(i));
            }
        } catch (Exception ignored) {}
    }

    // Merged onError — handles both legacy canvas capture and native WebRTC errors
    @Override
    public void onError(String message) {
        captureActive = false;
        mainHandler.post(() -> {
            evalJS("window.kitsuneNative && window.kitsuneNative._onCaptureError && window.kitsuneNative._onCaptureError(" + jsString(message) + ")");
            evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenError && window.kitsuneNative._onNativeScreenError(" + jsString(message) + ")");
        });
    }

    // Merged onStopped — handles both legacy canvas capture and native WebRTC stop
    @Override
    public void onStopped() {
        captureActive = false;
        mainHandler.post(() -> {
            evalJS("window.kitsuneNative && window.kitsuneNative._onCaptureStopped && window.kitsuneNative._onCaptureStopped()");
            evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenStopped && window.kitsuneNative._onNativeScreenStopped()");
        });
    }

    @Override
    public void onOffer(String peerId, String sdp) {
        evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenOffer && window.kitsuneNative._onNativeScreenOffer(" + jsString(peerId) + "," + jsString(sdp) + ")");
    }

    @Override
    public void onAnswer(String peerId, String sdp) {
        // Not used — native is the initiator
    }

    @Override
    public void onIceCandidate(String peerId, String sdp, String sdpMid, int sdpMLineIndex, String serverUrl) {
        String urlArg = serverUrl != null ? jsString(serverUrl) : "null";
        evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenIce && window.kitsuneNative._onNativeScreenIce(" + jsString(peerId) + "," + jsString(sdp) + "," + jsString(sdpMid) + "," + sdpMLineIndex + "," + urlArg + ")");
    }

    // ---- Screen Recording (MP4 file) ----

    @JavascriptInterface
    public String startScreenRecording() {
        if (recordActive) return error("Screen recording already active");
        try {
            MediaProjectionManager mpm = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (mpm == null) return error("MediaProjection not available");

            ScreenRecordService.setRecordListener(new ScreenRecordService.RecordListener() {
                @Override
                public void onStarted(String path) {
                    evalJS("window.kitsuneNative && window.kitsuneNative._onRecordStarted && window.kitsuneNative._onRecordStarted(" + jsString(path) + ")");
                }
                @Override
                public void onFinished(String path) {
                    recordActive = false;
                    evalJS("window.kitsuneNative && window.kitsuneNative._onRecordFinished && window.kitsuneNative._onRecordFinished(" + jsString(path) + ")");
                }
                @Override
                public void onError(String message) {
                    recordActive = false;
                    evalJS("window.kitsuneNative && window.kitsuneNative._onRecordError && window.kitsuneNative._onRecordError(" + jsString(message) + ")");
                }
            });

            activity.requestScreenCapture(mpm.createScreenCaptureIntent(), REQUEST_RECORD);
            return ok();
        } catch (Exception e) { return error(e.getMessage()); }
    }

    @JavascriptInterface
    public String stopScreenRecording() {
        recordActive = false;
        try {
            Intent service = new Intent(activity, ScreenRecordService.class);
            service.setAction(ScreenRecordService.ACTION_STOP);
            activity.startService(service);
        } catch (Exception ignored) {}
        return ok();
    }

    // ---- Callback from MainActivity.onActivityResult ----

    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (resultCode != Activity.RESULT_OK || data == null) {
            if (requestCode == REQUEST_CAPTURE) {
                evalJS("window.kitsuneNative && window.kitsuneNative._onCaptureError && window.kitsuneNative._onCaptureError('Screen capture permission denied')");
            } else if (requestCode == REQUEST_RECORD) {
                evalJS("window.kitsuneNative && window.kitsuneNative._onRecordError && window.kitsuneNative._onRecordError('Screen recording permission denied')");
            } else if (requestCode == REQUEST_NATIVE_SCREEN) {
                evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenError && window.kitsuneNative._onNativeScreenError('Screen share permission denied')");
            }
            return;
        }

        if (requestCode == REQUEST_CAPTURE) {
            Intent service = new Intent(activity, ScreenCaptureService.class);
            service.setAction(ScreenCaptureService.ACTION_START);
            service.putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode);
            service.putExtra(ScreenCaptureService.EXTRA_DATA, data);
            service.putExtra(ScreenCaptureService.EXTRA_WIDTH, captureWidth);
            service.putExtra(ScreenCaptureService.EXTRA_HEIGHT, captureHeight);
            service.putExtra(ScreenCaptureService.EXTRA_DENSITY, captureDensity);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                activity.startForegroundService(service);
            } else {
                activity.startService(service);
            }
            captureActive = true;
            evalJS("window.kitsuneNative && window.kitsuneNative._onCaptureStarted && window.kitsuneNative._onCaptureStarted(" + captureWidth + "," + captureHeight + ")");
        } else if (requestCode == REQUEST_RECORD) {
            Intent service = new Intent(activity, ScreenRecordService.class);
            service.setAction(ScreenRecordService.ACTION_START);
            service.putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode);
            service.putExtra(ScreenRecordService.EXTRA_DATA, data);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                activity.startForegroundService(service);
            } else {
                activity.startService(service);
            }
            recordActive = true;
        } else if (requestCode == REQUEST_NATIVE_SCREEN) {
            // Start a lightweight foreground service to keep MediaProjection alive (required on Android 14+)
            // This service only shows a notification — the actual capture is done by native WebRTC's ScreenCapturerAndroid
            Intent fgService = new Intent(activity, ScreenShareForegroundService.class);
            fgService.setAction(ScreenShareForegroundService.ACTION_START);
            fgService.putExtra(ScreenShareForegroundService.EXTRA_RESULT_CODE, resultCode);
            fgService.putExtra(ScreenShareForegroundService.EXTRA_DATA, data);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                activity.startForegroundService(fgService);
            } else {
                activity.startService(fgService);
            }

            // Start native WebRTC screen share
            if (nativeWebRTC == null) {
                nativeWebRTC = new NativeWebRTC(activity, this);
            }
            nativeWebRTC.setIceServers(pendingIceServersJson != null ? pendingIceServersJson : "[]");
            boolean started = nativeWebRTC.startScreenCapture(resultCode, data);
            if (!started) {
                evalJS("window.kitsuneNative && window.kitsuneNative._onNativeScreenError && window.kitsuneNative._onNativeScreenError('Failed to start native screen capture')");
            }
        }
    }

    // ---- ScreenCaptureService.FrameListener (legacy canvas approach) ----

    @Override
    public void onFrame(String base64, int width, int height) {
        mainHandler.post(() -> {
            evalJS("window.kitsuneNative && window.kitsuneNative._onFrame && window.kitsuneNative._onFrame(" + jsString(base64) + "," + width + "," + height + ")");
        });
    }

    // onError and onStopped are implemented above (merged with NativeWebRTC.SignalingCallback)

    // ---- Lifecycle ----

    public void onDestroy() {
        if (nativeWebRTC != null) {
            nativeWebRTC.dispose();
            nativeWebRTC = null;
        }
    }

    // ---- Helpers ----

    private void evalJS(String js) {
        try { webView.post(() -> webView.evaluateJavascript(js, null)); } catch (Exception ignored) {}
    }

    private String jsString(String s) {
        if (s == null) return "null";
        return JSONObject.quote(s);
    }

    private String ok() { return "{\"ok\":true}"; }
    private String error(String msg) { return "{\"ok\":false,\"error\":\"" + (msg == null ? "" : msg.replace("\"", "\\\"")) + "\"}"; }
}
