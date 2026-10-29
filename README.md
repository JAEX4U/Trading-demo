# TradeLab — Paper Trading Simulator

A polished, responsive, dependency-free paper-trading dashboard built with vanilla HTML, CSS, and JavaScript. All market prices and trade outcomes are simulated in the browser; the app does not connect to a broker, exchange, or live market-data provider.

## Features

- Responsive trading workspace with a simulated price chart, market-depth view, and order ticket.
- BTC/USDT, ETH/USDT, and SOL/USDT simulated markets with selectable chart ranges.
- Market orders and pending limit orders, including cancel controls and simulated fills.
- Risk-based position sizing, margin estimates, leverage controls, and configurable risk limits.
- Configurable randomized win probability and reward-to-risk assumptions, with an educational expectancy calculator.
- Account summary, completed-trade ledger, outcome filters, CSV export, and account reset.
- Locally persisted paper account, preferences, and order history using browser `localStorage`.
- Accessible navigation and controls, plus a clear simulation-only notice.

## Run locally

No package installation or build step is required. From the repository directory, start any static file server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser. The app is served from `index.html`.

## Important

This project is an educational interface demo, not financial software. Prices, market depth, and randomized trade results are synthetic. The configured win probability is only a simulation input; it is not an estimate, forecast, or trading signal. No real orders are sent and no real funds are used.
