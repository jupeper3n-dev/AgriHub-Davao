import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { db } from "../../firebaseConfig";

export default function ReportedUsers() {
  const [reportedUsers, setReportedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [suspendDays, setSuspendDays] = useState("");

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "reports"));
      const reportsMap: Record<string, any> = {};

      snap.forEach((d) => {
        const data = d.data();
        const reportedId = data.reportedId;
        if (!reportsMap[reportedId]) {
          reportsMap[reportedId] = { count: 0, reasons: [], userId: reportedId };
        }
        reportsMap[reportedId].count += 1;
        reportsMap[reportedId].reasons.push(data.reason);
      });

      // Fetch user data
      const list: any[] = [];
      for (const userId of Object.keys(reportsMap)) {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          list.push({
            ...userSnap.data(),
            id: userId,
            reports: reportsMap[userId].count,
            reasons: reportsMap[userId].reasons,
          });
        }
      }

      // Sort descending by report count
      list.sort((a, b) => b.reports - a.reports);
      setReportedUsers(list);
      setLoading(false);
    };

    fetchReports();
  }, []);

  const handleSuspend = async () => {
    if (!selectedUser) return;
    const days = parseInt(suspendDays);
    if (isNaN(days) || days <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid number of days.");
      return;
    }

    const suspendUntil = new Date();
    suspendUntil.setDate(suspendUntil.getDate() + days);

    try {
      await updateDoc(doc(db, "users", selectedUser.id), {
        suspendedUntil: suspendUntil,
      });
      Alert.alert("✅ User Suspended", `${selectedUser.fullName} is suspended for ${days} days.`);
      setModalVisible(false);
      setSuspendDays("");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to suspend user.");
    }
  };

  const handleBan = async (user: any) => {
    Alert.alert(
      "Confirm Ban",
      `Are you sure you want to permanently ban ${user.fullName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ban",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "users", user.id), { banned: true });
              Alert.alert("🚫 User Banned", `${user.fullName} has been permanently banned.`);
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Failed to ban user.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reported Users</Text>
      {loading ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : reportedUsers.length === 0 ? (
        <Text style={styles.empty}>No reported users found.</Text>
      ) : (
        <FlatList
          data={reportedUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.fullName || "Unnamed User"}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.reports}>Reports: {item.reports}</Text>
              <Text style={styles.reasonTitle}>Reasons:</Text>
              {item.reasons.slice(0, 3).map((r: string, i: number) => (
                <Text key={i} style={styles.reasonText}>
                  • {r}
                </Text>
              ))}
              {item.reasons.length > 3 && (
                <Text style={{ color: "#999" }}>+{item.reasons.length - 3} more...</Text>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#FFA000" }]}
                  onPress={() => {
                    setSelectedUser(item);
                    setModalVisible(true);
                  }}
                >
                  <Text style={styles.btnText}>Suspend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#E53935" }]}
                  onPress={() => handleBan(item)}
                >
                  <Text style={styles.btnText}>Ban</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Suspend Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Suspend {selectedUser?.fullName}</Text>
            <TextInput
              placeholder="Enter number of days"
              value={suspendDays}
              onChangeText={setSuspendDays}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4A8C2A" }]} onPress={handleSuspend}>
                <Text style={styles.modalText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#E53935" }]}
                onPress={() => setModalVisible(false)}
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
  name: { fontWeight: "bold", fontSize: 18 },
  email: { color: "#555" },
  reports: { marginTop: 6, color: "#E53935", fontWeight: "600" },
  reasonTitle: { marginTop: 4, fontWeight: "bold" },
  reasonText: { color: "#555", marginLeft: 6 },
  actions: { flexDirection: "row", marginTop: 10, justifyContent: "space-around" },
  btn: { padding: 8, borderRadius: 8, flex: 1, alignItems: "center", marginHorizontal: 4 },
  btnText: { color: "#fff", fontWeight: "bold" },
  empty: { textAlign: "center", color: "#888", marginTop: 20 },
  loading: { textAlign: "center", color: "#888", marginTop: 20 },

  // Modal
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
    padding: 8,
    marginBottom: 10,
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  modalBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center", marginHorizontal: 4 },
  modalText: { color: "#fff", fontWeight: "bold" },
});
