import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
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
import { auth, db } from "../../firebaseConfig";

const storage = getStorage();

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

  // 🧭 Get user’s location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setDeviceLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  // 🧩 Load product if editing
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "products", String(id)));
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
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // 🧠 Update location name from map
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

  // 🧍‍♂️ Set user’s role automatically
  useEffect(() => {
    const loadUserRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const type = snap.data().userType || "Store Owner";
        setForm((prev) => ({ ...prev, category: type }));
      } else {
        setForm((prev) => ({ ...prev, category: "Store Owner" }));
      }
    };
    loadUserRole();
  }, []);

  // 🖼️ Pick image
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled) setImgLocalUri(res.assets[0].uri);
  };

  // ☁️ Upload image if present
  const uploadImageIfAny = async (productId: string, uid: string) => {
    const uri = imgLocalUri;
    if (!uri) return form.imageUrl;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const storageRef = ref(storage, `products/${uid}/${productId}.jpg`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // 💾 Save Product
  const save = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return Alert.alert("Not signed in");
      if (!form.title || !form.price) {
        return Alert.alert("Missing fields", "Title and price are required.");
      }

      setSaving(true);

      // 🧾 Fetch user's name
      let userName = "Unknown User";
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        userName = data.fullName || data.displayName || user.email || "Unnamed User";
      }

      if (id) {
        // ✏️ Update existing
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
        // 🆕 Create new
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const userType = userData.userType || "Store Owner";

        const docRef = await addDoc(collection(db, "products"), {
          userId: user.uid,
          userName,
          userType, // ✅ new field for filtering
          title: form.title,
          description: form.description,
          price: Number(form.price),
          category: form.category, // optional: you can keep this for display
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

      Alert.alert("✅ Success", `Product ${id ? "updated" : "created"}!`);
      router.back();
    } catch (e: any) {
      console.error("🔥 Firestore error:", e);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{id ? "Edit Product" : "Add Product"}</Text>

      {/* 🖼️ Image Picker */}
      <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
        {imgLocalUri || form.imageUrl ? (
          <Image source={{ uri: imgLocalUri || form.imageUrl }} style={styles.img} />
        ) : (
          <Text style={{ color: "#1E88E5" }}>+ Select Image</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Title"
        value={form.title}
        onChangeText={(v) => setForm({ ...form, title: v })}
      />

      <TextInput
        style={[styles.input, { height: 90 }]}
        placeholder="Description"
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
        multiline
      />

      <TextInput
        style={styles.input}
        placeholder="Price (₱)"
        value={form.price}
        onChangeText={(v) => setForm({ ...form, price: v })}
        keyboardType="numeric"
      />

      {/* 🏷️ Category Display (auto-set) */}
      <View style={styles.autoCategoryBox}>
        <Text style={{ fontWeight: "bold", color: "#000" }}>Category:</Text>
        <Text style={{ color: "#1E88E5", fontSize: 16, fontWeight: "600" }}>
          {form.category || "Loading..."}
        </Text>
      </View>

      {/* 📍 Location Picker */}
      <TouchableOpacity
        style={[styles.input, { justifyContent: "center" }]}
        onPress={() => {
          router.push({
            pathname: "/modals/location-picker",
            params: { preserve: "true" },
          });
        }}
      >
        <Text style={{ color: form.locationName ? "#000" : "#999" }}>
          {form.locationName || "📍 Pick location on map"}
        </Text>
      </TouchableOpacity>

      {/* 💾 Save */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, paddingTop: 100 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  imageBox: {
    height: 160,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  img: { width: "100%", height: "100%", borderRadius: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  autoCategoryBox: {
    backgroundColor: "#f2f6fa",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  saveBtn: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});