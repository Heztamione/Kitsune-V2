package ai.kitsune.chat.screencapture;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Lightweight foreground service that keeps the MediaProjection session alive
 * while native WebRTC (ScreenCapturerAndroid) handles the actual capture.
 * Required on Android 14+ to prevent the system from killing the projection.
 */
public class ScreenShareForegroundService extends Service {
    public static final String ACTION_START = "ai.kitsune.chat.START_SCREEN_SHARE_FG";
    public static final String ACTION_STOP = "ai.kitsune.chat.STOP_SCREEN_SHARE_FG";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_DATA = "data";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground();
        return START_STICKY;
    }

    private void startForeground() {
        String channelId = "kitsune_screen_share";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Kitsune screen sharing", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(channel);
        }
        Notification notification = new Notification.Builder(this, channelId)
                .setContentTitle("Kitsune screen sharing")
                .setContentText("Your screen is being shared in a call")
                .setSmallIcon(android.R.drawable.ic_menu_gallery)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(1, notification);
        }
    }

    @Override
    public void onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
