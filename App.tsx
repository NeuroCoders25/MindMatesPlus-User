import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './src/context/AppContext';
import { Navigation } from './src/navigation';
import { auth, db } from './src/services/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

// Temporary Firebase connection test — remove after confirming it works
function FirebaseTest() {
  useEffect(() => {
    const test = async () => {
      try {
        console.log("✅ Auth ready");
        const snap = await getDocs(collection(db, 'users'));
        console.log("✅ Firestore connected. Docs:", snap.size);
      } catch (e) {
        console.error("❌ Firebase error:", e);
      }
    };
    test();
  }, []);

  return null; // renders nothing
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppProvider>
        <FirebaseTest />
        <Navigation />
      </AppProvider>
    </GestureHandlerRootView>
  );
}