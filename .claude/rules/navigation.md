# Navigation
- **Start with the map.** Read `CODEBASE_MAP.md` first for where things live and how they connect. If it disagrees with the Project Structure tree in `CLAUDE.md`, the map is current: trust the map.
- **Scout before non-trivial changes.** Delegate to the `codebase-scout` subagent to find all affected code and what else must change, then make the edits in the main session.
- **LSP before grep.** For symbol lookups (definitions, references, callers), use the `LSP` tool first.
- **Baseline errors aren't yours.** The repo has 24 type errors in 11 files before any change (listed in the map). Don't fix them as part of other work: flag them and ask, like any existing bug, so the change keeps its scope.
- **Keep the map current.** When you add, move, rename or delete folders or modules, or change a tab or route, update `CODEBASE_MAP.md` in the same change.
