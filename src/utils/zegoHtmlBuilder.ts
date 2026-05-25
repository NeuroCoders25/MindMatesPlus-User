/**
 * Builds a self-contained HTML string with a three-phase flow:
 *
 *   Phase 1 — SDK loading   : spinner while CDN script downloads
 *   Phase 2 — Pre-join      : camera preview + mic/camera toggles + Join button
 *   Phase 3 — Live call     : ZEGOCLOUD GroupCall UI
 *
 * Why a custom pre-join screen instead of ZEGOCLOUD's built-in one?
 *   • ZEGOCLOUD's lobby calls getUserMedia from a script context, which Android
 *     WebView treats with lower trust — it silently returns muted/black tracks.
 *   • Our "Join" button IS the user gesture. getUserMedia called inside a click
 *     handler is granted immediately and returns a live stream every time.
 *   • The pre-join stream "warms up" the camera permission in the WebView's
 *     permission cache, so ZEGOCLOUD's internal getUserMedia call (inside
 *     joinRoom) succeeds without needing another WebChromeClient grant.
 *
 * Messages posted back to React Native:
 *   { type: 'preJoinReady' }  — pre-join screen is showing (hide RN overlay)
 *   { type: 'callJoined'  }  — user tapped Join (call is live)
 *   { type: 'callEnded'   }  — user left the room
 *   { type: 'mediaError', name, message } — getUserMedia rejection
 *   { type: 'error',      message }       — SDK / fatal error
 *
 * Usage:
 *   <WebView source={{ html: buildZegoCallHtml(params), baseUrl: 'https://zegocloud.com' }} />
 */
export function buildZegoCallHtml(params: {
  appID: number;
  serverSecret: string;
  roomID: string;
  userID: string;
  userName: string;
  callTitle: string;
}): string {
  const { appID, serverSecret, roomID, userID, userName, callTitle } = params;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const CDN_PRIMARY =
    'https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-uikit-prebuilt.js';
  const CDN_FALLBACK =
    'https://cdn.jsdelivr.net/npm/@zegocloud/zego-uikit-prebuilt/zego-uikit-prebuilt.js';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${callTitle}</title>
  <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      width:100%; height:100%;
      background:#0d0d1a;
      font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow:hidden; color:#fff;
    }

    /* ── Shared util ─────────────────────────────────── */
    .fill {
      position:absolute; top:0; left:0; width:100%; height:100%;
    }
    .center {
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
    }

    /* ── Phase 1: loading ────────────────────────────── */
    #loading { background:#0d0d1a; gap:14px; }
    .spinner {
      width:40px; height:40px;
      border:3px solid rgba(255,255,255,0.15);
      border-top-color:#6C63FF;
      border-radius:50%;
      animation:spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }
    #loading p { font-size:14px; opacity:0.6; }

    /* ── Phase 2: pre-join ───────────────────────────── */
    #prejoin {
      display:none;
      flex-direction:column;
      align-items:center;
      background:#0d0d1a;
      padding:0 0 28px 0;
    }

    .pj-header {
      width:100%; padding:14px 16px 10px;
      display:flex; align-items:center; justify-content:space-between;
      border-bottom:0.5px solid rgba(255,255,255,0.08);
    }
    .pj-live { display:flex; align-items:center; gap:6px; }
    .live-dot {
      width:7px; height:7px; border-radius:50%;
      background:#E53E3E;
      animation:pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { opacity:1; } 50% { opacity:0.3; }
    }
    .pj-title { font-size:13px; font-weight:600; opacity:0.9; }
    .pj-name  { font-size:11px; opacity:0.45; }

    /* Camera preview */
    .preview-wrap {
      width:100%; flex:1;
      position:relative;
      background:#111122;
      overflow:hidden;
      max-height:calc(100vh - 220px);
    }
    #preview-video {
      width:100%; height:100%;
      object-fit:cover;
      transform:scaleX(-1); /* mirror front camera */
      -webkit-transform:scaleX(-1) translateZ(0);
      transform:scaleX(-1) translateZ(0);
      will-change:transform;
    }
    #cam-off-cover {
      display:none;
      position:absolute; inset:0;
      background:#111122;
      flex-direction:column; align-items:center; justify-content:center;
      gap:10px;
    }
    #cam-off-cover span { font-size:40px; }
    #cam-off-cover p    { font-size:13px; opacity:0.5; }

    /* Device toggles */
    .device-row {
      display:flex; gap:24px;
      padding:18px 0 16px;
    }
    .dev-btn {
      display:flex; flex-direction:column; align-items:center; gap:6px;
      background:none; border:none; cursor:pointer; color:#fff;
    }
    .dev-icon {
      width:52px; height:52px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:22px;
      background:rgba(255,255,255,0.12);
      transition:background 0.2s;
    }
    .dev-icon.off { background:rgba(229,62,62,0.35); }
    .dev-label { font-size:11px; opacity:0.6; }

    /* Join button */
    .join-btn {
      width:calc(100% - 40px);
      padding:15px;
      background:#6C63FF;
      border:none; border-radius:14px;
      color:#fff; font-size:16px; font-weight:700;
      cursor:pointer; letter-spacing:0.3px;
      transition:opacity 0.15s;
    }
    .join-btn:active { opacity:0.8; }

    /* ── Phase 3: live call container ────────────────── */
    #zego-root {
      display:none;
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      overflow:hidden;
    }
  </style>
