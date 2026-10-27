let balance = 10000.00;
let currentPrice = 96450.00;
let isMarketOrder = true;

const winChanceSlider = document.getElementById('win-chance');
const winChanceVal = document.getElementById('win-chance-val');
const rrRatioSlider = document.getElementById('rr-ratio');
const rrRatioVal = document.getElementById('rr-ratio-val');
const leverageSlider = document.getElementById('leverage');
const leverageVal = document.getElementById('leverage-val');
const balanceText = document.getElementById('account-balance');
const priceTicker = document.getElementById('current-price');

const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        const targetTab = item.getAttribute('data-target');
        tabContents.forEach(tab => {
            tab.classList.remove('active');
            if(tab.id === targetTab) tab.classList.add('active');
        });
        
        if(targetTab === 'chart-tab') resizeCanvas();
    });
});

winChanceSlider.addEventListener('input', (e) => winChanceVal.innerText = `${e.target.value}%`);
rrRatioSlider.addEventListener('input', (e) => rrRatioVal.innerText = `1:${e.target.value}`);
leverageSlider.addEventListener('input', (e) => leverageVal.innerText = `${e.target.value}x`);

document.getElementById('market-mode').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('limit-mode').classList.remove('active');
    isMarketOrder = true;
});
document.getElementById('limit-mode').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('market-mode').classList.remove('active');
    isMarketOrder = false;
});

function executeTrade(side) {
    const winProbability = parseInt(winChanceSlider.value) / 100;
    const rr = parseFloat(rrRatioSlider.value);
    const leverage = parseInt(leverageSlider.value);
    
    const riskAmount = 200 * leverage; 
    const rewardAmount = riskAmount * rr;
    
    const isWin = Math.random() < winProbability;
    let profitLoss = 0;
    let statusText = "";
    
    if (isWin) {
        profitLoss = rewardAmount;
        balance += profitLoss;
        statusText = "PROFIT";
    } else {
        profitLoss = -riskAmount;
        balance += profitLoss;
        statusText = (leverage > 12 && Math.random() > 0.7) ? "LIQUIDATED" : "STOP-LOSS";
    }

    balanceText.innerText = `$${balance.toFixed(2)}`;
    if (balance < 0) { balance = 10000.00; balanceText.innerText = `$${balance.toFixed(2)} (Reset)`; }
    
    logTrade(side, currentPrice, statusText, profitLoss);
}

document.getElementById('mobile-buy-btn').addEventListener('click', () => executeTrade('BUY'));
document.getElementById('mobile-sell-btn').addEventListener('click', () => executeTrade('SELL'));

function logTrade(side, price, result, pnl) {
    const tbody = document.getElementById('log-body');
    const row = document.createElement('tr');
    
    const pnlStyle = pnl >= 0 ? "color: var(--color-buy);" : "color: var(--color-sell);";
    const sign = pnl >= 0 ? "+" : "";

    row.innerHTML = `
        <td style="font-weight:bold; color:${side==='BUY'?'var(--color-buy)':'var(--color-sell)'}">${side}</td>
        <td>$${price.toFixed(2)}</td>
        <td>${result}</td>
        <td style="${pnlStyle}">${sign}$${pnl.toFixed(2)}</td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
}

function updateOrderBook() {
    const askList = document.getElementById('asks-list');
    const bidList = document.getElementById('bids-list');
    
    askList.innerHTML = "";
    bidList.innerHTML = "";

    for(let i=0; i<5; i++) {
        let askPrice = currentPrice + (Math.random() * 15 + 2);
        let askVol = (Math.random() * 2).toFixed(4);
        askList.innerHTML += `<li><span>$${askPrice.toFixed(2)}</span><span>${askVol}</span></li>`;

        let bidPrice = currentPrice - (Math.random() * 15 + 2);
        let bidVol = (Math.random() * 2).toFixed(4);
        bidList.innerHTML += `<li><span>$${bidPrice.toFixed(2)}</span><span>${bidVol}</span></li>`;
    }
}

const canvas = document.getElementById('tradingChart');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    drawChartPlaceholder();
}

function drawChartPlaceholder() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2b3139';
    ctx.lineWidth = 1;
    
    for(let i = 50; i < canvas.height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    for(let i = 60; i < canvas.width; i += 60) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }

    ctx.fillStyle = "rgba(132, 142, 156, 0.15)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AUTOMATED MARKET CANVAS WORKING", canvas.width / 2, canvas.height / 2);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

setInterval(() => {
    currentPrice += (Math.random() - 0.5) * 12;
    priceTicker.innerText = `$${currentPrice.toFixed(2)}`;
    updateOrderBook();
}, 1000);
        
