import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StageLatencies } from '../flow/authenticateOnSite';

interface MetricsPanelProps {
  latencies: StageLatencies | null;
  passiveScore: number | null;
  combinedModelSizeKb: number;
  isRunning: boolean;
}

const TARGET_TOTAL_MS = 700;
const CEILING_TOTAL_MS = 1000;
const MODEL_SIZE_CEILING_MB = 50;

function formatMs(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  return `${ms} ms`;
}

function totalColor(totalMs: number | null): string {
  if (totalMs === null) {
    return '#888888';
  }
  if (totalMs <= TARGET_TOTAL_MS) {
    return '#34C759';
  }
  if (totalMs <= CEILING_TOTAL_MS) {
    return '#FF9500';
  }
  return '#FF3B30';
}

export default function MetricsPanel({
  latencies,
  passiveScore,
  combinedModelSizeKb,
  isRunning,
}: MetricsPanelProps) {
  const modelSizeMb = (combinedModelSizeKb / 1024).toFixed(2);
  const modelOk = combinedModelSizeKb / 1024 < MODEL_SIZE_CEILING_MB;

  const stages: { label: string; ms: number | null }[] = [
    { label: 'Detection', ms: latencies?.detectionMs ?? null },
    { label: 'Passive liveness', ms: latencies?.passiveLivenessMs ?? null },
    { label: 'Active challenge', ms: latencies?.activeChallengeMs ?? null },
    { label: 'Embedding', ms: latencies?.embeddingMs ?? null },
    { label: 'Match', ms: latencies?.matchMs ?? null },
  ];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Live Metrics</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Models on device</Text>
        <Text style={[styles.value, modelOk ? styles.green : styles.red]}>
          {modelSizeMb} MB {modelOk ? '✓' : '✗'}
        </Text>
      </View>

      {passiveScore !== null && (
        <View style={styles.row}>
          <Text style={styles.label}>Passive liveness score</Text>
          <Text style={[styles.value, passiveScore >= 0.6 ? styles.green : styles.red]}>
            {(passiveScore * 100).toFixed(1)}%
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {stages.map(s => (
        <View key={s.label} style={styles.row}>
          <Text style={styles.label}>{s.label}</Text>
          <Text style={[styles.value, isRunning && s.ms === null ? styles.dim : styles.bright]}>
            {isRunning && s.ms === null ? '…' : formatMs(s.ms)}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total end-to-end</Text>
        <Text
          style={[
            styles.totalValue,
            { color: totalColor(latencies?.totalMs ?? null) },
          ]}>
          {isRunning && latencies === null ? '…' : formatMs(latencies?.totalMs ?? null)}
        </Text>
      </View>

      <Text style={styles.targets}>
        Target &lt; {TARGET_TOTAL_MS} ms · Ceiling &lt; {CEILING_TOTAL_MS} ms · Model ceiling &lt;{' '}
        {MODEL_SIZE_CEILING_MB} MB
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    color: '#888888',
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
  bright: {
    color: '#FFFFFF',
  },
  dim: {
    color: '#555555',
  },
  green: {
    color: '#34C759',
  },
  red: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 8,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  targets: {
    color: '#555555',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
