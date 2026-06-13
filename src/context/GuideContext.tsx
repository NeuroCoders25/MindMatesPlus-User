import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { APP_GUIDE_STEPS, GuideStep } from '../config/appGuideSteps';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GuideContextType {
  isGuideActive: boolean;
  currentStepIndex: number;
  steps: GuideStep[];
  targetRects: Record<string, TargetRect>;
  registerTarget: (key: string, rect: TargetRect) => void;
  /** Called from HomeScreen on mount — checks persistence and auto-starts guide for new users. */
  checkAndMaybeStartGuide: (uid: string, isRestricted: boolean) => Promise<void>;
  /** Manual trigger (Replay from Settings) — ignores the hasSeenAppGuide flag. */
  startGuideManually: () => void;
  nextStep: () => void;
  /** Advances past the last step — also writes the persistence flag. */
  completeGuide: (uid: string) => Promise<void>;
  /** Skips the guide immediately and writes the persistence flag. */
  skipGuide: (uid: string) => Promise<void>;
}

const GuideContext = createContext<GuideContextType | null>(null);

export const useGuide = (): GuideContextType => {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide must be used within GuideProvider');
  return ctx;
};

const asyncKey = (uid: string) => `mm_hasSeenAppGuide_${uid}`;

async function markSeen(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(asyncKey(uid), 'true');
  } catch { /* non-fatal */ }
  try {
    await setDoc(doc(db, 'users', uid), { hasSeenAppGuide: true }, { merge: true });
  } catch { /* non-fatal */ }
}

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRects, setTargetRects] = useState<Record<string, TargetRect>>({});
  // Tracks which uid has already been checked to avoid duplicate Firestore reads
  const checkedUidRef = useRef<string | null>(null);

  const registerTarget = useCallback((key: string, rect: TargetRect) => {
    setTargetRects(prev => {
      // Skip update if values are identical to avoid unnecessary renders
      const prev_ = prev[key];
      if (
        prev_ &&
        prev_.x === rect.x && prev_.y === rect.y &&
        prev_.width === rect.width && prev_.height === rect.height
      ) return prev;
      return { ...prev, [key]: rect };
    });
  }, []);

  const checkAndMaybeStartGuide = useCallback(async (uid: string, isRestricted: boolean) => {
    if (isRestricted) return;
    if (checkedUidRef.current === uid) return; // already checked for this user
    checkedUidRef.current = uid;

    // Fast local check first
    try {
      const local = await AsyncStorage.getItem(asyncKey(uid));
      if (local === 'true') return;
    } catch { /* ignore storage errors */ }

    // Firestore check (handles new devices / reinstalls)
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists() && snap.data()?.hasSeenAppGuide === true) {
        // Backfill AsyncStorage for subsequent launches
        AsyncStorage.setItem(asyncKey(uid), 'true').catch(() => {});
        return;
      }
    } catch { /* network offline — show guide once, acceptable per spec */ }

    setCurrentStepIndex(0);
    setIsGuideActive(true);
  }, []);

  const startGuideManually = useCallback(() => {
    setCurrentStepIndex(0);
    setIsGuideActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex(prev =>
      prev < APP_GUIDE_STEPS.length - 1 ? prev + 1 : prev,
    );
  }, []);

  const completeGuide = useCallback(async (uid: string) => {
    setIsGuideActive(false);
    setCurrentStepIndex(0);
    await markSeen(uid);
  }, []);

  const skipGuide = useCallback(async (uid: string) => {
    setIsGuideActive(false);
    setCurrentStepIndex(0);
    await markSeen(uid);
  }, []);

  return (
    <GuideContext.Provider
      value={{
        isGuideActive,
        currentStepIndex,
        steps: APP_GUIDE_STEPS,
        targetRects,
        registerTarget,
        checkAndMaybeStartGuide,
        startGuideManually,
        nextStep,
        completeGuide,
        skipGuide,
      }}
    >
      {children}
    </GuideContext.Provider>
  );
};
