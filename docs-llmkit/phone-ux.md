# Phone UX study — OpenHands on a Galaxy S24 Ultra (2026-09-21)

**Method.** Playwright drives the real stack (tailnet HTTPS → app → sandbox → bruny `chat`) in a
384×780 CSS-px viewport, DPR 3.75, touch, Android UA, behaving like a person: read the
confirmation, wait 1.5 s, tap Continue, scroll only when the panel is off-screen, screenshot
along the way. Scripts: `tools/phone-test/`. Yardstick: Claude Code on the same phone.
Confinement held throughout: the sandbox mounts only the workspace, no docker socket, uid 1000,
no sudo; every action paused for a tap; nothing outside `/workspace` was touched.

## The two runs

| | Iteration 1 — code mode | Iteration 2 — plan mode → Build → "run it for my phone" |
|---|---|---|
| Task | React tic-tac-toe, Vite, plain JS | same, new folder, then a follow-up |
| Taps | **18** | **52** (23 to write the plan, 29 to build, 0 for the follow-up) |
| Wall time | 6 min 0 s | ~11 min to "finished" (driver ran to its 30-min cap) |
| Result | playable game, verified in a phone-sized browser (win, reset, no JS errors) | playable game, dev server on 8011, **verified through the phone URL** `https://jude.tail0bda35.ts.net:40000/sb/<port>/` |
| Taps that did real work | 8 (six files, install, build) | ~12 |
| Taps spent on housekeeping | 10 — one interactive `npm create` prompt cost 8 | ~40 — the planner read every file of the *previous* project one by one; create-vite's linter prompt cost 4 more |

## What broke, in order of severity

1. **Plan mode approvals went to the wrong conversation.** Plan mode is a *second* conversation
   (sub-conversation) with its own sandbox. Continue/Cancel posted to the parent's URL. The
   planner sat at its first action forever; the parent's code agent — with nothing pending —
   took the response as "run" and executed the task unasked (8/8 taps misrouted). This is the
   "asking me to confirm but there is no way" you saw. **Fixed** (`98a27a9aa`).
2. **The Continue button was unreachable without scrolling.** The panel lived at the end of the
   thread; the thread does not auto-scroll when a new action arrives, so the button was
   off-screen or under the composer 16 times in 52. Now **pinned above the composer**,
   verified in view and unobscured at y=549/780 (`3d96aae59`).
3. **Buttons only existed inside whichever component drew the last message** — none when that was
   a streaming bubble or a hidden plan-mode edit. **Fixed** (`f5c6f24c4`).
4. **Raw JSON as content.** Titles were `tool_name: {"command": …}` (the agent-server's fallback
   summary for local models); `INVOKESKILL` and `PLANNINGFILEEDITOR` cards dumped the whole
   event. **Fixed**: translated titles, "Loading skill npm", "Reading <path>", field lists.
5. **Approving what you cannot read.** Commands clipped at the right edge; file previews cut at
   1000 chars with `...`. **Fixed**: wrapping, 6000 chars, "N more characters not shown".
6. **Sandboxes never stop and their random host ports collide.** Six sandboxes were alive, one
   18 h old; the next start failed with `Bind for 0.0.0.0:56633 failed` and the phone showed a
   spinner for 3 min. `agentui off` now removes sandboxes by name; the port race is upstream.
