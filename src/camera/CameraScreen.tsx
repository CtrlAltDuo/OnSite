import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  PhotoFile,
} from 'react-native-vision-camera';
import { FaceSignals } from '../onsite/coreTypes';
import { useOnSiteFrameProcessor } from './useFrameProcessor';

interface CameraScreenProps {
  onFacesDetected?: (faces: FaceSignals[]) => void;
  onPhotoCaptured?: (photo: PhotoFile) => void;
  captureRequested?: boolean;
  onCaptureComplete?: () => void;
}

export default function CameraScreen({
  onFacesDetected,
  onPhotoCaptured,
  captureRequested,
  onCaptureComplete,
}: CameraScreenProps) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const [latestFaces, setLatestFaces] = useState<FaceSignals[]>([]);

  const handleFacesDetected = useCallback(
    (faces: FaceSignals[]) => {
      setLatestFaces(faces);
      if (onFacesDetected) {
        onFacesDetected(faces);
      }
    },
    [onFacesDetected],
  );

  const frameProcessor = useOnSiteFrameProcessor(handleFacesDetected);

  useEffect(() => {
    if (!hasPermission && !permissionRequested) {
      setPermissionRequested(true);
      requestPermission();
    }
  }, [hasPermission, permissionRequested, requestPermission]);

  useEffect(() => {
    if (captureRequested && cameraRef.current) {
      cameraRef.current
        .takePhoto({ flash: 'off' })
        .then(photo => {
          if (onPhotoCaptured) {
            onPhotoCaptured(photo);
          }
          if (onCaptureComplete) {
            onCaptureComplete();
          }
        })
        .catch(() => {
          if (onCaptureComplete) {
            onCaptureComplete();
          }
        });
    }
  }, [captureRequested, onPhotoCaptured, onCaptureComplete]);

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionText}>Camera permission required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  const hasFace = latestFaces.length > 0;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
      />
      <View style={styles.overlay}>
        <View
          style={[
            styles.faceGuide,
            hasFace ? styles.faceGuideDetected : styles.faceGuideSearching,
          ]}
        />
        <Text style={styles.statusText}>
          {hasFace ? 'Face detected' : 'Position your face in the circle'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 320,
    borderRadius: 125,
    borderWidth: 3,
  },
  faceGuideDetected: {
    borderColor: '#34C759',
  },
  faceGuideSearching: {
    borderColor: '#FFFFFF80',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textShadowColor: '#00000080',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
