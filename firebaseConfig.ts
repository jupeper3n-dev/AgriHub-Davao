import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, browserLocalPersistence, getAuth, initializeAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { Firestore, getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

if (Platform.OS === "web") {
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
} else {
  auth = getAuth(app);
}

const dbInstance = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, dbInstance as db, rtdb };
