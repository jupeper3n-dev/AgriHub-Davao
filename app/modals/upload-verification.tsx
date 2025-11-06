import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

const storage = getStorage();

export default function UploadVerification() {
  const router = useRouter();
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Load user info and verification status
  useEffect(() => {
    const fetchUserInfo = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Get verification status
      const verificationSnap = await getDoc(doc(db, "user_verifications", user.uid));
      if (verificationSnap.exists()) setStatus(verificationSnap.data().status);

      // Get role
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        setUserRole((userSnap.data().userType || "consumer").toLowerCase());
      }
    };
    fetchUserInfo();
  }, []);

  const pickImage = async (setImage: (uri: string) => void) => {
    Alert.alert(
      "Select Option",
      "Would you like to capture a new photo or choose from gallery?",
      [
        {
          text: "Camera",
          onPress: async () => {
            const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
            if (!cameraPerm.granted) {
              Alert.alert("Permission Required", "Please allow camera access to take a photo.");
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });

            if (!result.canceled) setImage(result.assets[0].uri);
          },
        },
        {
          text: "Gallery",
          onPress: async () => {
            const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!galleryPerm.granted) {
              Alert.alert("Permission Required", "Please allow access to your photo library.");
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });

            if (!result.canceled) setImage(result.assets[0].uri);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
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
      return Alert.alert("Missing Documents", "Please upload both front and back ID images.");
    }

    try {
      setUploading(true);

      const frontUrl = await uploadImage(frontUri, `verifications/${user.uid}/front.jpg`);
      const backUrl = await uploadImage(backUri, `verifications/${user.uid}/back.jpg`);

      await setDoc(doc(db, "user_verifications", user.uid), {
        userId: user.uid,
        role: userRole,
        frontIdUrl: frontUrl,
        backIdUrl: backUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      Alert.alert("Submitted", "Your valid ID has been submitted for verification.");
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  // Show status screen if pending/approved
  if (status === "pending" || status === "approved") {
    return (
      <View style={styles.centered}>
        <View style={styles.greenHeader}>
          <Text style={styles.headerText}>Verification Status</Text>
        </View>
        <Image
          source={require("@/assets/images/agrihub-davao-logo.png")}
          style={styles.logo}
        />
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
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Green Header (Full Width) */}
      <View style={styles.greenHeader}>
        <Text style={styles.headerText}>Upload Verification Documents</Text>
      </View>

      {/* Inner Content with Padding */}
      <View style={styles.innerContent}>
        <Image
          source={require("@/assets/images/agrihub-davao-logo.png")}
          style={styles.logo}
        />

        <Text style={styles.subtitle}>
          Please upload clear images of your valid government-issued ID (front and back).
        </Text>

        {/* Dynamic Upload Fields Based on Role */}
        {(() => {
          let firstLabel = "Upload Front ID";
          let secondLabel = "Upload Back ID";

          if (userRole === "store owner") {
            firstLabel = "Upload Business Permit";
            secondLabel = "Upload Valid ID";
          } else if (userRole === "farmer") {
            firstLabel = "Upload Front RFID / Farmer’s Card";
            secondLabel = "Upload Back RFID / Farmer’s Card";
          } else if (userRole === "consumer") {
            firstLabel = "Upload Picture";
            secondLabel = "Upload Valid ID";
          }

          return (
            <>
              <TouchableOpacity style={styles.imageBox} onPress={() => pickImage(setFrontUri)}>
                {frontUri ? (
                  <Image source={{ uri: frontUri }} style={styles.preview} />
                ) : (
                  <Text style={{ color: "#1E88E5" }}>{firstLabel}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.imageBox} onPress={() => pickImage(setBackUri)}>
                {backUri ? (
                  <Image source={{ uri: backUri }} style={styles.preview} />
                ) : (
                  <Text style={{ color: "#1E88E5" }}>{secondLabel}</Text>
                )}
              </TouchableOpacity>
            </>
          );
        })()}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  innerContent: { flex: 1, padding: 20, paddingTop: 30 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  greenHeader: {
    backgroundColor: "#4A8C2A",
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  headerText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  logo: {
    width: 100,
    height: 100,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: 10,
  },
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
  cancelBtn: { alignItems: "center", padding: 8, borderWidth: 1, borderColor: "#4A8C2A", borderRadius: 14},
  cancelText: { color: "#4A8C2A", fontSize: 14 },
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