# Navigation
- **Start with the map.** Read `CODEBASE_MAP.md` first for where things live and how they connect. If it disagrees with the Project Structure tree in `CLAUDE.md`, the map is current: trust the map.
- **Scout before non-trivial changes.** Delegate to the `codebase-scout` subagent to find all affected code and what else must change, then make the edits in the main session.
- **LSP before grep.** For symbol lookups (definitions, references, callers), use the `LSP` tool first.
- **Remind people who haven't installed LSP.** At the start of a local session, if the `LSP` tool isn't available or reports `Executable not found`, tell the user once, before other work, in plain words:
  - **Why it helps:** without it, Claude finds connected code by text search. That's slower, uses more tokens, and can miss code or mix up different things with the same name, so a change is more likely to break something elsewhere. With it, Claude gets exact "where is this used" answers and sees type errors right after each edit.
  - **How to install** (once per computer): run `npm install -g typescript-language-server typescript` in a terminal, check it's found with `Get-Command typescript-language-server` (Windows) or `which typescript-language-server` (Mac), then in Claude Code run `/plugin install typescript-lsp@claude-plugins-official` and `/reload-plugins` (or start a new session).
  - Don't install it for them. Carry on with Grep/Glob in the meantime. Skip the reminder in web/cloud sessions, where LSP can't run.
- **Baseline errors aren't yours.** The repo has 24 type errors in 11 files before any change (listed in the map). Don't fix them as part of other work: flag them and ask, like any existing bug, so the change keeps its scope.
- **Keep the map current.** When you add, move, rename or delete folders or modules, or change a tab or route, update `CODEBASE_MAP.md` in the same change.
