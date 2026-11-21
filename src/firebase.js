// Import the Firebase SDK pieces we actually need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// Your web app's Firebase configuration.
// NOTE: a Firebase web apiKey is not a secret — it only identifies which
// Firebase project the SDK talks to, and Google's own docs confirm it's
// safe to ship in client bundles. The actual security boundary in this
// project is the Firestore Security Rules. Still, these values are moved
// to environment variables for config hygiene (switching Firebase
// projects without editing source) and to match conventional practice.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase once, and export the pieces every component will need
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);    // used for register/login/logout
export const db = getFirestore(app); // used for all reads/writes to our collections

// DEV-ONLY: expose these on window so you can paste attack attempts
// directly into the browser DevTools console to test security rules.
// import.meta.env.DEV is false in a production build, so this block is
// automatically excluded when you deploy — nothing to remember to remove.
if (import.meta.env.DEV) {
  window.db = db;
  window.auth = auth;
  window.doc = doc;
  window.setDoc = setDoc;
  window.updateDoc = updateDoc;
  window.serverTimestamp = serverTimestamp;
}

export default app;