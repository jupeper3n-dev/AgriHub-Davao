import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";

import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProductDetailsModal() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [imageFromDb, setImageFromDb] = useState<string | null>(null);
  const [postOwnerId, setPostOwnerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const id = params.id || params.productId;
  if (!id) {
    console.warn("No product ID found in params");
    return;
  }

  (async () => {
    try {
      const ref = doc(db, "products", id as string);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setPostOwnerId(data.userId || null);

        // STEP 1: Determine user type from product itself
        let type = (data.userType || "").toLowerCase();

        // STEP 2: If not in product, look up user's profile
        if (!type && data.userId) {
          const userRef = doc(db, "users", data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            type = (userData.userType || "consumer").toLowerCase();
          } else {
            type = "consumer";
          }
        }

        setUserType(type);

        // STEP 3: Handle image as before
        const validUrl =
          typeof data.imageUrl === "string"
            ? data.imageUrl
            : Array.isArray(data.imageUrl)
            ? data.imageUrl[0]
            : data.imageUrl?.uri || null;

        if (validUrl) {
          setImageFromDb(validUrl);
          console.log("Loaded image from Firestore:", validUrl);
        } else {
          console.warn("No imageUrl in Firestore for", id);
        }
      }
    } catch (err) {
      console.error("Error fetching image from Firestore:", err);
    } finally {
      setLoading(false);
    }
  })();
}, []);

  const {
    title,
    category,
    price,
    description,
    specifications,
    locationName,
    lat,
    lng,
    userName,
    imageUrl,
  } = params;

  // Use same image as Dashboard (no decoding/re-encoding)
  const finalImage = imageFromDb || null;

if (loading) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)" }}>
      <ActivityIndicator size="large" color="#4A8C2A" />
    </View>
  );
}


  return (
    <View style={styles.overlay}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Post Details</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Simplified Image Section */}
        {finalImage ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setFullscreenImage(finalImage)}
          >
            <Image
              source={{ uri: finalImage }}
              style={styles.image}
              resizeMode="cover"
              onError={(e) => {
                console.log(" Image load error:", e.nativeEvent.error);
                console.log(" Image URL:", finalImage);
              }}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={40} color="#aaa" />
            <Text style={{ color: "#aaa" }}>No Image</Text>
          </View>
        )}

          {/* Product Info */}
          <View style={styles.contentBox}>
            <Text style={styles.title}>{title || "Untitled Product"}</Text>

            {/* Category */}
            <View style={styles.infoRow}>
              <Ionicons name="pricetag-outline" size={18} color="#4A8C2A" />
              <Text style={styles.label}>Category:</Text>
              <Text style={styles.value}>{category || "N/A"}</Text>
            </View>

            {userType !== "consumer" && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={18} color="#4A8C2A" />
                <Text style={styles.label}>Price:</Text>
                <Text
                  style={[styles.value, { color: "#1E88E5", fontWeight: "bold" }]}
                >
                  ₱ {price || "N/A"}
                </Text>
              </View>
            )}

            {/* Posted By */}
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color="#4A8C2A" />
              <Text style={styles.label}>Posted by:</Text>
              <Text style={styles.value}>{userName || "Unknown User"}</Text>
            </View>

            {/* Description */}
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.text}>
              {description || "No description provided."}
            </Text>

            {userType !== "consumer" && (
              <>
                <Text style={styles.sectionTitle}>Store Location</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={18} color="#4A8C2A" />
                  <Text style={styles.label}>Location:</Text>
                  <Text style={styles.value}>
                    {locationName
                      ? `${locationName}`
                      : lat && lng
                      ? `Location selected (${lat}, ${lng})`
                      : "Not provided"}
                  </Text>
                </View>

                {lat && lng && (
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/modals/view-map",
                        params: { lat, lng, locationName },
                      })
                    }
                  >
                    <Ionicons name="map-outline" size={18} color="#fff" />
                    <Text style={styles.mapBtnText}>See Location</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            </View>
        </ScrollView>
      </View>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity
            style={styles.fullscreenOverlay}
            activeOpacity={1}
            onPress={() => setFullscreenImage(null)}
          >
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#b6b6b679",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "92%",
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#4A8C2A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  image: {
    width: "100%",
    height: 240,
    backgroundColor: "#eee",
  },
  imagePlaceholder: {
    width: "100%",
    height: 240,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  contentBox: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 12,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  label: {
    marginLeft: 6,
    fontWeight: "600",
    color: "#333",
    fontSize: 15,
  },
  value: {
    marginLeft: 4,
    fontSize: 15,
    color: "#555",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 14,
    color: "#333",
  },
  text: {
    color: "#555",
    marginTop: 4,
    lineHeight: 20,
    fontSize: 15,
  },
  mapBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#4A8C2A",
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  mapBtnText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 6,
    fontSize: 15,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenClose: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
  },
});