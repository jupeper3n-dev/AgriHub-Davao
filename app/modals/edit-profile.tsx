import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
    photoURL: "",
  });
  const [imgLocalUri, setImgLocalUri] = useState<string | null>(null);

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
    if (!result.canceled) {
      setImgLocalUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uid: string) => {
    if (!imgLocalUri) return form.photoURL;
    const blob = await (await fetch(imgLocalUri)).blob();
    const storageRef = ref(storage, `users/${uid}/profile.jpg`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

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
        photoURL: newPhotoURL,
      });
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
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Edit Profile</Text>

      <TouchableOpacity onPress={pickImage} style={styles.imageBox}>
        {imgLocalUri || form.photoURL ? (
          <Image
            source={{ uri: imgLocalUri || form.photoURL }}
            style={styles.avatar}
          />
        ) : (
          <Text style={{ color: "#1E88E5" }}>+ Select Profile Picture</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={form.fullName}
        onChangeText={(v) => setForm({ ...form, fullName: v })}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={form.email}
        editable={false} // email not editable
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={saveProfile}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelBtn]}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, paddingTop: 80 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  imageBox: {
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 20,
    borderRadius: 10,
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: { color: "#888" },
});