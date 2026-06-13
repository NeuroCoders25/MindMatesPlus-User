import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { TabActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useGuide, TargetRect } from '../context/GuideContext';
import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';
import { navigationRef } from '../navigation/navigationRef';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPOTLIGHT_PAD = 10;
const SPOTLIGHT_R   = 16;
const TAB_BAR_H     = 49;

// Maps a step's targetKey to the tab it lives on.
const TAB_NAV_MAP: Record<string, string> = {
  tab_groups:        'Groups',
  tab_listener:      'Listener',
  tab_journal:       'Journal',
  tab_profile:       'Profile',
  achievements_row:  'Profile',
  feedback_row:      'Profile',
  groups_content:    'Groups',
  listener_content:  'Listener',
  journal_content:   'Journal',
  recommended_groups: 'Home',
  daily_card:         'Home',
};

// Reverse map: tab name → estimated-rect key
const TAB_NAME_TO_KEY: Record<string, string> = {
  Home:     'tab_home',
  Groups:   'tab_groups',
  Listener: 'tab_listener',
  Journal:  'tab_journal',
  Profile:  'tab_profile',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampedHole(
  raw: TargetRect,
  padH: number, padV: number,
  sw: number, sh: number,
) {
  const hx = Math.max(0, raw.x   - padH);
  const hy = Math.max(0, raw.y   - padV);
  const hw = Math.min(sw - hx, raw.width  + padH * 2);
  const hh = Math.min(sh - hy, raw.height + padV * 2);
  return { hx, hy, hw, hh };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AppGuideOverlay: React.FC = () => {
  const { user } = useApp();
  const {
    isGuideActive, currentStepIndex, steps,
    targetRects, nextStep, skipGuide, completeGuide,
  } = useGuide();

  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();

  // ── Modal visibility (separate from isGuideActive so we can fade-out first) ─
  const [modalVisible, setModalVisible] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);

  // ── Estimated tab-bar rects ────────────────────────────────────────────────
  // Modal uses the full window coordinate space (statusBarTranslucent on Android),
  // so tabBarTop calculated from sh matches the actual screen position.
  const tabBarTop = sh - TAB_BAR_H - insets.bottom;
  const tabW      = sw / 5;

  const estimatedTabRects: Record<string, TargetRect> = {
    tab_home:     { x: 0,        y: tabBarTop, width: tabW, height: TAB_BAR_H },
    tab_groups:   { x: tabW,     y: tabBarTop, width: tabW, height: TAB_BAR_H },
    tab_listener: { x: tabW * 2, y: tabBarTop, width: tabW, height: TAB_BAR_H },
    tab_journal:  { x: tabW * 3, y: tabBarTop, width: tabW, height: TAB_BAR_H },
    tab_profile:  { x: tabW * 4, y: tabBarTop, width: tabW, height: TAB_BAR_H },
  };

  // ── Animation ──────────────────────────────────────────────────────────────
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const prevIdxRef = useRef<number>(-1);

  useEffect(() => {
    if (isGuideActive) {
      setModalVisible(true);
      // Let the Modal mount before starting the fade-in
      requestAnimationFrame(() => {
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
        prevIdxRef.current = -1;
      });
    }
  }, [isGuideActive]);

  // Cross-fade between steps + auto-navigate to the right tab
  useEffect(() => {
    if (!isGuideActive) return;
    if (prevIdxRef.current === currentStepIndex) return;

    const isFirst = prevIdxRef.current === -1;
    prevIdxRef.current = currentStepIndex;

    const step = steps[currentStepIndex];
    const tabName = TAB_NAV_MAP[step.targetKey];
    if (tabName && navigationRef.isReady()) {
      try { navigationRef.dispatch(TabActions.jumpTo(tabName)); } catch { /* ignore */ }
    }

    if (isFirst) return;

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
    ]).start();
  }, [currentStepIndex, isGuideActive]);

  if (!modalVisible || !user) return null;

  const step       = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isTabStep  = step.targetKey.startsWith('tab_');

  // ── Primary spotlight ──────────────────────────────────────────────────────
  // measureInWindow returns y relative to the app window (below the status bar).
  // On Android the Modal with statusBarTranslucent draws from the top of the
  // physical screen, so we shift registered rects down by the status bar height.
  const yOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 0;

  const measuredRect = targetRects[step.targetKey];
  const primaryRaw: TargetRect =
    measuredRect != null
      ? { ...measuredRect, y: measuredRect.y + yOffset }
      : estimatedTabRects[step.targetKey] ??
        { x: sw / 2 - 120, y: sh / 2 - 40, width: 240, height: 80 };

  const primaryPadH = isTabStep ? 6 : SPOTLIGHT_PAD;
  const primaryPadV = isTabStep ? 4 : SPOTLIGHT_PAD;
  const { hx, hy, hw, hh } = clampedHole(primaryRaw, primaryPadH, primaryPadV, sw, sh);

  // ── Secondary spotlight on the relevant tab icon (for non-tab steps) ───────
  // Shows the user which tab is active even when the primary spotlight is on content.
  const secondaryTabKey = !isTabStep
    ? (TAB_NAME_TO_KEY[TAB_NAV_MAP[step.targetKey] ?? ''] ?? null)
    : null;
  const secondaryRaw = secondaryTabKey ? (estimatedTabRects[secondaryTabKey] ?? null) : null;
  const secondary = secondaryRaw
    ? clampedHole(secondaryRaw, 6, 4, sw, sh)
    : null;

  // ── Tooltip position ───────────────────────────────────────────────────────
  const TOOLTIP_MARGIN = 14;
  const measuredH = cardHeight || 200; // real height once measured, else estimate

  // Always measure space from primary spotlight bottom to screen bottom —
  // the secondary (tab icon) spotlight is decorative and must not constrain placement.
  const spaceBelow = sh - (hy + hh) - insets.bottom - TOOLTIP_MARGIN;
  const placeBelow = spaceBelow >= measuredH;

  // When below: top-anchored (grows down into open space).
  // When above: BOTTOM-anchored — pin the card's bottom a fixed margin above
  // the spotlight top (hy) so it grows upward and can never cross into the
  // spotlight / tab bar below it, no matter how tall the text is.
  const tooltipPos = placeBelow
    ? { top: Math.max(insets.top + 8, hy + hh + TOOLTIP_MARGIN) }
    : { bottom: sh - hy + TOOLTIP_MARGIN };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNext = () => isLastStep ? completeGuide(user.id) : nextStep();
  const handleSkip = () => skipGuide(user.id);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      // Android: extend under status bar so coordinates match useWindowDimensions
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        {/* ── Dim layer with spotlight hole(s) ──────────────────────────── */}
        <Svg
          width={sw}
          height={sh}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Defs>
            {/*
              Mask semantics: white = dim shows, black = dim hidden (transparent hole).
              Two black rects create two spotlight holes.
            */}
            <Mask id="guide-mask" x="0" y="0" width={sw} height={sh}>
              <Rect x={0} y={0} width={sw} height={sh} fill="white" />

              {/* Primary spotlight */}
              <Rect
                x={hx} y={hy} width={hw} height={hh}
                rx={SPOTLIGHT_R} ry={SPOTLIGHT_R}
                fill="black"
              />

              {/* Secondary spotlight — the relevant tab icon (non-tab steps only) */}
              {secondary && (
                <Rect
                  x={secondary.hx} y={secondary.hy}
                  width={secondary.hw} height={secondary.hh}
                  rx={12} ry={12}
                  fill="black"
                />
              )}
            </Mask>
          </Defs>

          <Rect
            x={0} y={0} width={sw} height={sh}
            fill="rgba(0,0,0,0.72)"
            mask="url(#guide-mask)"
          />
        </Svg>

        {/* ── Tooltip card ──────────────────────────────────────────────── */}
        <View
          style={[styles.card, { left: TOOLTIP_MARGIN, right: TOOLTIP_MARGIN, ...tooltipPos }]}
          pointerEvents="box-none"
          onLayout={e => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - cardHeight) > 1) setCardHeight(h);
          }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.stepCounter}>
              {currentStepIndex + 1} / {steps.length}
            </Text>
            <TouchableOpacity onPress={handleSkip} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip tour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>{isLastStep ? 'Done' : 'Next'}</Text>
              {!isLastStep && (
                <Ionicons name="arrow-forward" size={14} color="white" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  card: {
    position:        'absolute',
    backgroundColor: COLORS.white,
    borderRadius:    20,
    padding:         20,
    gap:             10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.22,
    shadowRadius:    20,
    elevation:       20,
  },
  cardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   2,
  },
  stepCounter: {
    fontSize:      12,
    fontWeight:    '700',
    color:         COLORS.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#F3F4F6',
    alignItems:      'center',
    justifyContent:  'center',
  },
  title: {
    fontSize:   17,
    fontWeight: 'bold',
    color:      COLORS.text,
    lineHeight: 23,
  },
  body: {
    fontSize:   14,
    color:      COLORS.muted,
    lineHeight: 21,
  },
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      6,
  },
  skipBtn: {
    paddingVertical:   8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize:   13,
    color:      COLORS.muted,
    fontWeight: '600',
  },
  nextBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.primary,
    borderRadius:    12,
    paddingVertical:   10,
    paddingHorizontal: 20,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.3,
    shadowRadius:    6,
    elevation:       4,
  },
  nextText: {
    fontSize:   14,
    fontWeight: '700',
    color:      'white',
  },
});
