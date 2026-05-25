import { SignedRecord } from '../record/recordSigner';

const STUB_ENDPOINT_URL = 'https://onsite-stub.example.com/v1/verification-records';
const UPLOAD_TIMEOUT_MS = 10000;

export interface SyncUploadResult {
  recordId: string;
  success: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

export interface SyncClientConfig {
  endpointUrl: string;
  timeoutMs: number;
}

const defaultConfig: SyncClientConfig = {
  endpointUrl: STUB_ENDPOINT_URL,
  timeoutMs: UPLOAD_TIMEOUT_MS,
};

function buildPayload(signed: SignedRecord): string {
  return JSON.stringify({
    recordId: signed.record.id,
    workerId: signed.record.workerId,
    deviceId: signed.record.deviceId,
    timestamp: signed.record.timestamp,
    livenessScore: signed.record.livenessScore,
    similarity: signed.record.similarity,
    matched: signed.record.matched,
    gpsCoords: signed.record.gpsCoords,
    signature: signed.signature,
    deviceKeyId: signed.deviceKeyId,
  });
}

export async function uploadRecord(
  signed: SignedRecord,
  config: SyncClientConfig = defaultConfig,
): Promise<SyncUploadResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.endpointUrl}/${signed.record.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': signed.record.id,
      },
      body: buildPayload(signed),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      recordId: signed.record.id,
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      errorMessage: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === 'AbortError';
    return {
      recordId: signed.record.id,
      success: false,
      statusCode: null,
      errorMessage: isAbort ? 'Upload timed out' : String(err?.message ?? 'Network error'),
    };
  }
}

export async function uploadRecords(
  records: SignedRecord[],
  config: SyncClientConfig = defaultConfig,
): Promise<SyncUploadResult[]> {
  const results: SyncUploadResult[] = [];
  for (const record of records) {
    const result = await uploadRecord(record, config);
    results.push(result);
  }
  return results;
}
