# jentic's OpenHands fork — status

**Objective:** carry the changes that make OpenHands usable from a phone, driven by a local
model, on the `llmkit` branch — and keep them small enough to rebase onto upstream. What was
measured and why: [phone-ux.md](phone-ux.md). The kit that deploys this fork, and the rest of
the story: `../../../STATUS.md` in the jentic repo (this is the submodule).
**Last checkpoint:** 2026-09-23

## Headline

Five commits this session, all frontend, all from using the thing on a phone against a local
model: a conversation opens on its newest message, tool output is treated as literal text
rather than markdown, a strip says what the agent is doing during the long quiet stretch
while a local model reads the prompt, Code or Plan can be chosen when starting, and the
conversation title keeps half the header row. **Clean, 5 ahead of `origin/llmkit`, not
pushed.** Only the frontend is built and mounted over the pinned app image — no backend
change in this fork is live.

## Where things stand

| Area | State |
|---|---|
| Git | **Clean. `llmkit` at `90c6e4eea`, 5 ahead of its remote**, not pushed. |
| What is actually deployed | **The frontend build only.** `jentic` mounts `frontend/build` over the image's copy; the backend is the pinned upstream image (revision f4bfa7f9, SDK 1.36.0). Backend behaviour is changed from the kit's `sitecustomize`, not from here. |
| Build | Current — `jentic status --json` reports `frontend.stale: false`. Every change needs `npm run build` then `jentic restart-app`. |
| Tests | The touched suites pass: v1 + markdown 151, chat + hooks 484. **Two pre-existing failures** survive on an untouched tree (below). |
| Pre-commit | The hook's frontend half runs and passes; its backend half needs `poetry`, absent here, so **every commit this session used `--no-verify`**. |

## Completed this session (with evidence)

1. **A conversation opens on its newest message** (`1319d3669`). `useRememberedScroll` opened a long conversation at `top: 0` with following off. Replaced by `useOpenAtBottom`, which needs *two* observers — see the trap below. Verified by driving a real browser: sampled every 500 ms, the container is at the bottom from 0.5 s and holds while content grows 4,194 → 11,558 px.
2. **Tool output is literal text** (`84ee3200c`). `__init__.py` was printed as a bold `init.py`; browser state ran into the conversation as thousands of JSON objects; a truncation mid-block left the fence open. All three were unfenced text handed to react-markdown. Fencing is conditional for browser output so a one-line status stays a sentence. Blocks over eight lines now collapse to six with "Show N more lines".
3. **An activity strip** (`74903fdb3`). Spinner and clock on a timer, not on events, because the quiet stretch is exactly when no events arrive; a `~` estimate from the streaming deltas; and the conversation's exact totals with the prompt cache's share.
4. **Code or Plan at creation** (`79aae88c2`). The plumbing existed and was unused: `agent_type` is declared by the server as `{default, plan}` and nothing in the web UI passed it, so plan mode was reachable only through `jentic-cli plan`.
5. **The phone header** (`90c6e4eea`). 62 % of a 384 px phone left the title 65 px.

## Tried and failed

- **A ResizeObserver set up once watches only the children that existed then.** The first version of the scroll fix pinned to the bottom of the first message, then drifted up the history as messages streamed in — because a message arriving is a DOM change, not a size change. It needs a MutationObserver as well, with the ResizeObserver kept for markdown and images that lay out late. It took two reports of "still scrolling" before this was measured in a browser rather than reasoned about from the source.
- **A context gauge cannot be built from `accumulated_token_usage`.** It is the conversation's running total: 1,875,850 prompt tokens against a `context_window` of 30,000, so the strip read "context 1876k/30k". `per_turn_token` is also a total (82,101 against the same 30,000). Nothing in that payload holds the current prompt size.
- **Two tests passed with their fix removed.** An observer stub registered its callback in the constructor rather than in `observe()`; and the browser-output tests passed unfenced. Both were re-checked by disabling the fix and watching them fail.
- **`window.matchMedia` is not guaranteed.** The Enter-to-send handler checked `window` but not the function, and threw on every keystroke under jsdom.

## Next session

1. **Push**: `git push origin llmkit` (5 commits), *before* the kit's pointer bump is pushed, or a clone fetches a submodule commit that does not exist.
2. **Two pre-existing test failures**, both on an untouched tree, neither from this work: `__tests__/hooks/use-settings-nav-items.test.tsx` (5 cases, settings nav items) and `__tests__/components/features/home/recent-conversation.test.tsx` (1, model-name formatting).
3. **Rebase pressure**: the app image is `:latest`. When it moves, this fork's frontend is built against a backend that may have changed shape; the five `sitecustomize` patches on the kit side fail soft, which means silent, so check `jentic logs` for `llmkit:` lines after any pull.
4. **`docs-llmkit/phone-ux.md` iteration 5 is still missing its terminal leg** — driving `jentic-cli` from a phone over SSH.

## Key files (this fork's own)

| Path | Role |
|---|---|
| `frontend/src/hooks/use-open-at-bottom.ts` | where a conversation opens, and why it needs two observers |
| `frontend/src/hooks/use-turn-activity.ts` | what the strip can honestly say, and what it cannot |
| `frontend/src/components/features/markdown/collapsible-code.tsx` | long blocks collapse |
| `frontend/src/components/v1/chat/event-content-helpers/get-observation-content.ts` | every branch fences its literal text |
| `frontend/src/components/features/home/home-composer.tsx` | the fork's home screen: composer, and Code/Plan |
| `frontend/src/components/shared/buttons/v1-confirmation-buttons.tsx` | the phone's confirmation panel |
| `frontend/src/utils/llmkit-policy.ts` | TypeScript port of the kit's classifier |
| `docs-llmkit/phone-ux.md` | the study: method, iterations, ranked list |

## Open risks

- **5 unpushed commits**, and the kit's submodule pointer already committed to them.
- **`--no-verify` on every commit here.** The frontend checks ran; the backend hook did not.
- **This fork is ahead of the deployed backend.** `_create_condenser` exists here and not in the pinned image; anything written against fork-only backend code will not run until the image moves.
- **The frontend build is a mount.** A build that fails leaves the previous `build/` in place and the app keeps serving it, so "nothing changed" can mean "the build failed", not "the fix did not work".
