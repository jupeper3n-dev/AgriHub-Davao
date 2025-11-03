import { useColorScheme } from "@/hooks/use-color-scheme";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { enableNetwork, getFirestore } from "firebase/firestore";
import React, { useEffect } from "react";
import { AppState, LogBox } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebaseConfig";
import { setupPresence } from "../lib/presenceTracker";


export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  useEffect(() => {
      LogBox.ignoreLogs([
        "Target ID already exists", // Firestore duplicate listener warning
        "Snapshot listener",        // (optional broader ignore)
        "AsyncStorage has been extracted", // keep React Native’s common warning silent
      ]);
    }, []);
    
  // Initialize presence tracking
  useEffect(() => {
    setupPresence();
  }, []);

  // Monitor auth session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User session active:", user.email);
      } else {
        console.log("Session expired — redirecting to login");
        router.replace("/login" as any);
      }
    });
    return () => unsubscribe();
  }, []);

  // Periodically refresh Firebase Auth token every 30 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          await user.getIdToken(true); // force refresh
          console.log("Firebase token refreshed");
        } catch (err) {
          console.warn("Failed to refresh Firebase token:", err);
        }
      }
    }, 1000 * 60 * 30); // every 30 minutes

    return () => clearInterval(interval);
  }, []);

  // When app resumes, re-enable Firestore network and refresh token
  useEffect(() => {
    const db = getFirestore();
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        console.log("App resumed — re-enabling Firestore and refreshing token");
        const user = auth.currentUser;
        if (user) {
          try {
            await user.getIdToken(true);
            await enableNetwork(db);
          } catch (err) {
            console.warn("Error while re-enabling Firestore:", err);
          }
        }
      }
    });

    return () => subscription.remove();
  }, []);


  // Periodic token refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
        console.log("Refreshed Firebase session token");
      }
    }, 1000 * 60 * 15); // every 15 mins

    return () => clearInterval(interval);
  }, []);

  // Fast Auth restore when app starts or resumes
  useEffect(() => {
    const restoreSession = async () => {
      return new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log("Session restored instantly for:", user.email);
          } else {
            console.log("No user session found");
          }
          unsub();
          resolve();
        });
      });
    };

    // Run immediately when the layout loads
    restoreSession();

    // Run again when app resumes
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        restoreSession();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fff" }}
        edges={["top", "left", "right", "bottom"]}
      >
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chats" />
            <Stack.Screen name="chat-room" />
          </Stack>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        </ThemeProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}