7. **The dev-server URL the agent gives is wrong for a phone** (`http://localhost:40000/sb/…`),
   and even the right host gave **403** (Vite's allowedHosts) and could not load its assets from
   `/`. **Fixed** in the proxy (Host → localhost, `sbport` cookie routes `/` to the last sandbox
   page) and in the UI (localhost links rewritten to the page host); `AGENTS.md` tells the agent
   the phone form.
8. **Interactive CLIs.** `npm create vite` prompted on a non-TTY and the model spent 8 taps on
   `y`/Ctrl-C/Ctrl-D; with `npm_config_yes` the *next* layer (create-vite's "Which linter?")
   prompted instead. Only writing the files directly worked, both times. `AGENTS.md` now says so.
9. Smaller: New Conversation below the fold on the home screen (fixed: order); `⌘↩`/`⇧⌘⌫` hints
   on touch (fixed); Build button 26 px tall (fixed); tab strip wrapping the ⋮ menu onto a second
   line at 384 px (fixed: scrollable row); "Planning agent initialized" toast covering the header;
   GitHub-repo suggestion cards in a scratch workspace; "No Repo Connected / No Branch" chips;
   `Writing toverify.txt` (missing space in the card title).

## Improvements to make, ranked (for someone used to Claude Code on a phone)

**A. Fewer taps — the whole difference.** Claude Code asks once per *kind* of action and offers
"allow for this session"; here every `view`, `glob`, `grep`, task-list update and skill load is a
tap, and identical consecutive actions are two taps. ~75 % of taps in both runs were on actions
that cannot hurt anything.
1. **Auto-approve read-only actions**: `file_editor view`, glob, grep, `TaskTrackerAction`,
   `InvokeSkillAction`, `ThinkAction`, `BrowserGetState`, and terminal commands from an allow-list
   (`ls`, `cat`, `head`, `find`, `git status/diff/log`, `npm ls`). Writes inside `/workspace` and
   everything else still ask. This alone would have cut run 2 from 52 taps to ~14.
2. **"Allow this for the session" as a third button** (per tool, per path prefix), the way
   Claude Code does; and **"Continue and don't ask about file writes under tictactoe2/"**.
3. **Never ask twice for the same thing**: dedupe an action identical to the one just approved.
4. **Batch the small ones**: when several actions arrive within a few seconds (three `view`s in
   run 2 landed in the same second) show one panel listing them with a single Continue.

**B. What the panel shows.** Make the approval itself informative enough to decide from:
5. A one-line **diff summary** on writes ("App.jsx: +111 lines, new file"; "index.css: 3 lines
   replaced") with "show full" — not the whole file inline.
6. **Risk colour** on the panel from `security_risk` (already computed) instead of a grey box;
   terminal commands get the command in the panel title, not only in the card above.
7. **Haptic/notification when a confirmation is waiting**: the phone is in a pocket for the 30–60 s
   scaffolding steps; a web push or at least a title-bar badge "(1) Waiting for you".

**C. Fewer wasted turns (agent side).**
8. Ship a stock `AGENTS.md` with the workspace: no scaffolding CLIs, no prompts, batch reads, the
   phone URL form, dev servers on 8011/0.0.0.0. (Done for this workspace; make it part of the kit.)
9. **Plan mode should not re-read the last project file by file** (23 taps to write a plan). Give
   the planner a single "list the project" step, or disable confirmation for the planner's reads.
10. **Stop the sandbox when the conversation is idle** for N minutes, and pause instead of
    killing running dev servers; show "sandbox stopped — tap to resume" rather than a spinner.
11. Retry sandbox start automatically on the port-collision error (upstream: bind the probe
    socket with `SO_REUSEADDR` off, or let Docker pick the host port).

**D. Screen real estate and chrome.**
12. Collapse the two header rows into one on narrow screens (title + a single ⋮); the strip and
    title cost 15 % of the viewport before content.
13. Hide "No Repo Connected / No Branch" and the GitHub task suggestions unless a git provider is
    configured; home screen = one input and recent conversations.
14. Toasts at the bottom, not over the header buttons.
15. A **"Open"** button on the dev-server line: when the agent reports a work-host URL, render a
    button that opens `https://<page host>:40000/sb/<port>/` in a new tab (the rewrite exists;
    make it a button, not a link to find in prose).

**E. Trust and safety cues (keep the confinement visible).**
16. Show *where* an action will happen in the panel: `/workspace/project/tictactoe2/App.jsx`
    with the `/workspace/project/` prefix greyed — anything outside the workspace in red (the
    guard hook would deny it anyway; the user should see why).
17. After Cancel, show what the agent was told ("User rejected the action") and let the user type
    a reason in the same panel instead of a new message.

## Facts worth keeping
- Plan mode = parent conversation + planning sub-conversation, **two sandboxes**, two sets of
  four published ports each.
- The UI merges both conversations' events into one thread and marks the planner's with
  `isFromPlanningAgent`; the confirmation target must follow that flag.
- The agent's terminal has no TTY: any prompt means the command has already exited.
- Approval → next action is 7 s for small file writes on `Qwen3.6-35B-A3B` over the tunnel;
  20–65 s when npm/scaffolding is involved. The wait is model + sandbox, not the UI.
- `SANDBOX_CONTAINER_URL_PATTERN` is used for both the app's own checks and the browser; it
  cannot carry the tailnet name (the app cannot reach tailscale serve), so the UI/proxy do the
  host rewriting.
