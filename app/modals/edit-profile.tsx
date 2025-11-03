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
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    address: "",
    password: "",
    photoURL: "",
  });
  const [imgLocalUri, setImgLocalUri] = useState<string | null>(null);

  // Load user profile
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
          });
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

  // Pick Image
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

  // Upload photo
  const uploadPhoto = async (uid: string) => {
    if (!imgLocalUri) return form.photoURL;
    const blob = await (await fetch(imgLocalUri)).blob();
    const storageRef = ref(storage, `users/${uid}/profile.jpg`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // Save profile
  const saveProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      if (!form.fullName.trim()) {
        return Alert.alert("Required", "Full name cannot be empty.");
      }

      setSaving(true);
      const newPhotoURL = await uploadPhoto(user.uid);

      await updateDoc(doc(db, "users", user.uid), {
        fullName: form.fullName,
        email: form.email,
        address: form.address,
        photoURL: newPhotoURL,
      });

      // ...
      if (form.password.trim().length > 0) {
        await updatePassword(user, form.password);
      }

      Alert.alert("Success", "Profile updated successfully!");
      router.replace({
        pathname: "/(tabs)/profile",
        params: { refresh: "true" },
      });
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A8C2A" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.title}>Edit Profile ✏️</Text>

      {/* Profile Picture */}
      <TouchableOpacity onPress={pickImage} style={styles.imageBox}>
        {imgLocalUri || form.photoURL ? (
          <Image source={{ uri: imgLocalUri || form.photoURL }} style={styles.avatar} />
        ) : (
          <Text style={{ color: "#4A8C2A", fontWeight: "600" }}>+ Select Profile Picture</Text>
        )}
      </TouchableOpacity>

      {/* Fields */}
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
      <TextInput
        style={styles.input}
        placeholder="New Password (optional)"
        value={form.password}
        secureTextEntry
        onChangeText={(v) => setForm({ ...form, password: v })}
      />

      {/* Buttons */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={saveProfile}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
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
});