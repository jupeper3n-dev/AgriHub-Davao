const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.syncPresenceToFirestore = functions.database
  .ref("/status/{uid}")
  .onUpdate(async (change, context) => {
    const uid = context.params.uid;
    const after = change.after.val();

    const userDoc = admin.firestore().doc(`users/${uid}`);
    const isOnline = after?.state === "online";
    const lastSeen = after?.lastChanged
      ? new Date(after.lastChanged)
      : new Date();

    try {
      await userDoc.update({
        isOnline,
        lastSeen,
      });
      console.log(`✅ Synced ${uid} → Firestore: isOnline=${isOnline}`);
    } catch (err) {
      console.error(`❌ Failed to sync presence for ${uid}:`, err);
    }
  });