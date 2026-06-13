import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Auth'), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.Image
        source={require('../assets/logo.png')}
        style={[styles.logo, { transform: [{ scale }], opacity }]}
        resizeMode="contain"
      />
      <Animated.Text style={[styles.tagline, { opacity }]}>
        Your AI-Powered Mental Health Companion
      </Animated.Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 90,
    marginBottom: 24,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
});