</head>
<body>

  <!-- Phase 1 — SDK loading -->
  <div id="loading" class="fill center">
    <div class="spinner"></div>
    <p>Connecting…</p>
  </div>

  <!-- Phase 2 — Pre-join -->
  <div id="prejoin" class="fill">
    <div class="pj-header">
      <div class="pj-live">
        <div class="live-dot"></div>
        <span class="pj-title">${callTitle}</span>
      </div>
      <span class="pj-name">${esc(userName)}</span>
    </div>

    <div class="preview-wrap">
      <video id="preview-video" autoplay playsinline muted></video>
      <div id="cam-off-cover" class="center">
        <span>📷</span>
        <p>Camera is off</p>
      </div>
    </div>

    <div class="device-row">
      <button class="dev-btn" id="mic-btn" onclick="toggleMic()">
        <div class="dev-icon" id="mic-icon-wrap">🎤</div>
        <span class="dev-label" id="mic-label">Mic on</span>
      </button>
      <button class="dev-btn" id="cam-btn" onclick="toggleCamera()">
        <div class="dev-icon" id="cam-icon-wrap">📷</div>
        <span class="dev-label" id="cam-label">Camera on</span>
      </button>
    </div>

    <button class="join-btn" onclick="handleJoin()">Join Call</button>
  </div>

  <!-- Phase 3 — Live call -->
  <div id="zego-root"></div>

  <script>
    // ── Helpers ──────────────────────────────────────────────────────────
    function rnPost(msg) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      } catch (e) { /* swallow */ }
    }

    // ── State ─────────────────────────────────────────────────────────────
    var zegoInstance   = null;
    var previewStream  = null;
    var cameraEnabled  = true;
    var micEnabled     = true;

    // ── Phase 2: preview helpers ──────────────────────────────────────────
    function startPreview() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        // getUserMedia not available — still show pre-join, user can join
        // without camera and ZEGOCLOUD will handle the error.
        showCamOffCover();
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' }, audio: true })
        .then(function (stream) {
          previewStream = stream;
          var v = document.getElementById('preview-video');
          v.srcObject = stream;
          v.play().catch(function () {});
        })
        .catch(function (err) {
          rnPost({ type: 'mediaError', name: err.name, message: err.message });
          showCamOffCover();
        });
    }

    function showCamOffCover() {
      document.getElementById('cam-off-cover').style.display = 'flex';
      document.getElementById('preview-video').style.display = 'none';
      cameraEnabled = false;
      syncCamBtn();
    }

    function syncMicBtn() {
      var wrap  = document.getElementById('mic-icon-wrap');
      var label = document.getElementById('mic-label');
      if (micEnabled) {
        wrap.textContent = '🎤';
        wrap.className   = 'dev-icon';
        label.textContent = 'Mic on';
      } else {
        wrap.textContent = '🔇';
        wrap.className   = 'dev-icon off';
        label.textContent = 'Muted';
      }
    }

    function syncCamBtn() {
      var wrap  = document.getElementById('cam-icon-wrap');
      var label = document.getElementById('cam-label');
      if (cameraEnabled) {
        wrap.textContent  = '📷';
        wrap.className    = 'dev-icon';
        label.textContent = 'Camera on';
        document.getElementById('preview-video').style.display = 'block';
        document.getElementById('cam-off-cover').style.display = 'none';
      } else {
        wrap.textContent  = '🚫';
        wrap.className    = 'dev-icon off';
        label.textContent = 'Camera off';
        document.getElementById('preview-video').style.display = 'none';
        document.getElementById('cam-off-cover').style.display = 'flex';
      }
    }

    function toggleMic() {
      micEnabled = !micEnabled;
      if (previewStream) {
        previewStream.getAudioTracks().forEach(function (t) {
          t.enabled = micEnabled;
        });
      }
      syncMicBtn();
    }

    function toggleCamera() {
      cameraEnabled = !cameraEnabled;
      if (previewStream) {
        previewStream.getVideoTracks().forEach(function (t) {
          t.enabled = cameraEnabled;
        });
      }
      syncCamBtn();
    }

    // ── Phase 3: join ─────────────────────────────────────────────────────
    async function handleJoin() {
      // Stop the preview stream tracks before calling joinRoom.
      // track.stop() is asynchronous at the hardware level on Android —
      // a 500 ms wait ensures the camera/mic are fully released before
      // ZEGOCLOUD's internal getUserMedia fires, preventing NotReadableError.
      if (previewStream) {
        previewStream.getTracks().forEach(function (t) { t.stop(); });
        previewStream = null;
        await new Promise(function (resolve) { setTimeout(resolve, 500); });
      }

      document.getElementById('prejoin').style.display  = 'none';
      document.getElementById('zego-root').style.display = 'block';
      rnPost({ type: 'callJoined' });

      // Two rAF cycles: let the browser commit the zego-root layout dimensions
      // before ZEGOCLOUD measures the container for video tile allocation.
      await new Promise(function (resolve) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { resolve(undefined); });
        });
      });

      zegoInstance.joinRoom({
        container: document.getElementById('zego-root'),

        // GroupCall skips the built-in lobby that hangs in WebView.
        scenario: { mode: ZegoUIKitPrebuilt.GroupCall },
        showPreJoinView: false,

        // Honour the user's toggle choices from the pre-join screen.
        turnOnCameraWhenJoining:    cameraEnabled,
        turnOnMicrophoneWhenJoining: micEnabled,
        useFrontFacingCamera: true,

        // UI chrome
        sharedLinks: [],
        showScreenSharingButton:           false,
        showTurnOffRemoteCameraButton:     false,
        showTurnOffRemoteMicrophoneButton: false,
        showRemoveUserButton:              false,
        showRoomTimer: true,
        maxUsers: 50,
        layout: 'Auto',
        onLeaveRoom: function () { rnPost({ type: 'callEnded' }); },
      });
    }

    // ── SDK initialisation (called after CDN script loads) ─────────────────
    function initZego() {
      clearTimeout(loadTimer);
      try {
        if (typeof ZegoUIKitPrebuilt === 'undefined') {
          rnPost({ type: 'error', message: 'ZEGOCLOUD SDK failed to load from CDN' });
          return;
        }

        var appID        = ${appID};
        var serverSecret = '${esc(serverSecret)}';
        var roomID       = '${esc(roomID)}';
        var userID       = '${esc(userID)}';
        var userName     = '${esc(userName)}';

        var kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID, serverSecret, roomID, userID, userName
        );
        zegoInstance = ZegoUIKitPrebuilt.create(kitToken);

        // Switch to Phase 2 and start the camera preview.
        document.getElementById('loading').style.display = 'none';
        document.getElementById('prejoin').style.display = 'flex';

        // Tell React Native the pre-join screen is ready — hide the RN overlay.
        rnPost({ type: 'preJoinReady' });

        // startPreview is called from script context (not user gesture).
        // This is fine here because PermissionsAndroid.requestMultiple() on
        // the React Native side already resolved the OS permissions before this
        // HTML ran, so getUserMedia resolves immediately instead of hanging.
        startPreview();

      } catch (err) {
        rnPost({ type: 'error', message: err && err.message ? err.message : String(err) });
      }
    }

    // ── Dynamic CDN loader with fallback ──────────────────────────────────
    var loadTimer = setTimeout(function () {
      rnPost({ type: 'error', message: 'Timed out loading ZEGOCLOUD SDK.' });
    }, 30000);

    function loadScript(src, onSuccess, onFail) {
      var s = document.createElement('script');
      s.src     = src;
      s.onload  = onSuccess;
      s.onerror = onFail;
      document.head.appendChild(s);
    }

    loadScript(
      '${CDN_PRIMARY}',
      function () { initZego(); },
      function () {
        loadScript(
          '${CDN_FALLBACK}',
          function () { initZego(); },
          function () {
            clearTimeout(loadTimer);
            rnPost({ type: 'error', message: 'Could not load ZEGOCLOUD SDK — check network.' });
          }
        );
      }
    );
  </script>

</body>
</html>`;
}
