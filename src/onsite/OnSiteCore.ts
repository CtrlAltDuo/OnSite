import {
  FaceSignals,
  DetectedFace,
  MatchResult,
  DEFAULT_MATCH_THRESHOLD,
  Landmarks,
} from './coreTypes';
import { detectFacesFromMLKit } from '../detection/faceDetector';
import { alignFaceFromLandmarks } from '../recognition/alignFace';
import { deriveEmbeddingFromCrop } from '../recognition/embeddingModel';
import { enrolFaceForWorker } from '../enrolment/enrolFace';
import {
  verifyAgainstAllEnrolled,
  verifyAgainstEnrolledWorker,
} from '../verification/verifyIdentity';
import { hasStoredTemplate } from '../storage/encryptedStore';
import { RawDetectedFace } from '../detection/types';

export interface OnSiteCoreInterface {
  detectFaces(rawFaces: RawDetectedFace[]): DetectedFace[];
  deriveEmbedding(alignedPixels: number[]): Promise<Float32Array>;
  enrolWorker(workerId: string, alignedPixels: number[]): Promise<void>;
  verifyAgainstEnrolled(alignedPixels: number[]): Promise<MatchResult>;
  hasEnrolledTemplate(workerId: string): Promise<boolean>;
}

function detectFacesWithAlignment(
  rawFaces: RawDetectedFace[],
  framePixels?: number[],
  frameWidth?: number,
  frameHeight?: number,
): DetectedFace[] {
  const signals = detectFacesFromMLKit(rawFaces);

  return signals.map(signal => {
    let alignedCrop: number[] = [];
    let cropWidth = 0;
    let cropHeight = 0;

    if (framePixels && frameWidth && frameHeight) {
      const aligned = alignFaceFromLandmarks(
        framePixels,
        frameWidth,
        frameHeight,
        signal.landmarks,
      );
      alignedCrop = aligned.pixels;
      cropWidth = aligned.width;
      cropHeight = aligned.height;
    }

    return {
      signals: signal,
      alignedCrop,
      cropWidth,
      cropHeight,
    };
  });
}

async function deriveEmbeddingFromAlignedCrop(
  alignedPixels: number[],
): Promise<Float32Array> {
  return deriveEmbeddingFromCrop(alignedPixels);
}

async function enrolWorkerWithCrop(
  workerId: string,
  alignedPixels: number[],
): Promise<void> {
  return enrolFaceForWorker(workerId, alignedPixels);
}

async function verifyAgainstEnrolledTemplates(
  alignedPixels: number[],
): Promise<MatchResult> {
  return verifyAgainstAllEnrolled(alignedPixels, DEFAULT_MATCH_THRESHOLD);
}

async function checkHasEnrolledTemplate(workerId: string): Promise<boolean> {
  return hasStoredTemplate(workerId);
}

export const OnSiteCore: OnSiteCoreInterface = {
  detectFaces: (rawFaces: RawDetectedFace[]) =>
    detectFacesWithAlignment(rawFaces),
  deriveEmbedding: deriveEmbeddingFromAlignedCrop,
  enrolWorker: enrolWorkerWithCrop,
  verifyAgainstEnrolled: verifyAgainstEnrolledTemplates,
  hasEnrolledTemplate: checkHasEnrolledTemplate,
};

export {
  detectFacesWithAlignment,
  deriveEmbeddingFromAlignedCrop,
  enrolWorkerWithCrop,
  verifyAgainstEnrolledTemplates,
  verifyAgainstEnrolledWorker,
  checkHasEnrolledTemplate,
};

export type {
  FaceSignals,
  DetectedFace,
  MatchResult,
  Landmarks,
} from './coreTypes';

export {
  DEFAULT_MATCH_THRESHOLD,
  EMBEDDING_DIMENSION,
  ALIGNED_FACE_SIZE,
} from './coreTypes';
