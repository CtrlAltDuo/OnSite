import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { PhotoFile } from 'react-native-vision-camera';
import CameraScreen from '../camera/CameraScreen';
import { FaceSignals } from '../onsite/coreTypes';
import { enrolFaceForWorker } from '../enrolment/enrolFace';
import { alignFaceFromLandmarks } from '../recognition/alignFace';
import RNFS from 'react-native-fs';

type EnrolScreenProps = {
  navigation?: any;
};

export default function EnrolScreen({ navigation }: EnrolScreenProps) {
  const [workerId, setWorkerId] = useState('');
  const [currentFaces, setCurrentFaces] = useState<FaceSignals[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [captureRequested, setCaptureRequested] = useState(false);
  const [enrolledSuccess, setEnrolledSuccess] = useState(false);

  const handleFacesDetected = useCallback((faces: FaceSignals[]) => {
    setCurrentFaces(faces);
  }, []);

  const handlePhotoCaptured = useCallback(
    async (photo: PhotoFile) => {
      if (!workerId.trim()) {
        Alert.alert('Error', 'Please enter a Worker ID');
        return;
      }

      if (currentFaces.length === 0) {
        Alert.alert('Error', 'No face detected. Please try again.');
        return;
      }

      setIsEnrolling(true);

      try {
        const photoPath = photo.path;
        const imageData = await RNFS.readFile(photoPath, 'base64');
        const binaryString = atob(imageData);
        const pixels: number[] = [];
        for (let i = 0; i < binaryString.length; i++) {
          pixels.push(binaryString.charCodeAt(i));
        }

        const face = currentFaces[0];
        const estimatedWidth = Math.round(face.signals?.boundingBox?.width || 640);
        const estimatedHeight = Math.round(face.signals?.boundingBox?.height || 480);

        const rgbPixels: number[] = [];
        const pixelCount = estimatedWidth * estimatedHeight;
        for (let i = 0; i < pixelCount; i++) {
          const idx = i * 4;
          rgbPixels.push(pixels[idx] || 0);
          rgbPixels.push(pixels[idx + 1] || 0);
          rgbPixels.push(pixels[idx + 2] || 0);
        }

        const aligned = alignFaceFromLandmarks(
          rgbPixels,
          estimatedWidth,
          estimatedHeight,
          face.landmarks,
        );

        await enrolFaceForWorker(workerId.trim(), aligned.pixels);
        setEnrolledSuccess(true);
        setShowCamera(false);
      } catch (error) {
        Alert.alert('Enrolment Failed', 'Could not enrol face. Please try again.');
      } finally {
        setIsEnrolling(false);
      }
    },
    [workerId, currentFaces],
  );

  const handleCaptureComplete = useCallback(() => {
    setCaptureRequested(false);
  }, []);

  const handleCapture = useCallback(() => {
    if (!workerId.trim()) {
      Alert.alert('Error', 'Please enter a Worker ID');
      return;
    }
    if (currentFaces.length === 0) {
      Alert.alert('Error', 'No face detected');
      return;
    }
    setCaptureRequested(true);
  }, [workerId, currentFaces]);

  const handleReset = useCallback(() => {
    setWorkerId('');
    setShowCamera(true);
    setEnrolledSuccess(false);
    setCurrentFaces([]);
  }, []);

  if (enrolledSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Enrolled Successfully</Text>
        <Text style={styles.successSubtitle}>
          Worker {workerId} has been enrolled
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
          <Text style={styles.primaryButtonText}>Enrol Another</Text>
        </TouchableOpacity>
        {navigation && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Verify')}>
            <Text style={styles.secondaryButtonText}>Go to Verification</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Worker ID</Text>
        <TextInput
          style={styles.input}
          value={workerId}
          onChangeText={setWorkerId}
          placeholder="Enter worker ID"
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {showCamera && (
        <View style={styles.cameraContainer}>
          <CameraScreen
            onFacesDetected={handleFacesDetected}
            onPhotoCaptured={handlePhotoCaptured}
            captureRequested={captureRequested}
            onCaptureComplete={handleCaptureComplete}
          />
        </View>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            (!workerId.trim() || currentFaces.length === 0 || isEnrolling) &&
              styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={
            !workerId.trim() || currentFaces.length === 0 || isEnrolling
          }>
          <Text style={styles.captureButtonText}>
            {isEnrolling ? 'Enrolling...' : 'Capture & Enrol'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#111111',
  },
  label: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cameraContainer: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    backgroundColor: '#111111',
  },
  captureButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#333333',
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  successSubtitle: {
    color: '#AAAAAA',
    fontSize: 14,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4A90D9',
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '600',
  },
});
