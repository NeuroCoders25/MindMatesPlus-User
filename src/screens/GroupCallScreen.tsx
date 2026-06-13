import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  BackHandler,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { RootStackParamList } from '../navigation';
import { useApp } from '../context/AppContext';
import { buildZegoCallHtml } from '../utils/zegoHtmlBuilder';

// ─── Route type ───────────────────────────────────────────────────────────────

type GroupCallRouteProp = RouteProp<RootStackParamList, 'GroupCall'>;

// ─── WebView JavaScript injections ────────────────────────────────────────────
//
// Injected immediately after the WebView's HTML document is parsed.
// Does two things:
//
//   1. Wraps navigator.mediaDevices.getUserMedia so any rejection (NotAllowedError,
//      NotFoundError, NotReadableError …) is forwarded to React Native as a
//      { type: 'mediaError', name, message } postMessage.
//
//   2. Watches for every <video> element ZEGOCLOUD inserts into the DOM and
//      immediately promotes it to a GPU compositing layer (translateZ(0)).
//      On Android WebView, video elements rendered without a dedicated
//      compositing layer appear as solid black rectangles; translateZ(0) forces
//      the browser to create a hardware texture for the element.

const INJECTED_MEDIA_INTERCEPTOR = `
  (function () {

    // ── 1. getUserMedia error reporter ───────────────────────────────────────
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      var _orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function (constraints) {
        return _orig(constraints).catch(function (err) {
          try {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mediaError',
                name: err.name || 'UnknownError',
                message: err.message || String(err),
              }));
            }
          } catch (e) { /* swallow */ }
          throw err; // re-throw so callers still see the rejection
        });
      };
    }

    // ── 2. Video element compositor fix ─────────────────────────────────────
    // Forces GPU compositing on every <video> element ZEGOCLOUD inserts.
    // Fixes solid-black camera tiles on Android WebView.
    function fixVideo(v) {
      if (!v || v.tagName !== 'VIDEO') return;
      v.setAttribute('autoplay', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.style.webkitTransform = 'translateZ(0)';
      v.style.transform       = 'translateZ(0)';
      v.style.willChange      = 'transform';
      if (v.paused) {
        v.play().catch(function () { /* autoplay policy — safe to ignore */ });
      }
    }

    // Patch any video elements already in the DOM at injection time.
    document.querySelectorAll('video').forEach(fixVideo);

    // Watch for new video elements ZEGOCLOUD inserts dynamically.
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return; // element nodes only
          if (node.tagName === 'VIDEO') {
            fixVideo(node);
          } else if (typeof node.querySelectorAll === 'function') {
            node.querySelectorAll('video').forEach(fixVideo);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    true; // injectedJavaScriptBeforeContentLoaded must evaluate to a truthy value
  })();
`;

// ─── Component ────────────────────────────────────────────────────────────────

const GroupCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const route      = useRoute<GroupCallRouteProp>();

  const { roomUrl, callTitle, advisorName, userNickname, groupId, callId } = route.params;
  const { user } = useApp();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]       = useState(true);
  const [hasError, setHasError]         = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ── ZEGOCLOUD state ─────────────────────────────────────────────────────────
  const [zegoHtmlUri, setZegoHtmlUri] = useState<string | null>(null);
  const [tokenError, setTokenError]   = useState(false);

  const webViewRef      = useRef<WebView>(null);
  // Holds the temp file path so the cleanup effect can delete it on unmount.
  const zegoHtmlUriRef  = useRef<string | null>(null);

  // Prevents navigation.goBack() being called more than once — can race between
  // the ZEGOCLOUD "callEnded" message and the user tapping the RN Leave button.
  const callLeftRef = useRef(false);

  // Safe navigation helper — idempotent.
  const safeLeave = useCallback(() => {
    if (callLeftRef.current) return;
    callLeftRef.current = true;
    navigation.goBack();
  }, [navigation]);

  // ── Permissions + HTML build on mount ─────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        // ── Android: request camera + mic at the OS level ──────────────────
        //
        // Android WebView's getUserMedia blocks indefinitely if the host app
        // has not been granted camera/mic runtime permissions. Awaiting this
        // BEFORE buildZegoCallHtml() ensures getUserMedia inside the page
        // never hangs waiting for an unresolved OS permission dialog.
        if (Platform.OS === 'android') {
          console.log('[GroupCallScreen] Requesting Android permissions…');

          const statuses = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);

          const camResult = statuses[PermissionsAndroid.PERMISSIONS.CAMERA];
          const micResult = statuses[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          const { GRANTED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;

          console.log('[GroupCallScreen] Permission results →', { camResult, micResult });

          // "Don't ask again" permanently suppresses the system dialog.
          // Detect and guide the user to Settings instead of silently failing.
          if (camResult === NEVER_ASK_AGAIN || micResult === NEVER_ASK_AGAIN) {
            Alert.alert(
              'Camera & microphone access needed',
              'MindMates+ needs camera and microphone permission for group calls. Please enable them in your device Settings.',
              [
                { text: 'Not now', style: 'cancel', onPress: safeLeave },
                {
                  text: 'Open Settings',
                  onPress: () => { Linking.openSettings(); safeLeave(); },
                },
              ],
              { cancelable: false },
            );
            return; // do not load the WebView
          }

          if (camResult !== GRANTED || micResult !== GRANTED) {
            // User tapped "Deny" (but not permanently). Proceed — ZEGOCLOUD will
            // surface a "no device" state and the user can retry after re-granting.
            console.warn('[GroupCallScreen] Camera or mic permission denied (not permanent).');
          }
        }

        // ── Read ZEGOCLOUD credentials from app config ─────────────────────
        // Credentials flow: .env → app.config.js (extra field) → Constants.expoConfig.extra
        const appID: number         = Number(Constants.expoConfig?.extra?.zegoAppId ?? 0);
        const serverSecret: string  = Constants.expoConfig?.extra?.zegoServerSecret ?? '';

        console.log('[GroupCallScreen] App config →', {
          appID:     appID   || '(missing)',
          hasSecret: !!serverSecret,
          roomUrl,
          callTitle,
        });

        if (!appID || !serverSecret) {
          throw new Error(
            'ZEGO_APP_ID or ZEGO_SERVER_SECRET missing. Check .env and app.config.js.',
          );
        }

        // ZEGOCLOUD userID: alphanumeric + underscore, max 36 chars
        const rawUserID = user?.id ?? 'student_' + Date.now();
        const userID    = rawUserID.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 36);

        // ZEGOCLOUD roomID: same character rules, max 64 chars
        const roomID = roomUrl.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);

        console.log('[GroupCallScreen] Building HTML → roomID:', roomID, ' userID:', userID);

        // Token generation is delegated to ZegoUIKitPrebuilt.generateKitTokenForTest()
        // inside the HTML — no custom HMAC needed on the React Native side.
        const html = buildZegoCallHtml({
          appID,
          serverSecret,
          roomID,
          userID,
          userName:  userNickname ?? user?.name ?? 'Student',
          callTitle,
        });

        // Write to a temp file so the WebView loads via file:// URI.
        // This gives the page a real (non-null) origin on Android, which
        // allows getUserMedia to succeed once onPermissionRequest grants it.
        // expo-file-system v19 uses the class-based File + Paths API.
        const tempFile = new FileSystem.File(
          FileSystem.Paths.cache,
          'zego_call_' + Date.now() + '.html',
        );
        tempFile.write(html);
        zegoHtmlUriRef.current = tempFile.uri;
        setZegoHtmlUri(tempFile.uri);
        console.log('[GroupCallScreen] HTML written to temp file — WebView will render.');

      } catch (err) {
        console.error('[GroupCallScreen] Init error:', err);
        setTokenError(true);
        setIsLoading(false);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Delete the temp HTML file when the screen unmounts to avoid cache bloat.
  useEffect(() => {
    return () => {
      if (zegoHtmlUriRef.current) {
        try { new FileSystem.File(zegoHtmlUriRef.current).delete(); } catch { /* safe to ignore */ }
      }
    };
  }, []);

  // Watch Firestore for the advisor ending the call remotely.
  // When status flips to "ended", exit immediately without prompting the user.
  useEffect(() => {
    const callRef = doc(db, 'peer_groups', groupId, 'groupCalls', callId);
    const unsub = onSnapshot(callRef, snapshot => {
      const status = snapshot.data()?.status as string | undefined;
      if (status === 'ended') {
        safeLeave();
      }
    });
    return unsub;
  }, [groupId, callId, safeLeave]);

  // ── Leave confirmation ─────────────────────────────────────────────────────

  const handleLeave = useCallback(() => {
    Alert.alert(
      'Leave call',
      'Are you sure you want to leave this group call?',
      [
        { text: 'Stay in call', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            // Ask the WebView to stop the camera/mic preview before the
            // component unmounts. This releases the camera indicator on Android
            // a few frames earlier than waiting for the full WebView teardown.
            try {
              webViewRef.current?.injectJavaScript(
                'if (typeof window.rnLeave === "function") { window.rnLeave(); } true;',
              );
            } catch { /* safe to ignore — WebView may already be gone */ }
            safeLeave();
          },
        },
      ],
      { cancelable: true },
    );
  }, [safeLeave]);

  // ── Android hardware back button ───────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleLeave();
      return true; // prevent default back behaviour
    });
    return () => sub.remove();
  }, [handleLeave]);

  // ── ZEGOCLOUD → React Native postMessage events ────────────────────────────

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    let data: Record<string, unknown>;

    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return; // non-JSON messages from WebView — ignore
    }

    console.log('[GroupCallScreen] WebView message →', data);

    switch (data.type as string) {

      // ── Pre-join screen is live inside the WebView ────────────────────────
      // Hide the React Native loading overlay so the pre-join UI is visible.
      case 'preJoinReady':
        setIsLoading(false);
        break;

      // ── User tapped "Join Call" in the pre-join screen ────────────────────
      case 'callJoined':
        setIsLoading(false); // no-op if preJoinReady already fired
        break;

      // ── User left the ZEGOCLOUD room ──────────────────────────────────────
      case 'callEnded':
        safeLeave();
        break;

      // ── Fatal SDK or network error ────────────────────────────────────────
      case 'error':
        console.error('[GroupCallScreen] ZEGOCLOUD error:', data.message);
        setHasError(true);
        setIsLoading(false);
        setErrorMessage((data.message as string) ?? 'Call error');
        break;

      // ── getUserMedia rejection (reported by injected interceptor) ─────────
      case 'mediaError':
        console.warn('[GroupCallScreen] getUserMedia error →', data.name, data.message);

        if (data.name === 'NotAllowedError') {
          // Permission denied at the browser layer.
          // On Android: OS permission was not granted or WebView grant failed.
          // On iOS: WKWebView permission sheet was dismissed.
          Alert.alert(
            'Camera or microphone blocked',
            'Please allow camera and microphone access in your device Settings, then rejoin the call.',
            [
              { text: 'Go back', onPress: safeLeave },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }

        if (data.name === 'NotFoundError' || data.name === 'NotReadableError') {
          // Hardware unavailable or in use by another app.
          setHasError(true);
          setIsLoading(false);
          setErrorMessage(
            data.name === 'NotFoundError'
              ? 'No camera or microphone found on this device.'
              : 'Camera or microphone is in use by another app.',
          );
        }
        break;
    }
  };

  // ── WebView error handlers ─────────────────────────────────────────────────

  const handleError = (syntheticEvent: WebViewErrorEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[GroupCallScreen] WebView load error →', nativeEvent);
    setHasError(true);
    setIsLoading(false);
    setErrorMessage(nativeEvent.description ?? 'Failed to load call');
  };

  const handleHttpError = (syntheticEvent: WebViewHttpErrorEvent) => {
    const { statusCode } = syntheticEvent.nativeEvent;
    console.warn('[GroupCallScreen] WebView HTTP error →', statusCode);
    if (statusCode >= 400) {
      setHasError(true);
      setIsLoading(false);
      setErrorMessage('Server error ' + statusCode);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
          <Text style={styles.callTitleText} numberOfLines={1}>
            {callTitle}
          </Text>
        </View>

        <View style={styles.topBarRight}>
          <Text style={styles.advisorLabel} numberOfLines={1}>
            {advisorName}
          </Text>
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeave}
            activeOpacity={0.8}
          >
            <Text style={styles.leaveButtonText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main content area ───────────────────────────────────────────── */}
      <View style={styles.contentArea}>

        {/*
          The WebView is rendered as soon as the HTML is ready.

          CRITICAL: The WebView must always occupy its full layout dimensions.
          When "hidden" we use opacity:0 only — NEVER width:0/height:0.

          Why: ZEGOCLOUD's SDK measures #zego-root's bounding rect when
          allocating GPU video textures for each participant tile. If the
          native WebView container is 0×0 at that moment, all textures are
          allocated at 0×0 — resulting in permanent black camera tiles that
          no amount of re-renders or requestAnimationFrame calls will fix.

          The loading overlay (absoluteFillObject) sits on top and hides the
          WebView visually while isLoading is true.
        */}
        {zegoHtmlUri && (
          <WebView
            ref={webViewRef}
            source={{ uri: zegoHtmlUri }}
            style={[
              styles.webView,
              (isLoading || hasError) && styles.webViewHidden,
            ]}

            // ── Media permissions ──────────────────────────────────────────
            // mediaCapturePermissionGrantType="grant" — bypasses the
            //   WKWebView-level sheet on iOS (OS NSCameraUsageDescription
            //   dialog still fires the first time).
            // Android WebChromeClient.onPermissionRequest is handled
            //   internally by react-native-webview (RNCWebChromeClient.java):
            //   it calls ContextCompat.checkSelfPermission and auto-grants
            //   the WebView request if the OS permission is already held.
            //   That is why PermissionsAndroid.requestMultiple() must resolve
            //   BEFORE the WebView renders — which init() guarantees.
            // allowsInlineMediaPlayback — video renders inline, not
            //   full-screen, on iOS.
            // mediaPlaybackRequiresUserAction:false — lets ZEGOCLOUD's
            //   autoplay policy work without an extra user tap.
            mediaCapturePermissionGrantType="grant"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}

            // ── ZEGOCLOUD SDK requirements ─────────────────────────────────
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}

            // ── Injected scripts ───────────────────────────────────────────
            // injectedJavaScriptBeforeContentLoaded runs BEFORE the CDN
            // script executes, so ZEGOCLOUD captures the wrapped getUserMedia
            // reference and all its internal calls are intercepted too.
            // (Issue 4 fix: was injectedJavaScript which ran too late.)
            injectedJavaScriptBeforeContentLoaded={INJECTED_MEDIA_INTERCEPTOR}

            // ── Message handler ────────────────────────────────────────────
            onMessage={handleWebViewMessage}

            // ── Load lifecycle ─────────────────────────────────────────────
            // onLoadStart  — sets isLoading:true so the overlay reappears on
            //                retry (webViewRef.current?.reload())
            // onLoadEnd    — HTML document is parsed; ZEGOCLOUD SDK is still
            //                loading from CDN (Phase 1 spinner is showing
            //                inside the WebView). We do NOT clear isLoading
            //                here — we wait for the 'preJoinReady' postMessage
            //                which fires once Phase 2 (pre-join screen) is up.
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
              console.log('[GroupCallScreen] WebView onLoadStart.');
            }}
            onLoadEnd={() => {
              // HTML parsed — SDK CDN still loading. isLoading stays true.
              console.log('[GroupCallScreen] WebView onLoadEnd (HTML parsed, SDK loading…).');
            }}
            onError={handleError}
            onHttpError={handleHttpError}
          />
        )}

        {/* Loading overlay ─────────────────────────────────────────────────
            Shown while:
              a) zegoHtmlUri is being built (permissions + file write)
              b) The ZEGOCLOUD SDK is loading from CDN (Phase 1)
              c) onLoadStart fired but preJoinReady hasn't arrived yet
            Dismissed ONLY when the WebView sends { type: 'preJoinReady' }.
        */}
        {(isLoading || zegoHtmlUri === null) && !hasError && !tokenError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={styles.loadingTitle}>Preparing call…</Text>
            <Text style={styles.loadingSubtitle}>
              Setting up your camera and microphone
            </Text>
          </View>
        )}

        {/* Config / token error state ──────────────────────────────────── */}
        {tokenError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>📵</Text>
            <Text style={styles.errorTitle}>Could not connect to call service</Text>
            <Text style={styles.errorMessage}>
              Check your internet connection and try again.
            </Text>
            <TouchableOpacity style={styles.cancelButton} onPress={safeLeave}>
              <Text style={styles.cancelButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView / network error state ───────────────────────────────── */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>📵</Text>
            <Text style={styles.errorTitle}>Could not join call</Text>
            <Text style={styles.errorMessage}>
              {errorMessage || 'Check your internet connection and try again'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setHasError(false);
                setIsLoading(true);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={safeLeave}>
              <Text style={styles.cancelButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
};

export default GroupCallScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0d0d1a',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    minHeight: 54,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,62,62,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E53E3E',
    marginRight: 4,
  },
  livePillText: {
    color: '#E53E3E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  callTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advisorLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    maxWidth: 100,
  },
  leaveButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Content area ─────────────────────────────────────────────────────────────
  contentArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1a1a2e',
  },

  webView: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },

  // KEY FIX: Previously this style had { position:'absolute', width:0, height:0 }
  // which caused ZEGOCLOUD to allocate GPU video textures at 0×0 — the root
  // cause of permanent black camera tiles.
  //
  // The fix: opacity:0 only. The WebView keeps its full layout dimensions so
  // ZEGOCLOUD's container measurement succeeds. The loading overlay
  // (absoluteFillObject) covers the invisible WebView during load.
  webViewHidden: {
    opacity: 0,
  },

  // ── Loading overlay ───────────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 6,
  },
  loadingSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
  },

  // ── Error state ───────────────────────────────────────────────────────────────
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
});
