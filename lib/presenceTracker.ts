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
import { doc, setDoc } from "firebase/firestore";
import { AppState, Platform } from "react-native";
import { auth, db, rtdb } from "../firebaseConfig";

/* ---------------------------------------------------------
   Helper 1: Wait until RTDB is connected
--------------------------------------------------------- */
async function waitForRTDBConnection() {
  const db = getDatabase();
  const connectedRef = ref(db, ".info/connected");
  return new Promise<void>((resolve) => {
    const unsub = onValue(connectedRef, (snap) => {
      if (snap?.val() === true) {
        if (typeof unsub === "function") unsub();
        resolve();
      }
    });
  });
}

/* ---------------------------------------------------------
   Helper 2: Safe RTDB writes (ignore stream token error)
--------------------------------------------------------- */
async function safeSet(refObj: any, data: any) {
  try {
    await set(refObj, data);
  } catch (err: any) {
    const msg = String(err);
    if (msg.includes("missing stream token")) {
      console.log("Ignored RTDB 'missing stream token' — will retry later");
      return;
    }
    throw err;
  }
}

/* ---------------------------------------------------------
   Helper 3: Safe unsubscribe for all listener types
--------------------------------------------------------- */
function safeUnsub(u?: (() => void) | { remove: () => void } | null) {
  try {
    if (!u) return;
    if (typeof u === "function") {
      u();
    } else if (typeof (u as any).remove === "function") {
      (u as any).remove();
    } else {
      console.warn("Tried to unsubscribe invalid listener:", u);
    }
  } catch (e) {
    console.warn("safeUnsub failed:", e);
  }
}

let initializedForUser: string | null = null;
let appStateSub: any = null;
let connectedUnsub: any = null;
let exiting = false;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;

/* ---------------------------------------------------------
   Main Presence Setup
--------------------------------------------------------- */
export const setupPresence = () => {
  console.log("setupPresence() called");

  // Clean old listeners first
  safeUnsub(appStateSub);
  appStateSub = null;
  safeUnsub(connectedUnsub);
  connectedUnsub = null;

  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }

  onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("User logged out — disabling presence safely");
    initializedForUser = null;

    try {
      // Immediately mark Firestore offline
      const prevUser = auth.currentUser;
      if (prevUser?.uid) {
        const userRef = doc(db, "users", prevUser.uid);
        await setDoc(userRef, { isOnline: false, lastSeen: new Date() }, { merge: true });
        console.log("Marked user offline in Firestore");
      }

      // Go offline in RTDB
      goOffline(getDatabase());
    } catch (err) {
      console.warn("Logout presence cleanup failed:", err);
    }

    // Cleanup listeners and watchdog
    safeUnsub(connectedUnsub);
    connectedUnsub = null;

    if (watchdogInterval) {
      clearInterval(watchdogInterval);
      watchdogInterval = null;
    }

    return; // exit cleanly
  }

    // Prevent duplicate initialization
    if (initializedForUser === user.uid) {
      console.log(" Presence already active for", user.uid);
      return;
    }
    initializedForUser = user.uid;

    // Prevent invalid UID references
    if (!user?.uid) {
      console.warn("No valid user UID, skipping RTDB presence setup");
      return;
    }

    console.log("Starting presence tracking for:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const rtdbRef = ref(rtdb, `/status/${user.uid}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const onlineFirestore = { isOnline: true, lastSeen: new Date() };
    const offlineFirestore = { isOnline: false, lastSeen: new Date() };
    const onlineRTDB = { state: "online", lastChanged: Date.now() };
    const offlineRTDB = { state: "offline", lastChanged: Date.now() };

    // Small delay for RTDB readiness
    await new Promise((resolve) => setTimeout(resolve, 1200));

    /* -----------------------------------------------------
       RTDB Connectivity Listener
    ----------------------------------------------------- */
    connectedUnsub = onValue(connectedRef, async (snap: any) => {
      const connected = snap?.val();
      console.log("RTDB .info/connected:", connected);

      if (!connected) {
        console.log("RTDB disconnected — fallback to Firestore only");
        try {
          await setDoc(userRef, offlineFirestore, { merge: true });
        } catch (err) {
          console.warn("Firestore fallback update skipped:", err);
        }
        return;
      }

      try {
        await onDisconnect(rtdbRef).set(offlineRTDB);
        await waitForRTDBConnection();
        await safeSet(rtdbRef, onlineRTDB);
        await setDoc(userRef, onlineFirestore, { merge: true });
        console.log("Presence: online (RTDB + Firestore synced)");
      } catch (err) {
        console.error("RTDB connection update failed:", err);
      }
    });

    /* -----------------------------------------------------
       AppState: Active / Inactive / Background
    ----------------------------------------------------- */
    const handleAppStateChange = async (state: string) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        if (state === "active") {
          console.log("App active — forcing online...");
          goOnline(getDatabase());
          await waitForRTDBConnection();
          await safeSet(rtdbRef, onlineRTDB);
          await setDoc(userRef, onlineFirestore, { merge: true });
        } else if (state === "background" || state === "inactive") {
          console.log(" App background/inactive — marking offline...");
          await safeSet(rtdbRef, offlineRTDB);
          await new Promise((res) => setTimeout(res, 500));
          goOffline(getDatabase());
          await setDoc(userRef, offlineFirestore, { merge: true });
        }
      } catch (err) {
        console.error("Presence appstate error:", err);
      }
    };

    safeUnsub(appStateSub);
    appStateSub = AppState.addEventListener("change", handleAppStateChange);

    /* -----------------------------------------------------
       App Exit (swipe or close)
    ----------------------------------------------------- */
    const handleExit = async () => {
      if (exiting) return;
      exiting = true;

      const currentUser = auth.currentUser;
      if (!currentUser) return;

      console.log("App swiped closed — marking user offline...");
      try {
        await safeSet(rtdbRef, offlineRTDB);
        await new Promise((res) => setTimeout(res, 500));
        goOffline(getDatabase());
        await setDoc(userRef, offlineFirestore, { merge: true });
      } catch (err) {
        console.error("Exit cleanup failed:", err);
      } finally {
        exiting = false;
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleExit);
    } else {
      AppState.addEventListener("change", (state) => {
        if (state === "inactive" || state === "background") handleExit();
      });
    }

 /* -----------------------------------------------------
    Watchdog: Auto-Reconnect RTDB
----------------------------------------------------- */
    watchdogInterval = setInterval(async () => {
      if (!auth.currentUser) return; // don’t run when logged out
      try {
        const infoRef = ref(rtdb, ".info/connected");
        const snap = await new Promise<any>((resolve) => {
          let resolved = false;
          const tempUnsub = onValue(
            infoRef,
            (s) => {
              if (!resolved) {
                resolved = true;
                if (typeof tempUnsub === "function") tempUnsub();
                resolve(s);
              }
            },
            { onlyOnce: true }
          );
        });

        if (!snap?.val()) {
          console.log("Watchdog: RTDB still offline — retrying...");
          goOnline(getDatabase());
          await waitForRTDBConnection();
          await setDoc(userRef, onlineFirestore, { merge: true });
        }
      } catch (err) {
        console.error("Watchdog error:", err);
      }
    }, 10000);
  });
};