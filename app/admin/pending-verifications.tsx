// app/admin/pending-verifications.tsx
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../firebaseConfig";

export default function PendingVerifications() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPending = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "user_verifications"));
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.status === "pending") list.push({ id: d.id, ...data });
      });
      setPending(list);
      setLoading(false);
    };
    fetchPending();
  }, []);

  const handleDecision = async (item: any, approve: boolean) => {
    const userRef = doc(db, "users", item.userId);
    const verifyRef = doc(db, "user_verifications", item.id);
    try {
      if (approve) {
        await updateDoc(userRef, { verified: true });
        await updateDoc(verifyRef, { status: "approved" });
        Alert.alert("✅ Approved", "User is now verified.");
      } else {
        await updateDoc(verifyRef, { status: "rejected" });
        Alert.alert("❌ Rejected", "Verification has been rejected.");
      }
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to update verification status.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pending Verifications</Text>
      {loading ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>User ID: {item.userId}</Text>
              <View style={styles.imageRow}>
                <Image source={{ uri: item.frontIdUrl }} style={styles.image} />
                <Image source={{ uri: item.backIdUrl }} style={styles.image} />
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#4A8C2A" }]}
                  onPress={() => handleDecision(item, true)}
                >
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#E53935" }]}
                  onPress={() => handleDecision(item, false)}
                >
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
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
  card: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  name: { fontWeight: "bold", marginBottom: 8 },
  imageRow: { flexDirection: "row", justifyContent: "space-between" },
  image: { width: "48%", height: 120, borderRadius: 6 },
  actions: { flexDirection: "row", marginTop: 10, justifyContent: "space-around" },
  btn: { padding: 8, borderRadius: 8, flex: 1, alignItems: "center", marginHorizontal: 4 },
  btnText: { color: "#fff", fontWeight: "bold" },
  loading: { textAlign: "center", color: "#888", marginTop: 20 },
});