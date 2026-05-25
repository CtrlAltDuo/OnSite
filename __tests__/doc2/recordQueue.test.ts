import {
  enqueueRecord,
  listPendingRecords,
  listAllRecords,
  markRecordSynced,
  removeRecord,
  clearSyncedRecords,
} from '../../src/record/recordQueue';
import { SignedRecord } from '../../src/record/recordSigner';

jest.mock('react-native-fs', () => {
  let store: Record<string, string> = {};
  return {
    DocumentDirectoryPath: '/mock/docs',
    exists: jest.fn(async (path: string) => path in store),
    mkdir: jest.fn(async () => {}),
    readFile: jest.fn(async (path: string) => store[path] ?? ''),
    writeFile: jest.fn(async (path: string, data: string) => { store[path] = data; }),
    __reset: () => { store = {}; },
  };
});

jest.mock('../../src/storage/secureKey', () => ({
  getOrCreateEncryptionKey: jest.fn().mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
}));

function makeSignedRecord(id: string, syncStatus: 'pending' | 'synced' = 'pending'): SignedRecord {
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
      syncStatus,
    },
    signature: 'abc123',
    deviceKeyId: 'dev001',
  };
}

beforeEach(() => {
  const RNFS = require('react-native-fs');
  RNFS.__reset();
});

describe('recordQueue', () => {
  it('listAllRecords returns empty array when queue is empty', async () => {
    const all = await listAllRecords();
    expect(all).toEqual([]);
  });

  it('enqueueRecord adds a record retrievable by listAllRecords', async () => {
    await enqueueRecord(makeSignedRecord('r1'));
    const all = await listAllRecords();
    expect(all.length).toBe(1);
    expect(all[0].record.id).toBe('r1');
  });

  it('listPendingRecords only returns pending records', async () => {
    await enqueueRecord(makeSignedRecord('r1'));
    await enqueueRecord(makeSignedRecord('r2'));
    await markRecordSynced('r1');
    const pending = await listPendingRecords();
    expect(pending.length).toBe(1);
    expect(pending[0].record.id).toBe('r2');
  });

  it('markRecordSynced changes syncStatus to synced', async () => {
    await enqueueRecord(makeSignedRecord('r1'));
    await markRecordSynced('r1');
    const all = await listAllRecords();
    expect(all[0].record.syncStatus).toBe('synced');
  });

  it('removeRecord deletes a record by id', async () => {
    await enqueueRecord(makeSignedRecord('r1'));
    await enqueueRecord(makeSignedRecord('r2'));
    await removeRecord('r1');
    const all = await listAllRecords();
    expect(all.length).toBe(1);
    expect(all[0].record.id).toBe('r2');
  });

  it('clearSyncedRecords removes only synced records', async () => {
    await enqueueRecord(makeSignedRecord('r1'));
    await enqueueRecord(makeSignedRecord('r2'));
    await markRecordSynced('r1');
    await clearSyncedRecords();
    const all = await listAllRecords();
    expect(all.length).toBe(1);
    expect(all[0].record.id).toBe('r2');
  });

  it('preserves signature and deviceKeyId through enqueue/read cycle', async () => {
    const signed = makeSignedRecord('r1');
    signed.signature = 'unique-sig-xyz';
    signed.deviceKeyId = 'key-abc';
    await enqueueRecord(signed);
    const [retrieved] = await listAllRecords();
    expect(retrieved.signature).toBe('unique-sig-xyz');
    expect(retrieved.deviceKeyId).toBe('key-abc');
  });
});
