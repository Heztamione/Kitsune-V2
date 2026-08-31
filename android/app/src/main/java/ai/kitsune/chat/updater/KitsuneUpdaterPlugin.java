package ai.kitsune.chat.updater;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

@CapacitorPlugin(name = "KitsuneUpdater")
public class KitsuneUpdaterPlugin extends Plugin {

    private File downloadFile(PluginCall call, String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(300000);
        conn.connect();
        if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());

        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        File output = new File(dir, "kitsune-update.apk");
        if (output.exists()) output.delete();

        long total = conn.getContentLength();
        long downloaded = 0;
        InputStream input = conn.getInputStream();
        FileOutputStream fos = new FileOutputStream(output);
        byte[] buffer = new byte[8192];
        int len;
        while ((len = input.read(buffer)) != -1) {
            fos.write(buffer, 0, len);
            downloaded += len;
            if (total > 0) {
                int percent = (int) (downloaded * 100 / total);
                JSObject progress = new JSObject();
                progress.put("event", "progress");
                progress.put("percent", percent);
                notifyListeners("updateProgress", progress);
            }
        }
        fos.close();
        input.close();
        conn.disconnect();
        return output;
    }

    private String sha256(File file) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            java.io.FileInputStream fis = new java.io.FileInputStream(file);
            byte[] buffer = new byte[8192];
            int len;
            while ((len = fis.read(buffer)) != -1) md.update(buffer, 0, len);
            fis.close();
            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlStr = call.getString("url");
        String expectedSha = call.getString("sha256");
        if (urlStr == null) { call.reject("url is required"); return; }

        new Thread(() -> {
            try {
                File apk = downloadFile(call, urlStr);

                // Verify SHA-256 if provided
                if (expectedSha != null && !expectedSha.isEmpty()) {
                    String actual = sha256(apk);
                    if (actual == null || !actual.equalsIgnoreCase(expectedSha)) {
                        call.reject("SHA-256 verification failed");
                        return;
                    }
                }

                // Trigger install via FileProvider + ACTION_INSTALL_PACKAGE
                Activity activity = getActivity();
                Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                String mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension("apk");
                intent.setDataAndType(uri, mimeType != null ? mimeType : "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);

                JSObject result = new JSObject();
                result.put("installed", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Update failed: " + e.getMessage());
            }
        }).start();
    }
}
