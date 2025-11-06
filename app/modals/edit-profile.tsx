import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { updatePassword } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

const storage = getStorage();

export default function EditProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  type FormData = {
  fullName: string;
  email: string;
  address: string;
  password: string;
  photoURL: string;
  crops: string[];
  };

  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    address: "",
    password: "",
    photoURL: "",
    crops: [],
  });

  const [newCrop, setNewCrop] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<string>("");
  const [imgLocalUri, setImgLocalUri] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordRules, setPasswordRules] = useState({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    isLongEnough: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            fullName: d.fullName || "",
            email: d.email || user.email || "",
            address: d.address || "",
            password: "",
            photoURL: d.photoURL || "",
            crops: d.crops || [],
          });
          setUserType(d.userType || "");
        }
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission needed", "Allow access to photos.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setImgLocalUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uid: string) => {
    if (!imgLocalUri) return form.photoURL;
    const blob = await (await fetch(imgLocalUri)).blob();
    const storageRef = ref(storage, `users/${uid}/profile.jpg`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const isPasswordStrong = (pwd: string) => {
    // Regular expression for password validation
    const regexUppercase = /[A-Z]/;
    const regexLowercase = /[a-z]/;
    const regexNumber = /\d/;
    const isLongEnough = pwd.length >= 8;

    // Update the password validation states
    setPasswordRules({
      hasUppercase: regexUppercase.test(pwd),
      hasLowercase: regexLowercase.test(pwd),
      hasNumber: regexNumber.test(pwd),
      isLongEnough,
    });

    return regexUppercase.test(pwd) && regexLowercase.test(pwd) && regexNumber.test(pwd) && isLongEnough;
  };

  const saveProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      if (!form.fullName.trim()) {
        return Alert.alert("Required", "Full name cannot be empty.");
      }

      // Check for password change and validation
      if (form.password.trim().length > 0) {
        if (!isPasswordStrong(form.password)) {
          return Alert.alert(
            "Weak Password",
            "Password must be at least 8 characters long and include:\n• 1 uppercase letter\n• 1 lowercase letter\n• 1 number"
          );
        }
        if (form.password !== confirmPassword) {
          return Alert.alert("Password Mismatch", "Passwords do not match.");
        }
      }

      setSaving(true);
      const newPhotoURL = await uploadPhoto(user.uid);

      // Update user profile info in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        fullName: form.fullName,
        email: form.email,
        address: form.address,
        photoURL: newPhotoURL,
        crops: form.crops,
      });

      // Update password if it's been changed
      if (form.password.trim().length > 0) {
        await updatePassword(user, form.password);
      }

      // If password is updated, log out and prompt for re-login
      if (form.password.trim().length > 0) {
        await auth.signOut();
        Alert.alert("Success", "Password updated. Please log in again.");
        router.replace("/login"); // You may redirect to login screen
      } else {
        Alert.alert("Success", "Profile updated successfully.");
        router.replace({
          pathname: "/(tabs)/profile",
          params: { refresh: "true" },
        });
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const passwordMatchMessage =
    confirmPassword.length > 0
      ? form.password === confirmPassword
        ? "Passwords match"
        : "Passwords do not match"
      : "";

  const passwordMatchColor =
    confirmPassword.length > 0
      ? form.password === confirmPassword
        ? "#4CAF50"
        : "#E53935"
      : "transparent";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A8C2A" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
    {/* 🟩 Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>
      </View>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>


      <TouchableOpacity onPress={pickImage} style={styles.imageBox}>
        {imgLocalUri || form.photoURL ? (
          <Image source={{ uri: imgLocalUri || form.photoURL }} style={styles.avatar} />
        ) : (
          <Text style={{ color: "#4A8C2A", fontWeight: "600" }}>+ Select Profile Picture</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={form.fullName}
        onChangeText={(v) => setForm({ ...form, fullName: v })}
      />
      <TextInput
        style={[styles.input, { backgroundColor: "#f1f1f1" }]}
        placeholder="Email"
        value={form.email}
        editable={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Address"
        value={form.address}
        onChangeText={(v) => setForm({ ...form, address: v })}
      />

      {userType.toLowerCase() === "farmer" && (
        <>
          <Text style={styles.label}>Crops (for Farmers)</Text>

          {/* Add Crop Row */}
          <View style={styles.cropRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Add a crop..."
              value={newCrop}
              onChangeText={setNewCrop}
            />
            <TouchableOpacity
              style={styles.addCropBtn}
              onPress={() => {
                if (!newCrop.trim()) return;
                setForm((prev) => ({
                  ...prev,
                  crops: [...(prev.crops || []), newCrop.trim()],
                }));
                setNewCrop("");
              }}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Existing Crops List */}
          {form.crops.length > 0 && (
            <View style={styles.cropList}>
              {form.crops.map((crop, index) => (
                <View key={index} style={styles.cropPill}>
                  <Text style={styles.cropText}>{crop}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setForm((prev) => ({
                        ...prev,
                        crops: prev.crops.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Ionicons name="close-circle" size={18} color="red" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.inputPassword}
          placeholder="New Password (optional)"
          value={form.password}
          secureTextEntry={!showPassword}
          onChangeText={(v) => setForm({ ...form, password: v })}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} activeOpacity={0.7}>
          <Ionicons
            name={showPassword ? "eye" : "eye-off"}
            size={22}
            color={showPassword ? "#000" : "rgba(0,0,0,0.4)"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.passwordContainer}>
        <TextInput
          style={[
            styles.inputPassword,
            confirmPassword.length > 0 && form.password !== confirmPassword
              ? { borderColor: "#E53935" }
              : {},
          ]}
          placeholder="Confirm New Password"
          value={confirmPassword}
          secureTextEntry={!showConfirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton} activeOpacity={0.7}>
          <Ionicons
            name={showConfirmPassword ? "eye" : "eye-off"}
            size={22}
            color={showConfirmPassword ? "#000" : "rgba(0,0,0,0.4)"}
          />
        </TouchableOpacity>
      </View>

      {/* Password strength rules */}
      <View style={styles.passwordRulesContainer}>
        <Text style={{ color: passwordRules.hasUppercase ? "#4CAF50" : "#E53935" }}>
          {passwordRules.hasUppercase ? "" : ""} At least one uppercase letter
        </Text>
        <Text style={{ color: passwordRules.hasLowercase ? "#4CAF50" : "#E53935" }}>
          {passwordRules.hasLowercase ? "" : ""} At least one lowercase letter
        </Text>
        <Text style={{ color: passwordRules.hasNumber ? "#4CAF50" : "#E53935" }}>
          {passwordRules.hasNumber ? "" : ""} At least one number
        </Text>
        <Text style={{ color: passwordRules.isLongEnough ? "#4CAF50" : "#E53935" }}>
          {passwordRules.isLongEnough ? "" : ""} At least 8 characters long
        </Text>
      </View>

      {confirmPassword.length > 0 && (
        <Text style={[styles.matchText, { color: passwordMatchColor }]}>{passwordMatchMessage}</Text>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveProfile} disabled={saving}>
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 80 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 24, color: "#222" },
  imageBox: {
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#f9f9f9",
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    fontSize: 16,
    backgroundColor: "#fff",
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
    borderRadius: 10,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#000",
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -11 }],
    padding: 0,
  },
  matchText: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "500",
  },
  saveBtn: {
    backgroundColor: "#4A8C2A",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: { marginTop: 14, alignItems: "center", paddingVertical: 12 },
  cancelText: { color: "#888", fontSize: 15 },
  passwordRulesContainer: {
  marginTop: 12,
  marginBottom: 20,
  paddingLeft: 10,
  paddingRight: 10,
},
headerTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "bold",
},
cropRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
},
addCropBtn: {
  backgroundColor: "#4A8C2A",
  padding: 10,
  borderRadius: 10,
  marginLeft: 8,
}, cropList: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 20,
  marginTop: 10,
},cropPill: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#E8F5E9",
  borderRadius: 20,
  paddingHorizontal: 10,
  paddingVertical: 6,
},cropText: {
  color: "#2E7D32",
  marginRight: 6,
},label: {
  fontWeight: "bold",
  color: "#333",
  marginBottom: 6,
  fontSize: 16,
},wrapper: {
  flex: 1,
  backgroundColor: "#fff",
},
header: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  backgroundColor: "#4A8C2A",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingVertical: 14,
  elevation: 5,
  zIndex: 100, // ensures it stays above ScrollView
},
headerLeft: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},
scrollContainer: {
  flex: 1,
  marginTop: 65, // push content below the fixed header height
  paddingHorizontal: 20,
  backgroundColor: "#fff",
},

});