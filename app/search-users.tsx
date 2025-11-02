import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function SearchUsers() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  // ✅ Fetch logged-in user's role
  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserRole(userDoc.data().userType || "Store Owner");
      } else {
        setUserRole("Store Owner");
      }
    };
    fetchUserRole();
  }, []);

  // ✅ Auto-search when typing (debounced)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (search.trim().length > 0) handleSearch();
      else setResults([]);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // ✅ Perform search with role filtering
  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        orderBy("fullName"),
        where("fullName", ">=", search),
        where("fullName", "<=", search + "\uf8ff")
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      let filtered = list;
      if (userRole?.toLowerCase() === "farmer" || userRole?.toLowerCase() === "consumer") {
        filtered = list.filter(
          (u) => (u.userType || "").toLowerCase() === "store owner"
        );
      }

      // Store owners see everyone
      const currentUid = auth.currentUser?.uid;
      filtered = filtered.filter((u) => u.id !== currentUid);

      setResults(filtered);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 🔹 Sticky Header with Back Button + Search */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Users</Text>
      </View>

      {/* 🔹 Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#1E88E5" />
          <TextInput
            style={styles.input}
            placeholder="Search users by name..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* 🔹 Loading Spinner */}
      {loading && <ActivityIndicator size="large" color="#1E88E5" style={{ marginTop: 20 }} />}

      {/* 🔹 Results List */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() =>
              router.push({ pathname: "/profile-view", params: { uid: item.id } })
            }
          >
            <Image
              source={{
                uri: item.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
              }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.role}>{item.userType}</Text>
              {item.verified ? (
                <Text style={{ color: "#43A047", fontWeight: "600" }}>✅ Verified</Text>
              ) : (
                <Text style={{ color: "#E53935", fontWeight: "600" }}>❌ Not Verified</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && search.trim() ? (
            <Text style={styles.emptyText}>No users found.</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 50 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },

  stickyHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A8C2A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 40,
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },

  searchBarContainer: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 16, color: "#000" },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 1,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  name: { fontSize: 16, fontWeight: "600", color: "#333" },
  role: { color: "#1E88E5", fontSize: 14 },
  emptyText: { textAlign: "center", color: "#777", marginTop: 30 },
});