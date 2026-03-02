/**
 * Simple push notification sender.
 *
 * Usage:
 *   node scripts/send-notification.js <pushToken> [title] [body]
 *
 * Examples:
 *   node scripts/send-notification.js ExponentPushToken[xxxxxx] "Hello" "World"
 *   node scripts/send-notification.js <fcm-token> "Workout complete" "Great job!"
 */

const [, , pushToken, title = "Momentum", body = "You have a new notification"] =
  process.argv;

if (!pushToken) {
  console.error("Usage: node send-notification.js <pushToken> [title] [body]");
  process.exit(1);
}

// --- Expo Push (works if token starts with ExponentPushToken) ---
async function sendExpo() {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      sound: "default",
    }),
  });
  return res.json();
}

// --- FCM Legacy HTTP (requires FCM_SERVER_KEY env var) ---
async function sendFCM() {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.error("Set FCM_SERVER_KEY env variable for FCM tokens.");
    process.exit(1);
  }
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: pushToken,
      notification: { title, body, sound: "default" },
    }),
  });
  return res.json();
}

(async () => {
  const isExpo = pushToken.startsWith("ExponentPushToken");
  console.log(`Sending via ${isExpo ? "Expo" : "FCM"}...`);

  const result = isExpo ? await sendExpo() : await sendFCM();
  console.log("Response:", JSON.stringify(result, null, 2));
})();
