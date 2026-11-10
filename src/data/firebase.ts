import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
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
// Cache stays in-memory — useFirebaseSync already mirrors every value to localStorage
// for instant paint.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
