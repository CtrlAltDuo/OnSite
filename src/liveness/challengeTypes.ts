export type ChallengeStep = 'blink' | 'turnLeft' | 'turnRight';

export interface ChallengeResult {
  passed: boolean;
  completedSteps: ChallengeStep[];
  elapsedMs: number;
  failReason: 'timeout' | 'wrongOrder' | null;
}

export interface LivenessConfig {
  passiveThreshold: number;
  challengeTimeoutMs: number;
  challengeStepCount: number;
  headYawThresholdDeg: number;
  eyeOpenDropThreshold: number;
  eyeOpenRecoverThreshold: number;
}

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  passiveThreshold: 0.6,
  challengeTimeoutMs: 8000,
  challengeStepCount: 2,
  headYawThresholdDeg: 20,
  eyeOpenDropThreshold: 0.3,
  eyeOpenRecoverThreshold: 0.7,
};

export interface LivenessResult {
  passed: boolean;
  passiveScore: number;
  challengeResult: ChallengeResult | null;
  failReason: 'passiveFailed' | 'challengeFailed' | null;
}
