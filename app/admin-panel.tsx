import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { db } from "../firebaseConfig";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("Users");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verifiedUsers, setVerifiedUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "Users") {
        const snap = await getDocs(collection(db, "users"));
        const list: any[] = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setUsers(list);
      } else if (activeTab === "Pending") {
        const snap = await getDocs(collection(db, "user_verifications"));
        const list: any[] = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setVerifications(list);
      } else if (activeTab === "Verified") {
        const snap = await getDocs(
          query(collection(db, "users"))
        );
        const list: any[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          if (data.isVerified) list.push({ id: doc.id, ...data });
        });
        setVerifiedUsers(list);
      } else if (activeTab === "Reports") {
        await fetchReports();
      }
    } catch (err) {
      console.error("Error loading data:", err);
      Alert.alert("Error", "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  // 🧩 Fetch grouped reports
  const fetchReports = async () => {
    const reportsSnap = await getDocs(
      query(collection(db, "reports"), orderBy("createdAt", "desc"))
    );

    const grouped: Record<
      string,
      { count: number; reasons: string[]; reportedId: string }
    > = {};

    reportsSnap.forEach((doc) => {
      const data = doc.data();
      if (!grouped[data.reportedId]) {
        grouped[data.reportedId] = {
          count: 1,
          reasons: [data.reason],
          reportedId: data.reportedId,
        };
      } else {
        grouped[data.reportedId].count++;
        grouped[data.reportedId].reasons.push(data.reason);
      }
    });

    const usersList = await Promise.all(
      Object.values(grouped).map(async (item) => {
        const userDoc = await getDoc(doc(db, "users", item.reportedId));
        return {
          ...item,
          userInfo: userDoc.exists() ? userDoc.data() : null,
        };
      })
    );

    const sorted = usersList.sort((a, b) => b.count - a.count);
    setReports(sorted);
  };

  // 🧱 Suspend user temporarily
  const handleSuspend = async (userId: string, days: number) => {
    try {
      const until = new Date();
      until.setDate(until.getDate() + days);
      await updateDoc(doc(db, "users", userId), {
        suspendedUntil: until,
      });
      Alert.alert("✅ User Suspended", `User suspended for ${days} days.`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to suspend user.");
    }
  };

  // 🧱 Ban user permanently
  const handleBan = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isBanned: true,
        bannedAt: serverTimestamp(),
      });
      Alert.alert("🚫 User Banned", "User has been permanently banned.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to ban user.");
    }
  };

  // 🔹 Render Tabs
  const renderTabs = () => (
    <View style={styles.tabs}>
      {["Users", "Pending", "Verified", "Reports"].map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => setActiveTab(tab)}
          style={[
            styles.tabBtn,
            activeTab === tab && styles.activeTab,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText,
            ]}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // 🔹 Render User
  const renderUser = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.userName}>{item.fullName || "Unnamed"}</Text>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.role}>{item.userType}</Text>
    </View>
  );

  // 🔹 Render Verification Request
  const renderVerification = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.userName}>{item.fullName}</Text>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text>Document: {item.documentType || "N/A"}</Text>
    </View>
  );

  // 🔹 Render Verified User
  const renderVerifiedUser = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.userName}>{item.fullName}</Text>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={{ color: "#43A047" }}>✅ Verified</Text>
    </View>
  );

  // 🔹 Render Report
  const renderReport = ({ item }: { item: any }) => {
    const u = item.userInfo;
    return (
      <View style={styles.reportCard}>
        <View style={styles.row}>
          {u?.photoURL ? (
            <Image source={{ uri: u.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {u?.fullName?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{u?.fullName || "Unknown User"}</Text>
            <Text style={styles.userEmail}>{u?.email}</Text>
            <Text style={styles.count}>Reports: {item.count}</Text>
            <Text style={styles.reason}>
              Example reason: {item.reasons[0] || "No reason provided"}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#FFA000" }]}
            onPress={() =>
              Alert.alert(
                "Suspend User",
                "Suspend for how long?",
                [
                  { text: "1 day", onPress: () => handleSuspend(item.reportedId, 1) },
                  { text: "7 days", onPress: () => handleSuspend(item.reportedId, 7) },
                  { text: "30 days", onPress: () => handleSuspend(item.reportedId, 30) },
                  { text: "Cancel", style: "cancel" },
                ]
              )
            }
          >
            <Text style={styles.btnText}>Suspend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#E53935" }]}
            onPress={() =>
              Alert.alert("Confirm Ban", "Ban this user permanently?", [
                { text: "Cancel", style: "cancel" },
                { text: "Ban", style: "destructive", onPress: () => handleBan(item.reportedId) },
              ])
            }
          >
            <Text style={styles.btnText}>Ban</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 🔹 Render Content
  const renderContent = () => {
    if (loading)
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A8C2A" />
          <Text>Loading...</Text>
        </View>
      );

    if (activeTab === "Users")
      return (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
        />
      );

    if (activeTab === "Pending")
      return (
        <FlatList
          data={verifications}
          renderItem={renderVerification}
          keyExtractor={(item) => item.id}
        />
      );

    if (activeTab === "Verified")
      return (
        <FlatList
          data={verifiedUsers}
          renderItem={renderVerifiedUser}
          keyExtractor={(item) => item.id}
        />
      );

    if (activeTab === "Reports")
      return (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.reportedId}
        />
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>👨‍💼 Admin Panel</Text>
      {renderTabs()}
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 24, fontWeight: "bold", color: "#4A8C2A", marginBottom: 10 },
  tabs: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E0E0E0",
  },
  activeTab: { backgroundColor: "#4A8C2A" },
  tabText: { color: "#333", fontWeight: "bold" },
  activeTabText: { color: "#fff" },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  userName: { fontWeight: "bold", fontSize: 16 },
  userEmail: { color: "#555" },
  role: { color: "#1E88E5", fontWeight: "600" },
  reportCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderLeftColor: "#FFB300",
  },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 10 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarLetter: { fontSize: 20, color: "#4A8C2A", fontWeight: "bold" },
  count: { color: "#E65100", fontWeight: "bold", marginTop: 4 },
  reason: { color: "#444", marginTop: 2, fontStyle: "italic" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});