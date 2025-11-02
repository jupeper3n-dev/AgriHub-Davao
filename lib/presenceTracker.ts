import { onAuthStateChanged } from "firebase/auth";
import {
  getDatabase,
  goOffline,
  goOnline,
  onDisconnect,
  onValue,
  ref,
  set,
} from "firebase/database";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { AppState, Platform } from "react-native";
import { auth, db, rtdb } from "../firebaseConfig";

let appStateSubscription: { remove?: () => void } | null = null;
let connectedUnsub: (() => void) | null = null;
let cleanupOnExit = false;

export const setupPresence = () => {
  // 🧹 Clean old listeners
  if (appStateSubscription && typeof appStateSubscription.remove === "function") {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  if (connectedUnsub) {
    connectedUnsub();
    connectedUnsub = null;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.log("User logged out — stopping presence tracking");

      if (appStateSubscription && typeof appStateSubscription.remove === "function") {
        appStateSubscription.remove();
        appStateSubscription = null;
      }
      if (connectedUnsub) connectedUnsub();

      return;
    }

    console.log("🟢 Starting presence tracking for user:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const rtdbRef = ref(rtdb, `/status/${user.uid}`);

    const isOnlineForFirestore = { isOnline: true, lastSeen: serverTimestamp() };
    const isOfflineForFirestore = { isOnline: false, lastSeen: serverTimestamp() };

    const isOnlineForRTDB = { state: "online", lastChanged: Date.now() };
    const isOfflineForRTDB = { state: "offline", lastChanged: Date.now() };

    const connectedRef = ref(rtdb, ".info/connected");

    // ✅ Monitor RTDB connection state
    connectedUnsub = onValue(connectedRef, async (snap) => {
      const connected = snap.val();
      if (connected) {
        try {
          await onDisconnect(rtdbRef).set(isOfflineForRTDB);
          await set(rtdbRef, isOnlineForRTDB);
          await setDoc(userRef, isOnlineForFirestore, { merge: true });
          console.log("✅ RTDB reconnected and Firestore updated (online)");
        } catch (err) {
          console.error("⚠️ RTDB reconnect failed:", (err as Error).message);
        }
      } else {
        console.log("⚠️ RTDB disconnected");
      }
    });

    // 📱 Handle app state (background / foreground)
    const handleAppStateChange = async (state: string) => {
      try {
        if (!auth.currentUser) return;

        if (state === "active") {
          console.log("📱 App active — reconnecting RTDB...");
          goOnline(getDatabase());

          // Wait briefly for connection to stabilize
          setTimeout(async () => {
            await setDoc(userRef, isOnlineForFirestore, { merge: true });
            await set(rtdbRef, isOnlineForRTDB);
            console.log("✅ User marked online after resume");
          }, 600);
        } else {
          console.log("📴 App backgrounded — setting offline + closing RTDB");
          await setDoc(userRef, isOfflineForFirestore, { merge: true });
          await set(rtdbRef, isOfflineForRTDB);
          goOffline(getDatabase());
        }
      } catch (err) {
        console.error("⚠️ Presence update skipped:", (err as Error).message);
      }
    };

    appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

    // Handle app termination (swipe kill or crash)
    const handleExit = async () => {
      if (cleanupOnExit) return;
      cleanupOnExit = true;
      try {
        console.log("App terminated — marking user offline...");
        await setDoc(userRef, isOfflineForFirestore, { merge: true });
        await set(rtdbRef, isOfflineForRTDB);
        goOffline(getDatabase());
      } catch (err) {
        console.error("Cleanup on exit failed:", (err as Error).message);
      }
    };

    // Safe platform-specific cleanup
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleExit);
    } else {
      // React Native fallback — no window object
      const exitHandler = AppState.addEventListener("change", (state) => {
        if (state === "inactive" || state === "background") {
          handleExit();
        }
      });
    }

    // Fallback for React Native app termination
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0] && args[0].toString().includes("setNativeProps")) {
        handleExit();
      }
      originalConsoleError(...args);
    };
  });
};