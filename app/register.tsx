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
  Alert, Image, Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [userType, setUserType] = useState("consumer");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [crops, setCrops] = useState<string[]>([]);
  const [cropInput, setCropInput] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation
  const isPasswordStrong = (pwd: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
    return regex.test(pwd);
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword || !fullName || !phone || !address)
      return Alert.alert("Missing fields", "Please fill in all required information.");

    if (!agreeTerms)
      return Alert.alert("Terms Required", "You must agree to the terms and conditions to continue.");

    if (!isPasswordStrong(password))
      return Alert.alert(
        "Weak Password",
        "Password must be at least 10 characters long and include:\n• 1 uppercase letter\n• 1 lowercase letter\n• 1 number"
      );

    if (password !== confirmPassword)
      return Alert.alert("Password Mismatch", "Passwords do not match. Please try again.");

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName,
        email,
        phone,
        address,
        userType: userType.toLowerCase(),
        crops: userType.toLowerCase() === "farmer" ? crops : [],
        createdAt: new Date().toISOString(),
        verified: user.emailVerified,
      });

      await sendEmailVerification(user);
      Alert.alert("Verify your email", "A verification link has been sent to your inbox.");
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Registration Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordMatchMessage =
    confirmPassword.length > 0
      ? password === confirmPassword
        ? "Passwords match"
        : "Passwords do not match"
      : "";

  const passwordMatchColor =
    confirmPassword.length > 0
      ? password === confirmPassword
        ? "#4CAF50"
        : "#E53935"
      : "transparent";

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>

      <View style={styles.headerBar}>
      <View style={styles.headerContent}>
        <Image
          source={require("../assets/images/agrihub-davao-logo.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>AgriHub Davao</Text>
      </View>
    </View>
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

        {/* Confirm Password */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.inputPassword,
              confirmPassword.length > 0 && password !== confirmPassword
                ? { borderColor: "#E53935" }
                : {},
            ]}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.eyeButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showConfirmPassword ? "eye" : "eye-off"}
              size={22}
              color={showConfirmPassword ? "#000" : "rgba(0,0,0,0.4)"}
            />
          </TouchableOpacity>
        </View>

        {/* Password Match Indicator */}
        {confirmPassword.length > 0 && (
          <Text style={[styles.matchText, { color: passwordMatchColor }]}>
            {passwordMatchMessage}
          </Text>
        )}

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

        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Register as:</Text>
          <Picker
            selectedValue={userType}
            onValueChange={(value) => {
              if (value) setUserType(value.toLowerCase());
            }}
            style={styles.picker}
          >
            <Picker.Item label="Consumer" value="consumer" />
            <Picker.Item label="Farmer" value="farmer" />
            <Picker.Item label="Store Owner" value="store owner" />
          </Picker>
        </View>

          {userType.toLowerCase() === "farmer" && (
          <View style={{ width: "100%", marginBottom: 10 }}>
            <Text style={styles.label}>Crops You Plant</Text>

            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Type a crop and press Add"
                value={cropInput}
                onChangeText={setCropInput}
              />
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={() => {
                  if (cropInput.trim() && !crops.includes(cropInput.trim())) {
                    setCrops([...crops, cropInput.trim()]);
                    setCropInput("");
                  }
                }}
              >
                <Text style={styles.addTagText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Display current tags */}
            <View style={styles.tagsContainer}>
              {crops.map((crop, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{crop}</Text>
                  <TouchableOpacity
                    onPress={() => setCrops(crops.filter((c) => c !== crop))}
                  >
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Terms and Conditions */}
        <View style={styles.checkboxContainer}>
          <Pressable
            onPress={() => setAgreeTerms(!agreeTerms)}
            style={[
              styles.checkbox,
              { backgroundColor: agreeTerms ? "#4A8C2A" : "transparent" },
            ]}
          >
            {agreeTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
          </Pressable>
          <Text style={styles.checkboxLabel}>
            I agree to the{" "}
            <Text style={styles.link} onPress={() => setModalVisible(true)}>
              Terms and Conditions
            </Text>
          </Text>
        </View>

        {/* Terms Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalTitle}>
                  AgriHubDavao – User Agreement and Terms & Conditions
                </Text>
                <Text style={styles.modalText}>
{`
Effective Date: [Insert Date]
Last Updated: [Insert Date]

Welcome to AgriHubDavao, a digital platform connecting farmers, store owners, and consumers within Davao’s agricultural supply chain. By using AgriHubDavao, you agree to comply with these Terms and Conditions. Please read carefully before using our services.

1. Overview of AgriHubDavao
AgriHubDavao facilitates communication, negotiation, and collaboration among agricultural stakeholders. The app provides geolocation mapping, real-time chat and video calls, negotiation history storage, and role-based access control to ensure appropriate interactions.

2. Acceptance of Terms
By creating an account or using the app, you confirm you are 18 years old or have consent, comply with Philippine laws, and consent to data collection under this policy.

3. User Roles and Responsibilities
Farmers, Store Owners, and Consumers each have specific responsibilities. All users must provide accurate information, avoid fraud, harassment, or misuse, and respect others on the platform.

4. Data Privacy and Security
AgriHubDavao complies with the Philippine Data Privacy Act of 2012 and uses Firebase encryption, AES-256 document protection, MFA, and security audits to ensure safe handling of data.

5. Transparency and Accountability
We provide clear data usage explanations, monitor communications for fairness, and keep transparent negotiation records under administrator supervision.

6. Ethical Code of Conduct
Users must uphold Data Privacy, Transparency, Integrity, and Accountability in all actions on the platform.

7. Security Risks and Mitigation
We address Firebase misconfiguration, weak authentication, and cross-site scripting through strict rules, MFA, and input sanitization.

8. Prohibited Activities
Uploading harmful content, impersonation, hacking, or misuse of the app is strictly prohibited. Violations may lead to suspension or legal action.

9. Limitation of Liability
AgriHubDavao is provided 'as is' without warranties. We are not responsible for user disputes, data loss, or transaction issues.

10. Intellectual Property
All logos, trademarks, and code are owned by the AgriHubDavao development team and may not be copied or distributed without permission.

11. Termination
Accounts violating terms may be suspended or terminated. Content found unsafe or illegal may be removed immediately.

12. Updates to Terms
We may revise these Terms to comply with new laws or technologies. Continued use signifies acceptance of updates.

13. Contact Information
AgriHubDavao Support Team
Email: [Insert Email Address]
Address: Davao City, Philippines

Acknowledgment:
By using AgriHubDavao, you acknowledge that you have read, understood, and agreed to these Terms and Conditions and the Code of Conduct.
`}
                </Text>
              </ScrollView>

              <Pressable
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Register Button */}
        {loading ? (
          <ActivityIndicator color="#1E88E5" style={{ marginVertical: 10 }} />
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              !agreeTerms && { backgroundColor: "#A5D6A7" },
            ]}
            onPress={handleRegister}
            disabled={!agreeTerms}
          >
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
  scrollContainer: { flexGrow: 1, justifyContent: "center", backgroundColor: "#fff" },
  container: { flex: 1, padding: 20, alignItems: "flex-start", paddingTop: 60 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 20, color: "#222", marginTop: 30, },
  input: {
    width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    padding: 10, marginBottom: 10, fontSize: 16, color: "#000",
  },
  pickerContainer: {
    width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    marginBottom: 15, paddingHorizontal: 10, paddingVertical: 4,
  },
  label: { fontWeight: "bold", color: "#333", marginBottom: 4 },
  picker: { width: "100%" },
  button: {
    backgroundColor: "#4A8C2A", width: "100%", paddingVertical: 14,
    borderRadius: 8, alignItems: "center", marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  linkWrap: { width: "100%", alignItems: "center", marginTop: 15 },
  link: { color: "#1E88E5", fontSize: 14 },
  passwordContainer: { width: "100%", position: "relative", marginBottom: 10 },
  inputPassword: {
    width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    padding: 10, paddingRight: 40, color: "#000",
  },
  eyeButton: {
    position: "absolute", right: 10, top: "50%", transform: [{ translateY: -11 }],
  },
  matchText: { marginBottom: 8, fontSize: 14, fontWeight: "500" },
  checkboxContainer: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  checkbox: {
    width: 20, height: 20, borderWidth: 1.5, borderColor: "#4A8C2A",
    alignItems: "center", justifyContent: "center", borderRadius: 4, marginRight: 8,
  },
  checkboxLabel: { color: "#333", fontSize: 14, flexShrink: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 15,
  },
  modalContainer: {
    backgroundColor: "#fff", borderRadius: 10, width: "95%",
    maxHeight: "85%", padding: 20,
  },
  modalScroll: { marginBottom: 20 },
  modalTitle: {
    fontSize: 18, fontWeight: "bold", marginBottom: 10, color: "#2E7D32",
  },
  modalText: { fontSize: 14, color: "#444", lineHeight: 20 },
  closeButton: {
    backgroundColor: "#4A8C2A", paddingVertical: 10, borderRadius: 6, alignItems: "center",
  },
  closeButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  tagInputContainer: {
  flexDirection: "row",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
tagInput: {
  flex: 1,
  fontSize: 15,
  color: "#000",
  paddingVertical: 8,
},
addTagButton: {
  backgroundColor: "#4A8C2A",
  borderRadius: 6,
  paddingVertical: 6,
  paddingHorizontal: 12,
  marginLeft: 8,
},
addTagText: {
  color: "#fff",
  fontWeight: "bold",
  fontSize: 14,
},
tagsContainer: {
  flexDirection: "row",
  flexWrap: "wrap",
  marginTop: 8,
},
tag: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#4A8C2A",
  borderRadius: 16,
  paddingHorizontal: 10,
  paddingVertical: 4,
  marginRight: 6,
  marginBottom: 6,
},
tagText: {
  color: "#fff",
  fontSize: 13,
  marginRight: 4,
},headerBar: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  backgroundColor: "#4A8C2A",
  paddingVertical: 14,
  paddingHorizontal: 16,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  elevation: 4,
  zIndex: 100,
},
headerContent: {
  flexDirection: "row",
  alignItems: "center",
},
headerLogo: {
  width: 36,
  height: 36,
  marginRight: 10,
},
headerTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "bold",
},
});