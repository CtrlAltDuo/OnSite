# OnSite

Offline facial recognition and two-layer liveness detection for field-worker attendance in zero-network zones. On-device, cross-platform, spoof-resistant.

## Overview

OnSite verifies that a real, live field worker is physically present at a remote, zero-network location, then queues a tamper-evident signed record to sync when connectivity returns. Enrolment, verification, passive liveness, and active challenge all run offline. The network is used only by the background sync task.

Target platforms: Android 8.0+ and iOS 12+. Mid-range hardware (3 GB RAM, no GPU).

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    authenticateOnSite flow                    │
│  1. detectFaces   2. passiveLiveness   3. activeChallenge     │
│  4. deriveEmbedding   5. verifyAgainstEnrolled               │
│  6. sign + enqueue record                                    │
├─────────────┬────────────┬───────────────┬───────────────────┤
│  OnSiteCore │  Liveness  │    Record     │      Sync         │
│  (Doc 1)    │  (Doc 2)   │  (Doc 2)      │  (Doc 2)          │
└─────────────┴────────────┴───────────────┴───────────────────┘
```

## Public API Surface — OnSiteCore (Document 1)

```typescript
interface OnSiteCore {
  detectFaces(rawFaces: RawDetectedFace[]): DetectedFace[];
  deriveEmbedding(alignedPixels: number[]): Promise<Float32Array>;
  enrolWorker(workerId: string, alignedPixels: number[]): Promise<void>;
  verifyAgainstEnrolled(alignedPixels: number[]): Promise<MatchResult>;
  hasEnrolledTemplate(workerId: string): Promise<boolean>;
}
```

## Liveness — Two Layers (Document 2)

### Layer A — Passive (silent)

MiniFASNet (Apache-2.0, ~1.7 MB int8) inspects the surface of an 80×80 crop taken at 2.7× margin around the face box. Detects print and replay spoofs from texture and backlight artefacts. Returns `livenessScore = 1 − (p_print + p_replay)`. Threshold is configurable.

### Layer B — Active (challenge-response)

Randomised blink + head-turn sequence driven by the foundation's `FaceSignals`. A fixed sequence is replayable; random order + a timeout defeats pre-recorded attacks. Step count, timeout, and thresholds are all configurable.

## Project Structure

```
src/
  liveness/
    passiveLiveness.ts         MiniFASNet ONNX wrapper → livenessScore
    passiveCrop.ts             80×80, 2.7×-margin crop
    activeChallenge.ts         randomised blink/turn sequence + timeout
    challengeTypes.ts          ChallengeStep, ChallengeResult, LivenessConfig
    livenessGate.ts            orchestrates passive then active
  record/
    verificationRecord.ts      build the record object
    recordSigner.ts            sign with device key (tamper-evident)
    recordQueue.ts             encrypted local queue (enqueue/list/markSynced)
  sync/
    syncClient.ts              idempotent PUT upload (stub endpoint)
    syncScheduler.ts           background flush on connectivity, never blocks auth
    purge.ts                   confirm-then-delete raw biometric material
  flow/
    authenticateOnSite.ts      full orchestrated flow
  screens/
    OnSiteScreen.tsx           demo screen: challenge UI + live metrics
    MetricsPanel.tsx           per-stage + total latency, model-size readout
    EnrolScreen.tsx            enrol a worker face under an ID
    VerifyScreen.tsx           basic verification screen (Document 1)
  camera/
    CameraScreen.tsx           front-camera preview with frame processor
    useFrameProcessor.ts       ML Kit face detection on camera frames
  detection/
    faceDetector.ts            ML Kit wrapper returning typed FaceSignals
    types.ts                   DetectedFace, Landmarks, FaceSignals
  recognition/
    alignFace.ts               5-point similarity warp to 112×112 aligned crop
    embeddingModel.ts          ONNX Runtime → 512-d embedding
    matcher.ts                 cosine similarity + match threshold
  enrolment/
    enrolFace.ts               capture → embedding → encrypted store
  storage/
    secureKey.ts               platform keystore/keychain key management
    encryptedStore.ts          encrypt/decrypt templates at rest
  onsite/
    OnSiteCore.ts              public API surface (Document 1)
    coreTypes.ts               shared types and constants
  App.tsx                      navigation root
assets/
  models/
    sface_int8.onnx            SFace recognition model (~36 MB, Document 1)
    minifasnet_int8.onnx       MiniFASNet passive liveness (~1.7 MB, Document 2)
tools/
  convert_model.py             regenerate SFace ONNX
  convert_minifasnet.py        regenerate MiniFASNet ONNX (Apache-2.0 weights required)
