package ai.kitsune.chat.screencapture;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

@CapacitorPlugin(name = "KitsuneScreenCapture")
public class KitsuneScreenCapturePlugin extends Plugin implements ScreenCaptureService.FrameListener {

    private PluginCall pendingCall;
    private boolean isCapturing = false;
    private int targetWidth = 1280;
    private int targetHeight = 720;
    private int density = 320;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void isSupported(PluginCall call) {
        Context ctx = getContext();
        MediaProjectionManager mpm = (MediaProjectionManager) ctx.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        boolean supported = mpm != null;
        JSObject result = new JSObject();
        result.put("supported", supported);
        call.resolve(result);
    }

    @PluginMethod
    public void startCapture(PluginCall call) {
        Context ctx = getContext();
        MediaProjectionManager mpm = (MediaProjectionManager) ctx.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("MediaProjection is not available on this device");
            return;
        }

        if (isCapturing) {
            call.reject("Screen capture already active");
            return;
        }

        // Compute display dimensions
        WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        Display display = wm.getDefaultDisplay();
        DisplayMetrics metrics = new DisplayMetrics();
        display.getRealMetrics(metrics);
        density = metrics.densityDpi;
        float aspect = (float) metrics.widthPixels / (float) metrics.heightPixels;
        targetWidth = Math.min(1280, metrics.widthPixels);
        targetHeight = Math.round(targetWidth / aspect);
        if (targetHeight > metrics.heightPixels) targetHeight = metrics.heightPixels;

        pendingCall = call;
        ScreenCaptureService.setFrameListener(this);
        Intent intent = mpm.createScreenCaptureIntent();
        startActivityForResult(call, intent, "startCaptureResult");
    }

    private PluginCall recordCall;

    @ActivityCallback
    private void startCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen capture permission denied");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Intent service = new Intent(activity, ScreenCaptureService.class);
        service.setAction(ScreenCaptureService.ACTION_START);
        service.putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.getResultCode());
        service.putExtra(ScreenCaptureService.EXTRA_DATA, result.getData());
        service.putExtra(ScreenCaptureService.EXTRA_WIDTH, targetWidth);
        service.putExtra(ScreenCaptureService.EXTRA_HEIGHT, targetHeight);
        service.putExtra(ScreenCaptureService.EXTRA_DENSITY, density);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            activity.startForegroundService(service);
        } else {
            activity.startService(service);
        }

        isCapturing = true;
        JSObject res = new JSObject();
        res.put("started", true);
        res.put("width", targetWidth);
        res.put("height", targetHeight);
        call.resolve(res);
    }

    @PluginMethod
    public void stopCapture(PluginCall call) {
        isCapturing = false;
        Activity activity = getActivity();
        if (activity != null) {
            Intent service = new Intent(activity, ScreenCaptureService.class);
            service.setAction(ScreenCaptureService.ACTION_STOP);
            activity.startService(service);
        }
        ScreenCaptureService instance = ScreenCaptureService.getInstance();
        if (instance != null) instance.stopCapture();
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @Override
    public void onFrame(String base64, int width, int height) {
        mainHandler.post(() -> {
            JSObject frame = new JSObject();
            frame.put("event", "frame");
            frame.put("data", base64);
            frame.put("width", width);
            frame.put("height", height);
            notifyListeners("screenFrame", frame);
        });
    }

    @Override
    public void onError(String message) {
        isCapturing = false;
        mainHandler.post(() -> {
            JSObject error = new JSObject();
            error.put("event", "error");
            error.put("message", message);
            notifyListeners("screenError", error);
        });
    }

    @Override
    public void onStopped() {
        isCapturing = false;
        mainHandler.post(() -> {
            JSObject stopped = new JSObject();
            stopped.put("event", "stopped");
            notifyListeners("screenStopped", stopped);
        });
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        Context ctx = getContext();
        MediaProjectionManager mpm = (MediaProjectionManager) ctx.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("MediaProjection is not available on this device");
            return;
        }

        if (isCapturing) {
            call.reject("Screen capture already active");
            return;
        }

        recordCall = call;
        ScreenRecordService.setRecordListener(new ScreenRecordService.RecordListener() {
            @Override
            public void onStarted(String path) {
                JSObject res = new JSObject();
                res.put("started", true);
                res.put("path", path);
                call.resolve(res);
            }

            @Override
            public void onFinished(String path) {
                JSObject event = new JSObject();
                event.put("event", "finished");
                event.put("path", path);
                notifyListeners("recordFinished", event);
            }

            @Override
            public void onError(String message) {
                JSObject error = new JSObject();
                error.put("event", "error");
                error.put("message", message);
                notifyListeners("recordError", error);
                if (recordCall != null) { recordCall.reject(message); recordCall = null; }
            }
        });

        Intent intent = mpm.createScreenCaptureIntent();
        startActivityForResult(call, intent, "startRecordingResult");
    }

    @ActivityCallback
    private void startRecordingResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen recording permission denied");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Intent service = new Intent(activity, ScreenRecordService.class);
        service.setAction(ScreenRecordService.ACTION_START);
        service.putExtra(ScreenRecordService.EXTRA_RESULT_CODE, result.getResultCode());
        service.putExtra(ScreenRecordService.EXTRA_DATA, result.getData());

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            activity.startForegroundService(service);
        } else {
            activity.startService(service);
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) {
            Intent service = new Intent(activity, ScreenRecordService.class);
            service.setAction(ScreenRecordService.ACTION_STOP);
            activity.startService(service);
        }
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @Override
    public void handleOnDestroy() {
        stopCapture(null);
    }
}
