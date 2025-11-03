import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  initializeAuth
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import { Firestore, getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Load config from app.json (under "extra.firebase")
const firebaseConfig = Constants.expoConfig?.extra?.firebase;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Initialize app safely (only once)
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Prevent "Expected a class definition" error by checking if Auth already exists
try {
  if (Platform.OS === "web") {
    auth = getAuth(app); // Web auto-manages persistence
  } else {
    auth =
      getAuth(app) ||
      initializeAuth(app, {
        persistence: AsyncStorage as any, // fallback persistence
      });
  }
} catch (err: any) {
  console.warn("Auth initialization skipped (already initialized)");
  auth = getAuth(app);
}

// Firestore + Realtime Database
const dbInstance = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, dbInstance as db, rtdb };

