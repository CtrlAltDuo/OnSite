import { useCallback, useEffect } from 'react';
import { Frame } from 'react-native-vision-camera';
import { FaceSignals } from '../onsite/coreTypes';

export function useOnSiteFrameProcessor(onFacesDetected: (faces: FaceSignals[]) => void) {
  useEffect(() => {
    // For the hackathon MVP, we simulate a face in the center of the camera view
    // so the verification button is enabled immediately and extracts the center crop.
    const interval = setInterval(() => {
      onFacesDetected([
        {
          boundingBox: { x: 200, y: 300, width: 400, height: 400 },
          landmarks: {
            leftEye: { x: 280, y: 400 },
            rightEye: { x: 520, y: 400 },
            noseBase: { x: 400, y: 500 },
          },
          pitch: 0,
          yaw: 0,
          roll: 0,
        },
      ]);
    }, 500);

    return () => clearInterval(interval);
  }, [onFacesDetected]);

  return useCallback((_frame: Frame) => {
    'worklet';
  }, []);
}

