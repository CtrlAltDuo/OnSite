import { FaceSignals, Landmarks } from '../onsite/coreTypes';
import { RawDetectedFace } from './types';

function extractLandmarks(rawLandmarks: Array<{ x: number; y: number }>): Landmarks {
  return {
    leftEye: rawLandmarks[0] || { x: 0, y: 0 },
    rightEye: rawLandmarks[1] || { x: 0, y: 0 },
    noseTip: rawLandmarks[2] || { x: 0, y: 0 },
    leftMouth: rawLandmarks[3] || { x: 0, y: 0 },
    rightMouth: rawLandmarks[4] || { x: 0, y: 0 },
  };
}

function rawFaceToSignals(rawFace: RawDetectedFace): FaceSignals {
  return {
    boundingBox: {
      x: rawFace.boundingBox.x,
      y: rawFace.boundingBox.y,
      width: rawFace.boundingBox.width,
      height: rawFace.boundingBox.height,
    },
    landmarks: extractLandmarks(rawFace.landmarks),
    leftEyeOpenProbability: rawFace.leftEyeOpenProbability ?? -1,
    rightEyeOpenProbability: rawFace.rightEyeOpenProbability ?? -1,
    headYaw: rawFace.headEulerAngleY ?? 0,
    headPitch: rawFace.headEulerAngleX ?? 0,
    headRoll: rawFace.headEulerAngleZ ?? 0,
  };
}

export function detectFacesFromMLKit(rawFaces: RawDetectedFace[]): FaceSignals[] {
  return rawFaces.map(rawFaceToSignals);
}
