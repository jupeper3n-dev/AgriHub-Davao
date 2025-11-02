import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, browserLocalPersistence, getAuth, initializeAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { Firestore, getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyCCfQx8Ru9AgZCcJKeSUlGoxM8Y74ApLKg",
  authDomain: "manota-f9acc.firebaseapp.com",
  projectId: "manota-f9acc",
  storageBucket: "manota-f9acc.appspot.com",
  messagingSenderId: "44603281991",
  appId: "1:44603281991:web:dc52f67beaaaff11c59762",
  databaseURL: "https://manota-f9acc-default-rtdb.firebaseio.com/", // ✅ Correct RTDB URL
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// ✅ Initialize Firebase app safely
app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ✅ Handle Auth initialization
if (Platform.OS === "web") {
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
} else {
  auth = getAuth(app);
}

// ✅ Initialize Firestore and RTDB
const dbInstance = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, dbInstance as db, rtdb };

