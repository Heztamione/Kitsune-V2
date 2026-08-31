package ai.kitsune.chat;

import android.app.Activity;
import android.content.Context;
import android.media.projection.MediaProjectionManager;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStreamTrack;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.ScreenCapturerAndroid;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class NativeWebRTC {
    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final SignalingCallback callback;

    private PeerConnectionFactory factory;
    private EglBase eglBase;
    private SurfaceTextureHelper surfaceHelper;
    private ScreenCapturerAndroid screenCapturer;
    private VideoSource videoSource;
    private VideoTrack screenTrack;

    private final Map<String, PeerConnection> peerConnections = new HashMap<>();
    private List<PeerConnection.IceServer> iceServers = new ArrayList<>();
    private boolean running = false;

    public interface SignalingCallback {
        void onStarted();
        void onError(String message);
        void onStopped();
        void onOffer(String peerId, String sdp);
        void onAnswer(String peerId, String sdp);
        void onIceCandidate(String peerId, String sdp, String sdpMid, int sdpMLineIndex, String serverUrl);
    }

    public NativeWebRTC(Context context, SignalingCallback callback) {
        this.context = context;
        this.callback = callback;
    }

    public synchronized void init() {
        if (factory != null) return;
        eglBase = EglBase.create();
        PeerConnectionFactory.InitializationOptions initOptions =
                PeerConnectionFactory.InitializationOptions.builder(context)
                        .createInitializationOptions();
        PeerConnectionFactory.initialize(initOptions);

        PeerConnectionFactory.Options options = new PeerConnectionFactory.Options();

        factory = PeerConnectionFactory.builder()
                .setOptions(options)
                .setVideoEncoderFactory(new DefaultVideoEncoderFactory(eglBase.getEglBaseContext(), true, true))
                .setVideoDecoderFactory(new DefaultVideoDecoderFactory(eglBase.getEglBaseContext()))
                .createPeerConnectionFactory();
    }

    public void setIceServers(String json) {
        try {
            JSONArray arr = new JSONArray(json);
            List<PeerConnection.IceServer> servers = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String url = obj.optString("url", obj.optString("urls", ""));
                if (url.isEmpty() && obj.has("urls")) {
                    JSONArray urls = obj.getJSONArray("urls");
                    for (int j = 0; j < urls.length(); j++) {
                        PeerConnection.IceServer.Builder b = PeerConnection.IceServer.builder(urls.getString(j));
                        if (obj.has("username")) b.setUsername(obj.getString("username"));
                        if (obj.has("credential")) b.setPassword(obj.getString("credential"));
                        servers.add(b.createIceServer());
                    }
                } else if (!url.isEmpty()) {
                    PeerConnection.IceServer.Builder b = PeerConnection.IceServer.builder(url);
                    if (obj.has("username")) b.setUsername(obj.getString("username"));
                    if (obj.has("credential")) b.setPassword(obj.getString("credential"));
                    servers.add(b.createIceServer());
                }
            }
            iceServers = servers;
        } catch (Exception e) {
            iceServers = new ArrayList<>();
        }
    }

    public synchronized boolean startScreenCapture(int resultCode, android.content.Intent data) {
        if (running) return false;
        try {
            init();

            DisplayMetrics metrics = new DisplayMetrics();
            WindowManager wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
            Display display = wm.getDefaultDisplay();
            display.getRealMetrics(metrics);
            int width = Math.min(1280, metrics.widthPixels);
            int height = Math.min(720, metrics.heightPixels);
            int fps = 30;

            // ScreenCapturerAndroid takes (Intent data, MediaProjection.Callback callback)
            screenCapturer = new ScreenCapturerAndroid(data, new android.media.projection.MediaProjection.Callback() {
                @Override
                public void onStop() {
                    mainHandler.post(() -> {
                        callback.onStopped();
                        stop();
                    });
                }
            });

            surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.getEglBaseContext());
            videoSource = factory.createVideoSource(/*isScreencast=*/true);
            screenCapturer.initialize(surfaceHelper, context, videoSource.getCapturerObserver());
            screenCapturer.startCapture(width, height, fps);

            screenTrack = factory.createVideoTrack("ARDAMSv0", videoSource);
            screenTrack.setEnabled(true);

            running = true;
            mainHandler.post(() -> callback.onStarted());
            return true;
        } catch (Exception e) {
            mainHandler.post(() -> callback.onError("Screen capture init failed: " + e.getMessage()));
            stop();
            return false;
        }
    }

    public synchronized void addPeer(String peerId) {
        if (!running || peerConnections.containsKey(peerId)) return;

        PeerConnection.RTCConfiguration config = new PeerConnection.RTCConfiguration(iceServers);
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        config.iceTransportsType = PeerConnection.IceTransportsType.ALL;

        PeerConnection pc = factory.createPeerConnection(config, pcObserver(peerId));
        if (pc == null) return;

        if (screenTrack != null) pc.addTrack(screenTrack, new ArrayList<>());

        peerConnections.put(peerId, pc);

        // Create offer
        pc.createOffer(new SdpObserverWrapper() {
            @Override
            public void onCreateSuccess(SessionDescription sdp) {
                pc.setLocalDescription(new SdpObserverWrapper() {
                    @Override
                    public void onSetSuccess() {
                        mainHandler.post(() -> callback.onOffer(peerId, sdp.description));
                    }
                }, sdp);
            }
        }, new MediaConstraints());
    }

    public synchronized void removePeer(String peerId) {
        PeerConnection pc = peerConnections.remove(peerId);
        if (pc != null) {
            try { pc.close(); } catch (Exception ignored) {}
        }
    }

    public synchronized void receiveAnswer(String peerId, String sdp) {
        PeerConnection pc = peerConnections.get(peerId);
        if (pc == null) return;
        pc.setRemoteDescription(new SdpObserverWrapper() {
            @Override
            public void onSetSuccess() {}
        }, new SessionDescription(SessionDescription.Type.ANSWER, sdp));
    }

    public synchronized void receiveIceCandidate(String peerId, String sdp, String sdpMid, int sdpMLineIndex, String serverUrl) {
        PeerConnection pc = peerConnections.get(peerId);
        if (pc == null) return;
        IceCandidate candidate = new IceCandidate(sdpMid, sdpMLineIndex, sdp);
        pc.addIceCandidate(candidate);
    }

    private PeerConnection.Observer pcObserver(String peerId) {
        return new PeerConnection.Observer() {
            @Override
            public void onIceCandidate(IceCandidate candidate) {
                mainHandler.post(() -> callback.onIceCandidate(peerId, candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex, candidate.serverUrl));
            }
            @Override public void onSignalingChange(PeerConnection.SignalingState s) {}
            @Override public void onIceConnectionChange(PeerConnection.IceConnectionState s) {}
            @Override public void onIceConnectionReceivingChange(boolean b) {}
            @Override public void onIceGatheringChange(PeerConnection.IceGatheringState s) {}
            @Override public void onIceCandidatesRemoved(IceCandidate[] c) {}
            @Override public void onAddStream(org.webrtc.MediaStream s) {}
            @Override public void onRemoveStream(org.webrtc.MediaStream s) {}
            @Override public void onDataChannel(org.webrtc.DataChannel dc) {}
            @Override public void onRenegotiationNeeded() {}
            @Override public void onAddTrack(org.webrtc.RtpReceiver receiver, org.webrtc.MediaStream[] mediaStreams) {}
        };
    }

    public synchronized void stop() {
        running = false;
        for (PeerConnection pc : peerConnections.values()) {
            try { pc.close(); } catch (Exception ignored) {}
        }
        peerConnections.clear();

        if (screenTrack != null) { try { screenTrack.dispose(); } catch (Exception ignored) {} screenTrack = null; }
        if (screenCapturer != null) { try { screenCapturer.stopCapture(); } catch (Exception ignored) {} screenCapturer = null; }
        if (videoSource != null) { try { videoSource.dispose(); } catch (Exception ignored) {} videoSource = null; }
        if (surfaceHelper != null) { try { surfaceHelper.dispose(); } catch (Exception ignored) {} surfaceHelper = null; }
    }

    public synchronized void dispose() {
        stop();
        if (factory != null) { try { factory.dispose(); } catch (Exception ignored) {} factory = null; }
        if (eglBase != null) { try { eglBase.release(); } catch (Exception ignored) {} eglBase = null; }
    }

    public boolean isRunning() { return running; }

    // Simple SDP observer wrapper
    private static abstract class SdpObserverWrapper implements org.webrtc.SdpObserver {
        @Override public void onCreateFailure(String error) {}
        @Override public void onSetFailure(String error) {}
        @Override public void onSetSuccess() {}
        @Override public void onCreateSuccess(SessionDescription sdp) {}
    }
}
