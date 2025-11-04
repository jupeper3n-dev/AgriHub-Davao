import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../firebaseConfig";

const storage = getStorage();

export default function UploadVerification() {
  const router = useRouter();
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | null>(null);

  // Load verification status
  useEffect(() => {
    const fetchStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "user_verifications", user.uid));
      if (snap.exists()) setStatus(snap.data().status);
    };
    fetchStatus();
  }, []);

  const pickImage = async (setImage: (uri: string) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string, path: string) => {
    const blob = await (await fetch(uri)).blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const submit = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Error", "User not signed in.");

    if (!frontUri || !backUri) {
      return Alert.alert("Missing Documents", "Please upload both front and back images.");
    }

    try {
      setUploading(true);
      const frontUrl = await uploadImage(frontUri, `verifications/${user.uid}/front.jpg`);
      const backUrl = await uploadImage(backUri, `verifications/${user.uid}/back.jpg`);

      await setDoc(doc(db, "user_verifications", user.uid), {
        userId: user.uid,
        frontIdUrl: frontUrl,
        backIdUrl: backUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      Alert.alert("Submitted", "Your documents have been submitted for verification.");
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  // Block re-upload if already pending/approved
  if (status === "pending" || status === "approved") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Verification Status</Text>
        <Text
          style={[
            styles.statusText,
            status === "approved"
              ? { color: "#4CAF50" }
              : { color: "#FFC107" },
          ]}
        >
          {status === "approved"
            ? "Your account is verified!"
            : "Your verification is under review."}
        </Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.closeText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Verification Documents</Text>
      <Text style={styles.subtitle}>
        Please upload clear images of your valid ID (front and back).
      </Text>

      {/* Front ID Upload */}
      <TouchableOpacity
        style={styles.imageBox}
        onPress={() => pickImage(setFrontUri)}
      >
        {frontUri ? (
          <Image source={{ uri: frontUri }} style={styles.preview} />
        ) : (
          <Text style={{ color: "#1E88E5" }}> Upload Front ID</Text>
        )}
      </TouchableOpacity>

      {/* Back ID Upload */}
      <TouchableOpacity
        style={styles.imageBox}
        onPress={() => pickImage(setBackUri)}
      >
        {backUri ? (
          <Image source={{ uri: backUri }} style={styles.preview} />
        ) : (
          <Text style={{ color: "#1E88E5" }}> Upload Back ID</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitBtn, uploading && { opacity: 0.6 }]}
        disabled={uploading}
        onPress={submit}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit for Review</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 10, color: "#222" },
  subtitle: {
    color: "#666",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  imageBox: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  preview: { width: "100%", height: "100%", borderRadius: 10 },
  submitBtn: {
    backgroundColor: "#4A8C2A",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: { alignItems: "center", padding: 8 },
  cancelText: { color: "#1E88E5", fontSize: 14 },
  closeBtn: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  closeText: { color: "#fff", fontWeight: "bold" },
  statusText: { fontSize: 16, fontWeight: "600", marginTop: 10 },
});