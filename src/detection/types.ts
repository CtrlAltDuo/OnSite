export type { Rect, Point, Landmarks, FaceSignals } from '../onsite/coreTypes';

export interface RawDetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: Array<{ x: number; y: number }>;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  headEulerAngleY: number;
  headEulerAngleX: number;
  headEulerAngleZ: number;
}
