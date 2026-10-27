// State Variables
let balance = 10000;
let currentPrice = 100;
let candles = [];
const maxCandles = 40;
let activeTrade = null;

// DOM Elements
const canvas = document.getElementById('tradingChart');
const ctx = canvas.getContext('2d');
const balanceInput = document.getElementById('balance-input');
const currentBalanceEl = document.getElementById('current-balance');
const winChanceSlider = document.getElementById('win-chance-slider');
const winChanceVal = document.getElementById('win-chance-val');
const profitTargetSlider = document.getElementById('profit-target-slider');
const profitTargetVal = document.getElementById('profit-target-val');
const rrSlider = document.getElementById('rr-slider');
const rrVal = document.getElementById('rr-val');
const leverageSlider = document.getElementById('leverage-slider');
const leverageVal = document.getElementById('leverage-val');
const orderTypeSelect = document.getElementById('order-type');
const limitPriceGroup = document.getElementById('limit-price-group');
const limitPriceInput = document.getElementById('limit-price-input');
const triggerTradeBtn = document.getElementById('trigger-trade-btn');
const tradeLogBody = document.getElementById('trade-log-body');
const asksList = document.getElementById('asks-list');
const bidsList = document.getElementById('bids-list');

// Resize Canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Sync Input Sliders & Values
winChanceSlider.addEventListener('input', (e) => winChanceVal.innerText = e.target.value);
profitTargetSlider.addEventListener('input', (e) => profitTargetVal.innerText = e.target.value);
rrSlider.addEventListener('input', (e) => rrVal.innerText = `1:${parseFloat(e.target.value).toFixed(1)}`);
leverageSlider.addEventListener('input', (e) => leverageVal.innerText = e.target.value);
orderTypeSelect.addEventListener('change', (e) => {
    if(e.target.value === 'limit') limitPriceGroup.classList.remove('hidden');
    else limitPriceGroup.classList.add('hidden');
});

balanceInput.addEventListener('change', (e) => {
    balance = parseFloat(e.target.value) || 10000;
    updateBalanceDisplay();
});

