/**
 * Changelog entries — newest first.
 * Add a new entry at the top whenever you ship a user-facing update.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
  notes?: string[];
}

const changelog: ChangelogEntry[] = [
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
