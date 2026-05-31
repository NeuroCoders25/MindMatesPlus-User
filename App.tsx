import './global.css';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './src/context/AppContext';
import { Navigation } from './src/navigation';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppProvider>
        <Navigation />
      </AppProvider>
    </GestureHandlerRootView>
  );
}