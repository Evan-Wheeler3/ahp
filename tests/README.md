# Tests
Run from the repo root (Node 18+):

    node tests/smoke.js      # syntax, every weapon, collapses, minutes of play, UI flows
    node tests/balance.js    # balance assertions (uses tests/throughput.json; rebuilt automatically when gameplay code changes, ~5 min)
    node tests/economy.js    # prints the throughput matrix, survival ceilings and the progression model
    node tests/perf.js       # hot-path timings
    NODE_PATH=$(npm root -g) node tests/browser.js [screenshot-dir]   # needs playwright + chromium

The game script is loaded from `lights-out.html` into a Node VM with a stubbed DOM (`harness.js`); `window.__lo.t` exposes internals for testing.
