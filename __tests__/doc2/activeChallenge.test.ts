import { createChallengeRunner } from '../../src/liveness/activeChallenge';
import { DEFAULT_LIVENESS_CONFIG, LivenessConfig } from '../../src/liveness/challengeTypes';
import { FaceSignals } from '../../src/onsite/coreTypes';

function makeSignals(overrides: Partial<FaceSignals> = {}): FaceSignals {
  return {
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    landmarks: {
      leftEye: { x: 30, y: 40 },
      rightEye: { x: 70, y: 40 },
      noseTip: { x: 50, y: 60 },
      leftMouth: { x: 35, y: 80 },
      rightMouth: { x: 65, y: 80 },
    },
    leftEyeOpenProbability: 0.95,
    rightEyeOpenProbability: 0.95,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    ...overrides,
  };
}

const config: LivenessConfig = {
  ...DEFAULT_LIVENESS_CONFIG,
  challengeStepCount: 2,
  challengeTimeoutMs: 5000,
  headYawThresholdDeg: 20,
  eyeOpenDropThreshold: 0.3,
  eyeOpenRecoverThreshold: 0.7,
};

describe('createChallengeRunner', () => {
  it('returns exactly the configured number of steps', () => {
    const runner = createChallengeRunner({ ...config, challengeStepCount: 2 });
    expect(runner.steps.length).toBe(2);
  });

  it('steps are valid ChallengeStep values', () => {
    const valid = new Set(['blink', 'turnLeft', 'turnRight']);
    const runner = createChallengeRunner(config);
    runner.steps.forEach(s => expect(valid.has(s)).toBe(true));
  });

  it('allDone is false before any steps complete', () => {
    const runner = createChallengeRunner(config);
    const result = runner.feedSignals(makeSignals());
    expect(result.allDone).toBe(false);
  });

  it('detects a blink: eyes close then re-open', () => {
    const randomSpy = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9)
      .mockReturnValue(0.5);

    const runner = createChallengeRunner({ ...config, challengeStepCount: 1 });
    randomSpy.mockRestore();

    if (runner.steps[0] !== 'blink') {
      return;
    }

    const open1 = runner.feedSignals(makeSignals({ leftEyeOpenProbability: 0.9, rightEyeOpenProbability: 0.9 }));
    expect(open1.allDone).toBe(false);
    const closed = runner.feedSignals(makeSignals({ leftEyeOpenProbability: 0.1, rightEyeOpenProbability: 0.1 }));
    expect(closed.allDone).toBe(false);
    const reopen = runner.feedSignals(makeSignals({ leftEyeOpenProbability: 0.95, rightEyeOpenProbability: 0.95 }));
    expect(reopen.allDone).toBe(true);
  });

  it('detects a left turn when yaw crosses threshold', () => {
    const runner = createForcedTurnRunner('turnLeft', config);
    const neutral = runner.feedSignals(makeSignals({ headYaw: 0 }));
    expect(neutral.allDone).toBe(false);
    const turned = runner.feedSignals(makeSignals({ headYaw: -25 }));
    expect(turned.allDone).toBe(true);
  });

  it('detects a right turn when yaw crosses threshold', () => {
    const runner = createForcedTurnRunner('turnRight', config);
    const neutral = runner.feedSignals(makeSignals({ headYaw: 0 }));
    expect(neutral.allDone).toBe(false);
    const turned = runner.feedSignals(makeSignals({ headYaw: 25 }));
    expect(turned.allDone).toBe(true);
  });

  it('getResult reports failure when not all steps are complete', () => {
    const runner = createChallengeRunner(config);
    const result = runner.getResult(Date.now() - 100);
    expect(result.passed).toBe(false);
  });
});

function createForcedBlinkRunner(cfg: LivenessConfig) {
  const { createChallengeRunner: make } = require('../../src/liveness/activeChallenge');
  let runner: ReturnType<typeof make> | null = null;
  for (let i = 0; i < 20; i++) {
    const r = make({ ...cfg, challengeStepCount: 1 });
    if (r.steps[0] === 'blink') {
      runner = r;
      break;
    }
  }
  if (!runner) {
    runner = make({ ...cfg, challengeStepCount: 1 });
    (runner as any)._steps = ['blink'];
  }
  return runner!;
}

function createForcedTurnRunner(dir: 'turnLeft' | 'turnRight', cfg: LivenessConfig) {
  const { createChallengeRunner: make } = require('../../src/liveness/activeChallenge');
  for (let i = 0; i < 30; i++) {
    const r = make({ ...cfg, challengeStepCount: 1 });
    if (r.steps[0] === dir) {
      return r;
    }
  }
  throw new Error(`Could not get a runner with step ${dir} in 30 tries`);
}