```

## Technology Stack

| Concern | Choice | Licence |
|---|---|---|
| Framework | React Native 0.85 (New Architecture) | MIT |
| Camera | react-native-vision-camera | MIT |
| Face Detection | ML Kit via vision-camera plugin | Apache-2.0 |
| Neural Inference | onnxruntime-react-native | MIT |
| Recognition Model | OpenCV SFace (MobileFaceNet) | Apache-2.0 |
| Passive Liveness Model | MiniFASNetV1SE (Silent-Face-Anti-Spoofing) | Apache-2.0 |
| Secure Storage | react-native-keychain | MIT |
| Navigation | React Navigation (Native Stack) | MIT |
| Connectivity | @react-native-community/netinfo | MIT |

## Liveness Configuration

All thresholds are configurable via `LivenessConfig`. No values are buried inline.

```typescript
const config: LivenessConfig = {
  passiveThreshold: 0.6,        // reject if passive score < this
  challengeTimeoutMs: 8000,     // active challenge must complete within this
  challengeStepCount: 2,        // how many random steps to issue
  headYawThresholdDeg: 20,      // degrees yaw for a valid head turn
  eyeOpenDropThreshold: 0.3,    // eye-open prob below which = eye closed
  eyeOpenRecoverThreshold: 0.7, // eye-open prob above which = eye re-opened
};
```

## Authentication Flow

```
1. detectFaces(frame)           → exactly one clear face required
2. passiveLiveness(80×80 crop) → reject if livenessScore < threshold
3. activeChallenge              → randomised blink → turn, timed
4. deriveEmbedding(alignedCrop)
5. verifyAgainstEnrolled
6. build + sign verificationRecord → enqueue encrypted
── later, off the auth path ──
7. syncScheduler flushes queue on reconnect (idempotent PUT)
8. on server ack → purgeSyncedRecords (confirm-then-delete)
```

## Verification Records

Each successful authentication produces a signed, encrypted record:

```typescript
interface VerificationRecord {
  id: string;           // stable unique ID for idempotent uploads
  workerId: string;
  deviceId: string;
  timestamp: number;
  livenessScore: number;
  similarity: number;
  matched: boolean;
  gpsCoords: { lat: number; lon: number } | null;
  syncStatus: 'pending' | 'synced';
}
```

Records are signed with the device key from the keystore. Tamper detection: any field change produces a different signature.

## Models

| Model | Input | Output | Size |
|---|---|---|---|
| SFace (recognition) | `[1,3,112,112]` NCHW float32 | `[1,512]` L2-norm embedding | ~36 MB |
| MiniFASNetV1SE (liveness) | `[1,3,80,80]` NCHW float32 | `[1,3]` softmax logits | ~1.7 MB |

Combined on-device model footprint: **~37.7 MB** (well under the 20 MB target for the liveness model alone; the recognition model is the foundation's).

## Setup & Customization Guide

### 1. Build and Run the App
Because OnSite relies on native hardware camera APIs, **it cannot be run on a simulator**. You must deploy to a physical device.

```bash
# 1. Install Node dependencies
npm install

# 2. iOS Setup (macOS only)
cd ios
bundle install
bundle exec pod install
cd ..
npx react-native run-ios --device

# 3. Android Setup
npx react-native run-android
```

### 2. Where to Edit What (Hackathon Customizations)
To adapt OnSite for your specific hackathon use case, you may want to modify the following files:

- **AWS Sync Endpoint:** 
  - **File:** `src/sync/syncClient.ts`
  - **Action:** Find `const STUB_ENDPOINT_URL` and replace the dummy URL with your real AWS API Gateway or backend endpoint.

- **Liveness Thresholds & Active Challenges:**
  - **File:** `src/liveness/challengeTypes.ts` / `livenessGate.ts`
  - **Action:** Adjust parameters like `passiveThreshold` (default 0.6), `challengeTimeoutMs` (default 8000), or `challengeStepCount` to make anti-spoofing stricter or more relaxed.

- **Similarity Match Threshold:**
  - **File:** `src/recognition/matcher.ts`
  - **Action:** Adjust the cosine similarity threshold to make the facial recognition stricter.

- **UI & Branding Colors:**
  - **Files:** `src/screens/OnSiteScreen.tsx`, `EnrolScreen.tsx`, `VerifyScreen.tsx`
  - **Action:** Modify the React Native `StyleSheet` objects at the bottom of these files to match your project's brand identity.

## Regenerating the Passive Liveness Model

```bash
# Clone the Apache-2.0 weights source
git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing tools/Silent-Face-Anti-Spoofing

pip install torch torchvision onnx onnxruntime
python3 tools/convert_minifasnet.py
```

See `tools/convert_minifasnet.py` for checkpoint placement instructions.

## Offline Operation

The entire pipeline — enrolment, verification, liveness, record signing, queueing — operates with zero network. Network is used only by `syncScheduler`, which:
- Never blocks authentication
- Uploads idempotently (PUT keyed by record ID)
- Marks records synced only after server acknowledgement
- Purges biometric material only after sync confirmation (confirm-then-delete)

> **Note on AWS Sync:** The cloud sync client currently points to a dummy placeholder URL (`https://onsite-stub.example.com`) to demonstrate the "scope for sync" requirement. To sync with your real AWS backend, simply replace the `STUB_ENDPOINT_URL` in `src/sync/syncClient.ts` with your actual API Gateway or S3 endpoint and provide your API keys.

## Licence Ledger

| Component | Licence |
|---|---|
| OnSite app code | Apache-2.0 |
| OpenCV SFace model | Apache-2.0 |
| MiniFASNetV1SE model | Apache-2.0 (Silent-Face-Anti-Spoofing project) |
| All runtime dependencies | MIT or Apache-2.0 (see table above) |

See [LICENSE](LICENSE).

