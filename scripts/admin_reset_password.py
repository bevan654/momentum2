from supabase import create_client
import sys

# Your Supabase project credentials
SUPABASE_URL = "https://mckuaytsjvjuvobtxaou.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3VheXRzanZqdXZvYnR4YW91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk0NjkyMywiZXhwIjoyMDg1NTIyOTIzfQ.oVuBG_uFGDJunVELeOqKwTJtP0J092losk2XMGLS82U"

# Use the SERVICE ROLE key (not the anon key) for admin operations
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def reset_password(email_or_uid: str, new_password: str):
    """Reset a user's password by email or UID."""
    try:
        # If it looks like an email, look up the UID first
        if "@" in email_or_uid:
            users = supabase.auth.admin.list_users()
            user = next((u for u in users if u.email == email_or_uid), None)
            if not user:
                print(f"Error: No user found with email '{email_or_uid}'")
                return
            uid = user.id
            print(f"Found user: {user.email} (UID: {uid})")
        else:
            uid = email_or_uid

        supabase.auth.admin.update_user_by_id(uid, {"password": new_password})
        print(f"Password updated successfully for {email_or_uid}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python admin_reset_password.py <email_or_uid> <new_password>")
        print("Example: python admin_reset_password.py user@example.com NewPass123!")
        sys.exit(1)

    reset_password(sys.argv[1], sys.argv[2])
