import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { PhotoFile } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import CameraScreen from '../camera/CameraScreen';
import { FaceSignals } from '../onsite/coreTypes';
import { alignFaceFromLandmarks } from '../recognition/alignFace';
import {
  runPassiveCheck,
  beginAuthentication,
  completeAuthentication,
  AuthResult,
  AuthFrame,
  ActiveChallengeHandle,
} from '../flow/authenticateOnSite';
import { StageLatencies } from '../flow/authenticateOnSite';
import { LivenessConfig, ChallengeStep, DEFAULT_LIVENESS_CONFIG } from '../liveness/challengeTypes';
import { listAllRecords, listPendingRecords } from '../record/recordQueue';
import { flushPendingRecords } from '../sync/syncScheduler';
import { purgeSyncedRecords } from '../sync/purge';
import MetricsPanel from './MetricsPanel';

const DEVICE_ID = 'demo-device-001';
const COMBINED_MODEL_SIZE_KB = 1700 + 38000;

const LIVENESS_CONFIG: LivenessConfig = DEFAULT_LIVENESS_CONFIG;

const decodeBase64 = (s: string): string =>
  (globalThis as unknown as Record<string, (x: string) => string>).atob(s);

type FlowPhase =
  | 'idle'
  | 'passive_checking'
  | 'challenge_active'
  | 'embedding_matching'
  | 'done';

const CHALLENGE_LABELS: Record<ChallengeStep, string> = {
  blink: 'Blink your eyes',
  turnLeft: 'Turn head left',
  turnRight: 'Turn head right',
};

type OnSiteScreenProps = {
  navigation?: any;
};

