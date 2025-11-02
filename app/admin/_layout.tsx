// app/admin/layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#4A8C2A" },
        headerTintColor: "#fff",
      }}
    >
      <Tabs.Screen
        name="verified-users"
        options={{
          title: "Verified Users",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pending-verifications"
        options={{
          title: "Pending Verifications",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reported-users"
        options={{
          title: "Reported Users",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}