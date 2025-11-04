import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

export async function sendNotification(
  recipientId: string,
  type: string,
  message: string,
  extraData: Record<string, any> = {}
) {
  if (!recipientId) return;
  try {
    await addDoc(collection(db, "notifications", recipientId, "items"), {
      type,
      message,
      ...extraData,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}