function updateBalanceDisplay() {
    currentBalanceEl.innerText = `$${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (balance <= 0) {
        currentBalanceEl.className = 'loss';
        currentBalanceEl.innerText += " (LIQUIDATED)";
    } else {
        currentBalanceEl.className = 'profit';
    }
}

// Generate Seed Candles
function initCandles() {
    for (let i = 0; i < maxCandles; i++) {
        let open = currentPrice;
        let change = (Math.random() - 0.5) * 4;
        let close = open + change;
        let high = Math.max(open, close) + Math.random() * 2;
        let low = Math.min(open, close) - Math.random() * 2;
        candles.push({ open, high, low, close });
        currentPrice = close;
    }
    limitPriceInput.value = currentPrice.toFixed(2);
}
initCandles();

// Loop for updates
setInterval(() => {
    // 1. Tick Current Candle Price
    let lastCandle = candles[candles.length - 1];
    let tick = (Math.random() - 0.5) * 1.5;
    currentPrice += tick;
    lastCandle.close = currentPrice;
    if (currentPrice > lastCandle.high) lastCandle.high = currentPrice;
    if (currentPrice < lastCandle.low) lastCandle.low = currentPrice;

    // 2. Process Order Book Fluctuations
    renderOrderBook();

    // 3. Process Active Positions / Orders
    processTradeLogic();

    // 4. Draw Layout Chart
    drawChart();
}, 200);

// Cycle New Candle every 4 seconds
setInterval(() => {
    candles.shift();
    let open = currentPrice;
    candles.push({ open, high: open, low: open, close: open });
}, 4000);

// Order Book Generator
function renderOrderBook() {
    asksList.innerHTML = '';
    bidsList.innerHTML = '';
    
    for(let i = 5; i > 0; i--) {
        let askPrice = (currentPrice + 0.05 * i).toFixed(2);
        let askSize = (Math.random() * 12).toFixed(3);
        asksList.innerHTML += `<div class="ob-row" style="color:#cf3046"><span>$${askPrice}</span><span>${askSize}</span></div>`;
    }
    for(let i = 1; i <= 5; i++) {
        let bidPrice = (currentPrice - 0.05 * i).toFixed(2);
        let bidSize = (Math.random() * 12).toFixed(3);
        bidsList.innerHTML += `<div class="ob-row" style="color:#02c076"><span>$${bidPrice}</span><span>${bidSize}</span></div>`;
    }
}

// Setup or Execute Trade Trigger
triggerTradeBtn.addEventListener('click', () => {
    if (balance <= 0) return alert("Account has no balance left.");
    if (activeTrade) return alert("Clear or complete current setup before starting another.");

    const orderType = orderTypeSelect.value;
    const targetPrice = parseFloat(limitPriceInput.value);
    
    if(orderType === 'limit') {
        activeTrade = {
            type: 'LIMIT',
            triggerPrice: targetPrice,
            status: 'PENDING'
        };
        logEvent('SYSTEM', 'LIMIT ORDER', `Set at $${targetPrice.toFixed(2)}`, 'PENDING', 0);
    } else {
        executeMarketTrade(currentPrice);
    }
});

function executeMarketTrade(entryPrice) {
    const winChance = parseInt(winChanceSlider.value);
    const targetPoints = parseFloat(profitTargetSlider.value);
    const rr = parseFloat(rrSlider.value);
    const stopLossPoints = targetPoints / rr;
    const leverage = parseInt(leverageSlider.value);

    // RNG resolution immediately on trade open
    const isWin = (Math.random() * 100) < winChance;
    
    activeTrade = {
        type: 'MARKET',
        status: 'ACTIVE',
        entryPrice: entryPrice,
        tpPrice: entryPrice + targetPoints,
        slPrice: entryPrice - stopLossPoints,
        isWin: isWin,
        leverage: leverage,
        points: targetPoints,
        slPoints: stopLossPoints
    };
    logEvent('BOT', 'BUY POSITION', `Entered @ $${entryPrice.toFixed(2)}`, 'ACTIVE', 0);
}

function processTradeLogic() {
    if (!activeTrade) return;

    if (activeTrade.status === 'PENDING' && activeTrade.type === 'LIMIT') {
        // Trigger condition logic if asset crosses threshold
        if (Math.abs(currentPrice - activeTrade.triggerPrice) <= 0.5) {
            executeMarketTrade(activeTrade.triggerPrice);
        }
    } else if (activeTrade.status === 'ACTIVE') {
        // If simulated trade resolves to win or loss path
        // For visual chart impact, we check if price approaches endpoints or trigger immediately
        let pnl = 0;
        let riskAmount = balance * 0.1; // Baseline risk exposure
        
        if (activeTrade.isWin && currentPrice >= activeTrade.tpPrice) {
            pnl = riskAmount * (activeTrade.points / activeTrade.slPoints) * activeTrade.leverage;
            balance += pnl;
            logEvent('BOT', 'PROFIT HIT', `Closed @ $${currentPrice.toFixed(2)}`, 'WIN', pnl);
            activeTrade = null;
            updateBalanceDisplay();
        } else if (!activeTrade.isWin && currentPrice <= activeTrade.slPrice) {
            pnl = -riskAmount * activeTrade.leverage;
            balance += pnl;
            logEvent('BOT', 'STOP LOSS', `Closed @ $${currentPrice.toFixed(2)}`, 'LOSS', pnl);
            activeTrade = null;
            updateBalanceDisplay();
        } else if (balance <= 0) {
            // Margin call threshold reached
            activeTrade = null;
        }
    }
}

function logEvent(type, order, detail, outcome, pnl) {
    const time = new Date().toLocaleTimeString();
    const pnlClass = pnl > 0 ? 'profit' : (pnl < 0 ? 'loss' : '');
    const pnlText = pnl !== 0 ? `${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}` : '-';
    
    const row = `<tr>
        <td>${time}</td>
        <td>${type}</td>
        <td>${order}</td>
        <td>${detail}</td>
        <td class="${outcome === 'WIN'?'profit':(outcome==='LOSS'?'loss':'')}">${outcome}</td>
        <td class="${pnlClass}">${pnlText}</td>
    </tr>`;
    tradeLogBody.insertAdjacentHTML('afterbegin', row);
}

// Chart Painter
function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    
    // Extrema detection
    let high = Math.max(...candles.map(c => c.high));
    let low = Math.min(...candles.map(c => c.low));
    let range = high - low || 1;
    
    // Scale optimization
    high += range * 0.1;
    low -= range * 0.1;
    range = high - low;

    const candleWidth = chartWidth / maxCandles;

    // Render Grid lines
    ctx.strokeStyle = '#1c2026';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
        let y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
    }

    // Render Candles
    candles.forEach((c, i) => {
        let x = padding + i * candleWidth + candleWidth * 0.1;
        let w = candleWidth * 0.8;
        
        let yOpen = padding + chartHeight * (1 - (c.open - low) / range);
        let yClose = padding + chartHeight * (1 - (c.close - low) / range);
        let yHigh = padding + chartHeight * (1 - (c.high - low) / range);
        let yLow = padding + chartHeight * (1 - (c.low - low) / range);
        
        ctx.strokeStyle = c.close >= c.open ? '#02c076' : '#cf3046';
        ctx.fillStyle = c.close >= c.open ? '#02c076' : '#cf3046';
        ctx.lineWidth = 1.5;
        
        // Wick
        ctx.beginPath();
        ctx.moveTo(x + w/2, yHigh);
        ctx.lineTo(x + w/2, yLow);
        ctx.stroke();
        
        // Body
        ctx.fillRect(x, Math.min(yOpen, yClose), w, Math.max(Math.abs(yOpen - yClose), 1));
    });

    // Draw active target brackets
    if (activeTrade && activeTrade.status === 'ACTIVE') {
        let yTp = padding + chartHeight * (1 - (activeTrade.tpPrice - low) / range);
        let ySl = padding + chartHeight * (1 - (activeTrade.slPrice - low) / range);
        let yEntry = padding + chartHeight * (1 - (activeTrade.entryPrice - low) / range);

        // Entry Level Target Line
        ctx.strokeStyle = '#f0b90b';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(padding, yEntry); ctx.lineTo(canvas.width - padding, yEntry); ctx.stroke();

        // TP Line Target Line
        ctx.strokeStyle = '#02c076';
        ctx.beginPath(); ctx.moveTo(padding, yTp); ctx.lineTo(canvas.width - padding, yTp); ctx.stroke();

        // SL Line Target Line
        ctx.strokeStyle = '#cf3046';
        ctx.beginPath(); ctx.moveTo(padding, ySl); ctx.lineTo(canvas.width - padding, ySl); ctx.stroke();
        ctx.setLineDash([]); // Reset default drawing rules
    }
}
