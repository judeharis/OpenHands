# phone-test — drive the UI like a person on a Galaxy S24 Ultra

Playwright scripts used for the phone UX study (see `docs-llmkit/phone-ux.md`). They run
against the live stack over the tailnet (`https://jude.tail0bda35.ts.net`) in a 384×780 CSS-px
viewport at DPR 3.75 with touch, and read conversation status from the app API on
`127.0.0.1:3000`.

```bash
cd frontend && npx playwright install chromium         # once
ln -sfn "$PWD/node_modules" ../tools/phone-test/node_modules
cd ../tools/phone-test
node probe.mjs                                          # list tappable elements on the home screen
node run.mjs iter1 code "Create a React tic-tac-toe game …"          # full run, approving every action
node run.mjs iter2 plan "…task…" "…follow-up sent after the first finish…"
node verify.mjs                                         # is the Continue button in view and unobscured?
```

`run.mjs` writes `/tmp/phone-test/<name>/NN-*.png` and `log.json` (approvals, scrolls, timings,
every `bug:`/`ux:` note). It taps Continue on every confirmation after a 1.5 s "reading" pause,
scrolls only when the panel is off-screen, and in plan mode taps Build once the plan is done.
