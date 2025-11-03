import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
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
  const [searchType, setSearchType] = useState<"users" | "products">("users");
  const [filterType, setFilterType] = useState<"All" | "Farmers" | "Consumers">("All");
  const router = useRouter();

  // Fetch logged-in user's role
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

  // Auto-search when typing (debounced)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (search.trim().length > 0) handleSearch();
      else setResults([]);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search, searchType, filterType]);

  // Perform search
  const handleSearch = async () => {
    if (!search.trim() || !userRole) return;
    setLoading(true);

    try {
      if (searchType === "users") {
        await handleUserSearch();
      } else {
        await handleProductSearch();
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Case-insensitive User Search
  const handleUserSearch = async () => {
    const keyword = search.trim();
    let resultsList: any[] = [];

    // Attempt uppercase version
    const q1 = query(
      collection(db, "users"),
      orderBy("fullName"),
      where("fullName", ">=", keyword.charAt(0).toUpperCase() + keyword.slice(1)),
      where("fullName", "<=", keyword.charAt(0).toUpperCase() + keyword.slice(1) + "\uf8ff")
    );
    const snap1 = await getDocs(q1);
    snap1.forEach((d) => resultsList.push({ id: d.id, ...d.data() }));

    // If no result, try lowercase fallback
    if (resultsList.length === 0) {
      const lower = keyword.toLowerCase();
      const q2 = query(
        collection(db, "users"),
        orderBy("fullName"),
        where("fullName", ">=", lower.charAt(0).toLowerCase() + lower.slice(1)),
        where("fullName", "<=", lower.charAt(0).toLowerCase() + lower.slice(1) + "\uf8ff")
      );
      const snap2 = await getDocs(q2);
      snap2.forEach((d) => resultsList.push({ id: d.id, ...d.data() }));
    }

    const currentUid = auth.currentUser?.uid;
    const role = userRole?.toLowerCase();
    let filtered: any[] = [];

    if (role === "store owner") {
      filtered = resultsList.filter(
        (u) =>
          (filterType === "All" ||
            (filterType === "Farmers" && u.userType?.toLowerCase() === "farmer") ||
            (filterType === "Consumers" && u.userType?.toLowerCase() === "consumer")) &&
          u.id !== currentUid
      );
    } else if (role === "farmer") {
      filtered = resultsList.filter(
        (u) => u.userType?.toLowerCase() === "store owner" && u.id !== currentUid
      );
    } else if (role === "consumer") {
      filtered = resultsList.filter(
        (u) => u.userType?.toLowerCase() === "farmer" && u.id !== currentUid
      );
    }

    setResults(filtered);
  };

  // 🔹 Case-insensitive Product Search
  const handleProductSearch = async () => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return;

    // Fetch all products ordered by title
    const q = query(collection(db, "products"), orderBy("title"));
    const snap = await getDocs(q);

    // Convert all to lowercase and filter manually
    const allProducts: any[] = [];
    snap.forEach((d) => allProducts.push({ id: d.id, ...d.data() }));

    const matched = allProducts.filter((p) =>
      (p.title || "").toLowerCase().includes(keyword)
    );

    const currentUid = auth.currentUser?.uid;
    const role = userRole?.toLowerCase();
    let filtered: any[] = [];

    if (role === "store owner") {
      filtered = matched.filter(
        (p) => p.category?.toLowerCase() === "farmer" && p.userId !== currentUid
      );
    } else if (role === "farmer") {
      filtered = matched.filter(
        (p) => p.category?.toLowerCase() === "store owner" && p.userId !== currentUid
      );
    } else if (role === "consumer") {
      filtered = matched.filter(
        (p) => p.category?.toLowerCase() === "farmer" && p.userId !== currentUid
      );
    }

    setResults(filtered);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Toggle Buttons */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === "users" && styles.toggleActive]}
          onPress={() => setSearchType("users")}
        >
          <Text
            style={[
              styles.toggleText,
              searchType === "users" && styles.toggleTextActive,
            ]}
          >
            Users
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, searchType === "products" && styles.toggleActive]}
          onPress={() => setSearchType("products")}
        >
          <Text
            style={[
              styles.toggleText,
              searchType === "products" && styles.toggleTextActive,
            ]}
          >
            Posts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Store Owner Filter */}
      {userRole?.toLowerCase() === "store owner" && searchType === "users" && (
        <View style={styles.filterRow}>
          {["All", "Farmers", "Consumers"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                filterType === type && styles.filterActive,
              ]}
              onPress={() => setFilterType(type as any)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterType === type && styles.filterTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#43A047" />
          <TextInput
            style={styles.input}
            placeholder={`Search ${searchType}...`}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color="#43A047" style={{ marginTop: 20 }} />}

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          searchType === "users" ? (
            <TouchableOpacity
              style={styles.userCard}
              onPress={() =>
                router.push({ pathname: "/profile-view", params: { uid: item.id } })
              }
            >
              <Image
                source={{
                  uri:
                    item.photoURL ||
                    "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                }}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.role}>{item.userType}</Text>
                {item.verified ? (
                  <Text style={{ color: "#43A047", fontWeight: "600" }}>Verified</Text>
                ) : (
                  <Text style={{ color: "#E53935", fontWeight: "600" }}>Not Verified</Text>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() =>
                router.push({
                  pathname: "/modals/product-details",
                  params: { ...item, imageUrl: item.imageUrl },
                })
              }
            >
              <Image
                source={{
                  uri:
                    item.imageUrl ||
                    "https://cdn-icons-png.flaticon.com/512/2748/2748558.png",
                }}
                style={styles.productImage}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.name}>{item.title}</Text>
                  <Text style={{ color: "#43A047", fontWeight: "bold" }}>₱ {item.price}</Text>
                </View>
                <Text numberOfLines={2} style={{ color: "#555", marginTop: 4 }}>
                  {item.description || "No description"}
                </Text>
              </View>
            </TouchableOpacity>
          )
        }
        ListEmptyComponent={
          !loading && search.trim() ? (
            <Text style={styles.emptyText}>No {searchType} found.</Text>
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
    paddingTop: 20,
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#e6e6e6",
    borderBottomWidth: 2,
    borderColor: "#43A047",
  },
  toggleButton: { flex: 1, alignItems: "center", paddingVertical: 10 },
  toggleActive: { backgroundColor: "#4A8C2A" },
  toggleText: { fontSize: 16, color: "#43A047" },
  toggleTextActive: { color: "#fff", fontWeight: "bold" },
  filterRow: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 6,
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  filterActive: { backgroundColor: "#4A8C2A", borderColor: "#4A8C2A" },
  filterText: { color: "#333", fontSize: 14 },
  filterTextActive: { color: "#fff" },
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
  productCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 1,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  productImage: { width: 70, height: 70, borderRadius: 8, marginRight: 10 },
  name: { fontSize: 16, fontWeight: "600", color: "#333" },
  role: { color: "#777", fontSize: 14 },
  emptyText: { textAlign: "center", color: "#000", marginTop: 30 },
});