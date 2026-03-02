"""
Exercise Fetcher — searches ExerciseDB with a keyword list, deduplicates,
lets you keep/skip each exercise, then exports CSV for exercises_catalog.

Usage: python exercise_fetcher.py
"""

import csv
import re
import urllib.request
import urllib.parse
import json
import uuid
import time
from datetime import datetime, timezone


API_URL = "https://exercisedb.dev/api/v1/exercises"
OUTPUT_FILE = "exercises_catalog.csv"

COLUMNS = [
    "id", "name", "slug", "primary_muscles", "secondary_muscles",
    "other_muscles", "equipment", "movement_type", "force_type",
    "category", "difficulty", "video_demo_url", "svg_demo",
    "created_at", "updated_at",
]

# ---------------------------------------------------------------------------
# Master keyword list — edit this to control what gets fetched.
# The script searches every keyword, deduplicates by exercise ID,
# then presents the unique exercises for you to keep or skip.
# ---------------------------------------------------------------------------
KEYWORDS = [
    # --- Chest ---
    "bench press", "chest press", "chest fly", "push up", "pushup",
    "dumbbell fly", "cable crossover", "pec deck", "dip",
    # --- Back ---
    "pull up", "pullup", "chin up", "lat pulldown", "row",
    "barbell row", "dumbbell row", "cable row", "seated row",
    "t-bar row", "deadlift", "back extension", "pullover",
    # --- Shoulders ---
    "shoulder press", "overhead press", "military press",
    "lateral raise", "front raise", "rear delt", "face pull",
    "arnold press", "upright row", "shrug",
    # --- Biceps ---
    "bicep curl", "hammer curl", "preacher curl", "concentration curl",
    "cable curl", "barbell curl", "incline curl", "spider curl",
    # --- Triceps ---
    "tricep", "tricep extension", "tricep pushdown", "skull crusher",
    "close grip bench", "overhead extension", "kickback",
    # --- Legs (Quads) ---
    "squat", "leg press", "lunge", "leg extension", "front squat",
    "goblet squat", "hack squat", "split squat", "bulgarian split",
    "step up", "sissy squat",
    # --- Legs (Hamstrings / Glutes) ---
    "leg curl", "hamstring curl", "romanian deadlift", "hip thrust",
    "glute bridge", "good morning", "sumo deadlift",
    "stiff leg deadlift", "nordic curl",
    # --- Calves ---
    "calf raise", "seated calf", "standing calf", "donkey calf",
    # --- Core / Abs ---
    "crunch", "sit up", "plank", "leg raise", "hanging leg raise",
    "ab wheel", "russian twist", "cable crunch", "woodchop",
    "mountain climber", "dead bug", "bicycle crunch", "v-up",
    "dragon flag", "decline crunch",
    # --- Forearms / Grip ---
    "wrist curl", "reverse curl", "farmer walk", "plate pinch",
    # --- Full Body / Compound ---
    "clean", "snatch", "thruster", "clean and press",
    "turkish get up", "man maker", "burpee", "kettlebell swing",
    # --- Cardio / Conditioning ---
    "jump rope", "jumping jack", "box jump", "battle rope",
    "rowing machine", "sled push", "sprint",
    # --- Stretching / Mobility ---
    "stretch", "foam roll", "hip flexor", "pigeon pose",
    "cat cow", "child pose", "cobra stretch",
    # --- Machine-specific ---
    "smith machine", "cable", "machine fly", "machine press",
    "pec deck", "leg press machine", "hip abduction", "hip adduction",
    # --- Equipment-based ---
    "barbell", "dumbbell", "kettlebell", "resistance band",
    "ez bar", "trap bar", "medicine ball", "stability ball",
]


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)


def pg_array(items: list[str]) -> str:
    """Format a Python list as a Postgres text[] literal: {a,b,c}"""
    if not items:
        return "{}"
    escaped = [f'"{i}"' if "," in i or " " in i else i for i in items]
    return "{" + ",".join(escaped) + "}"


