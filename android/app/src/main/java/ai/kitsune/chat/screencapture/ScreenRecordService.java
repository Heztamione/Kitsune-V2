package ai.kitsune.chat.screencapture;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Environment;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.Surface;
import android.view.WindowManager;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ScreenRecordService extends Service {
    public static final String ACTION_START = "ai.kitsune.chat.START_SCREEN_RECORD";
    public static final String ACTION_STOP = "ai.kitsune.chat.STOP_SCREEN_RECORD";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_DATA = "data";

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private MediaRecorder mediaRecorder;
    private File outputFile;
    private boolean isRecording = false;

    private static RecordListener recordListener;

    public interface RecordListener {
        void onStarted(String path);
        void onFinished(String path);
        void onError(String message);
    }

    public static void setRecordListener(RecordListener listener) { recordListener = listener; }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            stopRecord();
            return START_NOT_STICKY;
        }

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1);
        Intent data = intent.getParcelableExtra(EXTRA_DATA);
        if (resultCode == -1 || data == null) {
            if (recordListener != null) recordListener.onError("Screen record permission missing");
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground();

        Context ctx = getApplicationContext();
        MediaProjectionManager mpm = (MediaProjectionManager) ctx.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        mediaProjection = mpm.getMediaProjection(resultCode, data);
        if (mediaProjection == null) {
            if (recordListener != null) recordListener.onError("Could not start MediaProjection");
            stopSelf();
            return START_NOT_STICKY;
        }

        mediaProjection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() { stopRecord(); }
        }, null);

        WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        Display display = wm.getDefaultDisplay();
        DisplayMetrics metrics = new DisplayMetrics();
        display.getRealMetrics(metrics);

        int width = Math.min(1280, metrics.widthPixels);
        float aspect = (float) metrics.widthPixels / (float) metrics.heightPixels;
        int height = Math.round(width / aspect);
        int density = metrics.densityDpi;

        String fileName = "kitsune_record_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".mp4";
        File moviesDir = ctx.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        if (moviesDir == null) moviesDir = ctx.getCacheDir();
        outputFile = new File(moviesDir, fileName);

        mediaRecorder = new MediaRecorder();
        mediaRecorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        mediaRecorder.setOutputFile(outputFile.getAbsolutePath());
        mediaRecorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        mediaRecorder.setVideoSize(width, height);
        mediaRecorder.setVideoFrameRate(30);
        mediaRecorder.setVideoEncodingBitRate(2500000);

        try {
            mediaRecorder.prepare();
        } catch (IOException e) {
            if (recordListener != null) recordListener.onError("MediaRecorder prepare failed: " + e.getMessage());
            stopRecord();
            return START_NOT_STICKY;
        }

        Surface surface = mediaRecorder.getSurface();
        virtualDisplay = mediaProjection.createVirtualDisplay("KitsuneRecord",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                surface, null, null);

        try {
            mediaRecorder.start();
            isRecording = true;
            if (recordListener != null) recordListener.onStarted(outputFile.getAbsolutePath());
        } catch (Exception e) {
            if (recordListener != null) recordListener.onError("MediaRecorder start failed: " + e.getMessage());
            stopRecord();
        }

        return START_STICKY;
    }

    private void startForeground() {
        String channelId = "kitsune_screen_record";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Kitsune screen recording", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(channel);
        }
        Notification notification = new Notification.Builder(this, channelId)
                .setContentTitle("Kitsune screen recording")
                .setContentText("Recording in progress")
                .setSmallIcon(android.R.drawable.ic_menu_gallery)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(2, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(2, notification);
        }
    }

    private void stopRecord() {
        if (!isRecording) {
            stopSelf();
            return;
        }
        isRecording = false;

        try {
            if (mediaRecorder != null) {
                mediaRecorder.stop();
                mediaRecorder.release();
            }
        } catch (Exception ignored) {}

        if (virtualDisplay != null) { virtualDisplay.release(); virtualDisplay = null; }
        if (mediaProjection != null) { mediaProjection.stop(); mediaProjection = null; }

        if (recordListener != null && outputFile != null) {
            recordListener.onFinished(outputFile.getAbsolutePath());
        }
        stopSelf();
    }

    @Override
    public void onDestroy() { stopRecord(); }
}
