import { getOrCreateEncryptionKey } from '../storage/secureKey';
import { VerificationRecord } from './verificationRecord';

function hmacLike(payload: string, key: string): string {
  let h = 0x811c9dc5;
  const combined = key + payload;
  for (let i = 0; i < combined.length; i++) {
    h ^= combined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h.toString(16).padStart(8, '0');
}

function stableStringify(record: VerificationRecord): string {
  const keys = Object.keys(record).sort() as (keyof VerificationRecord)[];
  const parts = keys
    .filter(k => (k as string) !== 'signature')
    .map(k => `${k}:${JSON.stringify(record[k])}`);
  return parts.join('|');
}

export interface SignedRecord {
  record: VerificationRecord;
  signature: string;
  deviceKeyId: string;
}

export async function signVerificationRecord(record: VerificationRecord): Promise<SignedRecord> {
  const key = await getOrCreateEncryptionKey();
  const payload = stableStringify(record);
  const signature = hmacLike(payload, key);
  const deviceKeyId = hmacLike(key, 'device-id-derivation').slice(0, 8);

  return {
    record,
    signature,
    deviceKeyId,
  };
}

export function verifyRecordSignature(signed: SignedRecord, key: string): boolean {
  const payload = stableStringify(signed.record);
  const expected = hmacLike(payload, key);
  return expected === signed.signature;
}
