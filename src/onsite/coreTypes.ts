export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Landmarks {
  leftEye: Point;
  rightEye: Point;
  noseTip: Point;
  leftMouth: Point;
  rightMouth: Point;
}

export interface FaceSignals {
  boundingBox: Rect;
  landmarks: Landmarks;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
}

export interface DetectedFace {
  signals: FaceSignals;
  alignedCrop: number[];
  cropWidth: number;
  cropHeight: number;
}

export interface MatchResult {
  matched: boolean;
  similarity: number;
  threshold: number;
  workerId: string | null;
}

export const DEFAULT_MATCH_THRESHOLD = 0.4;

export const EMBEDDING_DIMENSION = 512;

export const ALIGNED_FACE_SIZE = 112;
