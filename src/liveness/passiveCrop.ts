import { Rect } from '../onsite/coreTypes';

const PASSIVE_MODEL_INPUT_SIZE = 80;
const PASSIVE_CROP_MARGIN_MULTIPLIER = 2.7;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function cropForPassiveLiveness(
  framePixels: number[],
  frameWidth: number,
  frameHeight: number,
  boundingBox: Rect,
): number[] {
  const cx = boundingBox.x + boundingBox.width / 2;
  const cy = boundingBox.y + boundingBox.height / 2;
  const halfSide = (Math.max(boundingBox.width, boundingBox.height) * PASSIVE_CROP_MARGIN_MULTIPLIER) / 2;

  const x0 = clamp(Math.round(cx - halfSide), 0, frameWidth - 1);
  const y0 = clamp(Math.round(cy - halfSide), 0, frameHeight - 1);
  const x1 = clamp(Math.round(cx + halfSide), 0, frameWidth - 1);
  const y1 = clamp(Math.round(cy + halfSide), 0, frameHeight - 1);

  const cropW = x1 - x0;
  const cropH = y1 - y0;

  if (cropW <= 0 || cropH <= 0) {
    return new Array(PASSIVE_MODEL_INPUT_SIZE * PASSIVE_MODEL_INPUT_SIZE * 3).fill(0);
  }

  const out = new Array(PASSIVE_MODEL_INPUT_SIZE * PASSIVE_MODEL_INPUT_SIZE * 3).fill(0);
  const scaleX = cropW / PASSIVE_MODEL_INPUT_SIZE;
  const scaleY = cropH / PASSIVE_MODEL_INPUT_SIZE;

  for (let py = 0; py < PASSIVE_MODEL_INPUT_SIZE; py++) {
    for (let px = 0; px < PASSIVE_MODEL_INPUT_SIZE; px++) {
      const srcX = clamp(Math.round(x0 + px * scaleX), 0, frameWidth - 1);
      const srcY = clamp(Math.round(y0 + py * scaleY), 0, frameHeight - 1);
      const srcIdx = (srcY * frameWidth + srcX) * 3;
      const dstIdx = (py * PASSIVE_MODEL_INPUT_SIZE + px) * 3;
      out[dstIdx] = framePixels[srcIdx] ?? 0;
      out[dstIdx + 1] = framePixels[srcIdx + 1] ?? 0;
      out[dstIdx + 2] = framePixels[srcIdx + 2] ?? 0;
    }
  }

  return out;
}

export { PASSIVE_MODEL_INPUT_SIZE };
