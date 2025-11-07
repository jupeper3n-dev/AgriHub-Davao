import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { Database, getDatabase } from "firebase/database";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Load config from app.json (under "extra.firebase")
const firebaseConfig = Constants.expoConfig?.extra?.firebase as Record<string, string>;

// Initialize app (only once)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Properly initialize Auth for React Native
let auth: Auth;

if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: AsyncStorage as any,
    });
  } catch (e) {
    auth = getAuth(app); // fallback if already initialized
  }
}

// Initialize other Firebase services
const db: Firestore = getFirestore(app);
const rtdb: Database = getDatabase(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, rtdb, storage };
