import { Redirect } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth, db } from "../firebaseConfig";

export default function Index() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (!user) {
        setRole("guest");
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRole(data.userType || "user");
        } else {
          setRole("user");
        }
      } catch (err) {
        console.error("Failed to get user role:", err);
        setRole("user");
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4A8C2A" />
      </View>
    );
  }

  // Not logged in → go to login
  if (role === "guest") return <Redirect href="/login" />;

  // Default → normal dashboard
  return <Redirect href="/(tabs)/dashboard" />;
}