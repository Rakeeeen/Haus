import { doc, setDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { meteredDoc } from '@/data/readMeter';
import { codeFromBytes } from '@/domain/access';

const COL = 'device_auth_codes';
const TTL = 5 * 60 * 1000; // 5 minutes
const DEVICE_CODE_LENGTH = 6;

export interface DeviceAuthDoc {
  pending: boolean;
  code: string | null;
  requestedAt: number;
  expiresAt: number;
  used: boolean;
}

/** Mobile calls this — signals the Mac to generate a code */
export async function requestDeviceCode(userId: string): Promise<void> {
  await setDoc(doc(db, COL, userId), {
    pending: true,
    code: null,
    requestedAt: Date.now(),
    expiresAt: Date.now() + TTL,
    used: false,
  });
}

/** Mac calls this — generates the code and writes it so mobile can verify */
export async function generateAndStoreCode(userId: string): Promise<string> {
  // From the browser's cryptographic random source (Math.random is predictable, so no good for a code that lets a device in).
  const code = codeFromBytes(crypto.getRandomValues(new Uint8Array(32)), DEVICE_CODE_LENGTH);
  await updateDoc(doc(db, COL, userId), { code });
  return code;
}

/** Mobile calls this to verify what the user typed */
export async function verifyDeviceCode(userId: string, input: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COL, userId));
  if (!snap.exists()) return false;
  const data = snap.data() as DeviceAuthDoc;
  if (data.used) return false;
  if (Date.now() > data.expiresAt) return false;
  if (data.code !== input.trim()) return false;
  await updateDoc(doc(db, COL, userId), { used: true });
  return true;
}

/** Mac subscribes to this — fires when mobile requests a code */
export function onDeviceCodeRequest(
  userId: string,
  callback: (data: DeviceAuthDoc | null) => void
): () => void {
  return onSnapshot(doc(db, COL, userId), meteredDoc(`${COL}/{uid}`, (snap) => {
    if (!snap.exists()) { callback(null); return; }
    const data = snap.data() as DeviceAuthDoc;
    // Ignore expired or already-used docs
    if (data.used || Date.now() > data.expiresAt) { callback(null); return; }
    callback(data);
  }));
}
