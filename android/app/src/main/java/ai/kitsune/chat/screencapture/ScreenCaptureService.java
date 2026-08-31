package ai.kitsune.chat.screencapture;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class ScreenCaptureService extends Service {
    public static final String ACTION_START = "ai.kitsune.chat.START_SCREEN_CAPTURE";
    public static final String ACTION_STOP = "ai.kitsune.chat.STOP_SCREEN_CAPTURE";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_DATA = "data";
    public static final String EXTRA_WIDTH = "width";
    public static final String EXTRA_HEIGHT = "height";
    public static final String EXTRA_DENSITY = "density";

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread captureThread;
    private Handler handler;
    private int width = 1280;
    private int height = 720;
    private int density = 320;
    private final Object lock = new Object();
    private boolean running = false;

    private static ScreenCaptureService instance;
    private static FrameListener frameListener;

    public interface FrameListener {
        void onFrame(String base64, int width, int height);
        void onError(String message);
        void onStopped();
    }

    public static ScreenCaptureService getInstance() { return instance; }
    public static void setFrameListener(FrameListener listener) { frameListener = listener; }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        captureThread = new HandlerThread("KitsuneScreenCapture");
        captureThread.start();
        handler = new Handler(captureThread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1);
        Intent data = intent.getParcelableExtra(EXTRA_DATA);
        width = intent.getIntExtra(EXTRA_WIDTH, 1280);
        height = intent.getIntExtra(EXTRA_HEIGHT, 720);
        density = intent.getIntExtra(EXTRA_DENSITY, 320);

        if (resultCode == -1 || data == null) {
            if (frameListener != null) frameListener.onError("Screen capture permission missing");
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground();

        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        mediaProjection = mpm.getMediaProjection(resultCode, data);
        if (mediaProjection == null) {
            if (frameListener != null) frameListener.onError("Could not start MediaProjection");
            stopSelf();
            return START_NOT_STICKY;
        }

        mediaProjection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                super.onStop();
                stopCapture();
            }
        }, handler);

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3);
        imageReader.setOnImageAvailableListener(reader -> {
            Image image = null;
            Bitmap bitmap = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) return;
                bitmap = convertImageToBitmap(image);
                if (bitmap == null) return;

                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 50, out);
                byte[] jpeg = out.toByteArray();
                String base64 = Base64.encodeToString(jpeg, Base64.NO_WRAP);

                if (frameListener != null) {
                    frameListener.onFrame(base64, width, height);
                }
            } catch (Exception e) {
                if (frameListener != null) frameListener.onError(e.getMessage());
            } finally {
                if (bitmap != null) bitmap.recycle();
                if (image != null) image.close();
            }
        }, handler);

        virtualDisplay = mediaProjection.createVirtualDisplay("KitsuneScreen",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(), null, handler);

        running = true;
        return START_STICKY;
    }

    private Bitmap convertImageToBitmap(Image image) {
        if (image == null) return null;
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer buffer = planes[0].getBuffer();

        int w = image.getWidth();
        int h = image.getHeight();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * w;

        Bitmap bitmap = Bitmap.createBitmap(w + rowPadding / pixelStride, h, Bitmap.Config.ARGB_8888);
        bitmap.copyPixelsFromBuffer(buffer);
        // Crop to requested size
        return Bitmap.createBitmap(bitmap, 0, 0, w, h);
    }

    private void startForeground() {
        String channelId = "kitsune_screen_capture";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Kitsune screen capture", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(channel);
        }
        Notification notification = new Notification.Builder(this, channelId)
                .setContentTitle("Kitsune screen sharing")
                .setContentText("Screen is being shared in a call")
                .setSmallIcon(android.R.drawable.ic_menu_gallery)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(1, notification);
        }
    }

    public void stopCapture() {
        synchronized (lock) {
            running = false;
            if (virtualDisplay != null) { virtualDisplay.release(); virtualDisplay = null; }
            if (imageReader != null) { imageReader.close(); imageReader = null; }
            if (mediaProjection != null) { mediaProjection.stop(); mediaProjection = null; }
        }
        if (frameListener != null) frameListener.onStopped();
        if (captureThread != null) {
            try { captureThread.quitSafely(); } catch (Exception ignored) {}
            captureThread = null;
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopCapture();
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    public boolean isRunning() { return running; }
}