def search_exercises(query: str, limit: int = 100, max_retries: int = 5) -> list[dict]:
    params = urllib.parse.urlencode({"search": query, "limit": limit})
    url = f"{API_URL}?{params}"
    req = urllib.request.Request(url)

    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
            if data.get("success") and data.get("data"):
                return data["data"]
            return []
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2 ** attempt  # 1, 2, 4, 8, 16 seconds
                print(f"  [rate limited, waiting {wait}s]", end="", flush=True)
                time.sleep(wait)
            else:
                print(f"    [error] {e}")
                return []
        except Exception as e:
            print(f"    [error] {e}")
            return []
    print(f"    [failed after {max_retries} retries]")
    return []


def fetch_all_unique(keywords: list[str]) -> list[dict]:
    """Search every keyword and return a deduplicated list of exercises."""
    seen_ids: set[str] = set()
    unique: list[dict] = []
    total = len(keywords)

    for i, kw in enumerate(keywords, 1):
        print(f"  [{i}/{total}] Searching '{kw}'...", end="", flush=True)
        results = search_exercises(kw)
        new = 0
        for ex in results:
            eid = ex.get("exerciseId")
            if eid and eid not in seen_ids:
                seen_ids.add(eid)
                unique.append(ex)
                new += 1
        print(f"  {len(results)} results, {new} new  (total unique: {len(unique)})")
        time.sleep(1)  # be polite to the API

    return unique


def display_exercise(ex: dict, index: int, total: int) -> None:
    print(f"\n{'='*60}")
    print(f"  [{index+1}/{total}]  {ex['name']}")
    print(f"{'='*60}")
    print(f"  Target muscles : {', '.join(ex.get('targetMuscles', []))}")
    print(f"  Secondary      : {', '.join(ex.get('secondaryMuscles', []))}")
    print(f"  Body parts     : {', '.join(ex.get('bodyParts', []))}")
    print(f"  Equipment      : {', '.join(ex.get('equipments', []))}")
    if ex.get("instructions"):
        print(f"  Instructions   : {ex['instructions'][0][:120]}...")
    print(f"  GIF            : {ex.get('gifUrl', 'N/A')}")


def prompt_keep() -> str:
    while True:
        ans = input("\n  Keep? (y/n/q to quit): ").strip().lower()
        if ans in ("y", "yes"):
            return "y"
        if ans in ("n", "no"):
            return "n"
        if ans in ("q", "quit"):
            return "q"
        print("  Please enter y, n, or q.")


def build_row(ex: dict) -> dict:
    """Build a CSV row from an API exercise object."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "name": ex["name"],
        "slug": slugify(ex["name"]),
        "primary_muscles": pg_array(ex.get("targetMuscles", [])),
        "secondary_muscles": pg_array(ex.get("secondaryMuscles", [])),
        "other_muscles": pg_array(ex.get("bodyParts", [])),
        "equipment": pg_array(ex.get("equipments", [])),
        "movement_type": "",
        "force_type": "",
        "category": "",
        "difficulty": "",
        "video_demo_url": ex.get("gifUrl", ""),
        "svg_demo": "",
        "created_at": now,
        "updated_at": now,
    }


def main() -> None:
    print("\n  Exercise Fetcher for exercises_catalog")
    print(f"  {len(KEYWORDS)} keywords to search\n")

    # Phase 1: fetch & deduplicate
    exercises = fetch_all_unique(KEYWORDS)
    print(f"\n  Done! {len(exercises)} unique exercises found.\n")

    if not exercises:
        print("  No exercises found. Check your internet connection or API.")
        return

    # Phase 2: review one by one
    kept: list[dict] = []
    skipped = 0

    for i, ex in enumerate(exercises):
        display_exercise(ex, i, len(exercises))
        choice = prompt_keep()
        if choice == "y":
            kept.append(build_row(ex))
            print(f"  -> Kept! ({len(kept)} total)")
        elif choice == "n":
            skipped += 1
        elif choice == "q":
            print(f"\n  Stopped early at {i+1}/{len(exercises)}.")
            break

    print(f"\n  Summary: {len(kept)} kept, {skipped} skipped")

    if not kept:
        print("  Nothing to write.")
        return

    # Phase 3: write CSV (append to existing if present)
    try:
        with open(OUTPUT_FILE, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            existing = list(reader)
    except FileNotFoundError:
        existing = []

    all_rows = existing + kept

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"  Wrote {len(kept)} new exercise(s) to {OUTPUT_FILE}  (total: {len(all_rows)})")


if __name__ == "__main__":
    main()
