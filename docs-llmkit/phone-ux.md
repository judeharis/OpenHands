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
- Plan mode = parent conversation + planning sub-conversation in **the same sandbox**: the app
  copies the parent's `sandbox_id` into the sub-conversation's start request
  (`_inherit_configuration_from_parent`). An earlier version of this note said two sandboxes;
  the DB shows every parent/planner pair on one. The planner has its own conversation id,
  socket and session key on that sandbox.
- The UI merges both conversations' events into one thread and marks the planner's with
  `isFromPlanningAgent`; the confirmation target must follow that flag.
- The agent's terminal has no TTY: any prompt means the command has already exited.
- Approval → next action is 7 s for small file writes on `Qwen3.6-35B-A3B` over the tunnel;
  20–65 s when npm/scaffolding is involved. The wait is model + sandbox, not the UI.
- `SANDBOX_CONTAINER_URL_PATTERN` is used for both the app's own checks and the browser; it
  cannot carry the tailnet name (the app cannot reach tailscale serve), so the UI/proxy do the
  host rewriting.

## Iteration 3 — reads run, writes ask (2026-09-22)

What changed since the two runs above (all in `local-llm-kit/agentui/`, this fork is now its
submodule): the sandbox runs `llmkit_policy`, a security analyzer that rates read-only tools,
file views and an allow-list of terminal commands LOW (they run), anything outside `/workspace`
HIGH, everything else MEDIUM (it asks) under `ConfirmRisky(MEDIUM)`; the app installs it in every
conversation's start request. The panel lists the whole pending batch with one Continue, has a
third button **Allow for session** (a `write:<dir>/` or `cmd:<prefix>` grant, then continue),
does not ask twice for an identical batch, colours by the policy's verdict, shows "new file, 20
lines" and the path with the project prefix greyed, and can send a rejection reason. Sessions:
sandboxes are kept (max 50, `agentui off` stops rather than removes), old conversations show
their whole history and **Reopen**, each sandbox has its own conversations directory.

Same task as iteration 1 (folder `tictactoe3`), same driver, same viewport. The driver now taps
Allow for session the first time a write inside the project is asked, as a Claude Code user would.

| | Iteration 1 (baseline) | Iteration 3 |
|---|---|---|
| Taps | **18** | **4** (1 of them Allow for session) |
| Wall time | 6 min 0 s | **2 min 20 s** |
| Agent actions | – | 10 (7 file edits, 3 commands): 6 ran without a tap |
| Scrolls to reach the panel | 4 | 0 |
| Bugs logged by the driver | 1 | 0 |
| Result | playable game | playable game, built and published under `/games/tictactoe3/` |

The four taps: `package.json` (answered with Allow for session → the other six files ran), then
three commands: create the directory tree, `npm install`, `vite build`. Each of those is a
`cmd:` grant away from zero.

**A planner loop the policy hid.** The plan-mode run (folder `tictactoe4`) never reached Build:
the planner grepped `tictactoe4` in an empty project **seventeen times in a row**, each auto-approved
in ~1 s, until the SDK's stuck detector stopped the conversation (`execution_status: stuck`). In
iteration 2 a person saw the second identical `grep` and would have cancelled; with reads free,
the loop ran at model speed. Fix: the analyzer now rates the **third identical action in a row**
MEDIUM (it asks; the panel says "the same action 3 times in a row; is it stuck?"), and the driver
treats `stuck` as a finding plus one nudge instead of waiting out its cap. The plan-mode
re-measurement is iteration 4.

Everything else of the ranked list that landed in this iteration: A1 (server-side, not a robot
tap), A2, A3, A4, B5, B6, E16, E17, C9 (the planner's three tools are all read-only, so it
needs zero taps — when it is not looping), C10 (`agentui reap --idle`, off by default), C11 (the
app sitecustomize keeps a new sandbox off any port a stopped one holds), D12–D15 (one header
row, no repo chrome without a provider, toasts at the bottom, an Open button on work-host
links), B7 (a "(1) Waiting for you" title badge and an opt-in browser notification; Web Push
needs the backend and is out of scope). Not done: nothing on the list; the remaining tap
reductions are grants the user chooses.

### Method notes
- `run.mjs` now records per-confirm `actionKinds` / `risk` / `count` from the panel, counts
  every agent action from the app-server mirror afterwards (`autoApproved = actions − taps`),
  and `compare.mjs <baseline> <run>` prints the deltas. Baselines are in `baselines/`.
- Folder names are bumped per run (`tictactoe3`, `tictactoe4`, …) so the workspace state does not
  shortcut the task.

## Iteration 4 — plan mode, build, "publish it for my phone" (2026-09-22)

Same task and follow-up as iteration 2, folder `tictactoe6`, same driver; the driver taps
Allow for session once for file writes and once for the browser tool.

