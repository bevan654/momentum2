/**
 * Changelog entries — newest first.
 * Add a new entry at the top whenever you ship a user-facing update.
 */

type ChangelogCtaTarget = 'Community' | 'Workouts' | 'Home' | 'Nutrition' | 'Recovery';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
  notes?: string[];
  cta?: { label: string; target: ChangelogCtaTarget };
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.0.45',
    date: '2026-11-14',
    title: "What's New",
    items: [
      'Live workout on your Lock Screen and Dynamic Island (iPhone) and in your notifications (Android): your workout timer, current set, next exercise and a live rest countdown',
      'Workouts now save in one go: no more half-saved or duplicated workouts on a bad connection',
      'Undo after finishing reopens your exact workout, and editing a saved workout keeps your notes and set details',
      "Starting a routine while a workout is running now asks before replacing it",
      'Logging your weight twice in a day updates that day instead of failing',
      'Fixed: pull-ups and other bodyweight sets from older workouts now count towards your rank',
      'Fixed: history and recovery no longer go blank when you lose connection',
    ],
  },
  {
    version: '1.0.44',
    date: '2026-11-14',
    title: "What's New",
    items: [
      'A new, far more detailed muscle map: see exactly which muscles each workout hit, down to individual heads, on recovery, history and the feed',
      'Over 700 exercises in the library, with clearer names',
      'Bodyweight exercises like push-ups, pull-ups and dips now count towards muscle heat, Training Balance and recovery',
      'Feed posts now show your best reps for bodyweight exercises',
      "Fixed: a workout you'd just started could disappear after closing the app",
      "Fixed: racing a friend's workout now keeps the race going if the app restarts",
      'Fixed: the workout notification no longer sticks around after the app was closed',
    ],
    cta: { label: 'See your recovery', target: 'Recovery' },
  },
  {
    version: '1.0.43',
    date: '2026-11-14',
    title: "What's New",
    items: [
      'Progressive overload chart on every exercise: your last 8 sessions of volume, with the days you beat your previous session lit up and a target line to aim for',
      "Today's bar fills as you log sets, with a little celebration when you beat last session",
      'Redesigned workout header: your workout name, time and volume, a sets progress strip, and Finish shows how many sets are done',
      'The rest timer now sits right under the set you just finished, with +15s and Skip',
      'Cleaner exercise cards: options live in the ⋯ menu and notes are tucked behind a note icon',
      'Smoother sheets and menus everywhere: they now slide open and closed instead of popping in and out',
      "Fixed: removing or reordering an exercise could clear what you'd typed in other exercises",
    ],
    notes: ['Prefer compact cards? Turn charts off in Settings → Workouts'],
    cta: { label: 'Start a workout', target: 'Workouts' },
  },
  {
    version: '1.0.39',
    date: '2026-07-08',
    title: "What's New",
    items: [
      'AI Coach\'s Take — right after you finish a workout, get an instant recap comparing this session to your last one, exercise by exercise',
      'Smart nudges — reminders when your streak\'s at risk, a muscle group\'s been neglected, or it\'s time to beat your last lift',
      'Workout summary is now a sleek bottom sheet',
      'Fixed an issue where finishing a workout could hang after the app had been backgrounded for a while',
    ],
    cta: { label: 'Finish a workout', target: 'Workouts' },
  },
  {
    version: '1.0.37',
    date: '2026-05-16',
    title: "What's New",
    items: [
      'New Community tab — see your friends\' workouts in a live activity feed',
      'Share photos and captions with every session you finish',
      'Like posts and tap any workout to see the full breakdown',
    ],
    cta: { label: 'Check it out', target: 'Community' },
  },
  {
    version: '1.0.36',
    date: '2026-05-04',
    title: "What's New",
    items: [
      'MacroLens: add optional context before scanning (e.g. "from McDonald\'s", "1 cup brown rice", "cooked in butter") to improve accuracy',
      'Active workout: tap a previous set to copy its weight and reps into your current set',
      'Active workout: new "Copy" button duplicates the last set in one tap',
      'Active workout: new X button on each exercise to remove it from the workout',
      'Active workout: Superset button now works — tap to pair with the next exercise, tap again to unlink',
      'Background music (Spotify, Apple Music, etc.) no longer ducks when the workout sheet is open',
      'Fixed an issue where tapping a workout in the Recovery Overview history would freeze the screen',
    ],
  },
  {
    version: '1.0.35',
    date: '2026-04-23',
    title: 'Bug Fix',
    items: [
      'Fixed an issue where workouts, food entries, and other data would not load after restarting the app',
    ],
  },
  {
    version: '1.0.34',
    date: '2026-04-22',
    title: "What's New",
    items: [
      'AI coach in the Lab tab — chat about your training, programming, and recovery with context pulled from your recent workouts',
      'Chat history saves across sessions and syncs to your account',
      'New app logo',
    ],
  },
  {
    version: '1.0.33',
    date: '2026-04-03',
    title: "What's New",
    items: [
      '12 accent color themes — customize the entire app with your preferred color palette',
      'UI design refresh — compacted layouts, refined spacing, and cleaner card designs across all screens',
      'Exercise search upgraded with deep search powered by AI for finding any exercise instantly',
      'Food search upgraded with deep search for accurate macro and micronutrient estimates on any food',
      'New "For You" tab in food logger combining recent and popular foods in one view',
      'General bug fixes and performance improvements',
    ],
  },
  {
    version: '1.0.31',
    date: '2026-03-11',
    title: "What's New",
    items: [
      'Redesigned home page with new greeting layout and action cards',
      'Workout programs — browse and start structured training plans',
      'Routine preview so you can see exercises before starting',
      'Recovery overlay improvements for better muscle rest visibility',
    ],
  },
  {
    version: '1.0.30',
    date: '2026-03-08',
    title: "What's New",
    items: [
      'Community page — see what your friends are up to',
      'Ghost challenge flow — race against your previous workouts',
      'Inline workout summary shown after finishing a session',
      'Redesigned exercise history graphs for clearer progress tracking',
    ],
  },
  {
    version: '1.0.29',
    date: '2026-03-06',
    title: "What's New",
    items: [
      'Redesigned workouts page with recovery overview, training calendar, and workout history',
      'New routines — save and reuse your favourite workout templates',
      'Improved exercises modal with better search, filtering, and exercise details',
      'Grouped muscle recovery filters — view by Chest, Back, Shoulders, Arms, or Legs',
      'Streamlined navigation with cleaner tab layout',
    ],
  },
  {
    version: '1.0.28',
    date: '2026-03-05',
    title: "What's New",
    items: [
      'Supplement settings revamp — cleaner UI with animations',
      'Workout UI refinements: history graph, rep steppers, calendar today marker',
      'Redesigned workout discard confirmation',
      'Home screen cards now share a consistent settings layout',
      'Protein powder settings moved to its own popup modal',
    ],
  },
  {
    version: '1.0.27',
    date: '2026-03-04',
    title: "What's New",
    items: [
      'Redesigned workout page with recovery body map, training calendar, and glass UI',
      'Routine summary screen to review your plan before lifting',
      'Swipe-to-delete on exercises and sets',
      'Rest timer pause and beep countdown',
      'Progressive overload redesigned as a minimal inline module',
    ],
  },
  {
    version: '1.0.26a',
    date: '2026-03-03',
    title: "What's New",
    items: [
      'Protein powder tracking — save powder profiles with per-scoop macros',
      'Log scoops from the home screen, auto-logged as snack entries in daily nutrition',
      'Multiple scoop size options on the home screen',
      'Weight trend analysis with goal weight projection and ETA',
      'Smart disclaimers when tracking data is limited',
    ],
  },
  {
    version: '1.0.26',
    date: '2026-03-02',
    title: "What's New",
    items: [
      'Redesigned supplement cards — track up to 2 supplements side by side',
      'Add new supplements directly from the card with the built-in Add button',
      'Daily motivation quotes on the home screen to keep you going',
      'Refreshed home screen layout with cleaner card design',
    ],
  },
  {
    version: '1.0.23',
    date: '2026-02-23',
    title: "What's New",
    items: [
      'Alternate nutrition source — switch between Open Food Facts and USDA data when scanning',
      'Prompts you to enter the serving size when it can\'t be found automatically',
      'User-created foods now appear in search for all users (marked as Unverified)',
      'Food database expanded to 1200+ items including gym & lifting-focused foods',
      'All food serving sizes now displayed in grams for consistency',
      'Serving size shown in search results so you know what the macros are per',
      'Recent foods limited to 5 most recent for a cleaner search experience',
    ],
  },
  {
    version: '1.0.22',
    date: '2026-02-22',
    title: "What's New",
    items: [
      'Recovery body graph to see which muscles need rest at a glance',
      'Ranks so you can climb the leaderboard and earn your title',
      'Check out the Lab section for new analytics & insights',
      'Bug fixes & performance improvements',
    ],
    notes: [
      'The exercise database is still growing and will continue to expand with future updates.',
      'The food database is currently limited and being actively improved.',
    ],
  },
];

export default changelog;
