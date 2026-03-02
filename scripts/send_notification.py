"""
Simple push notification sender.

Usage:
    python scripts/send_notification.py <push_token> [title] [body]

Examples:
    python scripts/send_notification.py "ExponentPushToken[abc123]" "Hello" "World"
    python scripts/send_notification.py "<fcm-token>" "Workout done" "Great job!"
"""

import sys
import os
import json
import urllib.request

def send_expo(token: str, title: str, body: str) -> dict:
    payload = json.dumps({
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
    }).encode()

    req = urllib.request.Request(
        "https://exp.host/--/api/v2/push/send",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


def send_fcm(token: str, title: str, body: str) -> dict:
    server_key = os.environ.get("FCM_SERVER_KEY")
    if not server_key:
        print("Error: set FCM_SERVER_KEY env variable for FCM tokens.", file=sys.stderr)
        sys.exit(1)

    payload = json.dumps({
        "to": token,
        "notification": {"title": title, "body": body, "sound": "default"},
    }).encode()

    req = urllib.request.Request(
        "https://fcm.googleapis.com/fcm/send",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"key={server_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python send_notification.py <push_token> [title] [body]")
        sys.exit(1)

    push_token = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else "Momentum"
    body = sys.argv[3] if len(sys.argv) > 3 else "You have a new notification"

    is_expo = push_token.startswith("ExponentPushToken")
    print(f"Sending via {'Expo' if is_expo else 'FCM'}...")

    result = send_expo(push_token, title, body) if is_expo else send_fcm(push_token, title, body)
    print("Response:", json.dumps(result, indent=2))
