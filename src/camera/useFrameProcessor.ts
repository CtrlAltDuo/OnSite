import { useCallback } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { Frame } from 'react-native-vision-camera';
import { FaceSignals } from '../onsite/coreTypes';
import { detectFacesFromMLKit } from '../detection/faceDetector';
import { RawDetectedFace } from '../detection/types';

type FaceDetectionCallback = (faces: FaceSignals[]) => void;

export function useOnSiteFrameProcessor(onFacesDetected: FaceDetectionCallback) {
  const handleDetectedFaces = useCallback(
    (rawFaces: RawDetectedFace[]) => {
      const signals = detectFacesFromMLKit(rawFaces);
      onFacesDetected(signals);
    },
    [onFacesDetected],
  );

  const frameProcessor = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        const scanFaces = (global as any).__scanFaces;
        if (scanFaces) {
          const rawFaces = scanFaces(frame) as RawDetectedFace[];
          if (rawFaces && rawFaces.length > 0) {
            runOnJS(handleDetectedFaces)(rawFaces);
          }
        }
      } catch (_error) {
      }
    },
    [handleDetectedFaces],
  );

  return frameProcessor;
}
