// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// 1. Your real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9Mwx0CBbtBWtyDeu92S6Fw9Jm9gqABC8",
  authDomain: "vibescout-2b0c5.firebaseapp.com",
  projectId: "vibescout-2b0c5",
  storageBucket: "vibescout-2b0c5.firebasestorage.app",
  messagingSenderId: "21897430720",
  appId: "1:21897430720:web:b78976aa942aaf78e20f25",
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 3. Initialize Firestore with a MULTI-TAB offline cache.
//    This replaces enableIndexedDbPersistence(), which only allowed ONE
//    tab to hold the offline cache at a time — opening a second tab would
//    fail to get the lock and silently fall back to memory-only, which is
//    why writes in tab 1 weren't reliably showing up in tab 2.
//    persistentMultipleTabManager() lets every open tab share one cache,
//    so live sync works correctly across as many tabs/devices as you open.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// 4. Silently sign the user in anonymously the moment the app loads.
//    No login screen, no email/password — just a random device ID.
signInAnonymously(auth).catch((err) => {
  console.error("Anonymous sign-in failed:", err);
});

let currentUserId = null;
onAuthStateChanged(auth, (user) => {
  currentUserId = user ? user.uid : null;
});

// 5. Reference to the "discoveries" collection in Firestore.
const discoveriesRef = collection(db, "discoveries");

/**
 * Subscribe to live updates from the discoveries collection.
 * Calls `callback` immediately with cached/local data (even offline),
 * then again every time anything changes (add/edit/delete, by anyone,
 * in any tab). Returns an unsubscribe function if you ever need to stop
 * listening.
 */
export function watchDiscoveries(callback) {
  const q = query(discoveriesRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const discoveries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(discoveries);
    },
    (error) => {
      console.error("watchDiscoveries error:", error);
    }
  );
}

/**
 * Add a new discovery. Works the same whether online or offline —
 * Firestore queues it locally and syncs to the server automatically
 * once connectivity returns. No manual queue needed.
 *
 * `item` should look like:
 * { title, category, description, lat, lng }
 */
export function addDiscovery(item) {
  return addDoc(discoveriesRef, {
    ...item,
    createdBy: currentUserId,
    createdAt: serverTimestamp(),
  });
}

/**
 * Live-subscribe to the current (anonymous) user's saved spots.
 * Saved spots live at users/{uid}/saved/{discoveryId} — a real Firestore
 * subcollection, not localStorage — so they're queued and synced offline
 * the same way discoveries are, and they follow this anonymous identity
 * across tabs/reloads on this device without any login screen.
 * Calls `callback` with a Set of saved discovery ids, live.
 */
export function watchSavedIds(callback) {
  let unsubscribeSnapshot = () => {};
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    unsubscribeSnapshot();
    if (!user) {
      callback(new Set());
      return;
    }
    const savedRef = collection(db, "users", user.uid, "saved");
    unsubscribeSnapshot = onSnapshot(
      savedRef,
      (snapshot) => callback(new Set(snapshot.docs.map((d) => d.id))),
      (error) => console.error("watchSavedIds error:", error)
    );
  });
  return () => {
    unsubscribeSnapshot();
    unsubscribeAuth();
  };
}

/**
 * Save or un-save a discovery for the current anonymous user.
 * Works offline — Firestore queues the write and syncs once reconnected,
 * same guarantee as adding a discovery.
 */
export function toggleSaved(discoveryId, isCurrentlySaved) {
  const uid = currentUserId || auth.currentUser?.uid;
  if (!uid) return Promise.resolve();
  const ref = doc(db, "users", uid, "saved", discoveryId);
  return isCurrentlySaved ? deleteDoc(ref) : setDoc(ref, { savedAt: serverTimestamp() });
}

/**
 * Bump (or un-bump) a discovery's live reaction count by ±1.
 * Uses Firestore's atomic increment() field transform, so concurrent taps
 * from different people never overwrite each other or lose an update —
 * and it queues fine offline, applying optimistically to the local cache
 * and syncing the moment connectivity returns.
 * Per-device "have I already reacted" state is tracked client-side
 * (see main.js) since it's just a UI nicety, not shared source of truth.
 */
export function toggleReaction(discoveryId, alreadyReacted) {
  const ref = doc(db, "discoveries", discoveryId);
  return updateDoc(ref, { reactionCount: increment(alreadyReacted ? -1 : 1) });
}

export { db, auth };
