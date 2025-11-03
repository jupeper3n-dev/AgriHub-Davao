import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

type Product = {
  id: string;
  title: string;
  price: number;
  imageUrl?: string;
  category?: string;
  locationName?: string;
};

export default function ProfileScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [verification, setVerification] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);

  const router = useRouter();
  const { refresh } = useLocalSearchParams();

  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user) return;

      // Guards
      let isMounted = true;
      let unsubUser: (() => void) | null = null;
      let unsubVerify: (() => void) | null = null;
      let unsubProducts: (() => void) | null = null;

      // Debounce to avoid overlapping listeners on rapid focus transitions
      const timer = setTimeout(() => {
        if (!isMounted) return;

        try {
          const userRef = doc(db, "users", user.uid);
          unsubUser = onSnapshot(
            userRef,
            (snap) => {
              if (!isMounted) return;
              if (snap.exists()) setUserData(snap.data());
              setLoading(false);
            },
            (err) => console.warn("users listener:", err.message)
          );

          const verifyRef = doc(db, "user_verifications", user.uid);
          unsubVerify = onSnapshot(
            verifyRef,
            (snap) => {
              if (!isMounted) return;
              if (snap.exists()) {
                setVerification(snap.data().status);
              } else if (userData?.verified) {
                setVerification("approved");
              } else {
                setVerification(null);
              }
            },
            (err) => console.warn("verifications listener:", err.message)
          );

          const q = query(
            collection(db, "products"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
          );

          unsubProducts = onSnapshot(
            q,
            (snap) => {
              if (!isMounted) return;
              const rows: Product[] = [];
              snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
              setMyProducts(rows);
            },
            (err) => console.warn("products listener:", err.message)
          );
        } catch (e: any) {
          console.error("Firestore subscription error:", e.message);
        }
      }, 300); // delay ensures previous listener cleanup finishes first

      // Cleanup
      return () => {
        isMounted = false;
        clearTimeout(timer);
        try {
          unsubUser && unsubUser();
          unsubVerify && unsubVerify();
          unsubProducts && unsubProducts();
          console.log("ProfileScreen listeners cleaned up safely");
        } catch (e) {
          console.warn("Cleanup error:", e);
        }
      };
    }, [refresh])
  );

  const handleLogout = async () => {
    try {
      const user = auth.currentUser;

      if (user) {
        const userRef = doc(db, "users", user.uid);

        // Update Firestore *before* signing out
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });

        console.log("User set offline in Firestore before logout");
      }

      // Now safe to log out
      await signOut(auth);

      console.log("Signed out successfully");
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete", "Remove this product?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "products", id));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

// Unified verification status
let statusLabel = "Not Verified"; // default
let statusColor = "#E53935"; // red

if (userData?.verified === true || verification === "approved") {
  statusLabel = "Verified";
  statusColor = "#4CAF50"; // green
} else if (verification === "pending") {
  statusLabel = "Pending Verification";
  statusColor = "#FFC107"; // yellow
}

  return (
    <FlatList
      style={styles.container}
      data={myProducts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Image
              source={{
                uri:
                  userData?.photoURL ||
                  "https://cdn-icons-png.flaticon.com/512/149/149071.png",
              }}
              style={styles.avatar}
            />
            <Text style={styles.name}>{userData?.fullName || "No Name"}</Text>
            <Text style={styles.email}>{userData?.email}</Text>

            {/* Role Display */}
            {userData?.userType && (
              <Text style={styles.roleBadge}>
                {userData.userType}
              </Text>
            )}

            {/* Verification Badges */}
            <Text style={[styles.badge, { backgroundColor: statusColor }]}>
              {statusLabel === "Verified"
                ? "Verified"
                : statusLabel === "Pending Verification"
                ? "Pending Verification"
                : "Not Verified"}
            </Text>

            {statusLabel === "Not Verified" && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => router.push("/modals/upload-verification")}
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.verifyBtnText}>Verify Account</Text>
              </TouchableOpacity>
            )}

            {/* Edit & Add Product */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => router.push("/modals/edit-profile")}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: "#43A047" }]}
                onPress={() => {
                  if (statusLabel !== "Verified") {
                    Alert.alert(
                      "Account Not Verified",
                      "You must verify your account before adding products.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Verify Now",
                          onPress: () => router.push("/modals/upload-verification"),
                        },
                      ]
                    );
                  } else {
                    router.push("/modals/product-form");
                  }
                }}
              >
                <Text style={styles.editButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu Options */}
          <View style={styles.optionGroup}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push("/saved-posts")}
            >
              <Ionicons name="bookmark-outline" size={22} color="#1E88E5" />
              <Text style={[styles.optionText, { color: "#1E88E5" }]}>
                Saved Posts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="red" />
              <Text style={[styles.optionText, { color: "red" }]}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>My Products</Text>
          {myProducts.length === 0 && (
            <Text style={{ color: "#888", paddingHorizontal: 20, marginBottom: 20 }}>
              You haven’t posted anything yet.
            </Text>
          )}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImg} />
          ) : (
            <View style={[styles.cardImg, { backgroundColor: "#eee" }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>{item.category || "Uncategorized"}</Text>
            <Text style={styles.cardPrice}>₱ {item.price}</Text>

            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/modals/product-form",
                    params: { id: item.id },
                  })
                }
              >
                <Text style={styles.link}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={[styles.link, { color: "red" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#f5f7fb",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: "#1E88E5",
  },
  name: { fontSize: 22, fontWeight: "bold", color: "#222" },
  email: { fontSize: 14, color: "#666", marginBottom: 6 },
  roleBadge: {
    fontSize: 14,
    color: "#1E88E5",
    fontWeight: "600",
    marginBottom: 10,
  },
  badge: {
    color: "#fff",
    fontWeight: "bold",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E88E5",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  verifyBtnText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 6,
  },
  editButton: {
    backgroundColor: "#1E88E5",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editButtonText: { color: "#fff", fontWeight: "600" },
  optionGroup: { paddingHorizontal: 20, paddingVertical: 15 },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: "#e5e5e5",
  },
  optionText: { marginLeft: 15, fontSize: 16, color: "#333" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImg: { width: 78, height: 78, borderRadius: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#222" },
  cardSub: { fontSize: 12, color: "#777", marginTop: 2 },
  cardPrice: { fontWeight: "700", color: "#1E88E5", marginTop: 6 },
  cardActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { color: "#1E88E5", fontWeight: "600" },
});