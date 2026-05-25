import { uploadRecord, SyncClientConfig } from '../../src/sync/syncClient';
import { SignedRecord } from '../../src/record/recordSigner';

function makeSignedRecord(id: string): SignedRecord {
  return {
    record: {
      id,
      workerId: 'w1',
      deviceId: 'dev1',
      timestamp: 1700000000000,
      livenessScore: 0.9,
      similarity: 0.8,
      matched: true,
      gpsCoords: null,
      syncStatus: 'pending',
    },
    signature: 'abc',
    deviceKeyId: 'dev001',
  };
}

const testConfig: SyncClientConfig = {
  endpointUrl: 'https://mock.example.com/v1/records',
  timeoutMs: 5000,
};

describe('syncClient', () => {
  beforeEach(() => {
    (global as any).fetch = undefined;
  });

  it('returns success=false and no statusCode when fetch throws (network error)', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));
    const result = await uploadRecord(makeSignedRecord('r1'), testConfig);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.errorMessage).toContain('Network unreachable');
  });

  it('returns success=true for a 200 response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 200, ok: true });
    const result = await uploadRecord(makeSignedRecord('r1'), testConfig);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.errorMessage).toBeNull();
  });

  it('returns success=false for a 409 response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 409, ok: false });
    const result = await uploadRecord(makeSignedRecord('r1'), testConfig);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(409);
  });

  it('returns success=false for a 500 response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 500, ok: false });
    const result = await uploadRecord(makeSignedRecord('r1'), testConfig);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it('includes the record id in the PUT URL', async () => {
    let capturedUrl = '';
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { status: 200, ok: true };
    });
    await uploadRecord(makeSignedRecord('my-record-id'), testConfig);
    expect(capturedUrl).toContain('my-record-id');
  });

  it('sets the Idempotency-Key header to the record id', async () => {
    let capturedHeaders: Record<string, string> = {};
    (global as any).fetch = jest.fn().mockImplementation(async (_url: string, init: any) => {
      capturedHeaders = init?.headers ?? {};
      return { status: 200, ok: true };
    });
    await uploadRecord(makeSignedRecord('idem-id'), testConfig);
    expect(capturedHeaders['Idempotency-Key']).toBe('idem-id');
  });
});
