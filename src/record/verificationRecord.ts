import { MatchResult } from '../onsite/coreTypes';
import { LivenessResult } from '../liveness/challengeTypes';

export interface VerificationRecord {
  id: string;
  workerId: string;
  deviceId: string;
  timestamp: number;
  livenessScore: number;
  similarity: number;
  matched: boolean;
  gpsCoords: { lat: number; lon: number } | null;
  syncStatus: 'pending' | 'synced';
}

function generateRecordId(workerId: string, timestamp: number): string {
  const raw = `${workerId}-${timestamp}-${Math.random().toString(36).slice(2)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `rec_${Math.abs(hash).toString(16)}_${timestamp.toString(36)}`;
}

export function buildVerificationRecord(
  workerId: string,
  deviceId: string,
  livenessResult: LivenessResult,
  matchResult: MatchResult,
  gpsCoords: { lat: number; lon: number } | null,
): VerificationRecord {
  const timestamp = Date.now();

  return {
    id: generateRecordId(workerId, timestamp),
    workerId,
    deviceId,
    timestamp,
    livenessScore: livenessResult.passiveScore,
    similarity: matchResult.similarity,
    matched: matchResult.matched,
    gpsCoords,
    syncStatus: 'pending',
  };
}
