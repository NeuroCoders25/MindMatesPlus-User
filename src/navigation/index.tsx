import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';

import { SplashScreen } from '../screens/SplashScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { QuestionnaireScreen } from '../screens/QuestionnaireScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { AdvisorScreen } from '../screens/AdvisorScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { JournalScreen } from '../screens/JournalScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { RecoverPasswordScreen } from '../screens/RecoverPasswordScreen';

// ─── Route Types ─────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  ForgotPassword: undefined;
  RecoverPassword: undefined;
  Questionnaire: undefined;
  Result: undefined;
  Advisor: undefined;
  Main: undefined;
  GroupChat: { groupId: string; groupName: string };
  Feedback: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Groups: undefined;
  AIChat: undefined;
  Journal: undefined;
  Profile: undefined;
};

// ─── Navigators ──────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// ─── Tab icon map ─────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, [IoniconsName, IoniconsName]> = {
  Home: ['home', 'home-outline'],
  Groups: ['people', 'people-outline'],
  AIChat: ['chatbubble', 'chatbubble-outline'],
  Journal: ['book', 'book-outline'],
  Profile: ['person', 'person-outline'],
};

// ─── Main Tabs ────────────────────────────────────────────────────────────────

const MainTabs = () => {
  const { showCrisisAlert, setShowCrisisAlert } = useApp();

  return (
    <>
      <MainTab.Navigator
        screenOptions={({ route }) => {
          const [active, inactive] = TAB_ICONS[route.name] ?? [
            'home',
            'home-outline',
          ];
          return {
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? active : inactive}
                size={size}
                color={color}
              />
            ),
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.muted,
            tabBarStyle: {
              backgroundColor: 'rgba(255,255,255,0.97)',
              borderTopColor: COLORS.border,
              paddingBottom: 4,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            },
          };
        }}
      >
        <MainTab.Screen name="Home" component={HomeScreen} />
        <MainTab.Screen name="Groups" component={GroupsScreen} />
        <MainTab.Screen
          name="AIChat"
          component={ChatScreen}
          options={{ tabBarLabel: 'AI Chat' }}
        />
        <MainTab.Screen name="Journal" component={JournalScreen} />
        <MainTab.Screen name="Profile" component={ProfileScreen} />
      </MainTab.Navigator>

      {/* Crisis Alert Modal */}
      <Modal visible={showCrisisAlert} transparent animationType="fade">
        <View style={crisis.overlay}>
          <View style={crisis.pulse}>
            <Ionicons name="alert-circle" size={44} color="white" />
          </View>
          <Text style={crisis.title}>Crisis Detected</Text>
          <Text style={crisis.body}>
            Our AI has detected signs of high distress. You are not alone. Please
            connect with a crisis advisor immediately.
          </Text>
          <TouchableOpacity
            style={crisis.primaryBtn}
            onPress={() => setShowCrisisAlert(false)}
          >
            <Text style={crisis.primaryBtnText}>Connect with Advisor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={crisis.ghostBtn}
            onPress={() => setShowCrisisAlert(false)}
          >
            <Text style={crisis.ghostBtnText}>I'm okay now</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

// ─── Root Navigator ───────────────────────────────────────────────────────────

export const Navigation = () => (
  <NavigationContainer>
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Splash" component={SplashScreen} />
      <RootStack.Screen name="Auth" component={AuthScreen} />
      <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <RootStack.Screen name="RecoverPassword" component={RecoverPasswordScreen} />
      <RootStack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <RootStack.Screen name="Result" component={ResultScreen} />
      <RootStack.Screen name="Advisor" component={AdvisorScreen} />
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen
        name="GroupChat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <RootStack.Screen name="Feedback" component={FeedbackScreen} />
    </RootStack.Navigator>
  </NavigationContainer>
);

// ─── Crisis Styles ────────────────────────────────────────────────────────────

const crisis = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(220, 38, 38, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pulse: {
    width: 88,
    height: 88,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: 'rgba(254, 202, 202, 1)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  ghostBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ghostBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
