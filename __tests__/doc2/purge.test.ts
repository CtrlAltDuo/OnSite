import { purgeSyncedRecords, listPurgeTargets } from '../../src/sync/purge';

jest.mock('react-native-fs', () => {
  let store: Record<string, string> = {};
  return {
    DocumentDirectoryPath: '/mock/docs',
    exists: jest.fn(async (path: string) => path in store),
    mkdir: jest.fn(async () => {}),
    readFile: jest.fn(async (path: string) => store[path] ?? ''),
    writeFile: jest.fn(async (path: string, data: string) => { store[path] = data; }),
    unlink: jest.fn(async (path: string) => { delete store[path]; }),
    readDir: jest.fn(async () => []),
    __store: store,
    __reset: () => { store = {}; },
  };
});

jest.mock('../../src/storage/secureKey', () => ({
  getOrCreateEncryptionKey: jest.fn().mockResolvedValue('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
}));

const { enqueueRecord } = require('../../src/record/recordQueue');
const { markRecordSynced } = require('../../src/record/recordQueue');

function makeSigned(id: string) {
  return {
    record: {
      id,
      workerId: `worker-${id}`,
      deviceId: 'dev1',
      timestamp: Date.now(),
      livenessScore: 0.9,
      similarity: 0.8,
      matched: true,
      gpsCoords: null,
      syncStatus: 'pending' as const,
    },
    signature: 'sig',
    deviceKeyId: 'kid',
  };
}

beforeEach(() => {
  require('react-native-fs').__reset();
});

describe('purge', () => {
  it('listPurgeTargets returns targets for all records in the queue', async () => {
    await enqueueRecord(makeSigned('a'));
    await enqueueRecord(makeSigned('b'));
    const targets = await listPurgeTargets();
    expect(targets.length).toBe(2);
    expect(targets.map(t => t.recordId).sort()).toEqual(['a', 'b']);
  });

  it('purgeSyncedRecords removes only synced records', async () => {
    await enqueueRecord(makeSigned('p1'));
    await enqueueRecord(makeSigned('p2'));
    await markRecordSynced('p1');
    const result = await purgeSyncedRecords();
    expect(result.purgedRecordIds).toContain('p1');
    expect(result.purgedRecordIds).not.toContain('p2');
    expect(result.skippedPendingCount).toBe(1);
  });

  it('purgeSyncedRecords returns zero purged when nothing is synced', async () => {
    await enqueueRecord(makeSigned('q1'));
    const result = await purgeSyncedRecords();
    expect(result.purgedRecordIds.length).toBe(0);
    expect(result.skippedPendingCount).toBe(1);
  });

  it('does not delete biometric template for a worker that still has pending records', async () => {
    const RNFS = require('react-native-fs');
    await enqueueRecord(makeSigned('s1'));
    await enqueueRecord({ ...makeSigned('s2'), record: { ...makeSigned('s2').record, workerId: 'worker-s1' } });
    await markRecordSynced('s1');
    const result = await purgeSyncedRecords();
    expect(result.purgedWorkerTemplates).not.toContain('worker-s1');
    expect(RNFS.unlink).not.toHaveBeenCalledWith(expect.stringContaining('worker-s1'));
  });
});
