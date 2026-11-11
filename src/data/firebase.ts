import { initializeApp } from "firebase/app";
import { CACHE_SIZE_UNLIMITED, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDpyaBASLG6ZgWXQND0J4gN6OoJFGhRmb4",
  authDomain: "rakeeen-home.firebaseapp.com",
  projectId: "rakeeen-home",
  storageBucket: "rakeeen-home.firebasestorage.app",
  messagingSenderId: "725227885738",
  appId: "1:725227885738:web:0d9c7bb3bce88735202cd3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// `experimentalForceLongPolling` bypasses the Firestore WebChannel transport, which
// is what throws "INTERNAL ASSERTION FAILED: Unexpected state (ca9/b815)" and then
// permanently wedges the client (the reason a full page reload was needed to recover).
//
// The cache is kept in the browser (IndexedDB), shared by this site's tabs. Without it every
// page load and refresh re-reads every document of every list — each one a billed read, and
// the free plan allows 50,000 a day. With it, a list opens from the copy on this device and the
// server sends only what changed (for a list watched again within about half an hour).
// Signing out wipes it (`signOutUser` in auth.ts), so the next person on this browser never sees
// what the last one had. useFirebaseSync still mirrors every value to localStorage for instant paint.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // Never trimmed by size: the tasks and notes are read by their changes only (data/deltaSync.ts), which trusts this copy to
  // still hold every document it was given. (It is small — a few MB — and signing out wipes it.)
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
