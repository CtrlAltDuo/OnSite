import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { PhotoFile } from 'react-native-vision-camera';
import CameraScreen from '../camera/CameraScreen';
import { FaceSignals, MatchResult } from '../onsite/coreTypes';
import { verifyAgainstAllEnrolled } from '../verification/verifyIdentity';
import { alignFaceFromLandmarks } from '../recognition/alignFace';
import RNFS from 'react-native-fs';

type VerifyScreenProps = {
  navigation?: any;
};

export default function VerifyScreen({ navigation }: VerifyScreenProps) {
  const [currentFaces, setCurrentFaces] = useState<FaceSignals[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [captureRequested, setCaptureRequested] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const handleFacesDetected = useCallback((faces: FaceSignals[]) => {
    setCurrentFaces(faces);
  }, []);

  const handlePhotoCaptured = useCallback(
    async (photo: PhotoFile) => {
      if (currentFaces.length === 0) {
        Alert.alert('Error', 'No face detected. Please try again.');
        return;
      }

      setIsVerifying(true);

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

        const result = await verifyAgainstAllEnrolled(aligned.pixels);
        setMatchResult(result);
      } catch (error) {
        Alert.alert('Verification Failed', 'Could not verify face. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    },
    [currentFaces],
  );

  const handleCaptureComplete = useCallback(() => {
    setCaptureRequested(false);
  }, []);

  const handleVerify = useCallback(() => {
    if (currentFaces.length === 0) {
      Alert.alert('Error', 'No face detected');
      return;
    }
    setMatchResult(null);
    setCaptureRequested(true);
  }, [currentFaces]);

  const handleRetry = useCallback(() => {
    setMatchResult(null);
    setCurrentFaces([]);
  }, []);

  if (matchResult) {
    const isMatch = matchResult.matched;

    return (
      <View style={styles.resultContainer}>
        <View
          style={[
            styles.resultIcon,
            isMatch ? styles.matchIcon : styles.noMatchIcon,
          ]}>
          <Text style={styles.resultIconText}>{isMatch ? '✓' : '✗'}</Text>
        </View>
        <Text style={styles.resultTitle}>
          {isMatch ? 'Identity Verified' : 'No Match Found'}
        </Text>
        <View style={styles.resultDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Similarity</Text>
            <Text style={styles.detailValue}>
              {(matchResult.similarity * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Threshold</Text>
            <Text style={styles.detailValue}>
              {(matchResult.threshold * 100).toFixed(1)}%
            </Text>
          </View>
          {matchResult.workerId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Worker ID</Text>
              <Text style={styles.detailValue}>{matchResult.workerId}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRetry}>
          <Text style={styles.primaryButtonText}>Verify Again</Text>
        </TouchableOpacity>
        {navigation && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Enrol')}>
            <Text style={styles.secondaryButtonText}>Go to Enrolment</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Verify Identity</Text>
        <Text style={styles.headerSubtitle}>
          {currentFaces.length > 0
            ? 'Face detected — ready to verify'
            : 'Position your face in the camera'}
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraScreen
          onFacesDetected={handleFacesDetected}
          onPhotoCaptured={handlePhotoCaptured}
          captureRequested={captureRequested}
          onCaptureComplete={handleCaptureComplete}
        />
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.verifyButton,
            (currentFaces.length === 0 || isVerifying) &&
              styles.verifyButtonDisabled,
          ]}
          onPress={handleVerify}
          disabled={currentFaces.length === 0 || isVerifying}>
          <Text style={styles.verifyButtonText}>
            {isVerifying ? 'Verifying...' : 'Verify'}
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
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#111111',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#AAAAAA',
    fontSize: 13,
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
  verifyButton: {
    backgroundColor: '#34C759',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#333333',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  matchIcon: {
    backgroundColor: '#34C759',
  },
  noMatchIcon: {
    backgroundColor: '#FF3B30',
  },
  resultIconText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  resultDetails: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#34C759',
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
    borderColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
  },
});
