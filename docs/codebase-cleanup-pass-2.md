# Codebase cleanup, pass 2: file-by-file optimise + de-clutter

Plan from 8 codebase-scout audits (2026-11-14). tv's decision: all on `tv/chore/codebase-cleanup`, one commit per section, update after each batch before the next is authorised.

## Status
- Step 0 (merge main): done, `20b5abf`.
- Batch A (dead code): done. tv: "if it doesn't have a purpose in the app or isn't used, get rid of it". Also removed: WorkoutDetailScreen, protein powder store + switch, bookmarks/comments/nudges, share-card variants, completeProgram, meal-config add/update/delete, 4 unread profile settings. Then (tv: "if nothing pops up, get rid of it") also removed FriendProfileModal (mounted, nothing opened it; took removeFriend + getFriendStats with it) and useSavedMealsStore.deleteMeal. Unblock and remove-friend have no UI now. A re-run of the unused styles / store keys / lib exports sweeps finds nothing.
- Docs refreshed after Batch A (map, CLAUDE.md/AGENTS.md tree + store table, status notes on the old plan/audit docs in docs/).
- Batch B (shared helpers): done (formatHoursMinutes/formatRest, dateNames + dateLabels, titleCase, ghostCompare, ema, ExerciseType/BodyFatMethod, useDebouncedValue to hooks, active-workout SESSION_CLEARED, planExerciseColumns, rank mergeBestSets, upsertDefaultGoals, food MICRO_KEYS, formatVolumeKg, avatar helpers, SetRow type checks). Left on purpose: the other formatVolume variants (they show different text; product call), the two formatTimeAgo styles, FriendSearch debounce (the hook would miss a re-search after clearing), food/foodMapping's micro list (leaves out caffeine; ask bevan).
- Batch B review: clean (nits fixed in 9d60a07).
- Batch C (performance): done. Workout header totals selector, keyboard-height ref, ElapsedClock in the banner, index-based editor callbacks, exercise search (prepared query + word-score cache, ~4x; identical scores on 180k pairs), picker FlashList, share text owned by the card, Lab pager dot store, weekly-volume parse cache, App root selectors, deferred Workouts/Lab fetches, no profile refetch on same-user token refresh, leaderboard block list once, one friendships query, feed fallback-only exercises query, parallel rank queries, stable row callbacks (search, notifications, history), narrower selectors (TodayScheduled, AI card, Home, Lab), memoised gestures (SheetWrapper, story crop), history chart dots. Moved to Batch D (they change with the merges): Lab 1Y bar rendering, weight history row gesture, exercise-history session list, supplement cell styles, routine cards.
- Batch D (merges/splits): done and reviewed (no bugs; nits fixed). Plan editors share useExerciseListEditor; active-workout store split (activeWorkout/finishHelpers, exerciseActions; 1,240 -> ~700); profile GoalEditorRow; OptionPickerSheet; RecoveryFilterChips; Plans ProgramCard; strengthRanks; useSaveFeedRoutine; auth (AuthLayout/AuthInput/AuthBrand, useUsernameAvailability) + components/onboarding (933 -> 407); Lab trend/ (three cards + three log modals + history sheet -> shared pieces, 1Y bars drawn as one Skia picture) and the AI coach split (useAiCoachChat, AiCoachChatModal); workout-sheet splits (set-row/, exercise-picker/useWgerSearch + pickerStyles, summary/SummaryStats/SummaryFooters/useSummaryShare, exercise-history/ with a FlashList session list, Ghost createStyles); home CardDetailSheet + NutritionDetailModal + SupplementDetailModal. Not done: ExercisePicker.tsx is still ~530 lines (next cut: the sheet open/close/pan into a hook); CreateMealModal (1,200 lines, not part of bevan's redesign) left for bevan.
- Batch E (conventions): done. Backdrops use colors.backdrop + the same alpha; ProgramCard on ReanimatedSwipeable; TabNavigator keeps RN Animated (material-top-tabs position), documented; garbled comments; 43 components wrapped in React.memo (time-based ones left on purpose); debugParts -> bodyParts; dev/ -> share/, NutritionStories -> friends/FriendStories, StartWorkoutScreen -> PlansScreen; notificationService comment. Left on purpose: hardcoded notch/home-bar paddings (switching to safe-area insets changes layouts on phones without a home bar; needs a visual check), deliberate colours (share image, camera, confetti, accent swatches, Lab goal line, AI-coach purple).
- Bugs: done (one commit each; final review fixes in 704e777). Fixed here: Routine Preview day labels; program dates off by a day outside UTC (parseLocalDate); program screens showing the previous program's progress; Abandon copy; adherence over 100%; Lab Trackers settings ignored; Default Range ignored + double load; fake Training Volume %; average time counting unknown durations; misleading weight empty state; comma decimals (non-workout inputs); Make-a-meal catalog link; food search stale results; meal-mode fiber/sugar. Also fixed: rank reset offline; water/supplements offline + silent config failures; friend accept/decline/block errors; unread badge drift (double tap, answering a request); feed Global/Friends stale responses; OTA reload during a workout; Forgot password email; username check stale answers; onboarding stuck offline + silent failed saves; beta welcome every launch (now once per account); loadSettings guard; offline friends list wipe; edited past workout cards/heatmap; drop-set labels after edit; feed update error after edit; second edit of a past workout starting from stale rows; swipe-delete hiding the next set; ghost haptic on mount; ghost verdicts by set position (finish screen, feed post, feed view); ghost durations; history chart clipping; duration picker reset/copy; double-tap save as routine; workout kg comma decimals. Not a bug: CoachTakeCard re-run (the just-finished summary has no edit mode).
- Double-check pass (5 review agents, 2026-11-17), all fixed: docs out of date (store size, Plans route, folders); default goals overwritten on each launch for a social-login user without a username (now insert-if-missing); push-token save racing sign-out; B5 (program/routine edits now check every insert, report a part-failed save and refetch; a failed create is removed again; the all-or-nothing RPC is still for bevan); two quick swipe-deletes removing the wrong set; onboarding form emptying on a failed final save (updateProfile { optimistic: false }); a hint when every Lab tracker is switched off; raw emails shown to other users (feed workout screens, leaderboard rows, friend-request/accepted/reaction notification texts; now safeDisplayName); "Try workout" / "Beat this" share useStartFeedWorkout; legacy Swipeable (RN Animated) in ExerciseCard, ExerciseRow and RoutineCard replaced by ReanimatedSwipeable; stable RoutineCard callbacks; year view Android back; shared date formatters (formatWeekdayMonthDay, formatMonthDayOf), formatMicroValue, set-type badges (workout-sheet/setTypeStyle), formatCountdown.
- Behaviour changes to mention in the PR: program adherence counts only scheduled past days (a workout on an unscheduled day doesn't count); the Lab trend cards start on their own range (Weight on the Settings default) instead of copying the range bar; the beta welcome shows once per account.
- Left on purpose: the Lab chart colours (EMA blue, goal green) and the muscle/category palette are fixed identity colours; AddFoodModal re-reads feature_flags on open (so a flag change applies without a restart); feed rows show the email's local part when a user has no username (displayNameFor), where safeDisplayName would mask it: a product call; WorkoutHeader's rest presets ("90s", "2m") and the rest picker ("1m 30s") keep their own wording; summary volume ("1.2k") is one of the 5 volume formats awaiting tv's decision.
- For bevan: CreateMealModal shows "Saved" before saveMeal/updateMeal finish (not awaited), so a failed save still says saved.
- Files still over 500 lines (left, not split in this pass): CreateMealModal 1,183, useFoodLogStore 671, WeeklyVolumeCard 644, MacroLensModal 641, SharePreviewCard 618, CreateCustomExerciseModal 600, FeedRow 566, useAuthStore ~560, ActiveWorkoutSheet 547, useWorkoutStore 545, FoodDetailModal 539, MuscleRadarCard 533, ExercisePicker 532, ExerciseRow 522, ProgramProgressScreen 520, ExerciseCard 515, ProgramSummaryScreen 514, ProgramDayEditorScreen 513, useSupplementStore 503.
- Known, not fixed (smaller): a block whose insert fails after the unfriend shows the friend again until the next refetch; supplement-store add rollback by key; a feed page loaded while a block is pending is dropped if the block fails; ProgramDayEditorScreen lists the catalog in a FlatList (FlashList would be faster).
- Product decisions (not fixed): Save to Gallery only opens the share sheet (a real save needs expo-media-library = store build); only the first workout per day opens from the activity calendar (needs a picker); empty routines/programs can be saved; workout volume is shown ~5 different ways; food/foodMapping's micro list leaves out caffeine (ask bevan); FoodLog rollback restores a whole-list snapshot (overwrites concurrent edits).


Source: 8 codebase-scout audits (2026-11-14), every file in src/ read in full. Food/stores audited on latest main.
All items are JS-only (OTA-safe). Nothing here needs a database change unless marked [bevan].

## Step 0 — sync
- Merge origin/main (104 commits, bevan's Nutrition redesign #75–#89). 5 conflicts:
  CODEBASE_MAP.md, changelog.ts (put 1.0.47 above bevan's entries; check numbering), FoodLoggerScreen.tsx,
  MealSection.tsx (take main's deletion), MacroLensModal.tsx (keep branch split; port #83:
  `onRequestClose={handleClose}` on main Overlay + empty-permission Overlay, `onRequestClose={onClose}` in macro-lens/PermissionGate.tsx).
- Fix stale docs: codebase-cleanup.md lines 39/43 (arrows are restored), 93 (sign-out now clears push_token);
  CLAUDE.md "beta-welcome flag" in useAuthStore doesn't exist.

## Batch A — dead code (biggest line savings; * = may be a planned feature, ask tv)
- *WorkoutDetailScreen.tsx (417) — route registered, nothing navigates to it. Remove screen, route, param type, map/docs.
- *useProteinPowderStore (~300 of 348 dead) — only `enabled` toggle used, and nothing reads it. Keep toggle or remove both.
- *Bookmarks / comments / nudges — lib/friends/social.ts + types + friendsDatabase re-exports + ~19 useFriendsStore fields (~320 lines). No UI.
- *dev/WorkoutOverlay.tsx minimal/bold/poster variants + MOCK_DATA (~300 lines) — only `classic` used.
- useMuscleAnalysisStore → recovery-only (~300 lines; only recoveryPercent read). Re-check main.
- useWorkoutStore.fetchWorkoutById (~160, no caller); useProgramStore.completeProgram; useNutritionStore steps/caloriesBurned/loading;
  useRankStore previousRankName/lastComputed; useFoodLogStore goNextDay/goPrevDay/collapse/mealConfig CRUD (verify on main).
- SheetWrapper `hasOwnSheet` branch (identical output); ShareModal `controls` prop; Confetti `colors` prop; Header `showStreak` const.
- Unused styles: ExerciseRow nameRow/headerRight/removeBtn, TodayScheduled x3, SearchResultRow email, WeightCard emptyState/emptyText + empty Y-label Views,
  AiHeroCard hintText, SignUp verifyHint, TabNavigator homeButton, FoodLoggerScreen x5, CreateMeal itemCal/resultsSectionLabel, HistoryOverlay fCategoryOpen.
- console.logs: useActiveWorkoutStore x9, AiHeroCard x2, ExerciseHistoryModal x2, CreateProgram x1 (CreateMeal x2 = food).
- Lab local buildSmoothPath copies x3 → utils/smoothPath.

## Batch B — shared helpers (dedupe)
- utils/formatDuration: formatHoursMinutes (6 copies), formatVolume (7 slightly different copies — check on screen), formatWorkoutDate (2 identical + ~10 variants),
  formatTimeAgo (2), formatRest (3), titleCase (5).
- constants: DAY/MONTH name arrays (~12 copies).
- compareGhostSet (3 identical), computeEma (3 identical), ExerciseType (3), BodyFatMethod (2), FeedExerciseDetail name clash (2).
- useDebouncedValue → src/hooks (reuse in FriendSearch).
- Store row-mapping dupes: routine/program `toRow`, rank `mergeBestSets`, friends feed dedupe, auth signUp → ensureProfileFromMetadata,
  active workout IDLE_STATE + _stopSession (copy-pasted 3x), start-workout shared code.

## Batch C — performance (ranked by what users feel)
1. Active workout typing: WorkoutHeader selects whole `exercises` (header + 3 modals re-render per keystroke) → useShallow totals;
   ActiveWorkoutSheet handleInputFocus depends on kbHeight (every card re-renders on keyboard show) → ref; inline onClose to ExerciseHistoryModal;
   SetRow SET_TYPE_CONFIG rebuilt per row per render; FloatingWorkoutBanner 1s tick → ElapsedClock child.
2. Routine/program editors: inline arrows per row defeat memo → every keystroke re-renders every card (pass index + stable handlers).
3. Exercise picker search: expandToken per catalog entry per keystroke (~10K × 100) → once per query; score before spreading; FlatList→FlashList.
4. Workout summary: share title/caption state in parent re-renders whole modal per keystroke.
5. Lab: 1Y bar charts = ~365 gradient nodes + 365 label Views per render → one path/group; BodyMetricsPager setState every scroll frame → onMomentumScrollEnd;
   cards fetch twice on mount; WeeklyVolume re-parses dates slots×workouts×4.
6. Startup: TabNavigator fires 9 fetches on mount → defer Workouts/Lab ones; App.tsx whole useAuthStore; onAuthStateChange re-bootstraps profile on every TOKEN_REFRESHED (verify).
7. Network: Leaderboard refetches blocked ids every tab tap; getFriendsList + getFriendIds = same query twice; feed fetches exercises+sets for every row even when exercise_details exists;
   rank store sequential queries → Promise.all; AddFoodModal feature_flags each open.
8. Small memo fixes: FriendSearch/NotificationList/HistoryOverlay renderItem arrows, TodayScheduled getState, AiHeroCard whole-profile selector, WaterCard, YearViewModal, StoryCropModal gestures, SheetWrapper gesture.

## Batch D — structural splits/merges
- Lab TrendCard: WeightCard/BodyFatCard/MeasurementsCard share ~70%, 3 log modals ~95%, 3 swipe history sheets → lab/trend/ (TrendCard, useTrendRange, EntryHistorySheet, NumberLogModal). ~1750 → ~1000 lines.
- useExerciseListEditor hook: 9 identical handlers + hydrate/save mapping in CreateRoutineScreen & ProgramDayEditorScreen.
- Auth: AuthLayout + AuthInput (Login/SignUp/ForgotPassword ~90 identical style lines each) + useUsernameAvailability (SignUp + Onboarding).
- useActiveWorkoutStore (1293): move _restoreSavedWorkout/_finishWorkout/_flushPendingDeletes/commitFeedPost into activeWorkout/.
- SetRow (674) → SetRowInputs + styles; ExercisePicker (781) → useWgerSearch + pickerData; WorkoutSummaryModal (671) → SummaryStats/Footers/useSummaryShare;
  AiHeroCard (688) → AiCoachChatModal; StartWorkoutScreen → ProgramCard; strengthScore (586) → folder; ExerciseHistoryModal (893, previously left — ask).
- Home detail-modal chrome copied 3x (Nutrition/Water/SupplementsCard) → CardDetailModal; profile goal editor rows x3 → GoalEditorRow; LabTrackerPickers → one OptionPickerSheet;
  RecoveryFilterChips data-driven (~60 lines); GhostMode/GhostFinishScreen/GhostContent inline styles → createStyles; feed-workout useFeedWorkoutActions.
- Food (bevan's fresh redesign): only tiny clutter. CreateMealModal (1207, not redesigned) rebuild on food/ui kit → suggest to bevan, don't do.

## Batch E — conventions
- ~15 hardcoded rgba scrims → colors.backdrop; hardcoded paddings → safe-area insets; React.memo on ~12 components; mojibake comments (muscles.ts, NutritionCard, CreateCustomExercise, WorkoutOverlay);
  rename debugParts → bodyParts; StartWorkoutScreen → PlansScreen; NutritionStories (is Community) rename; dev/ → share/ (production code); RN Animated in StartWorkout swipe → ReanimatedSwipeable.
- Leave: muscle/category identity colours, camera overlay colours, Confetti palette (deliberate).

## Bugs found (each needs a yes; own bugfix branch per CLAUDE.md)
High (users see it / data):
B1 Settings > Lab Trackers (hide/reorder) does nothing; Default Range setting overridden on mount (BodyMetricsPager.tsx:18, WeightCard.tsx:86).
B2 Beta welcome modal shows on every cold start (BetaWelcomeModal.tsx:25, App.tsx:96) — verify on phone first.
B3 Rank: offline/failed query resets rank to Novice and can persist a lower rank (useRankStore.ts:162-190).
B4 Supplements/water wiped to 0 offline; add/remove failures silent (useSupplementStore.ts:264, 198-240).
B5 Edit routine/program = delete then insert, no rollback → data loss if insert fails (useProgramStore 239, useRoutineStore 135). Proper fix = RPC [bevan]; client can at least check errors.
B6 Edited past workout: stats update but exercise cards/heatmap stay old (WorkoutSummaryModal.tsx:321). Edit→Cancel re-runs the AI coach (extra AI cost, overwrites notes, confetti replays).
B7 Swipe-delete a middle set may hide the next set (SetRow collapse values reused by index key) — confirm on phone.
B8 Dates off by a day (UTC parse of YYYY-MM-DD): CalendarPicker (start date disabled in UTC+), program dates/calendar; Routine Preview day labels off by one (Mon shows "Sun").
B9 Friendship accept/decline/remove/block ignore errors (block can unfriend without blocking).
B10 OTA 'silent' update can hard-reload the app mid-workout on foreground (useAppUpdates.ts:41).
B11 Forgot password: resend/confirm use untrimmed email → fails with autofill space.
B12 Delete account requires a password → Google/Apple users can't delete (App Store rule 5.1.1(v)) [bevan].
B13 Global feed pagination stops early (friends-only rows filtered client-side) [bevan].
Medium/low:
- "Save to Gallery" just opens share sheet; comma decimals ("80,5" → 80) in weight/supplement; only first workout per day opens from activity calendar;
  ghost chips buzz on mount; ghost finish verdict vs live tally mismatch; history chart clips newest point; duration picker reopens with old numbers;
  mixed volume units ("1.2k" vs "800 kg"); notification unread count drifts; program screens show previous program's stats briefly; Abandon copy contradicts behaviour;
  adherence can exceed 100%; onboarding stuck if username check fails offline; fake "+x%" on empty Training Volume; avg session time counts unknown (0) durations;
  "Log your first weight" shown when older entries exist; double-tap Save creates duplicate routine; ghost workout duration "75:00"; drop-set labels lost after edit;
  feed update error ignored after edit; profile settings loadSettings no try/catch; FoodLog rollback overwrites concurrent edits; searchCatalog no stale guard; friends feed mode-switch race.
- Food (bevan's area, report to him): Make-a-meal drops food_catalog_id for new items; meal-mode fiber/sugar edits ignored; "Saved" alert before save resolves.

## Needs backend [bevan]
- Streak/friend-stats aggregates (currently pages full history); get_global_feed server-side friends_only filter + cursor; atomic barcode scan_count;
  transactional routine/program replace RPC; social-login account deletion; drop protein_powder tables/bookmarks if features are removed.
