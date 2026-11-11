// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { countSent, meterJoined, meterOpened, meterSnapshot } from '@/data/readMeter';

type Report = { listeners: Record<string, { opened: number; joined: number; updates: number }>; sent: unknown };
const hausReads = () => (window as unknown as { hausReads: { (): Report; reset: () => void } }).hausReads;

beforeEach(() => hausReads().reset());

describe('the read meter', () => {
  it('keeps how many listeners were opened, how many parts of the app asked, and how many answers came', () => {
    meterOpened('dashboard/x'); meterJoined('dashboard/x'); meterJoined('dashboard/x'); meterSnapshot('dashboard/x');
    expect(hausReads()().listeners['dashboard/x']).toEqual({ opened: 1, joined: 2, updates: 1 });
  });

  it('says how to turn on the count of documents sent, which is off by default', () => {
    expect(hausReads()().sent).toBe('off');
  });

  it('counts each document Firestore sends, by its collection, on a listener and on a one-off read', () => {
    const into = new Map<string, number>();
    const doc = (path: string) => `{"name":"projects/p/databases/(default)/documents/${path}","fields":{}}`;
    countSent(`[[3,[{"documentChange":{"document":${doc('work_tasks/a')},"targetIds":[2]}}]]]`, into);
    countSent(`[[4,[{"documentChange":{"document":${doc('work_tasks/b')}}},{"documentChange":{"document":${doc('users/u1/data/glasses')}}}]]]`, into);
    countSent(`[{"found":${doc('members/x@y.z')},"readTime":"t"}]`, into);
    countSent('[[5,["noop"]]]', into);
    expect(Object.fromEntries(into)).toEqual({ work_tasks: 2, 'users/u1/data': 1, members: 1 });
  });
});
