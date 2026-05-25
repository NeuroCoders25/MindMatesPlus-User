// app.config.js — replaces app.json so we can inject env vars into extra.
// The original static fields are preserved verbatim; only `extra` is added.

module.exports = {
  expo: {
    name: 'MindMatesPlus-RN',
    slug: 'MindMatesPlus-RN',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          'MindMates+ needs camera access for peer group calls',
        NSMicrophoneUsageDescription:
          'MindMates+ needs microphone access for peer group calls',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.anonymous.MindMatesPlusRN',
      permissions: ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
    },
    web: {
      favicon: './assets/favicon.png',
    },

    // ── ZEGOCLOUD credentials ──────────────────────────────────────────────────
    // Set ZEGO_APP_ID and ZEGO_SERVER_SECRET in .env (never commit real secrets).
    // Access in app code via: Constants.expoConfig?.extra?.zegoAppId / zegoServerSecret
    extra: {
      zegoAppId: process.env.ZEGO_APP_ID,
      zegoServerSecret: process.env.ZEGO_SERVER_SECRET,
    },
  },
};
