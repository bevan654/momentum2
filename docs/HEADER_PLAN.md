# Header Plan — Branded Home Header Bar

## Approach
Replace the existing greeting section in HomeScreen with a branded header row containing three columns:
- **Left**: Two-line greeting ("Welcome Back," + username)
- **Center**: "Momentum" wordmark in accent color (Inter 800)
- **Right**: Avatar circle button that opens profile/settings

The header sits inside HomeScreen's ScrollView at the top — it scrolls with content (not fixed). No new files needed; this is an edit to `HomeScreen.tsx` only.

## Architecture decision: Why inside HomeScreen, not Header.tsx?
`Header.tsx` is shared across all 5 tabs (it's rendered once in TabNavigator). The branded header with user greeting + profile button is Home-specific, so it belongs in `HomeScreen.tsx`. The shared `Header.tsx` remains as-is (safe-area spacer).

## Changes to `src/screens/HomeScreen.tsx`

### Remove
- The existing `greetingSection` View (avatar + "Welcome Back," + name) — replaced by the header row
- Associated styles: `greetingSection`, `avatar`, `avatarText`, `welcomeText`, `nameText`

### Add
- Import `AvatarCircle` from `../components/friends/AvatarCircle`
- Import `TouchableOpacity` (already imported)
- A `handleOpenProfile` callback that navigates to the Profile tab or triggers profile sheet
  - Since profile is opened via BottomSheet in TabNavigator, we need a way to trigger it
  - The Tab.Navigator's `onLongPress` on Home tab already calls `openProfile()`
  - Simplest approach: navigate to a callback. But we don't have direct access to TabNavigator's state.
  - **Solution**: Use navigation to emit a custom event, OR navigate directly. Looking at the navigator, profile opens via `setProfileVisible(true)` in TabNavigator. We can expose this via a lightweight store or use `navigation.getParent()`.
  - **Simplest**: Add a global `useProfileSheetStore` or a simple callback ref. Actually even simpler: the avatar tap navigates to a "Profile" route — but Profile isn't a tab.
  - **Final approach**: Export a simple trigger from TabNavigator. Create a tiny module `profileSheet.ts` with `openProfileSheet` / `onOpenProfileSheet` event pattern. OR — just use the existing pattern: long-press Home tab opens profile. For the avatar button, we replicate: call `navigation.navigate('Home')` then trigger the sheet. Actually the cleanest way: emit a navigation event.
  - **Revised approach**: Just use a simple exported callback ref from a small store-like pattern. Actually, looking more carefully at the code, there's already `useActiveWorkoutStore` with `showSheet()`. Let's follow the same pattern — add `openProfileSheet` / `profileSheetVisible` to a store. But that would mean modifying the store + TabNavigator which touches more files.
  - **Cleanest minimal approach**: Pass a callback down via route params or context. Since this is a material-top-tab screen, we can use `navigation.getParent()` to access the tab navigator. But material-top-tabs doesn't support params easily.
  - **FINAL simplest approach**: Add `openProfileSheet` and `closeProfileSheet` to TabNavigator as module-level functions (exported), similar to how `initNotifications`/`cleanupNotifications` works. HomeScreen imports and calls `openProfileSheet()`.

### New header row structure
```
[Left: greeting]     [Center: wordmark]     [Right: avatar]
```
- Left: `flexShrink: 1` to handle long names
- Center: fixed "Momentum" text
- Right: fixed-width avatar button

### Styles
- `headerRow`: `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`, `marginBottom: sw(12)`
- `greetingCol`: greeting text container, `flexShrink: 1`
- `welcomeLine`: `colors.textTertiary`, `ms(12)`, `Fonts.regular`
- `nameLine`: `colors.textPrimary`, `ms(16)`, `Fonts.bold`, `numberOfLines={1}`
- `wordmark`: `colors.accent`, `ms(20)`, `Fonts.extraBold`, `letterSpacing: -0.5`
- Avatar: `AvatarCircle` at `sw(34)` wrapped in `TouchableOpacity`

## Files modified
1. `src/screens/HomeScreen.tsx` — replace greeting with branded header row
2. `src/navigation/TabNavigator.tsx` — export `openProfileSheet()` function

## Files NOT touched
- Header.tsx, NutritionHero.tsx, NutritionCard.tsx, DateNavigator
- Any friends/workout components
