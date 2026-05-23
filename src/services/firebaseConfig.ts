import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyB6xYQWNc6R246bMMnohCbaVe6VmaFCQy0",
  authDomain: "mindmatesplus.firebaseapp.com",
  projectId: "mindmatesplus",
  storageBucket: "mindmatesplus.firebasestorage.app",
  messagingSenderId: "1068423012547",
  appId: "1:1068423012547:web:ffb37fc78ea1ee15a3c276",
};

// Guard against double-initialisation on Expo hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log('[Firebase] App initialized');

// initializeAuth / initializeFirestore both throw if called twice on the same app,
// so fall back to the getters when the instance already exists.
let _auth: Auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  _auth = getAuth(app);
}
export const auth = _auth;

let _db: Firestore;
try {
  // experimentalForceLongPolling avoids the WebChannel transport errors on iOS/Android
  _db = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  _db = getFirestore(app);
}
export const db = _db;

export const storage = getStorage(app);
