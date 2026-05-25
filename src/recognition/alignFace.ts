import { ALIGNED_FACE_SIZE, Landmarks } from '../onsite/coreTypes';

function computeSimilarityTransform(
  srcPoints: number[][],
  dstPoints: number[][],
): number[] {
  const n = srcPoints.length;
  let srcMeanX = 0;
  let srcMeanY = 0;
  let dstMeanX = 0;
  let dstMeanY = 0;

  for (let i = 0; i < n; i++) {
    srcMeanX += srcPoints[i][0];
    srcMeanY += srcPoints[i][1];
    dstMeanX += dstPoints[i][0];
    dstMeanY += dstPoints[i][1];
  }

  srcMeanX /= n;
  srcMeanY /= n;
  dstMeanX /= n;
  dstMeanY /= n;

  let srcVarX = 0;
  let srcVarY = 0;
  let cov00 = 0;
  let cov01 = 0;
  let cov10 = 0;
  let cov11 = 0;

  for (let i = 0; i < n; i++) {
    const sx = srcPoints[i][0] - srcMeanX;
    const sy = srcPoints[i][1] - srcMeanY;
    const dx = dstPoints[i][0] - dstMeanX;
    const dy = dstPoints[i][1] - dstMeanY;

    srcVarX += sx * sx;
    srcVarY += sy * sy;
    cov00 += dx * sx;
    cov01 += dx * sy;
    cov10 += dy * sx;
    cov11 += dy * sy;
  }

  const srcVar = srcVarX + srcVarY;
  const a = (cov00 + cov11) / srcVar;
  const b = (cov10 - cov01) / srcVar;
  const tx = dstMeanX - a * srcMeanX - b * srcMeanY;
  const ty = dstMeanY + b * srcMeanX - a * srcMeanY;

  return [a, b, tx, -b, a, ty];
}

function getReferenceLandmarks(): number[][] {
  const size = ALIGNED_FACE_SIZE;
  return [
    [0.34191607 * size, 0.46157411 * size],
    [0.65653393 * size, 0.45983393 * size],
    [0.50022500 * size, 0.64050536 * size],
    [0.37097589 * size, 0.82469196 * size],
    [0.63151696 * size, 0.82325089 * size],
  ];
}

function applyAffineTransform(
  sourcePixels: number[],
  sourceWidth: number,
  sourceHeight: number,
  transform: number[],
  outputSize: number,
): number[] {
  const output = new Array(outputSize * outputSize * 3).fill(0);
  const [a, b, tx, d, e, ty] = transform;

  const det = a * e - b * d;
  const invA = e / det;
  const invB = -b / det;
  const invD = -d / det;
  const invE = a / det;
  const invTx = -(invA * tx + invB * ty);
  const invTy = -(invD * tx + invE * ty);

  for (let y = 0; y < outputSize; y++) {
    for (let x = 0; x < outputSize; x++) {
      const srcX = invA * x + invB * y + invTx;
      const srcY = invD * x + invE * y + invTy;

      const sx = Math.floor(srcX);
      const sy = Math.floor(srcY);

      if (sx >= 0 && sx < sourceWidth - 1 && sy >= 0 && sy < sourceHeight - 1) {
        const fx = srcX - sx;
        const fy = srcY - sy;

        for (let c = 0; c < 3; c++) {
          const topLeft = sourcePixels[(sy * sourceWidth + sx) * 3 + c];
          const topRight = sourcePixels[(sy * sourceWidth + sx + 1) * 3 + c];
          const bottomLeft = sourcePixels[((sy + 1) * sourceWidth + sx) * 3 + c];
          const bottomRight = sourcePixels[((sy + 1) * sourceWidth + sx + 1) * 3 + c];

          const top = topLeft + fx * (topRight - topLeft);
          const bottom = bottomLeft + fx * (bottomRight - bottomLeft);
          const value = top + fy * (bottom - top);

          output[(y * outputSize + x) * 3 + c] = Math.round(value);
        }
      }
    }
  }

  return output;
}

export function alignFaceFromLandmarks(
  framePixels: number[],
  frameWidth: number,
  frameHeight: number,
  landmarks: Landmarks,
): { pixels: number[]; width: number; height: number } {
  const sourcePoints = [
    [landmarks.leftEye.x, landmarks.leftEye.y],
    [landmarks.rightEye.x, landmarks.rightEye.y],
    [landmarks.noseTip.x, landmarks.noseTip.y],
    [landmarks.leftMouth.x, landmarks.leftMouth.y],
    [landmarks.rightMouth.x, landmarks.rightMouth.y],
  ];

  const referencePoints = getReferenceLandmarks();
  const transform = computeSimilarityTransform(sourcePoints, referencePoints);

  const alignedPixels = applyAffineTransform(
    framePixels,
    frameWidth,
    frameHeight,
    transform,
    ALIGNED_FACE_SIZE,
  );

  return {
    pixels: alignedPixels,
    width: ALIGNED_FACE_SIZE,
    height: ALIGNED_FACE_SIZE,
  };
}
