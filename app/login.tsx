import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 👁️ new
  const router = useRouter();

  useEffect(() => {
    // Load remembered email
    const loadRemembered = async () => {
      const savedEmail = await AsyncStorage.getItem("rememberedEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRemember(true);
      }
    };
    loadRemembered();
  }, []);

    const handleLogin = async () => {
      if (!email || !password) {
        Alert.alert("Missing fields", "Enter both email and password");
        return;
      }

      setLoading(true);
      setLoginError("");

      try {
        // Step 1: Authenticate
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Fetch Firestore user document FIRST
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          Alert.alert("Error", "User not found.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        const data = userDoc.data();
        console.log("Firestore data:", data);

        // Step 3: Handle ban or suspension before navigation
        if (data.banned === true) {
          Alert.alert("Account Banned", "Your account has been permanently banned.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (data.suspendedUntil) {
          const suspendedUntil = data.suspendedUntil.toDate
            ? data.suspendedUntil.toDate()
            : new Date(data.suspendedUntil);

          console.log("suspendedUntil parsed:", suspendedUntil);
          console.log("now:", new Date());

          if (suspendedUntil > new Date()) {
            Alert.alert(
              "Account Suspended",
              `Your account is suspended until ${suspendedUntil.toLocaleString()}.`
            );
            await signOut(auth);
            console.log("Signing out suspended user...");
            setLoading(false);
            return;
          }
        }

        // Step 4: Email verification check (optional)
        if (!user.emailVerified) {
          Alert.alert("Email not verified", "Please verify your email before logging in.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Step 5: Remember email
        if (remember) {
          await AsyncStorage.setItem("rememberedEmail", email);
        } else {
          await AsyncStorage.removeItem("rememberedEmail");
        }

        // Navigate based on user role AFTER all checks
        router.replace("/(tabs)/dashboard");

        Alert.alert("Welcome back!", `Logged in as ${user.email}`);

      } catch (error: any) {
        let message = "Something went wrong. Please try again.";

        if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
          message = "Incorrect email or password. Please try again.";
        } else if (error.code === "auth/user-not-found") {
          message = "No account found with this email.";
        } else if (error.code === "auth/too-many-requests") {
          message = "Too many failed attempts. Please try again later.";
        } else if (error.code === "auth/invalid-email") {
          message = "Invalid email format.";
        }

        setLoginError(message);
      } finally {
        setLoading(false);
      }
    };

    const handleResetPassword = async () => {
      if (!email.trim()) {
        Alert.alert("Missing email", "Please enter your email to reset password.");
        return;
      }

      try {
        await sendPasswordResetEmail(auth, email.trim());
        Alert.alert(
          "Password Reset Sent",
          "We've sent a password reset link to your email. Please check your inbox."
        );
      } catch (error: any) {
        console.error("Password reset error:", error);
        if (error.code === "auth/user-not-found") {
          Alert.alert("No account found", "No user found with that email address.");
        } else if (error.code === "auth/invalid-email") {
          Alert.alert("Invalid email", "Please enter a valid email address.");
        } else {
          Alert.alert("Error", error.message);
        }
      }
    };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Logo and Title */}
      <View style={styles.header}>
        <Image
          source={require("../assets/images/agrihub-davao-logo.png")} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>AgriHub Davao</Text>
        <Text style={styles.subtitle}>Connecting Farmers, Stores, and Consumers</Text>
      </View>

      {/* Input Fields */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#000"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setLoginError("");
          }}
        />

        {/* Password with Eye toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Password"
            placeholderTextColor="#000"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setLoginError("");
            }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? "eye" : "eye-off"}
              size={22}
              color={showPassword ? "#000" : "rgba(0,0,0,0.4)"}
            />
          </TouchableOpacity>
        </View>

        {/* Remember me + Forgot password row */}
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRemember(!remember)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, remember && styles.checkboxActive]} />
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setResetModalVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {loginError ? (
          <Text style={styles.errorText}>{loginError}</Text>
        ) : null}

        {/* Buttons */}
        {loading ? (
          <ActivityIndicator color="#4A8C2A" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.loginBtn]} onPress={handleLogin}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.signupBtn]}
              onPress={() => router.push("/register")}
            >
              <Text style={[styles.buttonText, { color: "#4A8C2A" }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
        {/* Reset Password Modal */}
        {resetModalVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalDesc}>
                Enter your registered email below. We'll send you a reset link.
              </Text>

              <TextInput
                style={[styles.input, { width: "100%" }]}
                placeholder="Email Address"
                placeholderTextColor="#000"
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnPrimary}
                  onPress={async () => {
                    if (!resetEmail.trim()) {
                      Alert.alert("Missing email", "Please enter your email.");
                      return;
                    }
                    try {
                      await sendPasswordResetEmail(auth, resetEmail.trim());
                      Alert.alert("Password Reset Sent", "Check your email for the reset link.");
                      setResetModalVisible(false);
                      setResetEmail("");
                    } catch (e: any) {
                      Alert.alert("Error", e.message);
                    }
                  }}
                >
                  <Text style={styles.modalBtnPrimaryText}>Send Reset Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalBtnGhost}
                  onPress={() => setResetModalVisible(false)}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
    </KeyboardAvoidingView>
  );

  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "flex-start",
    paddingTop: 120,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#4A8C2A",
  },
  subtitle: {
    color: "#777",
    fontSize: 14,
    marginTop: 4,
  },
  form: {
    width: "100%",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: "#333",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#4A8C2A",
    borderRadius: 4,
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: "#4A8C2A",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  loginBtn: {
    backgroundColor: "#4A8C2A",
  },
  signupBtn: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#4A8C2A",
  },
  buttonText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#fff",
  },
  optionsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  rememberText: { color: "#333", fontSize: 14 },
  forgotText: { color: "#1E88E5", fontSize: 14, fontWeight: "600" },

  // Modal
  modalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4A8C2A",
    marginBottom: 8,
  },
  modalDesc: {
    color: "#555",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 16,
  },

  modalActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: "#4A8C2A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnPrimaryText: { color: "#fff", fontWeight: "700" },
  modalBtnGhost: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#4A8C2A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnGhostText: { color: "#4A8C2A", fontWeight: "700" },
  errorText: {
  color: "#E53935",
  fontSize: 14,
  marginBottom: 8,
  textAlign: "center",
},passwordContainer: {
  width: "100%",
  position: "relative",
  marginBottom: 12,
},
inputPassword: {
  width: "100%",
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 10,
  padding: 12,
  paddingRight: 40, // space for the eye icon
  fontSize: 16,
  color: "#333",
},
eyeButton: {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: [{ translateY: -11 }],
  padding: 0,
},
});