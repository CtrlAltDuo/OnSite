import { cropForPassiveLiveness, PASSIVE_MODEL_INPUT_SIZE } from '../../src/liveness/passiveCrop';

function makeRgbFrame(w: number, h: number, fill = 128): number[] {
  return new Array(w * h * 3).fill(fill);
}

describe('cropForPassiveLiveness', () => {
  it('returns a buffer of exactly 80x80x3 bytes', () => {
    const frame = makeRgbFrame(640, 480);
    const crop = cropForPassiveLiveness(frame, 640, 480, { x: 200, y: 100, width: 100, height: 100 });
    expect(crop.length).toBe(PASSIVE_MODEL_INPUT_SIZE * PASSIVE_MODEL_INPUT_SIZE * 3);
  });

  it('returns zeros for a degenerate zero-size bounding box', () => {
    const frame = makeRgbFrame(100, 100);
    const crop = cropForPassiveLiveness(frame, 100, 100, { x: 50, y: 50, width: 0, height: 0 });
    expect(crop.every(v => v === 0)).toBe(true);
  });

  it('clamps a bounding box that extends beyond the frame edges', () => {
    const frame = makeRgbFrame(100, 100, 255);
    const crop = cropForPassiveLiveness(frame, 100, 100, { x: 90, y: 90, width: 20, height: 20 });
    expect(crop.length).toBe(PASSIVE_MODEL_INPUT_SIZE * PASSIVE_MODEL_INPUT_SIZE * 3);
  });

  it('preserves pixel values when the face is a solid-colour patch', () => {
    const frame = makeRgbFrame(640, 480, 200);
    const crop = cropForPassiveLiveness(frame, 640, 480, { x: 100, y: 100, width: 80, height: 80 });
    expect(crop.every(v => v === 200)).toBe(true);
  });
});
