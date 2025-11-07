import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";
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
import { auth, db, storage } from "../../firebaseConfig";

type Form = {
  title: string;
  description: string;
  price: string;
  category: string;
  imageUrl?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
};

export default function ProductForm() {
  const router = useRouter();
  const { id, lat, lng } = useLocalSearchParams();
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [imgLocalUri, setImgLocalUri] = useState<string | undefined>();
  const [form, setForm] = useState<Form>({
    title: "",
    description: "",
    price: "",
    category: "",
    imageUrl: undefined,
    locationName: "",
  });
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user’s location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setDeviceLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const productRef = doc(db, "products", String(id));
        const snap = await getDoc(productRef);

        if (snap.exists()) {
          const d = snap.data() as any;
          setForm({
            title: d.title || "",
            description: d.description || "",
            price: String(d.price ?? ""),
            category: d.category || "",
            imageUrl: d.imageUrl,
            locationName: d.locationName || "",
            lat: d.lat,
            lng: d.lng,
          });
        } else {
          console.warn("Product not found:", id);
        }
      } catch (error) {
        console.error("Firestore fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Update location name from map
  useEffect(() => {
    if (lat && lng) {
      setForm((prev) => ({
        ...prev,
        locationName: `Location selected (${parseFloat(lat as string).toFixed(4)}, ${parseFloat(
          lng as string
        ).toFixed(4)})`,
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
      }));
    }
  }, [lat, lng]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log(" Auth restored for ProductForm:", user.uid);
        loadUserRole(); // safely reloads userType
      } else {
        console.log(" No user logged in");
        setUserType(null);
      }
    });

    return () => unsub();
  }, []);

  const loadUserRole = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const type = (snap.data().userType || "Store Owner").toLowerCase();
        setUserType(type);
        setForm((prev) => ({ ...prev, category: type }));
      } else {
        setUserType("store owner");
        setForm((prev) => ({ ...prev, category: "store owner" }));
      }
    } catch (err) {
      console.error("Failed to load user role:", err);
    }
  };

  // Pick image
  const pickImage = async () => {
    Alert.alert(
      "Select Option",
      "Would you like to capture a new photo or choose from gallery?",
      [
        {
          text: "Camera",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Allow access to your camera.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled) setImgLocalUri(result.assets[0].uri);
          },
        },
        {
          text: "Gallery",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Allow access to your photos.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled) setImgLocalUri(result.assets[0].uri);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // Upload image if present
  const uploadImageIfAny = async (productId: string, uid: string) => {
    try {
      if (!imgLocalUri) return form.imageUrl;

      console.log("Uploading image:", imgLocalUri);
      const response = await fetch(imgLocalUri);
      const blob = await response.blob();

      const storageRef = ref(storage, `products/${uid}/${productId}.jpg`);
      await uploadBytes(storageRef, blob);

      const downloadURL = await getDownloadURL(storageRef);
      await new Promise((res) => setTimeout(res, 300));
      console.log("Final image URL:", downloadURL);

      return downloadURL;
    } catch (err) {
      console.error("Upload failed:", err);
      Alert.alert("Upload failed", "Unable to upload the image.");
      return null;
    }
  };

  // Save Product
  const save = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return Alert.alert("Not signed in");
      if (!form.title.trim()) {
        return Alert.alert("Missing fields", "Please fill in the post title.");
      }

      if (!imgLocalUri && !form.imageUrl) {
        return Alert.alert("Image Required", "Please upload a post image before posting.");
      }

      // Only enforce price and location for non-consumers
      if (userType !== "consumer") {
        if (!form.price.trim()) {
          return Alert.alert("Missing fields", "Please enter a price for your product.");
        }
        if (!form.lat || !form.lng) {
          return Alert.alert("Location Required", "Please pick a location on the map before posting.");
        }
      }

      setSaving(true);

      // Fetch user's name
      let userName = "Unknown User";
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as any;
        userName = data.fullName || data.displayName || user.email || "Unnamed User";
      }

      if (id) {
        // Update existing
        const newUrl = await uploadImageIfAny(String(id), user.uid);
        await updateDoc(doc(db, "products", String(id)), {
          ...form,
          userId: user.uid,
          userName,
          price: Number(form.price),
          imageUrl: newUrl,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const userType = (userData as any).userType || "Store Owner";

        const docRef = await addDoc(collection(db, "products"), {
          userId: user.uid,
          userName,
          userType,
          title: form.title,
          description: form.description,
          price: Number(form.price),
          category: userType, // optional display
          locationName: form.locationName || "",
          lat: form.lat || deviceLocation?.lat || null,
          lng: form.lng || deviceLocation?.lng || null,
          imageUrl: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const imageUrl = await uploadImageIfAny(docRef.id, user.uid);
        if (imageUrl) await updateDoc(docRef, { imageUrl });
      }

      Alert.alert("Success", `Post ${id ? "updated" : "uploaded"}!`);
      router.push({
        pathname: "/profile",
        params: { refresh: Date.now().toString() },
      });
    } catch (e: any) {
      console.error("Firestore error:", e);
      Alert.alert("Error", e.message);
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

  const isDisabled =
    saving ||
    !form.title.trim() ||
    (!imgLocalUri && !form.imageUrl) ||
    (userType !== "consumer" && (!form.price.trim() || !form.lat || !form.lng));

  // ---------- Layout (updated) ----------
  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{id ? "Edit Product" : "Add Post"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Image Picker */}
        <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
          {imgLocalUri || form.imageUrl ? (
            <Image source={{ uri: imgLocalUri || form.imageUrl }} style={styles.img} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={40} color="#4A8C2A" />
              <Text style={{ color: "#4A8C2A", marginTop: 8 }}>Select Image</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.card}>
          {/* Common fields for everyone */}
          <Text style={styles.label}>Post Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter post title"
            value={form.title}
            onChangeText={(v) => setForm({ ...form, title: v })}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: "top" }]}
            placeholder="Describe your post"
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            multiline
          />

          {/* Only show these if NOT a consumer */}
          {userType !== "consumer" && (
            <>
              <Text style={styles.label}>Price (₱)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v })}
              />

              <View style={styles.autoCategoryBox}>
                <Text style={styles.label}>Category</Text>
                <Text style={styles.categoryValue}>{form.category || "Loading..."}</Text>
              </View>

              <TouchableOpacity
                style={[styles.input, { justifyContent: "center" }]}
                onPress={() =>
                  router.push({
                    pathname: "/modals/location-picker",
                    params: { preserve: "true" },
                  })
                }
              >
                <Text style={{ color: form.locationName ? "#000" : "#999" }}>
                  {form.locationName || "Pick location on map"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            (saving || isDisabled) && { opacity: 0.6, backgroundColor: "#a5d6a7" },
          ]}
          onPress={save}
          disabled={isDisabled}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Upload Post</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4A8C2A",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  imageBox: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#f2f6f3",
  },
  img: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  autoCategoryBox: {
    backgroundColor: "#f0f7f0",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryValue: {
    color: "#4A8C2A",
    fontWeight: "bold",
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: "#4A8C2A",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    elevation: 3,
  },
  saveText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});