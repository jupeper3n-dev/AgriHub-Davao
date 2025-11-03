// app/admin/pending-verifications.tsx
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

export default function PendingVerifications() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineModal, setDeclineModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    const fetchPending = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "user_verifications"));
      const list: any[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        if (data.status === "pending") {
          // fetch corresponding user details
          const userSnap = await getDoc(doc(db, "users", data.userId));
          if (userSnap.exists()) {
            list.push({
              id: d.id,
              ...data,
              user: userSnap.data(),
            });
          }
        }
      }

      setPending(list);
      setLoading(false);
    };
    fetchPending();
  }, []);

  const handleApprove = async (item: any) => {
    try {
      await updateDoc(doc(db, "users", item.userId), { verified: true });
      await updateDoc(doc(db, "user_verifications", item.id), { status: "approved" });
      Alert.alert("Approved", "User has been verified successfully.");
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to approve user.");
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) return Alert.alert("Reason required", "Please enter a reason.");
    try {
      await updateDoc(doc(db, "user_verifications", selectedUser.id), {
        status: "rejected",
        declineReason,
      });
      await updateDoc(doc(db, "users", selectedUser.userId), {
        verified: false,
        declineReason,
      });
      Alert.alert("Declined", "Verification has been declined.");
      setPending((prev) => prev.filter((p) => p.id !== selectedUser.id));
      setDeclineReason("");
      setSelectedUser(null);
      setDeclineModal(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to decline verification.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pending Verifications</Text>
      {loading ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : pending.length === 0 ? (
        <Text style={styles.empty}>No pending users.</Text>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.user?.fullName || "Unnamed"}</Text>
              <Text style={styles.email}>{item.user?.email}</Text>
              <Text style={styles.role}>Role: {item.user?.role}</Text>

              <View style={styles.imageRow}>
                {item.frontIdUrl ? (
                  <Image source={{ uri: item.frontIdUrl }} style={styles.image} />
                ) : null}
                {item.backIdUrl ? (
                  <Image source={{ uri: item.backIdUrl }} style={styles.image} />
                ) : null}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#4A8C2A" }]}
                  onPress={() => handleApprove(item)}
                >
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#E53935" }]}
                  onPress={() => {
                    setSelectedUser(item);
                    setDeclineModal(true);
                  }}
                >
                  <Text style={styles.btnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Decline Modal */}
      <Modal visible={declineModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Decline {selectedUser?.user?.fullName || "User"}
            </Text>
            <TextInput
              placeholder="Enter reason for declining..."
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#E53935" }]}
                onPress={handleDecline}
              >
                <Text style={styles.modalText}>Confirm Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#999" }]}
                onPress={() => setDeclineModal(false)}
              >
                <Text style={styles.modalText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  name: { fontWeight: "bold", fontSize: 16 },
  email: { color: "#555" },
  role: { color: "#777", marginBottom: 8 },
  imageRow: { flexDirection: "row", justifyContent: "space-between" },
  image: { width: "48%", height: 120, borderRadius: 6 },
  actions: { flexDirection: "row", marginTop: 10, justifyContent: "space-around" },
  btn: { padding: 8, borderRadius: 8, flex: 1, alignItems: "center", marginHorizontal: 4 },
  btnText: { color: "#fff", fontWeight: "bold" },
  loading: { textAlign: "center", color: "#888", marginTop: 20 },
  empty: { textAlign: "center", color: "#999", marginTop: 20 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    marginBottom: 10,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", justifyContent: "space-between" },
  modalBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  modalText: { color: "#fff", fontWeight: "bold" },
});