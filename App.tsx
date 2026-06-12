import './global.css';
import React from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { Navigation } from './src/navigation';
import { COLORS } from './src/services/dataService';

// Suppress key-prop warning originating from third-party library internals
// (react-native-svg / react-navigation tab bar). All user-code lists have proper keys.
LogBox.ignoreLogs(['Each child in a list should have a unique']);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <SafeAreaProvider style={{ backgroundColor: COLORS.background }}>
        <StatusBar style="dark" backgroundColor={COLORS.background} />
        <AppProvider>
          <Navigation />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