| | Iteration 2 (baseline) | Iteration 4 |
|---|---|---|
| Taps to write the plan | **23** | **1** (the planner tried to write `package.json` with its own editor; the tool refuses that anyway — the policy no longer asks about it) |
| Taps to build | 29 | 7 (files as one batch → Allow for session; mkdir, npm install, vite build, dev server, browser navigate → Allow, one click) |
| Taps for the follow-up | 0 (never reached) | 16 |
| Taps, total | **52** | **24** (2 Allow for session) |
| Wall time | ~11 min to "finished", driver ran to its 30-min cap | **12 min 4 s** to finished, follow-up included |
| Agent actions | – | 98, of which 74 ran without a tap |
| Planner ready after the Plan tap | ~60 s (a second sandbox) | 0 s (same sandbox) |
| Result | game on a dev server | game built and published under `/games/tictactoe6/`, verified in the agent's browser |

Two earlier attempts at this iteration did not finish and each fixed something: the planner
looped on an identical `grep` seventeen times (now the third identical action in a row asks),
and the panel's never-ask-twice rule fingerprinted every browser click alike and one of its
auto-answers raced the sandbox's state update (whole-action fingerprints; a "confirmed" cue
that the sandbox has not honoured in 8 s goes back to the panel).

**The follow-up is where the taps went**, and they split two ways:
1. *Policy false positives* — reads that asked: `cat AGENTS.md 2>/dev/null | head` and
   `ls …/dist 2>/dev/null` (a `>` in a `/dev/null` redirect), `ps aux | grep …`, the shell
   `grep`, `curl -o /dev/null http://localhost:8011/` (marked *outside the workspace* because
   of `/dev/null`, and red). All now allow-listed: redirects to `/dev/null` are stripped before
   the check, `/dev/null` is not a path, shell `grep`/`rg`/`ps`/`ss`/`netstat` are read-only,
   and `curl` is free when it only reads from `localhost`. Six taps.
2. *The agent not knowing the deployment* — it started `http-server` on 8011 six times, then
   on **40000** (the proxy's port, outside the sandbox), and curl'd the tailnet URL from inside
   the sandbox, which cannot reach it. `AGENTS.md` now says the proxy serves `dist/` by itself,
   never to start a server on that port, and never to fetch that URL from the sandbox.
   The rest of the taps.

One driver note: "Continue tap did not take effect" at 536 s was not a lost tap; the agent's
`http-server` had exited and it issued the same command again as a new action (six attempts
in the event log).

### Iteration 4b — the same run after those two fixes

| | Iteration 2 (baseline) | Iteration 4 | **Iteration 4b** |
|---|---|---|---|
| Taps to write the plan | 23 | 1 | **0** |
| Taps to build | 29 | 7 | **6** (file batch → Allow for session; mkdir, npm install, vite build, dev server; browser → Allow for session, now the whole `browser_*` family) |
| Taps for the follow-up | – | 16 | **0** — the agent answered in two seconds: "the static build is already in `dist/`, which the proxy serves automatically", with the phone URL |
| Taps, total | **52** | 24 | **6** (2 Allow for session) |
| Wall time, task → last answer | ~11 min + cap | 12 min 4 s | **6 min 12 s** |
| Agent actions | – | 98 (74 unprompted) | 64 (58 unprompted; 33 of them the planner's, all free) |
| Result | dev server | published | published, `https://<host>:40000/games/tictactoe7/` answers 200 |

The remaining six are the commands a `cmd:` grant would take (`mkdir`, `npm install`, `npm run
build`, `npm run dev`) plus the two Allows. One driver bug surfaced and was fixed: an answer
that takes two seconds fell between two 2.5 s polls, so the driver never saw the agent
"running" after the follow-up and waited for its cap; the numbers above are from the event log.

## Iteration 5 — the same conversation from a terminal (2026-09-22)

`agentcli` (`local-llm-kit/agentui/cli`) speaks the app-server and sandbox protocols directly:
it lists, starts, attaches to and reopens conversations, streams the same events the phone
sees, answers confirmations with `y` / `n reason` / `a` (a session grant, then continue) /
`v`, has `/plan` · `/build` for plan mode, and `!cmd` for a shell in the sandbox. Both clients
subscribe to the sandbox's event socket; whoever answers first wins and the other says so.

`cli/tests/e2e/crosscheck.sh` drives both halves (the phone half is
`tools/phone-test/cli-crosscheck.mjs`, same viewport as the runs above):

| | Result |
|---|---|
| The CLI starts a one-file task and waits; the phone taps Continue | the CLI logs `answered_elsewhere` and moves on with the stream |
| The phone starts the same task and waits; the CLI answers `y` | the phone's panel resolves without a tap, the file appears |

Three bugs the cross-check found before it passed cleanly: the CLI's event logger died on
the first event (a duplicate keyword); a scripted `wait` swallowed the window in which the
confirmation was open; and after answering, the session re-entered the confirmation with
nothing pending and spun without yielding, starving the event consumer that would have told
it the sandbox had moved on. From the phone itself the terminal path is `ssh` to the desktop
(Termius) and `agentcli -r last`; that leg is the user's to try, it is not in the driver.
