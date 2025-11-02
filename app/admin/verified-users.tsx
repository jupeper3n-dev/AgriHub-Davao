// app/admin/verified-users.tsx
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../firebaseConfig";

export default function VerifiedUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const q = query(collection(db, "users"), where("verified", "==", true));
      const snap = await getDocs(q);
      let list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      if (filter !== "All") list = list.filter((u) => u.userType === filter);
      setUsers(list);
      setLoading(false);
    };
    fetchUsers();
  }, [filter]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verified Users</Text>

      <View style={styles.filterRow}>
        {["All", "Farmer", "Consumer", "Store Owner"].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterBtn, filter === cat && styles.filterActive]}
            onPress={() => setFilter(cat)}
          >
            <Text style={[styles.filterText, filter === cat && styles.filterTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.role}>{item.userType}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  filterRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  filterBtn: { padding: 8, borderRadius: 6, backgroundColor: "#eee" },
  filterActive: { backgroundColor: "#4A8C2A" },
  filterText: { color: "#333" },
  filterTextActive: { color: "#fff", fontWeight: "bold" },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  name: { fontSize: 18, fontWeight: "bold" },
  email: { color: "#555" },
  role: { color: "#1E88E5", fontWeight: "600" },
  loading: { textAlign: "center", color: "#888", marginTop: 20 },
});