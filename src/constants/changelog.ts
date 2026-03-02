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
