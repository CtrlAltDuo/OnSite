import { signVerificationRecord, verifyRecordSignature, SignedRecord } from '../../src/record/recordSigner';
import { VerificationRecord } from '../../src/record/verificationRecord';

jest.mock('../../src/storage/secureKey', () => ({
  getOrCreateEncryptionKey: jest.fn().mockResolvedValue('deadbeefdeadbeefdeadbeefdeadbeef'),
}));

const baseRecord: VerificationRecord = {
  id: 'rec_abc123_xyz',
  workerId: 'worker-1',
  deviceId: 'device-001',
  timestamp: 1700000000000,
  livenessScore: 0.9,
  similarity: 0.8,
  matched: true,
  gpsCoords: null,
  syncStatus: 'pending',
};

describe('recordSigner', () => {
  it('produces a non-empty signature string', async () => {
    const signed = await signVerificationRecord(baseRecord);
    expect(typeof signed.signature).toBe('string');
    expect(signed.signature.length).toBeGreaterThan(0);
  });

  it('includes a deviceKeyId', async () => {
    const signed = await signVerificationRecord(baseRecord);
    expect(typeof signed.deviceKeyId).toBe('string');
    expect(signed.deviceKeyId.length).toBeGreaterThan(0);
  });

  it('produces the same signature for the same input', async () => {
    const s1 = await signVerificationRecord(baseRecord);
    const s2 = await signVerificationRecord(baseRecord);
    expect(s1.signature).toBe(s2.signature);
  });

  it('produces a different signature when a field changes', async () => {
    const s1 = await signVerificationRecord(baseRecord);
    const tampered: VerificationRecord = { ...baseRecord, similarity: 0.99 };
    const s2 = await signVerificationRecord(tampered);
    expect(s1.signature).not.toBe(s2.signature);
  });

  it('verifyRecordSignature returns true for a valid signed record', async () => {
    const signed = await signVerificationRecord(baseRecord);
    const valid = verifyRecordSignature(signed, 'deadbeefdeadbeefdeadbeefdeadbeef');
    expect(valid).toBe(true);
  });

  it('verifyRecordSignature returns false when record is tampered', async () => {
    const signed = await signVerificationRecord(baseRecord);
    const tampered: SignedRecord = {
      ...signed,
      record: { ...signed.record, similarity: 0.1 },
    };
    const valid = verifyRecordSignature(tampered, 'deadbeefdeadbeefdeadbeefdeadbeef');
    expect(valid).toBe(false);
  });

  it('verifyRecordSignature returns false with wrong key', async () => {
    const signed = await signVerificationRecord(baseRecord);
    const valid = verifyRecordSignature(signed, 'ffffffffffffffffffffffffffffffff');
    expect(valid).toBe(false);
  });
});
