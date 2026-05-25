import { buildVerificationRecord } from '../../src/record/verificationRecord';
import { LivenessResult } from '../../src/liveness/challengeTypes';
import { MatchResult } from '../../src/onsite/coreTypes';

const livenessResult: LivenessResult = {
  passed: true,
  passiveScore: 0.85,
  challengeResult: {
    passed: true,
    completedSteps: ['blink', 'turnRight'],
    elapsedMs: 3200,
    failReason: null,
  },
  failReason: null,
};

const matchResult: MatchResult = {
  matched: true,
  similarity: 0.76,
  threshold: 0.4,
  workerId: 'worker-42',
};

describe('buildVerificationRecord', () => {
  it('includes all required fields', () => {
    const rec = buildVerificationRecord('worker-42', 'device-001', livenessResult, matchResult, null);
    expect(rec.workerId).toBe('worker-42');
    expect(rec.deviceId).toBe('device-001');
    expect(rec.livenessScore).toBeCloseTo(0.85);
    expect(rec.similarity).toBeCloseTo(0.76);
    expect(rec.matched).toBe(true);
    expect(rec.gpsCoords).toBeNull();
    expect(rec.syncStatus).toBe('pending');
  });

  it('generates a non-empty id string', () => {
    const rec = buildVerificationRecord('w1', 'dev1', livenessResult, matchResult, null);
    expect(typeof rec.id).toBe('string');
    expect(rec.id.length).toBeGreaterThan(0);
  });

  it('generates unique ids for successive calls', () => {
    const r1 = buildVerificationRecord('w1', 'dev1', livenessResult, matchResult, null);
    const r2 = buildVerificationRecord('w1', 'dev1', livenessResult, matchResult, null);
    expect(r1.id).not.toBe(r2.id);
  });

  it('stores gps coords when provided', () => {
    const rec = buildVerificationRecord('w1', 'dev1', livenessResult, matchResult, { lat: 28.6, lon: 77.2 });
    expect(rec.gpsCoords).toEqual({ lat: 28.6, lon: 77.2 });
  });

  it('sets a timestamp close to Date.now()', () => {
    const before = Date.now();
    const rec = buildVerificationRecord('w1', 'dev1', livenessResult, matchResult, null);
    const after = Date.now();
    expect(rec.timestamp).toBeGreaterThanOrEqual(before);
    expect(rec.timestamp).toBeLessThanOrEqual(after);
  });
});
