/**
 * ConfidenceSparkline — renders a mini SVG polyline of BERT confidence values
 * over the last N events. Each segment is colored by its prediction label.
 * A dashed horizontal rule marks the 0.80 confidence threshold.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import type { MLHistoryEntry } from '../../../types/diagnostic';

const LABEL_COLOR: Record<string, string> = {
  depression: '#EF4444',
  anxiety:    '#F59E0B',
  normal:     '#00FF88',
};

const PAD_X = 8;
const PAD_Y = 8;

interface SparkPoint {
  x: number;
  y: number;
  color: string;
}

interface Props {
  /** Entries in descending order (newest first) — the hook returns them this way. */
  entries: MLHistoryEntry[];
  width:   number;
  height?: number;
}

export const ConfidenceSparkline = React.memo<Props>(({ entries, width, height = 60 }) => {
  const { points, thresholdY } = useMemo<{ points: SparkPoint[]; thresholdY: number }>(() => {
    const plotW = width  - PAD_X * 2;
    const plotH = height - PAD_Y * 2;

    // Reverse to chronological order for left→right display
    const chrono = [...entries].reverse();
    const n = chrono.length;

    const pts: SparkPoint[] = chrono.map((e, i) => ({
      x: PAD_X + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      // confidence 1.0 maps to top (low y), 0.0 maps to bottom (high y)
      y: PAD_Y + plotH * (1 - Math.min(1, Math.max(0, e.confidence))),
      color: LABEL_COLOR[e.prediction] ?? '#6B7280',
    }));

    return {
      points: pts,
      thresholdY: PAD_Y + plotH * (1 - 0.80),
    };
  }, [entries, width, height]);

  if (points.length === 0) return <View style={{ height }} />;

  return (
    <Svg width={width} height={height} style={styles.svg}>
      {/* 0.80 confidence threshold — dashed reference line */}
      <Line
        x1={0}     y1={thresholdY}
        x2={width} y2={thresholdY}
        stroke="#374151"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Colored segment between each consecutive pair of points */}
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        return (
          <Line
            key={`seg_${i}`}
            x1={prev.x} y1={prev.y}
            x2={pt.x}   y2={pt.y}
            stroke={pt.color}
            strokeWidth={2}
          />
        );
      })}

      {/* Dot at each sample */}
      {points.map((pt, i) => (
        <Circle
          key={`dot_${i}`}
          cx={pt.x}
          cy={pt.y}
          r={3}
          fill={pt.color}
          stroke="#0F1117"
          strokeWidth={1}
        />
      ))}
    </Svg>
  );
});

ConfidenceSparkline.displayName = 'ConfidenceSparkline';

const styles = StyleSheet.create({
  svg: { marginVertical: 4 },
});
