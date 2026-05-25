import { FaceSignals } from '../onsite/coreTypes';
import { LivenessConfig, LivenessResult, DEFAULT_LIVENESS_CONFIG } from './challengeTypes';
import { computePassiveLivenessScore } from './passiveLiveness';
import { cropForPassiveLiveness } from './passiveCrop';
import { createChallengeRunner } from './activeChallenge';
import { Rect } from '../onsite/coreTypes';

export async function runPassiveLiveness(
  framePixels: number[],
  frameWidth: number,
  frameHeight: number,
  boundingBox: Rect,
  config: LivenessConfig = DEFAULT_LIVENESS_CONFIG,
): Promise<{ score: number; passed: boolean }> {
  const crop = cropForPassiveLiveness(framePixels, frameWidth, frameHeight, boundingBox);
  const score = await computePassiveLivenessScore(crop);
  return { score, passed: score >= config.passiveThreshold };
}

export function buildActiveChallengeRunner(config: LivenessConfig = DEFAULT_LIVENESS_CONFIG) {
  return createChallengeRunner(config);
}

export async function runFullLivenessGate(
  framePixels: number[],
  frameWidth: number,
  frameHeight: number,
  boundingBox: Rect,
  signalStream: FaceSignals[],
  config: LivenessConfig = DEFAULT_LIVENESS_CONFIG,
): Promise<LivenessResult> {
  const passiveResult = await runPassiveLiveness(
    framePixels,
    frameWidth,
    frameHeight,
    boundingBox,
    config,
  );

  if (!passiveResult.passed) {
    return {
      passed: false,
      passiveScore: passiveResult.score,
      challengeResult: null,
      failReason: 'passiveFailed',
    };
  }

  const runner = createChallengeRunner(config);
  const startTime = Date.now();

  let challengeResult = runner.getResult(startTime);

  for (const signals of signalStream) {
    if (Date.now() - startTime >= config.challengeTimeoutMs) {
      break;
    }
    const { allDone } = runner.feedSignals(signals);
    if (allDone) {
      break;
    }
  }

  challengeResult = runner.getResult(startTime);

  return {
    passed: challengeResult.passed,
    passiveScore: passiveResult.score,
    challengeResult,
    failReason: challengeResult.passed ? null : 'challengeFailed',
  };
}

export { DEFAULT_LIVENESS_CONFIG };
export type { LivenessConfig, LivenessResult };
