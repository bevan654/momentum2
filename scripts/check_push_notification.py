from supabase import create_client
import requests
import json

SUPABASE_URL = "https://mckuaytsjvjuvobtxaou.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3VheXRzanZqdXZvYnR4YW91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk0NjkyMywiZXhwIjoyMDg1NTIyOTIzfQ.oVuBG_uFGDJunVELeOqKwTJtP0J092losk2XMGLS82U"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

print("=" * 60)
print("PUSH NOTIFICATION DIAGNOSTICS")
print("=" * 60)

# 1. Get all profiles with push tokens
print("\n1. Profiles with push tokens:")
result = supabase.from_("profiles").select("id, email, push_token").not_.is_("push_token", "null").execute()
profiles_with_tokens = result.data or []
print(f"   {len(profiles_with_tokens)} profiles have push tokens\n")

for p in profiles_with_tokens:
    token = p.get("push_token", "")
    masked = token[:30] + "..." + token[-5:] if token and len(token) > 35 else token
    print(f"   {p.get('email', 'N/A'):40s} {masked}")

# 2. Check recent notifications and whether they have corresponding tokens
print("\n\n2. Recent notifications (last 10):")
notif_result = supabase.from_("notifications").select("id, user_id, type, title, created_at").order("created_at", desc=True).limit(10).execute()
if notif_result.data:
    for n in notif_result.data:
        uid = n.get("user_id", "")
        # Check if this user has a push token
        has_token = any(p["id"] == uid for p in profiles_with_tokens)
        token_status = "HAS TOKEN" if has_token else "NO TOKEN"
        print(f"   [{n.get('type'):20s}] {n.get('title'):30s} user:{uid[:8]}... [{token_status}] at {n.get('created_at')}")
else:
    print("   No notifications found!")

# 3. Check edge function exists
print("\n\n3. Testing edge function...")
try:
    # Send a minimal test payload (with a fake user_id so nothing actually sends)
    r = requests.post(
        f"{SUPABASE_URL}/functions/v1/push-notification",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "type": "INSERT",
            "record": {
                "user_id": "00000000-0000-0000-0000-000000000000",
                "title": "Test",
            },
        },
    )
    print(f"   Status: {r.status_code}")
    print(f"   Response: {r.text[:300]}")
    if r.status_code == 200:
        print("   RESULT: Edge function IS deployed and responding")
    elif r.status_code == 404:
        print("   RESULT: Edge function NOT FOUND — needs to be deployed!")
    elif r.status_code == 401:
        print("   RESULT: Edge function exists but auth failed")
    else:
        print(f"   RESULT: Unexpected status {r.status_code}")
except Exception as e:
    print(f"   Error: {e}")

# 4. Check database webhook/trigger on notifications table
print("\n\n4. Checking database webhook trigger on notifications table...")
# Supabase stores webhook hooks in supabase_functions.hooks
# We can check by querying via the management API or trying to list hooks
try:
    # Try listing hooks via the REST API
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/rpc/list_notification_triggers",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
    )
    if r.status_code == 200:
        print(f"   Triggers: {r.text[:500]}")
    else:
        print(f"   Could not query triggers directly (status {r.status_code})")
        print("   -> Check Supabase Dashboard > Database > Webhooks manually")
except Exception as e:
    print(f"   Error: {e}")

# 5. Direct Expo Push API test — pick a real Android token and test
print("\n\n5. Direct Expo Push API test (dry run with real token)...")
# Find an android-looking token (they all look the same with Expo tokens)
# Let's use the admin/test account
test_email = "admin@bevan.quest"
test_profile = next((p for p in profiles_with_tokens if p.get("email") == test_email), None)

if not test_profile:
    # Fallback to first available
    test_profile = profiles_with_tokens[0] if profiles_with_tokens else None

if test_profile:
    token = test_profile["push_token"]
    print(f"   Using token from: {test_profile.get('email')}")
    print(f"   Token: {token}")

    # Check token with Expo Push API (receipts endpoint to validate)
    push_payload = {
        "to": token,
        "title": "Push Test",
        "body": "Testing push delivery from admin script",
        "sound": "default",
        "priority": "high",
        "channelId": "social",
        "data": {"type": "test"},
    }

    print(f"\n   Sending test push via Expo API...")
    r = requests.post(
        "https://exp.host/--/api/v2/push/send",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json=push_payload,
    )
    print(f"   Expo API Status: {r.status_code}")
    resp = r.json()
    print(f"   Expo API Response: {json.dumps(resp, indent=2)}")

    if resp.get("data", {}).get("status") == "ok":
        ticket_id = resp.get("data", {}).get("id")
        print(f"\n   RESULT: Push ACCEPTED by Expo (ticket: {ticket_id})")
        print("   -> If notification still doesn't arrive on Android, check:")
        print("      a) google-services.json has correct FCM config")
        print("      b) App was built with EAS (not Expo Go)")
        print("      c) Device has Google Play Services")
        print("      d) Notification channel 'social' not muted on device")

        # Check receipt
        if ticket_id:
            print(f"\n   Checking receipt for ticket {ticket_id}...")
            import time
            time.sleep(3)  # Wait a few seconds for Expo to process
            receipt_r = requests.post(
                "https://exp.host/--/api/v2/push/getReceipts",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={"ids": [ticket_id]},
            )
            print(f"   Receipt response: {json.dumps(receipt_r.json(), indent=2)}")

    elif resp.get("data", {}).get("status") == "error":
        print(f"\n   RESULT: Push REJECTED by Expo!")
        print(f"   Error: {resp.get('data', {}).get('message')}")
        details = resp.get("data", {}).get("details", {})
        if details.get("error") == "DeviceNotRegistered":
            print("   -> Token is INVALID or device unregistered. Token needs to be refreshed.")
        elif details.get("error") == "InvalidCredentials":
            print("   -> FCM credentials are INVALID. Check google-services.json and FCM setup in Expo.")
else:
    print("   No profiles with push tokens found to test!")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
