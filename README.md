# OnSite

Offline facial recognition and liveness detection for field-worker attendance in zero-network zones. On-device, cross-platform, spoof-resistant.

## Overview

OnSite is an offline, on-device facial recognition module for React Native. It verifies that a real, live field worker is physically present at a remote, zero-network location, then queues a tamper-evident record to sync when connectivity returns.

Target platforms: Android 8.0+ and iOS 12+. Mid-range hardware (3 GB RAM, no GPU).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   OnSiteCore API                 │
│  detectFaces · deriveEmbedding · enrolWorker     │
│  verifyAgainstEnrolled · hasEnrolledTemplate     │
├──────────┬──────────┬──────────┬────────────────┤
│  Camera  │Detection │Recognition│   Storage     │
│  Pipeline│(ML Kit)  │(ONNX SFace)│ (Encrypted)  │
└──────────┴──────────┴──────────┴────────────────┘
```

## Public API Surface

### Types

```typescript
type FaceSignals = {
  boundingBox: Rect;
  landmarks: Landmarks;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
};

type DetectedFace = {
  signals: FaceSignals;
  alignedCrop: number[];
  cropWidth: number;
  cropHeight: number;
};

type MatchResult = {
  matched: boolean;
  similarity: number;
  threshold: number;
  workerId: string | null;
};
```

### OnSiteCore Interface

```typescript
interface OnSiteCore {
  detectFaces(rawFaces: RawDetectedFace[]): DetectedFace[];
  deriveEmbedding(alignedPixels: number[]): Promise<Float32Array>;
  enrolWorker(workerId: string, alignedPixels: number[]): Promise<void>;
  verifyAgainstEnrolled(alignedPixels: number[]): Promise<MatchResult>;
  hasEnrolledTemplate(workerId: string): Promise<boolean>;
}
```

### Usage

```typescript
import { OnSiteCore } from './src/onsite/OnSiteCore';

const enrolled = await OnSiteCore.hasEnrolledTemplate('worker-001');

await OnSiteCore.enrolWorker('worker-001', alignedPixels);

const result = await OnSiteCore.verifyAgainstEnrolled(alignedPixels);
if (result.matched) {
  console.log(`Verified: ${result.workerId} (${result.similarity})`);
}
```

## Project Structure

```
src/
  camera/
    CameraScreen.tsx          Front-camera preview with frame processor
    useFrameProcessor.ts      ML Kit face detection on camera frames
  detection/
    faceDetector.ts           ML Kit wrapper returning typed FaceSignals
    types.ts                  DetectedFace, Landmarks, FaceSignals, RawDetectedFace
  recognition/
    alignFace.ts              5-point similarity warp to 112×112 aligned crop
    embeddingModel.ts         ONNX Runtime inference producing 512-d embedding
    matcher.ts                Cosine similarity and match threshold logic
  enrolment/
    enrolFace.ts              Capture → embedding → encrypted store
    enrolmentStore.ts         Read/write encrypted templates
  storage/
    secureKey.ts              Platform keystore/keychain key management
    encryptedStore.ts         Encrypt/decrypt templates at rest
  verification/
    verifyIdentity.ts         Live capture → embedding → match result
  onsite/
    OnSiteCore.ts             Public API surface
    coreTypes.ts              Shared types and constants
  screens/
    EnrolScreen.tsx           Enrol a worker face under an ID
    VerifyScreen.tsx          Verify a live face against enrolled templates
  App.tsx                     Navigation root
assets/
  models/
    sface_int8.onnx           SFace recognition model (~36 MB)
tools/
  convert_model.py            Regenerate/quantise the ONNX model
  README.md                   Model regeneration instructions
```

## Technology Stack

| Concern | Choice |
|---|---|
| Framework | React Native 0.85 (New Architecture) |
| Camera | react-native-vision-camera with frame processors |
| Face Detection | ML Kit via vision-camera plugin |
| Neural Inference | onnxruntime-react-native |
| Recognition Model | OpenCV SFace (MobileFaceNet) |
| Secure Storage | react-native-keychain (Android Keystore / iOS Keychain) |
| Navigation | React Navigation (Native Stack) |

## Setup

```bash
npm install

# iOS
cd ios && bundle install && bundle exec pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

## Offline Operation

The entire enrolment and verification pipeline operates offline:
- Face detection uses on-device ML Kit (no network)
- Recognition model runs locally via ONNX Runtime
- Templates are stored encrypted on the device filesystem
- Encryption key lives in platform keystore/keychain

No network calls are made during enrolment or verification.

## Model

The recognition model is OpenCV SFace (MobileFaceNet trained with SFace loss).

- Input: `[1, 3, 112, 112]` (NCHW, float32, 0-1 normalised)
- Output: `[1, 512]` (L2-normalised embedding)
- Comparison: Cosine similarity with configurable threshold (default: 0.4)

See `tools/README.md` for regeneration instructions.

## License

Apache-2.0. See [LICENSE](LICENSE).
