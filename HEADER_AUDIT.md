# Header Audit

## 1. Is the React Navigation native header enabled on HomeScreen?
No. HomeScreen is rendered via `createMaterialTopTabNavigator()` in `TabNavigator.tsx` which does not use native headers. There is a shared `<Header />` component rendered above the Tab.Navigator (line 219) — it's a minimal safe-area spacer (`paddingTop: insets.top`, background color only). No native header to disable.

## 2. Where does the user's first name come from?
`useAuthStore` → `profile.username` (string | null). There is no `full_name` field. The current HomeScreen already reads it at line 23: `const username = useAuthStore((s) => s.profile?.username ?? null);`

## 3. Is there an existing avatar component I can reuse?
Yes — `AvatarCircle` in `src/components/friends/AvatarCircle.tsx`. Takes `username`, `email`, `size`, `bgColor`. Shows initial letter in a colored circle with a subtle ring border.

## 4. What's currently at the very top of HomeScreen's render?
A greeting section: avatar circle (accent bg) + "Welcome Back," + username. Then a quick action row (Log Workout / Log Food cards). Then supplement cards (NutritionCard, WaterCard, CreatineCard).

## Key architecture notes
- `Header.tsx` is a shared component rendered once in TabNavigator above ALL tabs — it only adds safe-area padding. Any per-screen header content belongs inside the screen itself.
- Profile/settings is opened via `BottomSheet` in TabNavigator (line 237), triggered by `openProfile()` callback.
- The existing greeting in HomeScreen (lines 94-104) already has avatar + name — it will be replaced by the branded header.
