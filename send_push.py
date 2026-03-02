import requests

# ── Your push tokens (max 20) ──────────────────────────
PUSH_TOKENS = [
    "ExponentPushToken[TNgCfeKeb9bbf64BcQYGAV]",
    "ExponentPushToken[uhNrEQPiROp1KNf3mFwU1Y]",
    "ExponentPushToken[2a0tAnLnm9s2_fvzsaTo_i]",
    "ExponentPushToken[M1tx_-KjgKT4OvSz-_rBzs]",
    "ExponentPushToken[KU5MntKr8tq66rPLkT57EW]",
    "ExponentPushToken[Db1hFQLJu8xWwJfZOLcxQu]",
    "ExponentPushToken[y37AyXHhIp7kapO8EDSTtU]",
    "ExponentPushToken[baSEqRN02LoSvhWr-6-R0T]",
    "ExponentPushToken[jqlKedLapN64ljgwS2gqEA]",
    "ExponentPushToken[Yzu-naJkc1b3MziDrVGidV]",
    "ExponentPushToken[CIBMNdCHRYzHGwIqtoy8KU]",
    "ExponentPushToken[4nEHluGsUUkTfU4MMtcr1G]",
]

# ── Notification content ────────────────────────────────
TITLE = "New Update Available 🚀"
BODY = "A new version of Momentum is ready! Open TestFlight to install the latest update."

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# ── Send one at a time to avoid project ID conflicts ────
def send_notifications():
    valid = [t for t in PUSH_TOKENS if t.startswith("ExponentPushToken")]
    if not valid:
        print("No valid tokens.")
        return

    for token in valid:
        resp = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json={
                "to": token,
                "sound": "default",
                "title": TITLE,
                "body": BODY,
            },
            headers=HEADERS,
        )
        status = "OK" if resp.status_code == 200 else f"ERR {resp.status_code}"
        print(f"{status} → {token[-25:]}")

if __name__ == "__main__":
    send_notifications()
