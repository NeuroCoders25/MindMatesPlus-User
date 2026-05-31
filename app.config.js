// app.config.js — replaces app.json so we can inject env vars into extra.
// The original static fields are preserved verbatim; only `extra` is added.

module.exports = {
  expo: {
    name: 'MindMates+',
    slug: 'MindMates+',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon copy.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon copy.png',
      resizeMode: 'contain',
      backgroundColor: '#1c2758',
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          'MindMates+ needs camera access for group video calls with your peer support group.',
        NSMicrophoneUsageDescription:
          'MindMates+ needs microphone access for group calls with your peer support group.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B0D3F',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.anonymous.MindMatesPlusRN',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.INTERNET',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [],

    // ── ZEGOCLOUD credentials ──────────────────────────────────────────────────
    // Set ZEGO_APP_ID and ZEGO_SERVER_SECRET in .env (never commit real secrets).
    // Access in app code via: Constants.expoConfig?.extra?.zegoAppId / zegoServerSecret
    extra: {
      zegoAppId: process.env.ZEGO_APP_ID,
      zegoServerSecret: process.env.ZEGO_SERVER_SECRET,
      alertApiUrl: process.env.ALERT_API_URL,
      mlApiUrl: process.env.ML_API_URL,
    },
  },
};
