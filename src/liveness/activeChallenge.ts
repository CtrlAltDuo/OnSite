import { FaceSignals } from '../onsite/coreTypes';
import { ChallengeStep, ChallengeResult, LivenessConfig } from './challengeTypes';

const ALL_STEPS: ChallengeStep[] = ['blink', 'turnLeft', 'turnRight'];

function pickRandomSteps(count: number): ChallengeStep[] {
  const shuffled = [...ALL_STEPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

type EyeState = 'open' | 'closing' | 'closed' | 'done';

interface BlinkTracker {
  state: EyeState;
}

interface TurnTracker {
  achieved: boolean;
}

function initBlinkTracker(): BlinkTracker {
  return { state: 'open' };
}

function updateBlinkTracker(
  tracker: BlinkTracker,
  signals: FaceSignals,
  config: LivenessConfig,
): boolean {
  const avgOpen = (signals.leftEyeOpenProbability + signals.rightEyeOpenProbability) / 2;

  if (tracker.state === 'open' && avgOpen < config.eyeOpenDropThreshold) {
    tracker.state = 'closing';
  } else if (tracker.state === 'closing' && avgOpen < config.eyeOpenDropThreshold) {
    tracker.state = 'closed';
  } else if (tracker.state === 'closed' && avgOpen > config.eyeOpenRecoverThreshold) {
    tracker.state = 'done';
    return true;
  }

  return false;
}

function initTurnTracker(): TurnTracker {
  return { achieved: false };
}

function updateTurnTracker(
  tracker: TurnTracker,
  signals: FaceSignals,
  direction: 'turnLeft' | 'turnRight',
  config: LivenessConfig,
): boolean {
  if (tracker.achieved) {
    return true;
  }

  const yaw = signals.headYaw;
  const threshold = config.headYawThresholdDeg;

  if (direction === 'turnLeft' && yaw < -threshold) {
    tracker.achieved = true;
    return true;
  }

  if (direction === 'turnRight' && yaw > threshold) {
    tracker.achieved = true;
    return true;
  }

  return false;
}

export function createChallengeRunner(config: LivenessConfig): {
  steps: ChallengeStep[];
  feedSignals: (signals: FaceSignals) => { stepCompleted: boolean; allDone: boolean };
  getResult: (startTime: number) => ChallengeResult;
} {
  const steps = pickRandomSteps(config.challengeStepCount);
  let currentStepIndex = 0;
  const completedSteps: ChallengeStep[] = [];

  let blinkTracker: BlinkTracker | null = null;
  let turnTracker: TurnTracker | null = null;

  function initCurrentStep(): void {
    const step = steps[currentStepIndex];
    if (step === 'blink') {
      blinkTracker = initBlinkTracker();
      turnTracker = null;
    } else {
      turnTracker = initTurnTracker();
      blinkTracker = null;
    }
  }

  initCurrentStep();

  function feedSignals(signals: FaceSignals): { stepCompleted: boolean; allDone: boolean } {
    if (currentStepIndex >= steps.length) {
      return { stepCompleted: false, allDone: true };
    }

    const step = steps[currentStepIndex];
    let stepDone = false;

    if (step === 'blink' && blinkTracker) {
      stepDone = updateBlinkTracker(blinkTracker, signals, config);
    } else if ((step === 'turnLeft' || step === 'turnRight') && turnTracker) {
      stepDone = updateTurnTracker(turnTracker, signals, step, config);
    }

    if (stepDone) {
      completedSteps.push(step);
      currentStepIndex++;
      if (currentStepIndex < steps.length) {
        initCurrentStep();
      }
    }

    const allDone = currentStepIndex >= steps.length;
    return { stepCompleted: stepDone, allDone };
  }

  function getResult(startTime: number): ChallengeResult {
    const elapsed = Date.now() - startTime;
    const allCompleted = currentStepIndex >= steps.length;

    return {
      passed: allCompleted,
      completedSteps,
      elapsedMs: elapsed,
      failReason: allCompleted ? null : elapsed >= config.challengeTimeoutMs ? 'timeout' : 'wrongOrder',
    };
  }

  return { steps, feedSignals, getResult };
}
