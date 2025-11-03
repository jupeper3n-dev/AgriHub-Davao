import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const { width } = Dimensions.get("window");

export default function AdminPanel() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("Users");
  const [users, setUsers] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [verified, setVerified] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [suspendDays, setSuspendDays] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);


  // NEW STATES FOR DECLINE MODAL
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [selectedVerification, setSelectedVerification] = useState<any>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const userSnap = await getDocs(collection(db, "users"));
      const allUsers: any[] = [];
      userSnap.forEach((doc) => allUsers.push({ id: doc.id, ...doc.data() }));
      setUsers(allUsers);

      const verifiedSnap = await getDocs(
        query(collection(db, "users"), where("verified", "==", true))
      );
      const verifiedList: any[] = [];
      verifiedSnap.forEach((doc) =>
        verifiedList.push({ id: doc.id, ...doc.data() })
      );
      setVerified(verifiedList);

      // UPDATED PENDING TAB FETCH WITH USER INFO
      const pendingSnap = await getDocs(collection(db, "user_verifications"));
      const pendingList: any[] = [];
      for (const d of pendingSnap.docs) {
        const data = d.data();
        if (data.status === "pending") {
          const userRef = doc(db, "users", data.userId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          pendingList.push({
            id: d.id,
            ...data,
            fullName: userData.fullName || "Unknown",
            email: userData.email || "N/A",
            role: userData.role || "Unspecified",
            frontIdUrl: data.frontIdUrl,
            backIdUrl: data.backIdUrl,
          });
        }
      }
      setPending(pendingList);

      const reportSnap = await getDocs(collection(db, "reports"));
      const reportsMap: Record<string, any> = {};

      reportSnap.forEach((doc) => {
        const data = doc.data();
        const reportedId = data.reportedId;
        if (!reportsMap[reportedId]) {
          reportsMap[reportedId] = { count: 0, reasons: [], userId: reportedId };
        }
        reportsMap[reportedId].count += 1;
        reportsMap[reportedId].reasons.push(data.reason);
      });

      const reportsList: any[] = [];
      for (const userId of Object.keys(reportsMap)) {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          reportsList.push({
            ...userSnap.data(),
            id: userId,
            reports: reportsMap[userId].count,
            reasons: reportsMap[userId].reasons,
          });
        }
      }

      reportsList.sort((a, b) => b.reports - a.reports);
      setReports(reportsList);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      setTimeout(() => {
        setLoggingOut(false);
        router.replace("/login");
      }, 1000);
    } catch (err: any) {
      setLoggingOut(false);
      Alert.alert("Error", err.message);
    }
  };

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
        banned: false,
      });
      Alert.alert(
        "User Suspended",
        `${selectedUser.fullName} suspended for ${days} days.`
      );
      setModalVisible(false);
      setSuspendDays("");
      fetchData();
    } catch {
      Alert.alert("Error", "Failed to suspend user.");
    }
  };

  const handleBan = async (user: any) => {
    Alert.alert("Confirm Ban", `Ban ${user.fullName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Ban",
        style: "destructive",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "users", user.id), {
              banned: true,
              suspendedUntil: null,
            });
            Alert.alert("User Banned", `${user.fullName} has been banned.`);
            fetchData();
          } catch {
            Alert.alert("Error", "Failed to ban user.");
          }
        },
      },
    ]);
  };

  const handleReactivate = async (user: any) => {
    try {
      await updateDoc(doc(db, "users", user.id), {
        banned: false,
        suspendedUntil: null,
      });
      Alert.alert("User Reactivated", `${user.fullName} is active again.`);
      fetchData();
    } catch {
      Alert.alert("Error", "Failed to reactivate user.");
    }
  };

  // Approve/Decline Verifications
  const handleVerificationDecision = async (
    item: any,
    approve: boolean,
    reason?: string
  ) => {
    const userRef = doc(db, "users", item.userId);
    const verifyRef = doc(db, "user_verifications", item.id);
    try {
      if (approve) {
        await updateDoc(userRef, { verified: true });
        await updateDoc(verifyRef, {
          status: "approved",
          reviewedAt: new Date(),
        });
        Alert.alert(" Approved", `${item.fullName} is now verified.`);
      } else {
        await updateDoc(verifyRef, {
          status: "rejected",
          reason: reason || "No reason provided",
          reviewedAt: new Date(),
        });
        Alert.alert(" Rejected", "Verification declined.");
      }
      setDeclineModal(false);
      setDeclineReason("");
      // AUTO REFRESH
      fetchData();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to update verification.");
    }
  };

  const openDeclineModal = (item: any) => {
    setSelectedVerification(item);
    setDeclineModal(true);
  };

  const getUserStatus = (user: any) => {
    const isBanned = user.banned === true;
    const isSuspended = user.suspendedUntil &&
      new Date(user.suspendedUntil.toDate ? user.suspendedUntil.toDate() : user.suspendedUntil) > new Date();

    if (isBanned) return { label: "Banned", color: "#E53935" };
    if (isSuspended) return { label: "Suspended", color: "#FFA000" };
    return { label: "Active", color: "#4A8C2A" };
  };

  const renderReports = ({ item }: any) => {
    const status = getUserStatus(item);
    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.name}>{item.fullName || "Unknown User"}</Text>
          <Text style={[styles.statusBadge, { backgroundColor: status.color }]}>
            {status.label}
          </Text>
        </View>
        <Text style={styles.email}>{item.email}</Text>
        <Text style={styles.reports}>Reports: {item.reports}</Text>
        <Text style={styles.reasonTitle}>Reasons:</Text>
        {item.reasons.slice(0, 3).map((r: string, i: number) => (
          <Text key={i} style={styles.reasonText}>
            • {r}
          </Text>
        ))}
        {item.reasons.length > 3 && (
          <Text style={{ color: "#999" }}>
            +{item.reasons.length - 3} more...
          </Text>
        )}
        <View style={styles.actions}>
          {status.label === "Active" && (
            <>
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
            </>
          )}
          {(status.label === "Banned" || status.label === "Suspended") && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#4A8C2A" }]}
              onPress={() => handleReactivate(item)}
            >
              <Text style={styles.btnText}>Reactivate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getData = () => {
    switch (activeTab) {
      case "Users":
        return users;
      case "Pending":
        return pending;
      case "Verified":
        return verified;
      case "Reports":
        return reports;
      default:
        return [];
    }
  };

  const getRenderer = () => {
    if (activeTab === "Reports") return renderReports;

    // CUSTOM RENDERER FOR PENDING VERIFICATIONS
    if (activeTab === "Pending") {
      return ({ item }: any) => (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{item.fullName}</Text>
            <Text style={{ color: "#4A8C2A", fontWeight: "600" }}>
              {item.role}
            </Text>
          </View>
          <Text style={styles.email}>{item.email}</Text>
          <View style={styles.imageRow}>
            {item.frontIdUrl && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUrl(item.frontIdUrl);
                  setImageModalVisible(true);
                }}
              >
                <Image source={{ uri: item.frontIdUrl }} style={styles.image} />
              </TouchableOpacity>
            )}
            {item.backIdUrl && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUrl(item.backIdUrl);
                  setImageModalVisible(true);
                }}
              >
                <Image source={{ uri: item.backIdUrl }} style={styles.image} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#4A8C2A" }]}
              onPress={() => handleVerificationDecision(item, true)}
            >
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#E53935" }]}
              onPress={() => openDeclineModal(item)}
            >
              <Text style={styles.btnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // USERS/VERIFIED RENDERER WITH BADGE
    return ({ item }: any) => {
      const verified = item.verified ? "Verified " : "Unverified ";
      const badgeColor = item.verified ? "#4A8C2A" : "#FFA000";

      return (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{item.fullName || item.userId}</Text>
            <Text
              style={[styles.statusBadge, { backgroundColor: badgeColor }]}
            >
              {verified}
            </Text>
          </View>
          <Text style={styles.email}>{item.email}</Text>
        </View>
      );
    };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <Image
            source={require("@/assets/images/agrihub-davao-logo.png")}
            style={styles.logo}
          />
          <Text style={styles.headerTitle}>Admin Panel</Text>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          {loggingOut ? (
            <ActivityIndicator size="small" color="#4A8C2A" />
          ) : (
            <Text style={styles.logoutText}>Logout</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {["Users", "Pending", "Verified", "Reports"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.activeTabText]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#4A8C2A"
          style={{ marginTop: 30 }}
        />
      ) : (
        <FlatList
          data={getData()}
          keyExtractor={(item) => item.id}
          renderItem={getRenderer()}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Suspend Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Suspend {selectedUser?.fullName}
            </Text>
            <TextInput
              placeholder="Enter number of days"
              value={suspendDays}
              onChangeText={setSuspendDays}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4A8C2A" }]}
                onPress={handleSuspend}
              >
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

      {/* Decline Modal */}
      <Modal visible={declineModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Decline Verification — {selectedVerification?.fullName}
            </Text>
            <TextInput
              placeholder="Reason for decline (optional)"
              value={declineReason}
              onChangeText={setDeclineReason}
              style={styles.input}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#E53935" }]}
                onPress={() =>
                  handleVerificationDecision(
                    selectedVerification,
                    false,
                    declineReason
                  )
                }
              >
                <Text style={styles.modalText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#777" }]}
                onPress={() => setDeclineModal(false)}
              >
                <Text style={styles.modalText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🖼️ Image Preview Modal */}
      <Modal visible={imageModalVisible} transparent animationType="fade">
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalBox}>
            {selectedImageUrl && (
              <Image source={{ uri: selectedImageUrl }} style={styles.imagePreview} />
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    backgroundColor: "#4A8C2A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.04,
    paddingVertical: width * 0.025,
    position: "sticky",
    top: 0,
    zIndex: 1000,
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: width * 0.02,
  },
  logo: {
    width: width * 0.12,
    height: width * 0.12,
    resizeMode: "contain",
  },
  headerTitle: {
    color: "#fff",
    fontSize: width * 0.05,
    fontWeight: "bold",
  },
  logoutBtn: {
    backgroundColor: "#fff",
    paddingVertical: width * 0.015,
    paddingHorizontal: width * 0.04,
    borderRadius: width * 0.02,
  },
  logoutText: {
    color: "#4A8C2A",
    fontWeight: "600",
    fontSize: width * 0.04,
  },

  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#f4f4f4",
  },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  activeTab: { backgroundColor: "#4A8C2A" },
  tabText: { color: "#333", fontWeight: "600" },
  activeTabText: { color: "#fff" },

  card: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  name: { fontWeight: "bold", fontSize: 16 },
  email: { color: "#555" },
  reports: { marginTop: 6, color: "#E53935", fontWeight: "600" },
  reasonTitle: { marginTop: 4, fontWeight: "bold" },
  reasonText: { color: "#555", marginLeft: 6 },
  actions: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-around",
  },
  btn: {
    padding: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
    marginHorizontal: 4,
  },
  btnText: { color: "#fff", fontWeight: "bold" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    fontSize: 12,
  },
  imageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  image: {
    width: "48%",
    height: 120,
    borderRadius: 6,
  },
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
  modalBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  modalText: { color: "#fff", fontWeight: "bold" },
  // Add these new styles below your existing styles
imageModalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.8)",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
},

imageModalBox: {
  backgroundColor: "#fff",
  borderRadius: 10,
  padding: 10,
  width: "90%",
  alignItems: "center",
},

imagePreview: {
  width: "100%",
  height: 400,
  borderRadius: 8,
  resizeMode: "contain",
  marginBottom: 10,
},

closeButton: {
  backgroundColor: "#E53935",
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 20,
},

closeButtonText: {
  color: "#fff",
  fontWeight: "bold",
  fontSize: 16,
},
});