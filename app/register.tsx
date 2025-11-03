import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [userType, setUserType] = useState("consumer");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  // Password validation
  const isPasswordStrong = (pwd: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
    return regex.test(pwd);
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !phone || !address)
      return Alert.alert("Missing fields", "Please fill in all required information.");

    if (!isPasswordStrong(password))
      return Alert.alert(
        "Weak Password",
        "Password must be at least 10 characters long and include:\n• 1 uppercase letter\n• 1 lowercase letter\n• 1 number"
      );

    setLoading(true);
    try {
      // Create Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName,
        email,
        phone,
        address,
        userType,
        createdAt: new Date().toISOString(),
        verified: user.emailVerified,
      });

      // Send email verification
      await sendEmailVerification(user);
      Alert.alert("Verify your email", "A verification link has been sent to your inbox.");

      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Registration Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>

        {/* Full Name */}
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
        />

        {/* Password */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
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

        {/* Phone Number */}
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        {/* Email */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Address */}
        <TextInput
          style={styles.input}
          placeholder="Address"
          value={address}
          onChangeText={setAddress}
        />

        {/* User Type */}
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Register as:</Text>
          <Picker
            selectedValue={userType}
            onValueChange={(value) => setUserType(value)}
            style={styles.picker}
          >
            <Picker.Item label="Consumer" value="Consumer" />
            <Picker.Item label="Farmer" value="Farmer" />
            <Picker.Item label="Store Owner" value="Store Owner" />
          </Picker>
        </View>

        {/* Register Button */}
        {loading ? (
          <ActivityIndicator color="#1E88E5" style={{ marginVertical: 10 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        )}

        {/* Login Link */}
        <TouchableOpacity
          onPress={() => router.push("/login")}
          style={styles.linkWrap}
        >
          <Text style={styles.link}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: "flex-start", // Left align all inputs and labels
    backgroundColor: "#fff",
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    alignSelf: "flex-start",
    color: "#222",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    color: "#000",
  },
  pickerContainer: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  picker: { width: "100%" },
  button: {
    backgroundColor: "#4A8C2A",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  linkWrap: {
  width: "100%",           // make the touch area full width
  alignItems: "center",    // center the text inside
  marginTop: 15,
  },
  link: {
    color: "#1E88E5",
    fontSize: 14,
  },
  passwordContainer: {
  width: "100%",
  position: "relative",
  marginBottom: 10,
  },
  inputPassword: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    paddingRight: 40, // space for the eye icon
    color: "#000",
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -11 }], // vertically center the icon
    padding: 0,
  },
});