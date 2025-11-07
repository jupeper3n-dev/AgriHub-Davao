import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
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
import React, { useEffect, useState } from "react";
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
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [showReason, setShowReason] = useState(false);
  const router = useRouter();
  const { refresh } = useLocalSearchParams();
  
  const isFocused = useIsFocused();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setLoading(true);
        // this retriggers your main effect cleanly
      } else {
        setUserData(null);
        setMyProducts([]);
        setVerification(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isFocused) {
      console.log(" Profile not focused — skipping listeners");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    let unsubscribers: Array<() => void> = [];
    let timeoutId: any;

    const attachListeners = () => {
      console.log(" Attaching Profile listeners...");
      const userRef = doc(db, "users", user.uid);
      const unsub1 = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
          setLoading(false);
        }
      });

      const verifyRef = doc(db, "user_verifications", user.uid);
      const unsub2 = onSnapshot(verifyRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setVerification(data.status);
          setDeclineReason(data.declineReason || null);
        }
      });

      const q = query(
        collection(db, "products"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const unsub3 = onSnapshot(q, (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setMyProducts(list);
        setLoading(false);
      });

      unsubscribers = [unsub1, unsub2, unsub3];
    };

    // Delay listener setup slightly to ensure old listeners are gone
    timeoutId = setTimeout(attachListeners, 400);

    return () => {
      console.log(" Cleaning up Profile listeners...");
      clearTimeout(timeoutId);
      unsubscribers.forEach((u) => u());
      unsubscribers = [];
    };
  }, [isFocused]);

  const handleLogout = async () => {
    try {
      const user = auth.currentUser;

      if (user) {
        const userRef = doc(db, "users", user.uid);
        // Add a short timeout — avoids hanging forever on bad connections
        await Promise.race([
          updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp(),
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout updating user status")), 3000)
          ),
        ]);
      }

      await signOut(auth);
      console.log("Signed out successfully");
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
      Alert.alert("Logout Failed", "Please try again.");
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

let statusLabel = "Not Verified";
let statusColor = "#E53935";

if (userData?.verified === true || verification === "approved") {
  statusLabel = "Verified";
  statusColor = "#4CAF50"; // green
} else if (verification === "pending") {
  statusLabel = "Pending Verification";
  statusColor = "#FFC107"; // yellow
} else if (verification === "rejected") {
  statusLabel = "Rejected";
  statusColor = "#E53935"; // red
}

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
          {/* --- existing header (same as before) --- */}
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

            {userData?.userType && (
              <Text style={styles.roleBadge}>{userData.userType}</Text>
            )}

            <Text style={[styles.badge, { backgroundColor: statusColor }]}>
              {statusLabel}
            </Text>

            {/* Hide upload button if rejected */}
            {statusLabel === "Not Verified" && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => router.push("/modals/upload-verification")}
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.verifyBtnText}>Verify Account</Text>
              </TouchableOpacity>
            )}

            {/* Rejected users — show reason link */}
            {statusLabel === "Rejected" && (
              <>
                <TouchableOpacity onPress={() => setShowReason(!showReason)}>
                  <Text style={styles.reasonLink}>
                    {showReason ? "Hide reason" : "View reason"}
                  </Text>
                </TouchableOpacity>
                {showReason && declineReason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonTitle}>Reason for Rejection:</Text>
                    <Text style={styles.reasonText}>{declineReason}</Text>
                  </View>
                )}
              </>
            )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginTop: 10,
                }}
              >
              <TouchableOpacity
                style={[
                  styles.editButton,
                  {
                    backgroundColor: "#fff",
                    borderWidth: 2,
                    borderColor: "#4A8C2A",
                    alignItems: "center",
                  },
                ]}
                onPress={() => router.push("/modals/edit-profile")}
              >
                <Text style={[styles.editButtonText, { color: "#43A047" }]}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editButton,
                  {
                    backgroundColor:
                      statusLabel === "Verified" ? "#43A047" : "#a5d6a7", // dimmed green
                    opacity: statusLabel === "Verified" ? 1 : 0.6,
                  },
                ]}
                disabled={statusLabel !== "Verified"} // disable press
                onPress={() =>
                  router.push({
                    pathname: "/modals/product-form",
                    params: { from: "profile" },
                  })
                }
              >
                <Text style={styles.editButtonText}>
                  {statusLabel === "Verified" ? "Add Post" : "Verify to Add Post"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu Options */}
          <View style={styles.optionGroup}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push("/saved-posts")}
            >
              <Ionicons name="bookmark-outline" size={22} color="#43A047" />
              <Text style={[styles.optionText, { color: "#43A047" }]}>
                Saved Posts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="red" />
              <Text style={[styles.optionText, { color: "red" }]}>Logout</Text>
            </TouchableOpacity>
          </View>

            <>
              <Text style={styles.sectionTitle}>My Posts</Text>
              {myProducts.length === 0 && (
                <Text
                  style={{
                    color: "#888",
                    paddingHorizontal: 20,
                    marginBottom: 20,
                  }}
                >
                  You haven’t posted anything yet.
                </Text>
              )}
            </>
        </>
      }
      renderItem={({ item }) =>
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
                      params: { id: item.id, from: "profile" },
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
      }
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
    borderColor: "#43A047",
  },
  name: { fontSize: 22, fontWeight: "bold", color: "#222" },
  email: { fontSize: 14, color: "#666", marginBottom: 6 },
  roleBadge: {
    fontSize: 16,
    color: "#43A047",
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
    minWidth: 120,
    alignItems: "center",
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
  cardTitle: { fontSize: 20, fontWeight: "600", color: "#43A047" },
  cardSub: { fontSize: 14, color: "#777", marginTop: 2 },
  cardPrice: { fontWeight: "700", color: "#43A047", marginTop: 6 },
  cardActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { color: "#43A047", fontWeight: "600" },
  reasonLink: {
  color: "#1E88E5",
  marginTop: 6,
  textDecorationLine: "underline",
  fontWeight: "500",
  },
  reasonBox: {
    backgroundColor: "#fdecea",
    borderLeftWidth: 4,
    borderLeftColor: "#E53935",
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    width: "85%",
    alignSelf: "center",
  },
  reasonTitle: {
    color: "#E53935",
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  reasonText: {
    color: "#333",
    fontSize: 13,
    textAlign: "center",
  },
});