export default function OnSiteScreen({ navigation }: OnSiteScreenProps) {
  const [currentFaces, setCurrentFaces] = useState<FaceSignals[]>([]);
  const [phase, setPhase] = useState<FlowPhase>('idle');
  const [captureRequested, setCaptureRequested] = useState(false);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [latencies, setLatencies] = useState<StageLatencies | null>(null);
  const [passiveScore, setPassiveScore] = useState<number | null>(null);
  const [pendingSteps, setPendingSteps] = useState<ChallengeStep[]>([]);
  const [completedSteps, setCompletedSteps] = useState<ChallengeStep[]>([]);
  const [simulateConnected, setSimulateConnected] = useState(false);
  const [queueStats, setQueueStats] = useState({ pending: 0, total: 0 });
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const challengeHandleRef = useRef<ActiveChallengeHandle | null>(null);
  const capturedFrameRef = useRef<AuthFrame | null>(null);
  const detectionMsRef = useRef<number>(0);
  const passiveMsRef = useRef<number>(0);
  const challengeStartRef = useRef<number>(0);
  const signalBufferRef = useRef<FaceSignals[]>([]);

  const refreshQueueStats = useCallback(async () => {
    const all = await listAllRecords();
    const pending = await listPendingRecords();
    setQueueStats({ pending: pending.length, total: all.length });
  }, []);

  useEffect(() => {
    refreshQueueStats();
  }, [refreshQueueStats]);

  useEffect(() => {
    if (!simulateConnected || isSyncing) {
      return;
    }
    let active = true;

    const run = async () => {
      setIsSyncing(true);
      setSyncLog(prev => [...prev, 'Connectivity detected — flushing queue…']);

      const result = await flushPendingRecords();
      if (!active) {
        return;
      }

      setSyncLog(prev => [
        ...prev,
        `Sync: ${result.succeeded} uploaded, ${result.failed} failed`,
      ]);

      if (result.syncedIds.length > 0) {
        const purgeResult = await purgeSyncedRecords();
        setSyncLog(prev => [
          ...prev,
          `Purge: ${purgeResult.purgedRecordIds.length} records removed, ${purgeResult.purgedWorkerTemplates.length} templates deleted`,
        ]);
      }

      await refreshQueueStats();
      setIsSyncing(false);
    };

    run();

    return () => {
      active = false;
    };
  }, [simulateConnected, isSyncing, refreshQueueStats]);

  const handleFacesDetected = useCallback(
    (faces: FaceSignals[]) => {
      setCurrentFaces(faces);

      if (phase === 'challenge_active' && challengeHandleRef.current) {
        for (const face of faces) {
          const { allDone, stepCompleted } = challengeHandleRef.current.feedSignals(face);
          signalBufferRef.current.push(face);

          if (stepCompleted) {
            setCompletedSteps(prev => {
              const next = challengeHandleRef.current
                ? challengeHandleRef.current.steps.slice(0, prev.length + 1)
                : prev;
              return next;
            });
          }

          if (allDone) {
            finaliseAfterChallenge();
            break;
          }
        }
      }
    },
    [phase],
  );

  function finaliseAfterChallenge() {
    if (!challengeHandleRef.current || !capturedFrameRef.current) {
      return;
    }

    const liveness = challengeHandleRef.current.finish();
    const challengeMs = Date.now() - challengeStartRef.current;

    setPhase('embedding_matching');

    completeAuthentication(
      capturedFrameRef.current,
      liveness,
      DEVICE_ID,
      detectionMsRef.current,
      passiveMsRef.current,
      challengeMs,
      null,
    ).then(result => {
      setAuthResult(result);
      setLatencies(result.latencies);
      setPhase('done');
      refreshQueueStats();
    });
  }

  const handlePhotoCaptured = useCallback(
    async (photo: PhotoFile) => {
      if (currentFaces.length === 0) {
        setPhase('idle');
        return;
      }

      const detectionStart = Date.now();
      const face = currentFaces[0];

      try {
        const imageData = await RNFS.readFile((photo as any).path, 'base64');
        const binary: string = decodeBase64(imageData);
        const pixels: number[] = [];
        for (let i = 0; i < binary.length; i++) {
          pixels.push(binary.charCodeAt(i));
        }

        const w = Math.round((face as any).signals?.boundingBox?.width ?? face.boundingBox?.width ?? 640);
        const h = Math.round((face as any).signals?.boundingBox?.height ?? face.boundingBox?.height ?? 480);

        const rgb: number[] = [];
        for (let i = 0; i < w * h; i++) {
          rgb.push(pixels[i * 4] ?? 0, pixels[i * 4 + 1] ?? 0, pixels[i * 4 + 2] ?? 0);
        }

        const aligned = alignFaceFromLandmarks(rgb, w, h, face.landmarks);

        const frame: AuthFrame = {
          pixels: rgb,
          width: w,
          height: h,
          signals: face,
          alignedCrop: aligned.pixels,
        };

        capturedFrameRef.current = frame;
        detectionMsRef.current = Date.now() - detectionStart;

        setPhase('passive_checking');

        const passiveResult = await runPassiveCheck(frame, LIVENESS_CONFIG);
        passiveMsRef.current = passiveResult.latencyMs;
        setPassiveScore(passiveResult.score);

        if (!passiveResult.passed) {
          const fakeLiveness = {
            passed: false,
            passiveScore: passiveResult.score,
            challengeResult: null,
            failReason: 'passiveFailed' as const,
          };
          const result = await completeAuthentication(
            frame,
            fakeLiveness,
            DEVICE_ID,
            detectionMsRef.current,
            passiveMsRef.current,
            0,
            null,
          );
          setAuthResult({
            ...result,
            outcome: 'spoof_rejected',
            livenessResult: fakeLiveness,
            matchResult: null,
          });
          setLatencies(result.latencies);
          setPhase('done');
          return;
        }

        const handle = beginAuthentication(frame, passiveResult.score, LIVENESS_CONFIG);
        challengeHandleRef.current = handle;
        signalBufferRef.current = [];
        challengeStartRef.current = Date.now();
        setPendingSteps(handle.steps);
        setCompletedSteps([]);
        setPhase('challenge_active');

        setTimeout(() => {
          if (challengeHandleRef.current && phase === 'challenge_active') {
            finaliseAfterChallenge();
          }
        }, LIVENESS_CONFIG.challengeTimeoutMs);
      } catch {
        setPhase('idle');
        Alert.alert('Error', 'Failed to process frame. Please try again.');
      }
    },
    [currentFaces, phase],
  );

  const handleCaptureComplete = useCallback(() => {
    setCaptureRequested(false);
  }, []);

  const handleStart = useCallback(() => {
    if (currentFaces.length === 0) {
      Alert.alert('No face detected', 'Position your face in the frame.');
      return;
    }
    setAuthResult(null);
    setLatencies(null);
    setPassiveScore(null);
    setPendingSteps([]);
    setCompletedSteps([]);
    challengeHandleRef.current = null;
    capturedFrameRef.current = null;
    setCaptureRequested(true);
    setPhase('passive_checking');
  }, [currentFaces]);

  const handleReset = useCallback(() => {
    setAuthResult(null);
    setLatencies(null);
    setPassiveScore(null);
    setPendingSteps([]);
    setCompletedSteps([]);
    setPhase('idle');
    challengeHandleRef.current = null;
    capturedFrameRef.current = null;
  }, []);

  const handleClearSyncLog = useCallback(() => {
    setSyncLog([]);
  }, []);

  if (phase === 'done' && authResult) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <OutcomeCard authResult={authResult} onReset={handleReset} navigation={navigation} />
        <MetricsPanel
          latencies={latencies}
          passiveScore={passiveScore}
          combinedModelSizeKb={COMBINED_MODEL_SIZE_KB}
          isRunning={false}
        />
        <SyncPanel
          simulateConnected={simulateConnected}
          onToggle={setSimulateConnected}
          queueStats={queueStats}
          syncLog={syncLog}
          onClearLog={handleClearSyncLog}
          isSyncing={isSyncing}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>OnSite Verify</Text>
        <Text style={styles.headerSubtitle}>Two-layer liveness · Offline-first</Text>
      </View>

      <View style={styles.cameraWrapper}>
        <CameraScreen
          onFacesDetected={handleFacesDetected}
          onPhotoCaptured={handlePhotoCaptured}
          captureRequested={captureRequested}
          onCaptureComplete={handleCaptureComplete}
        />
        {phase === 'challenge_active' && (
          <ChallengeOverlay pendingSteps={pendingSteps} completedSteps={completedSteps} />
        )}
        {phase !== 'idle' && phase !== 'challenge_active' && (
          <PhaseOverlay phase={phase} />
        )}
      </View>

      <MetricsPanel
        latencies={latencies}
        passiveScore={passiveScore}
        combinedModelSizeKb={COMBINED_MODEL_SIZE_KB}
        isRunning={phase !== 'idle'}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            (currentFaces.length === 0 || phase !== 'idle') && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={currentFaces.length === 0 || phase !== 'idle'}>
          <Text style={styles.startButtonText}>
            {phase === 'idle'
              ? currentFaces.length > 0
                ? 'Start Verification'
                : 'Waiting for face…'
              : phaseLabel(phase)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function phaseLabel(phase: FlowPhase): string {
  switch (phase) {
    case 'passive_checking':
      return 'Checking liveness…';
    case 'challenge_active':
      return 'Follow the prompts…';
    case 'embedding_matching':
      return 'Matching identity…';
    default:
      return '';
  }
}

function ChallengeOverlay({
  pendingSteps,
  completedSteps,
}: {
  pendingSteps: ChallengeStep[];
  completedSteps: ChallengeStep[];
}) {
  const currentIdx = completedSteps.length;
  const currentStep = pendingSteps[currentIdx];

  return (
    <View style={styles.challengeOverlay}>
      <View style={styles.challengeCard}>
        {currentStep && (
          <>
            <Text style={styles.challengeInstruction}>
              {CHALLENGE_LABELS[currentStep]}
            </Text>
            <View style={styles.challengeStepRow}>
              {pendingSteps.map((s, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.challengeStepDot,
                    idx < completedSteps.length && styles.challengeStepDotDone,
                    idx === currentIdx && styles.challengeStepDotActive,
                  ]}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function PhaseOverlay({ phase }: { phase: FlowPhase }) {
  return (
    <View style={styles.phaseOverlay}>
      <View style={styles.phaseCard}>
        <Text style={styles.phaseText}>{phaseLabel(phase)}</Text>
      </View>
    </View>
  );
}

function OutcomeCard({
  authResult,
  onReset,
  navigation,
}: {
  authResult: AuthResult;
  onReset: () => void;
  navigation?: any;
}) {
  const isSuccess = authResult.outcome === 'success';
  const isSpoof = authResult.outcome === 'spoof_rejected';

  const outcomeLabels: Record<string, string> = {
    success: 'Identity Verified',
    spoof_rejected: 'Spoof Detected',
    challenge_failed: 'Challenge Failed',
    identity_mismatch: 'No Match Found',
  };

  const outcomeDetails: Record<string, string> = {
    success: 'Real person · Challenge passed · Identity confirmed',
    spoof_rejected: 'Passive liveness rejected this face as a spoof (photo or screen)',
    challenge_failed: 'Active challenge timed out or wrong order',
    identity_mismatch: 'Live person confirmed but no enrolled template matched',
  };

  return (
    <View style={styles.outcomeCard}>
      <View
        style={[
          styles.outcomeIcon,
          isSuccess ? styles.iconSuccess : isSpoof ? styles.iconSpoof : styles.iconFail,
        ]}>
        <Text style={styles.outcomeIconText}>{isSuccess ? '✓' : isSpoof ? '⚠' : '✗'}</Text>
      </View>
      <Text style={styles.outcomeTitle}>{outcomeLabels[authResult.outcome]}</Text>
      <Text style={styles.outcomeDetail}>{outcomeDetails[authResult.outcome]}</Text>
      {authResult.matchResult?.workerId && (
        <Text style={styles.workerId}>Worker: {authResult.matchResult.workerId}</Text>
      )}
      {authResult.recordId && (
        <Text style={styles.recordId}>Record: {authResult.recordId}</Text>
      )}
      <TouchableOpacity style={styles.resetButton} onPress={onReset}>
        <Text style={styles.resetButtonText}>Verify Again</Text>
      </TouchableOpacity>
      {navigation && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Enrol')}>
          <Text style={styles.secondaryButtonText}>Go to Enrolment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SyncPanel({
  simulateConnected,
  onToggle,
  queueStats,
  syncLog,
  onClearLog,
  isSyncing,
}: {
  simulateConnected: boolean;
  onToggle: (v: boolean) => void;
  queueStats: { pending: number; total: number };
  syncLog: string[];
  onClearLog: () => void;
  isSyncing: boolean;
}) {
  return (
    <View style={styles.syncPanel}>
      <Text style={styles.syncTitle}>Sync & Purge</Text>

      <View style={styles.syncRow}>
        <View>
          <Text style={styles.syncLabel}>Simulate connectivity</Text>
          <Text style={styles.syncSub}>
            {simulateConnected ? 'Online — flushing queue' : 'Offline — records queued locally'}
          </Text>
        </View>
        <Switch
          value={simulateConnected}
          onValueChange={onToggle}
          trackColor={{ true: '#34C759', false: '#3A3A3A' }}
          thumbColor="#FFFFFF"
          disabled={isSyncing}
        />
      </View>

      <View style={styles.queueStats}>
        <Text style={styles.queueStatText}>Pending: {queueStats.pending}</Text>
        <Text style={styles.queueStatText}>Total: {queueStats.total}</Text>
      </View>

      {syncLog.length > 0 && (
        <View style={styles.syncLog}>
          {syncLog.map((line, i) => (
            <Text key={i} style={styles.syncLogLine}>
              {line}
            </Text>
          ))}
          <TouchableOpacity onPress={onClearLog}>
            <Text style={styles.clearLogText}>Clear log</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#111111',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
  },
  cameraWrapper: {
    height: 320,
    position: 'relative',
    overflow: 'hidden',
  },
  challengeOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingBottom: 16,
    alignItems: 'center',
  },
  challengeCard: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  challengeInstruction: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  challengeStepRow: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555555',
  },
  challengeStepDotDone: {
    backgroundColor: '#34C759',
  },
  challengeStepDotActive: {
    backgroundColor: '#FFFFFF',
  },
  phaseOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  phaseCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  phaseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#111111',
  },
  startButton: {
    backgroundColor: '#34C759',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#333333',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  outcomeCard: {
    margin: 16,
    marginTop: 32,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  outcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconSuccess: { backgroundColor: '#34C759' },
  iconFail: { backgroundColor: '#FF3B30' },
  iconSpoof: { backgroundColor: '#FF9500' },
  outcomeIconText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  outcomeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  outcomeDetail: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  workerId: {
    color: '#34C759',
    fontSize: 13,
    marginBottom: 4,
  },
  recordId: {
    color: '#555555',
    fontSize: 11,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
  },
  syncPanel: {
    margin: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  syncTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    opacity: 0.6,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  syncSub: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2,
  },
  queueStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  queueStatText: {
    color: '#888888',
    fontSize: 13,
  },
  syncLog: {
    marginTop: 8,
    backgroundColor: '#111111',
    borderRadius: 8,
    padding: 12,
  },
  syncLogLine: {
    color: '#34C759',
    fontSize: 12,
    fontFamily: 'Courier New',
    marginBottom: 2,
  },
  clearLogText: {
    color: '#555555',
    fontSize: 12,
    marginTop: 6,
  },
});
