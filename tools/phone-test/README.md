# phone-test — drive the UI like a person on a Galaxy S24 Ultra

Playwright scripts used for the phone UX study (see `docs-llmkit/phone-ux.md`). They run
against the live stack over the tailnet (`https://jude.tail0bda35.ts.net`) in a 384×780 CSS-px
viewport at DPR 3.75 with touch, and read conversation status from the app API on
`127.0.0.1:3000`.

```bash
cd frontend && npx playwright install chromium         # once
ln -sfn ../../frontend/node_modules ../tools/phone-test/node_modules
cd ../tools/phone-test
node probe.mjs                                          # list tappable elements on the home screen
node run.mjs iter5 code "Create a React tic-tac-toe game …"          # full run, approving every action
node run.mjs iter6 plan "…task…" "…follow-up sent after the first finish…"
node compare.mjs iter1 iter5                            # taps / time / auto-approved, vs a baseline
node verify.mjs                                         # is the Continue button in view and unobscured?
node reopen-smoke.mjs <conversation id>                 # an archived conversation: whole history, Reopen, live composer
node cli-crosscheck.mjs answer <id> | ask "<task>"      # the phone half of cli/tests/e2e/crosscheck.sh
```

`run.mjs` writes `/tmp/phone-test/<name>/NN-*.png` and `log.json` (approvals, scrolls, timings,
every `bug:`/`ux:` note, per-confirm action kinds / risk / batch size, and afterwards the count
of every action the agent took, so `autoApproved = actions − taps`). It taps Continue on every
confirmation after a 1.5 s "reading" pause, taps **Allow for session** the first time a write
inside the project is asked (as a Claude Code user would), scrolls only when the panel is
off-screen, in plan mode taps Build once the plan is done, and treats a `stuck` agent as a
finding plus one nudge. `baselines/` holds the logs of iterations 1 and 2; bump the folder name in
the task per run so the workspace does not shortcut it.
