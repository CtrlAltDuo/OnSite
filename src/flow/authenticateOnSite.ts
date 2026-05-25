import { FaceSignals, MatchResult } from '../onsite/coreTypes';
import { verifyAgainstAllEnrolled } from '../verification/verifyIdentity';
import { deriveEmbeddingFromCrop } from '../recognition/embeddingModel';
import { runPassiveLiveness, buildActiveChallengeRunner } from '../liveness/livenessGate';
import { LivenessConfig, LivenessResult, ChallengeStep, DEFAULT_LIVENESS_CONFIG } from '../liveness/challengeTypes';
import { buildVerificationRecord } from '../record/verificationRecord';
import { signVerificationRecord } from '../record/recordSigner';
import { enqueueRecord } from '../record/recordQueue';

export type AuthOutcome =
  | 'spoof_rejected'
  | 'challenge_failed'
  | 'identity_mismatch'
  | 'success';

export interface StageLatencies {
  detectionMs: number;
  passiveLivenessMs: number;
  activeChallengeMs: number;
  embeddingMs: number;
  matchMs: number;
  totalMs: number;
}

export interface AuthResult {
  outcome: AuthOutcome;
  livenessResult: LivenessResult | null;
  matchResult: MatchResult | null;
  recordId: string | null;
  latencies: StageLatencies;
}

export interface AuthFrame {
  pixels: number[];
  width: number;
  height: number;
  signals: FaceSignals;
  alignedCrop: number[];
}

export interface ActiveChallengeHandle {
  steps: ChallengeStep[];
  feedSignals: (signals: FaceSignals) => { stepCompleted: boolean; allDone: boolean };
  finish: () => LivenessResult;
  passiveScore: number;
}

export function beginAuthentication(
  frame: AuthFrame,
  passiveScore: number,
  config: LivenessConfig = DEFAULT_LIVENESS_CONFIG,
): ActiveChallengeHandle {
  const runner = buildActiveChallengeRunner(config);
  const startTime = Date.now();

  return {
    steps: runner.steps,
    passiveScore,
    feedSignals: runner.feedSignals,
    finish: (): LivenessResult => {
      const challengeResult = runner.getResult(startTime);
      return {
        passed: challengeResult.passed,
        passiveScore,
        challengeResult,
        failReason: challengeResult.passed ? null : 'challengeFailed',
      };
    },
  };
}

export async function runPassiveCheck(
  frame: AuthFrame,
  config: LivenessConfig = DEFAULT_LIVENESS_CONFIG,
): Promise<{ score: number; passed: boolean; latencyMs: number }> {
  const t0 = Date.now();
  const result = await runPassiveLiveness(
    frame.pixels,
    frame.width,
    frame.height,
    frame.signals.boundingBox,
    config,
  );
  return { ...result, latencyMs: Date.now() - t0 };
}

export async function completeAuthentication(
  frame: AuthFrame,
  livenessResult: LivenessResult,
  deviceId: string,
  detectionMs: number,
  passiveLivenessMs: number,
  activeChallengeMs: number,
  gpsCoords: { lat: number; lon: number } | null = null,
): Promise<AuthResult> {
  const totalStart = Date.now();

  const embeddingStart = Date.now();
  await deriveEmbeddingFromCrop(frame.alignedCrop);
  const embeddingMs = Date.now() - embeddingStart;

  const matchStart = Date.now();
  const matchResult = await verifyAgainstAllEnrolled(frame.alignedCrop);
  const matchMs = Date.now() - matchStart;

  const totalMs = detectionMs + passiveLivenessMs + activeChallengeMs + embeddingMs + matchMs;

  const latencies: StageLatencies = {
    detectionMs,
    passiveLivenessMs,
    activeChallengeMs,
    embeddingMs,
    matchMs,
    totalMs,
  };

  if (!matchResult.matched) {
    return {
      outcome: 'identity_mismatch',
      livenessResult,
      matchResult,
      recordId: null,
      latencies,
    };
  }

  const record = buildVerificationRecord(
    matchResult.workerId ?? 'unknown',
    deviceId,
    livenessResult,
    matchResult,
    gpsCoords,
  );

  const signed = await signVerificationRecord(record);
  await enqueueRecord(signed);

  return {
    outcome: 'success',
    livenessResult,
    matchResult,
    recordId: record.id,
    latencies,
  };
}
