'use strict';

(() => {
    const STORAGE_KEY = 'tradelab.paper-simulator.v1';
    const INITIAL_BALANCE = 25000;
    const STOP_DISTANCE = 0.005;
    const MAX_SAVED_TRADES = 500;
    const MAX_PENDING_ORDERS = 25;
    const DEFAULT_SETTINGS = Object.freeze({ winChance: 55, rewardRatio: 2, maxRiskPercent: 2, leverage: 5 });
    const RANGE_CONFIG = Object.freeze({
        '1H': { count: 60, labels: ['60m', '45m', '30m', '15m', 'Now'] },
        '4H': { count: 84, labels: ['4h', '3h', '2h', '1h', 'Now'] },
        '1D': { count: 108, labels: ['24h', '18h', '12h', '6h', 'Now'] },
        '1W': { count: 144, labels: ['7d', '5d', '3d', '1d', 'Now'] }
    });
    const MARKET_CONFIG = Object.freeze({
        BTCUSDT: { pair: 'BTC / USDT', base: 'BTC', basePrice: 67342.56, dayOpen: 66635.12, tickVolatility: 0.00042, chartVolatility: 0.00044, decimals: 2 },
        ETHUSDT: { pair: 'ETH / USDT', base: 'ETH', basePrice: 2498.13, dayOpen: 2474.36, tickVolatility: 0.00058, chartVolatility: 0.00057, decimals: 2 },
        SOLUSDT: { pair: 'SOL / USDT', base: 'SOL', basePrice: 151.42, dayOpen: 149.05, tickVolatility: 0.00083, chartVolatility: 0.00078, decimals: 2 }
    });

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
    const savedState = readSavedState();

    let balance = isFiniteNumber(savedState.balance) && savedState.balance >= 0 ? savedState.balance : INITIAL_BALANCE;
    let currentSymbol = Object.hasOwn(MARKET_CONFIG, savedState.currentSymbol) ? savedState.currentSymbol : 'BTCUSDT';
    let settings = sanitizeSettings(savedState.settings);
    let markets = createMarkets(savedState.markets);
    let trades = sanitizeTrades(savedState.trades);
    let pendingOrders = sanitizePendingOrders(savedState.pendingOrders);
    let selectedRange = '1D';
    let orderMode = 'market';
    let chartHistory = [];
    let chartHoverIndex = null;
    let toastTimer = null;

    const elements = {
        navButtons: [...document.querySelectorAll('.nav-button')],
        viewButtons: [...document.querySelectorAll('[data-view]')],
        views: [...document.querySelectorAll('.page-view')],
        marketSelect: document.getElementById('market-select'),
        headerBalance: document.getElementById('header-balance'),
        statBalance: document.getElementById('stat-balance'),
        statPnl: document.getElementById('stat-pnl'),
        statWinRate: document.getElementById('stat-winrate'),
        winrateCaption: document.getElementById('winrate-caption'),
        statTrades: document.getElementById('stat-trades'),
        chartHeading: document.getElementById('chart-heading'),
        currentPrice: document.getElementById('current-price'),
        priceChange: document.getElementById('price-change'),
        marketHigh: document.getElementById('market-high'),
        marketLow: document.getElementById('market-low'),
        lastUpdated: document.getElementById('last-updated'),
        chartCanvas: document.getElementById('tradingChart'),
        chartHoverChip: document.getElementById('chart-hover-chip'),
        chartHoverPrice: document.getElementById('chart-hover-price'),
        rangeButtons: [...document.querySelectorAll('.range-button')],
        marketMode: document.getElementById('market-mode'),
        limitMode: document.getElementById('limit-mode'),
        limitPriceGroup: document.getElementById('limit-price-group'),
        limitPrice: document.getElementById('limit-price'),
        riskAmount: document.getElementById('risk-amount'),
        riskCapNote: document.getElementById('risk-cap-note'),
        ticketLeverage: document.getElementById('ticket-leverage'),
        estimatedQuantity: document.getElementById('estimated-quantity'),
        estimatedMargin: document.getElementById('estimated-margin'),
        estimatedLoss: document.getElementById('estimated-loss'),
        estimatedReward: document.getElementById('estimated-reward'),
        ticketValidation: document.getElementById('ticket-validation'),
        ticketMessage: document.getElementById('ticket-message'),
        buyButton: document.getElementById('buy-btn'),
        sellButton: document.getElementById('sell-btn'),
        pendingCount: document.getElementById('pending-count'),
        bookPair: document.getElementById('book-pair'),
        asksList: document.getElementById('asks-list'),
        bidsList: document.getElementById('bids-list'),
        spreadValue: document.getElementById('spread-value'),
        bookMid: document.getElementById('book-mid'),
        recentTradesBody: document.getElementById('recent-trades-body'),
        activityLogBody: document.getElementById('activity-log-body'),
        activityTradeCount: document.getElementById('activity-trade-count'),
        activityFilter: document.getElementById('activity-filter'),
        pendingLedgerCount: document.getElementById('pending-ledger-count'),
        pendingOrdersList: document.getElementById('pending-orders-list'),
        winChance: document.getElementById('win-chance'),
        winChanceValue: document.getElementById('win-chance-val'),
        rewardRatio: document.getElementById('rr-ratio'),
        rewardRatioValue: document.getElementById('rr-ratio-val'),
        maxRisk: document.getElementById('max-risk'),
        maxRiskValue: document.getElementById('max-risk-val'),
        strategyLeverage: document.getElementById('strategy-leverage'),
        strategyLeverageValue: document.getElementById('strategy-leverage-val'),
        expectedValue: document.getElementById('expected-value'),
        calculatorReward: document.getElementById('calculator-reward'),
        calculatorRisk: document.getElementById('calculator-risk'),
        calculatorCap: document.getElementById('calculator-cap'),
        calculatorMargin: document.getElementById('calculator-margin'),
        exportCsv: document.getElementById('export-csv'),
        clearHistory: document.getElementById('clear-history'),
        resetAccount: document.getElementById('reset-account'),
        toastContainer: document.getElementById('toast-container')
    };

    const chartContext = elements.chartCanvas.getContext('2d');

    function readSavedState() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function sanitizeSettings(value) {
        const candidate = value && typeof value === 'object' ? value : {};
        return {
            winChance: clamp(isFiniteNumber(candidate.winChance) ? candidate.winChance : DEFAULT_SETTINGS.winChance, 10, 90),
            rewardRatio: clamp(isFiniteNumber(candidate.rewardRatio) ? candidate.rewardRatio : DEFAULT_SETTINGS.rewardRatio, 1, 5),
            maxRiskPercent: clamp(isFiniteNumber(candidate.maxRiskPercent) ? candidate.maxRiskPercent : DEFAULT_SETTINGS.maxRiskPercent, 0.25, 3),
            leverage: clamp(isFiniteNumber(candidate.leverage) ? candidate.leverage : DEFAULT_SETTINGS.leverage, 1, 10)
        };
    }

    function createMarkets(storedMarkets) {
        const saved = storedMarkets && typeof storedMarkets === 'object' ? storedMarkets : {};
        return Object.fromEntries(Object.entries(MARKET_CONFIG).map(([symbol, config]) => {
            const stored = saved[symbol] && typeof saved[symbol] === 'object' ? saved[symbol] : {};
            const price = isFiniteNumber(stored.price) && stored.price > 0 ? stored.price : config.basePrice;
            return [symbol, {
                price,
                dayOpen: config.dayOpen,
                high: isFiniteNumber(stored.high) && stored.high >= price ? stored.high : price,
                low: isFiniteNumber(stored.low) && stored.low <= price && stored.low > 0 ? stored.low : price
            }];
        }));
    }

    function sanitizeTrades(value) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, MAX_SAVED_TRADES).filter((trade) => {
            return trade && typeof trade === 'object'
                && Object.hasOwn(MARKET_CONFIG, trade.symbol)
                && (trade.side === 'BUY' || trade.side === 'SELL')
                && (trade.result === 'TAKE PROFIT' || trade.result === 'STOP LOSS')
                && isFiniteNumber(trade.price) && trade.price > 0
                && isFiniteNumber(trade.pnl) && isFiniteNumber(trade.risk)
                && typeof trade.timestamp === 'string' && Number.isFinite(Date.parse(trade.timestamp));
        }).map((trade) => ({
            id: typeof trade.id === 'string' ? trade.id.slice(0, 80) : makeId(),
            timestamp: trade.timestamp,
            symbol: trade.symbol,
            side: trade.side,
            price: trade.price,
            result: trade.result,
            pnl: trade.pnl,
            risk: trade.risk,
            orderType: trade.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
            balanceAfter: isFiniteNumber(trade.balanceAfter) ? trade.balanceAfter : 0
        }));
    }

    function sanitizePendingOrders(value) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, MAX_PENDING_ORDERS).filter((order) => {
            return order && typeof order === 'object'
                && Object.hasOwn(MARKET_CONFIG, order.symbol)
                && (order.side === 'BUY' || order.side === 'SELL')
                && isFiniteNumber(order.limitPrice) && order.limitPrice > 0
                && isFiniteNumber(order.risk) && order.risk > 0
                && typeof order.timestamp === 'string' && Number.isFinite(Date.parse(order.timestamp));
        }).map((order) => ({
            id: typeof order.id === 'string' ? order.id.slice(0, 80) : makeId(),
            timestamp: order.timestamp,
            symbol: order.symbol,
            side: order.side,
            limitPrice: order.limitPrice,
            risk: order.risk
        }));
    }

    function makeId() {
        return window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function persistState() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                balance,
                currentSymbol,
                markets,
                settings,
                trades: trades.slice(0, MAX_SAVED_TRADES),
                pendingOrders: pendingOrders.slice(0, MAX_PENDING_ORDERS),
                riskAmount: Number(elements.riskAmount.value) || 100
            }));
        } catch {
            // The simulator remains usable if browser storage is disabled or full.
        }
    }

    function activeMarket() {
        return markets[currentSymbol];
    }

    function configFor(symbol) {
        return MARKET_CONFIG[symbol] || MARKET_CONFIG.BTCUSDT;
    }

    function formatCurrency(value) {
        return currencyFormatter.format(Number.isFinite(value) ? value : 0);
    }

    function formatSignedCurrency(value) {
        if (value > 0) return `+${formatCurrency(value)}`;
        if (value < 0) return `−${formatCurrency(Math.abs(value))}`;
        return formatCurrency(0);
    }

    function formatPrice(value, symbol = currentSymbol) {
        const decimals = configFor(symbol).decimals;
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(Number.isFinite(value) ? value : 0);
        return `$${formatted}`;
    }

    function formatShortPrice(value) {
        if (value >= 10000) return `$${(value / 1000).toFixed(1)}k`;
        if (value >= 1000) return `$${(value / 1000).toFixed(2)}k`;
        return `$${value.toFixed(2)}`;
    }

    function formatQuantity(value, symbol = currentSymbol) {
        if (!Number.isFinite(value)) return '—';
        return `${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 }).format(value)} ${configFor(symbol).base}`;
    }

    function formatPercent(value, decimals = 2) {
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(decimals)}%`;
    }

    function getRiskAmount() {
        const value = Number(elements.riskAmount.value);
        return Number.isFinite(value) ? value : 0;
    }

    function getMaxAllowedRisk() {
        const marginCap = balance * settings.leverage * STOP_DISTANCE;
        const strategyCap = balance * settings.maxRiskPercent / 100;
        return Math.max(0, Math.min(balance, marginCap, strategyCap));
    }

    function getReferencePrice() {
        if (orderMode === 'limit') {
            const limitPrice = Number(elements.limitPrice.value);
            if (Number.isFinite(limitPrice) && limitPrice > 0) return limitPrice;
        }
        return activeMarket().price;
    }

    function updateTicketEstimates() {
        const risk = getRiskAmount();
        const maxRisk = getMaxAllowedRisk();
        const entryPrice = getReferencePrice();
        const exposure = risk > 0 ? risk / STOP_DISTANCE : 0;
        const quantity = entryPrice > 0 ? exposure / entryPrice : 0;
        const margin = settings.leverage > 0 ? exposure / settings.leverage : 0;
        const issues = [];

        elements.riskAmount.max = maxRisk.toFixed(2);
        elements.riskCapNote.textContent = `Max risk ${formatCurrency(maxRisk)} · ${settings.maxRiskPercent.toFixed(2)}% cap, margin-aware.`;

        if (!Number.isFinite(risk) || risk <= 0) issues.push('Enter a risk amount greater than $0.');
        else if (risk > maxRisk + 0.005) issues.push(`Risk exceeds the current maximum of ${formatCurrency(maxRisk)}.`);
        if (orderMode === 'limit' && (!Number.isFinite(Number(elements.limitPrice.value)) || Number(elements.limitPrice.value) <= 0)) {
            issues.push('Enter a valid limit price.');
        }
        if (margin > balance + 0.005) issues.push('Estimated margin is greater than available paper equity.');

        elements.estimatedQuantity.textContent = formatQuantity(quantity);
        elements.estimatedMargin.textContent = formatCurrency(margin);
        elements.estimatedLoss.textContent = risk > 0 ? `−${formatCurrency(risk)}` : '—';
        elements.estimatedReward.textContent = risk > 0 ? `+${formatCurrency(risk * settings.rewardRatio)}` : '—';
        elements.ticketValidation.hidden = issues.length === 0;
        elements.ticketValidation.textContent = issues.join(' ');
        elements.buyButton.disabled = issues.length > 0;
        elements.sellButton.disabled = issues.length > 0;
        renderCalculator(risk, maxRisk, margin);
    }

    function renderCalculator(risk = getRiskAmount(), maxRisk = getMaxAllowedRisk(), margin = 0) {
        const expected = risk * ((settings.winChance / 100) * settings.rewardRatio - (1 - settings.winChance / 100));
        elements.expectedValue.textContent = formatSignedCurrency(expected);
        elements.expectedValue.classList.toggle('positive', expected >= 0);
        elements.expectedValue.classList.toggle('negative', expected < 0);
        elements.calculatorReward.textContent = formatCurrency(risk * settings.rewardRatio);
        elements.calculatorRisk.textContent = `−${formatCurrency(risk)}`;
        elements.calculatorCap.textContent = formatCurrency(maxRisk);
        elements.calculatorMargin.textContent = formatCurrency(margin);
    }

    function renderAccountSummary() {
        const netPnl = balance - INITIAL_BALANCE;
        const wins = trades.filter((trade) => trade.result === 'TAKE PROFIT').length;
        const losses = trades.length - wins;
        const winRate = trades.length ? wins / trades.length * 100 : null;

        elements.headerBalance.textContent = formatCurrency(balance);
        elements.statBalance.textContent = formatCurrency(balance);
        elements.statPnl.textContent = formatSignedCurrency(netPnl);
        elements.statPnl.classList.toggle('positive', netPnl >= 0);
        elements.statPnl.classList.toggle('negative', netPnl < 0);
        elements.statWinRate.textContent = winRate === null ? '—' : `${winRate.toFixed(1)}%`;
        elements.winrateCaption.textContent = trades.length ? `${wins} wins · ${losses} losses` : 'No completed trades';
        elements.statTrades.textContent = numberFormatter.format(trades.length);
    }

    function renderMarket() {
        const market = activeMarket();
        const config = configFor(currentSymbol);
        const dailyChange = market.dayOpen ? (market.price - market.dayOpen) / market.dayOpen * 100 : 0;

        elements.marketSelect.value = currentSymbol;
        elements.chartHeading.textContent = config.pair;
        elements.bookPair.textContent = config.pair;
        elements.currentPrice.textContent = formatPrice(market.price);
        elements.priceChange.textContent = formatPercent(dailyChange);
        elements.priceChange.classList.toggle('positive', dailyChange >= 0);
        elements.priceChange.classList.toggle('negative', dailyChange < 0);
        elements.marketHigh.textContent = formatPrice(market.high);
        elements.marketLow.textContent = formatPrice(market.low);
        elements.chartCanvas.setAttribute('aria-label', `Simulated ${config.pair} price chart, current price ${formatPrice(market.price)}`);
        elements.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    function createDepthRow(price, quantity, width, side, symbol) {
        const row = document.createElement('li');
        const fill = document.createElement('span');
        const priceText = document.createElement('span');
        const quantityText = document.createElement('span');
        fill.className = 'depth-fill';
        fill.style.width = `${Math.round(width)}%`;
        priceText.textContent = formatPrice(price, symbol);
        quantityText.textContent = quantity.toFixed(4);
        row.className = side;
        row.append(fill, priceText, quantityText);
        return row;
    }

    function renderOrderBook() {
        const price = activeMarket().price;
        const halfSpread = price * 0.00008;
        const spacing = price * 0.000055;
        const asks = [];
        const bids = [];

        for (let level = 5; level >= 1; level -= 1) {
            asks.push({ price: price + halfSpread + spacing * level, quantity: .08 + Math.random() * 1.2 });
        }
        for (let level = 1; level <= 5; level += 1) {
            bids.push({ price: price - halfSpread - spacing * level, quantity: .08 + Math.random() * 1.2 });
        }
        const maxQuantity = Math.max(...asks.map((row) => row.quantity), ...bids.map((row) => row.quantity));
        elements.asksList.replaceChildren(...asks.map((row) => createDepthRow(row.price, row.quantity, row.quantity / maxQuantity * 82, 'ask', currentSymbol)));
        elements.bidsList.replaceChildren(...bids.map((row) => createDepthRow(row.price, row.quantity, row.quantity / maxQuantity * 82, 'bid', currentSymbol)));
        elements.spreadValue.textContent = formatPrice(halfSpread * 2, currentSymbol);
        elements.bookMid.textContent = formatPrice(price, currentSymbol);
    }

    function createCell(row, text, className = '') {
        const cell = document.createElement('td');
        cell.textContent = text;
        if (className) cell.className = className;
        row.appendChild(cell);
        return cell;
    }

    function createTradeTableRow(trade, fullDate = false) {
        const row = document.createElement('tr');
        const date = new Date(trade.timestamp);
        const timeText = fullDate
            ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const pair = configFor(trade.symbol).pair.replace(' / ', '/');
        const pnlCell = document.createElement('td');
        const sideCell = document.createElement('td');
        const outcomeCell = document.createElement('td');
        const sideBadge = document.createElement('span');
        const outcomeBadge = document.createElement('span');

        createCell(row, timeText);
        createCell(row, pair);
        sideBadge.className = `side-pill ${trade.side === 'BUY' ? 'buy' : 'sell'}`;
        sideBadge.textContent = trade.side;
        sideCell.appendChild(sideBadge);
        row.appendChild(sideCell);

        if (fullDate) createCell(row, formatPrice(trade.price, trade.symbol), 'align-right');
        outcomeBadge.className = `outcome-pill ${trade.result === 'TAKE PROFIT' ? 'win' : 'loss'}`;
        outcomeBadge.textContent = trade.result === 'TAKE PROFIT' ? 'TAKE PROFIT' : 'STOP LOSS';
        outcomeCell.appendChild(outcomeBadge);
        row.appendChild(outcomeCell);
        pnlCell.className = `align-right ${trade.pnl >= 0 ? 'positive' : 'negative'}`;
        pnlCell.textContent = formatSignedCurrency(trade.pnl);
        row.appendChild(pnlCell);
        return row;
    }

    function renderTradeTables() {
        const latest = trades.slice(0, 5);
        if (latest.length) {
            elements.recentTradesBody.replaceChildren(...latest.map((trade) => createTradeTableRow(trade)));
        } else {
            elements.recentTradesBody.replaceChildren(makeEmptyRow(5, 'No trades yet. Place a paper order to start your ledger.'));
        }

        const filter = elements.activityFilter.value;
        const visibleTrades = trades.filter((trade) => {
            if (filter === 'wins') return trade.result === 'TAKE PROFIT';
            if (filter === 'losses') return trade.result === 'STOP LOSS';
            return true;
        });
        if (visibleTrades.length) {
            elements.activityLogBody.replaceChildren(...visibleTrades.map((trade) => createTradeTableRow(trade, true)));
        } else {
            const message = trades.length ? 'No trades match this filter.' : 'Your completed paper trades will appear here.';
            elements.activityLogBody.replaceChildren(makeEmptyRow(6, message));
        }
        elements.activityTradeCount.textContent = `${numberFormatter.format(visibleTrades.length)} ${visibleTrades.length === 1 ? 'trade' : 'trades'}`;
    }

    function makeEmptyRow(columnCount, message) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.className = 'empty-cell';
        cell.colSpan = columnCount;
        cell.textContent = message;
        row.appendChild(cell);
        return row;
    }

    function renderPendingOrders() {
        elements.pendingCount.textContent = String(pendingOrders.length);
        elements.pendingLedgerCount.textContent = `${pendingOrders.length} open`;

        if (!pendingOrders.length) {
            const empty = document.createElement('div');
            empty.className = 'pending-empty';
            empty.textContent = 'No pending limit orders. Orders you place away from the market will show here.';
            elements.pendingOrdersList.replaceChildren(empty);
            return;
        }

        const rows = pendingOrders.map((order) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'pending-order-row';

            const market = document.createElement('div');
            market.className = 'pending-order-market';
            const pair = document.createElement('strong');
            pair.textContent = configFor(order.symbol).pair;
            const direction = document.createElement('span');
            direction.textContent = `${order.side} LIMIT`;
            direction.className = order.side === 'BUY' ? 'positive' : 'negative';
            market.append(pair, direction);

            const price = makePendingValue('LIMIT PRICE', formatPrice(order.limitPrice, order.symbol));
            const risk = makePendingValue('RISK', formatCurrency(order.risk));
            const time = makePendingValue('PLACED', new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            const cancel = document.createElement('button');
            cancel.className = 'cancel-order-button';
            cancel.type = 'button';
            cancel.dataset.orderId = order.id;
            cancel.textContent = 'Cancel';
            cancel.setAttribute('aria-label', `Cancel ${order.side.toLowerCase()} limit order for ${configFor(order.symbol).pair}`);
            wrapper.append(market, price, risk, time, cancel);
            return wrapper;
        });
        elements.pendingOrdersList.replaceChildren(...rows);
    }

    function makePendingValue(label, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pending-order-value';
        const labelNode = document.createElement('span');
        const valueNode = document.createElement('strong');
        labelNode.textContent = label;
        valueNode.textContent = value;
        wrapper.append(labelNode, valueNode);
        return wrapper;
    }

    function renderSettings() {
        elements.winChance.value = String(settings.winChance);
        elements.winChanceValue.textContent = `${settings.winChance}%`;
        elements.rewardRatio.value = String(settings.rewardRatio);
        elements.rewardRatioValue.textContent = `1 : ${Number(settings.rewardRatio).toFixed(settings.rewardRatio % 1 ? 1 : 0)}`;
        elements.maxRisk.value = String(settings.maxRiskPercent);
        elements.maxRiskValue.textContent = `${settings.maxRiskPercent.toFixed(2)}%`;
        elements.strategyLeverage.value = String(settings.leverage);
        elements.strategyLeverageValue.textContent = `${settings.leverage}×`;
        elements.ticketLeverage.value = String(settings.leverage);
    }

    function renderAll() {
        renderAccountSummary();
        renderMarket();
        renderOrderBook();
        renderTradeTables();
        renderPendingOrders();
        updateTicketEstimates();
        drawChart();
    }

    function seedChartHistory() {
        const count = RANGE_CONFIG[selectedRange].count;
        const config = configFor(currentSymbol);
        const values = [];
        let value = activeMarket().price * (1 + (Math.random() - 0.5) * 0.012);
        for (let index = 0; index < count; index += 1) {
            value *= 1 + (Math.random() - 0.5) * config.chartVolatility;
            values.push(value);
        }
        const correction = activeMarket().price - values[values.length - 1];
        chartHistory = values.map((item) => Math.max(0.0001, item + correction));
        chartHistory[chartHistory.length - 1] = activeMarket().price;
        chartHoverIndex = null;
        elements.chartHoverChip.hidden = true;
        drawChart();
    }

    function drawChart() {
        const canvas = elements.chartCanvas;
        const rect = canvas.getBoundingClientRect();
        if (!chartContext || rect.width < 2 || rect.height < 2 || chartHistory.length < 2) return;

        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const pixelWidth = Math.round(rect.width * ratio);
        const pixelHeight = Math.round(rect.height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        chartContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        chartContext.clearRect(0, 0, rect.width, rect.height);

        const ctx = chartContext;
        const padding = { top: 15, right: 62, bottom: 27, left: 54 };
        const plotWidth = Math.max(20, rect.width - padding.left - padding.right);
        const plotHeight = Math.max(20, rect.height - padding.top - padding.bottom);
        const rawMin = Math.min(...chartHistory);
        const rawMax = Math.max(...chartHistory);
        const spread = Math.max(rawMax - rawMin, activeMarket().price * 0.0012);
        const min = rawMin - spread * 0.12;
        const max = rawMax + spread * 0.12;
        const xAt = (index) => padding.left + index / (chartHistory.length - 1) * plotWidth;
        const yAt = (value) => padding.top + (max - value) / (max - min) * plotHeight;
        const isRising = chartHistory[chartHistory.length - 1] >= chartHistory[0];
        const lineColor = isRising ? '#42d7a0' : '#ff7783';

        ctx.save();
        ctx.strokeStyle = 'rgba(132, 153, 169, .15)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#6e8190';
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let tick = 0; tick <= 4; tick += 1) {
            const y = padding.top + (plotHeight / 4) * tick;
            const value = max - ((max - min) / 4) * tick;
            ctx.beginPath();
            ctx.moveTo(padding.left, Math.round(y) + 0.5);
            ctx.lineTo(padding.left + plotWidth, Math.round(y) + 0.5);
            ctx.stroke();
            ctx.fillText(formatShortPrice(value), padding.left - 8, y);
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labels = RANGE_CONFIG[selectedRange].labels;
        labels.forEach((label, index) => {
            const x = padding.left + plotWidth * (index / (labels.length - 1));
            ctx.beginPath();
            ctx.moveTo(Math.round(x) + 0.5, padding.top);
            ctx.lineTo(Math.round(x) + 0.5, padding.top + plotHeight);
            ctx.stroke();
            ctx.fillStyle = '#6e8190';
            ctx.fillText(label, x, padding.top + plotHeight + 9);
        });

        const area = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
        area.addColorStop(0, isRising ? 'rgba(66, 215, 160, .19)' : 'rgba(255, 119, 131, .17)');
        area.addColorStop(1, isRising ? 'rgba(66, 215, 160, .005)' : 'rgba(255, 119, 131, .005)');
        ctx.beginPath();
        chartHistory.forEach((value, index) => {
            const x = xAt(index);
            const y = yAt(value);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo(xAt(chartHistory.length - 1), padding.top + plotHeight);
        ctx.lineTo(xAt(0), padding.top + plotHeight);
        ctx.closePath();
        ctx.fillStyle = area;
        ctx.fill();

        ctx.beginPath();
        chartHistory.forEach((value, index) => {
            const x = xAt(index);
            const y = yAt(value);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 9;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const latestIndex = chartHistory.length - 1;
        const latestX = xAt(latestIndex);
        const latestY = yAt(chartHistory[latestIndex]);
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = `${lineColor}88`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(latestX, latestY);
        ctx.lineTo(padding.left + plotWidth, latestY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(latestX, latestY, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(latestX, latestY, 6, 0, Math.PI * 2);
        ctx.strokeStyle = `${lineColor}66`;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (chartHoverIndex !== null && chartHoverIndex >= 0 && chartHoverIndex < chartHistory.length) {
            const hoverX = xAt(chartHoverIndex);
            const hoverY = yAt(chartHistory[chartHoverIndex]);
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(207, 221, 232, .5)';
            ctx.beginPath();
            ctx.moveTo(hoverX, padding.top);
            ctx.lineTo(hoverX, padding.top + plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(hoverX, hoverY, 4, 0, Math.PI * 2);
            ctx.fillStyle = lineColor;
            ctx.fill();
            ctx.strokeStyle = '#eaf3f7';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    function onChartPointerMove(event) {
        if (event.pointerType === 'touch') return;
        const rect = elements.chartCanvas.getBoundingClientRect();
        const plotLeft = 54;
        const plotRight = rect.width - 62;
        const relativeX = clamp(event.clientX - rect.left, plotLeft, plotRight);
        chartHoverIndex = Math.round((relativeX - plotLeft) / Math.max(1, plotRight - plotLeft) * (chartHistory.length - 1));
        elements.chartHoverPrice.textContent = formatPrice(chartHistory[chartHoverIndex]);
        elements.chartHoverChip.hidden = false;
        drawChart();
    }

    function resizeChart() {
        drawChart();
    }

    function setView(viewName) {
        const knownViews = ['overview', 'activity', 'strategy'];
        if (!knownViews.includes(viewName)) return;
        elements.views.forEach((view) => {
            const isCurrent = view.id === `${viewName}-view`;
            view.hidden = !isCurrent;
            view.classList.toggle('is-active', isCurrent);
        });
        elements.navButtons.forEach((button) => {
            const isCurrent = button.dataset.view === viewName;
            button.classList.toggle('is-active', isCurrent);
            if (isCurrent) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        if (viewName === 'overview') requestAnimationFrame(drawChart);
    }

    function setOrderMode(mode) {
        orderMode = mode === 'limit' ? 'limit' : 'market';
        const marketSelected = orderMode === 'market';
        elements.marketMode.classList.toggle('is-active', marketSelected);
        elements.marketMode.setAttribute('aria-pressed', String(marketSelected));
        elements.limitMode.classList.toggle('is-active', !marketSelected);
        elements.limitMode.setAttribute('aria-pressed', String(!marketSelected));
        elements.limitPriceGroup.hidden = marketSelected;
        if (!marketSelected && (!Number(elements.limitPrice.value) || Number(elements.limitPrice.value) <= 0)) {
            elements.limitPrice.value = activeMarket().price.toFixed(configFor(currentSymbol).decimals);
        }
        updateTicketEstimates();
    }

    function showTicketMessage(message) {
        elements.ticketMessage.textContent = message;
        elements.ticketMessage.hidden = false;
        window.clearTimeout(showTicketMessage.timer);
        showTicketMessage.timer = window.setTimeout(() => { elements.ticketMessage.hidden = true; }, 5000);
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast${type === 'error' ? ' error' : ''}`;
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        window.setTimeout(() => toast.remove(), 4200);
    }

    function fillPaperOrder(side, price, risk, symbol, orderType) {
        const margin = risk / STOP_DISTANCE / settings.leverage;
        const allowedRisk = Math.min(balance, balance * settings.maxRiskPercent / 100, balance * settings.leverage * STOP_DISTANCE);
        if (!Number.isFinite(risk) || risk <= 0 || risk > allowedRisk + 0.005) {
            showToast(`Order skipped: risk is above the current ${formatCurrency(allowedRisk)} limit.`, 'error');
            return false;
        }
        if (margin > balance + 0.005) {
            showToast('Order skipped: estimated margin exceeds available paper equity.', 'error');
            return false;
        }

        const won = Math.random() < settings.winChance / 100;
        const pnl = won ? risk * settings.rewardRatio : -risk;
        balance = Math.max(0, balance + pnl);
        const trade = {
            id: makeId(),
            timestamp: new Date().toISOString(),
            symbol,
            side,
            price,
            result: won ? 'TAKE PROFIT' : 'STOP LOSS',
            pnl,
            risk,
            orderType,
            balanceAfter: balance
        };
        trades.unshift(trade);
        if (trades.length > MAX_SAVED_TRADES) trades.length = MAX_SAVED_TRADES;
        persistState();
        renderAll();
        showToast(`${side} ${configFor(symbol).base} · ${trade.result === 'TAKE PROFIT' ? '+' : '−'}${formatCurrency(Math.abs(pnl))} simulated P&L`);
        return true;
    }

    function submitOrder(side) {
        const risk = getRiskAmount();
        const maxRisk = getMaxAllowedRisk();
        if (risk <= 0 || risk > maxRisk + 0.005) {
            updateTicketEstimates();
            elements.riskAmount.focus();
            return;
        }

        if (orderMode === 'market') {
            fillPaperOrder(side, activeMarket().price, risk, currentSymbol, 'MARKET');
            return;
        }

        const limitPrice = Number(elements.limitPrice.value);
        if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
            updateTicketEstimates();
            elements.limitPrice.focus();
            return;
        }

        const marketPrice = activeMarket().price;
        const marketable = side === 'BUY' ? limitPrice >= marketPrice : limitPrice <= marketPrice;
        if (marketable) {
            const fillPrice = side === 'BUY' ? Math.min(marketPrice, limitPrice) : Math.max(marketPrice, limitPrice);
            fillPaperOrder(side, fillPrice, risk, currentSymbol, 'LIMIT');
            return;
        }

        if (pendingOrders.length >= MAX_PENDING_ORDERS) {
            showToast(`You can have up to ${MAX_PENDING_ORDERS} pending limit orders.`, 'error');
            return;
        }
        const order = { id: makeId(), timestamp: new Date().toISOString(), symbol: currentSymbol, side, limitPrice, risk };
        pendingOrders.unshift(order);
        persistState();
        renderPendingOrders();
        showTicketMessage(`${side} limit order placed at ${formatPrice(limitPrice)}. It will fill if the simulated price reaches your limit.`);
        showToast(`${side} limit order added to pending orders.`);
    }

    function checkPendingOrders(symbol, price) {
        const ready = pendingOrders.filter((order) => {
            if (order.symbol !== symbol) return false;
            return order.side === 'BUY' ? price <= order.limitPrice : price >= order.limitPrice;
        });
        if (!ready.length) return;

        const readyIds = new Set(ready.map((order) => order.id));
        pendingOrders = pendingOrders.filter((order) => !readyIds.has(order.id));
        ready.forEach((order) => {
            const fillPrice = order.side === 'BUY'
                ? Math.min(price, order.limitPrice)
                : Math.max(price, order.limitPrice);
            fillPaperOrder(order.side, fillPrice, order.risk, order.symbol, 'LIMIT');
        });
        persistState();
        renderPendingOrders();
    }

    function tickMarkets() {
        Object.entries(MARKET_CONFIG).forEach(([symbol, config]) => {
            const market = markets[symbol];
            const move = (Math.random() - 0.5) * config.tickVolatility;
            market.price = Math.max(0.0001, market.price * (1 + move));
            market.high = Math.max(market.high, market.price);
            market.low = Math.min(market.low, market.price);
            checkPendingOrders(symbol, market.price);
        });

        if (chartHistory.length) {
            chartHistory.push(activeMarket().price);
            const maxPoints = RANGE_CONFIG[selectedRange].count;
            while (chartHistory.length > maxPoints) chartHistory.shift();
        }
        renderMarket();
        renderOrderBook();
        updateTicketEstimates();
        drawChart();
    }

    function exportTradesCsv() {
        if (!trades.length) {
            showToast('There are no completed trades to export.', 'error');
            return;
        }
        const columns = ['Timestamp', 'Pair', 'Side', 'Order type', 'Entry price', 'Outcome', 'Risk (USD)', 'P&L (USD)', 'Balance after (USD)'];
        const rows = trades.map((trade) => [
            trade.timestamp,
            configFor(trade.symbol).pair,
            trade.side,
            trade.orderType,
            trade.price.toFixed(configFor(trade.symbol).decimals),
            trade.result,
            trade.risk.toFixed(2),
            trade.pnl.toFixed(2),
            trade.balanceAfter.toFixed(2)
        ]);
        const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
        const csv = [columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tradelab-paper-trades-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast('Trade ledger exported as CSV.');
    }

    function resetPaperAccount() {
        const confirmed = window.confirm('Reset the paper account to $25,000? This clears completed trades, pending orders, and strategy settings in this browser.');
        if (!confirmed) return;

        balance = INITIAL_BALANCE;
        currentSymbol = 'BTCUSDT';
        markets = createMarkets({});
        settings = { ...DEFAULT_SETTINGS };
        trades = [];
        pendingOrders = [];
        orderMode = 'market';
        selectedRange = '1D';
        elements.riskAmount.value = '100';
        elements.limitPrice.value = '';
        elements.activityFilter.value = 'all';
        elements.rangeButtons.forEach((button) => {
            const active = button.dataset.range === selectedRange;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        renderSettings();
        setOrderMode('market');
        setView('overview');
        seedChartHistory();
        persistState();
        renderAll();
        showToast('Paper account reset to its starting state.');
    }

    function clearTradeHistory() {
        if (!trades.length) {
            showToast('The trade ledger is already empty.', 'error');
            return;
        }
        if (!window.confirm('Clear completed trade history? Your current paper balance and pending orders will stay unchanged.')) return;
        trades = [];
        persistState();
        renderAll();
        showToast('Completed trade history cleared.');
    }

    function cancelPendingOrder(orderId) {
        const initialCount = pendingOrders.length;
        pendingOrders = pendingOrders.filter((order) => order.id !== orderId);
        if (pendingOrders.length === initialCount) return;
        persistState();
        renderPendingOrders();
        showToast('Pending limit order cancelled.');
    }

    function syncSettingsFromInputs() {
        settings.winChance = Number(elements.winChance.value);
        settings.rewardRatio = Number(elements.rewardRatio.value);
        settings.maxRiskPercent = Number(elements.maxRisk.value);
        settings.leverage = Number(elements.strategyLeverage.value);
        renderSettings();
        updateTicketEstimates();
        persistState();
    }

    function syncLeverageFromTicket() {
        settings.leverage = Number(elements.ticketLeverage.value);
        renderSettings();
        updateTicketEstimates();
        persistState();
    }

    function setMarket(symbol) {
        if (!Object.hasOwn(MARKET_CONFIG, symbol) || symbol === currentSymbol) return;
        currentSymbol = symbol;
        elements.limitPrice.value = orderMode === 'limit'
            ? activeMarket().price.toFixed(configFor(currentSymbol).decimals)
            : '';
        seedChartHistory();
        renderMarket();
        renderOrderBook();
        updateTicketEstimates();
        persistState();
    }

    elements.viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
    elements.marketSelect.addEventListener('change', (event) => setMarket(event.target.value));
    elements.marketMode.addEventListener('click', () => setOrderMode('market'));
    elements.limitMode.addEventListener('click', () => setOrderMode('limit'));
    elements.limitPrice.addEventListener('input', updateTicketEstimates);
    elements.riskAmount.addEventListener('input', () => {
        updateTicketEstimates();
        persistState();
    });
    elements.ticketLeverage.addEventListener('change', syncLeverageFromTicket);
    elements.buyButton.addEventListener('click', () => submitOrder('BUY'));
    elements.sellButton.addEventListener('click', () => submitOrder('SELL'));

    [elements.winChance, elements.rewardRatio, elements.maxRisk, elements.strategyLeverage].forEach((input) => {
        input.addEventListener('input', syncSettingsFromInputs);
    });
    elements.activityFilter.addEventListener('change', renderTradeTables);
    elements.exportCsv.addEventListener('click', exportTradesCsv);
    elements.clearHistory.addEventListener('click', clearTradeHistory);
    elements.resetAccount.addEventListener('click', resetPaperAccount);
    elements.pendingOrdersList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-order-id]');
        if (button) cancelPendingOrder(button.dataset.orderId);
    });
    elements.rangeButtons.forEach((button) => button.addEventListener('click', () => {
        selectedRange = button.dataset.range;
        elements.rangeButtons.forEach((rangeButton) => {
            const active = rangeButton === button;
            rangeButton.classList.toggle('is-active', active);
            rangeButton.setAttribute('aria-pressed', String(active));
        });
        seedChartHistory();
    }));

    elements.chartCanvas.addEventListener('pointermove', onChartPointerMove);
    elements.chartCanvas.addEventListener('pointerleave', () => {
        chartHoverIndex = null;
        elements.chartHoverChip.hidden = true;
        drawChart();
    });
    window.addEventListener('resize', resizeChart);
    if ('ResizeObserver' in window) {
        const chartObserver = new ResizeObserver(resizeChart);
        chartObserver.observe(document.getElementById('chart-container'));
    }

    const savedRiskAmount = Number(savedState.riskAmount);
    elements.riskAmount.value = Number.isFinite(savedRiskAmount) && savedRiskAmount > 0 ? String(savedRiskAmount) : '100';
    renderSettings();
    setOrderMode('market');
    seedChartHistory();
    renderAll();
    window.setInterval(tickMarkets, 1000);
    window.setInterval(persistState, 5000);
})();
