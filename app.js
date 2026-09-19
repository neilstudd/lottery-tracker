const BASE_DRAW_NUM = 3200;
const BASE_DRAW_DATE = new Date(2026, 7, 22); // Month is 0-indexed (7 = August)
const PAGE_SIZE = 50;

let drawsData = [];
let ticketsData = JSON.parse(localStorage.getItem('lottery_tickets') || '{}');
let currentPage = 1;

function normalizeTicketNumbers(numbers) {
    if (!Array.isArray(numbers)) return [];
    return [...numbers].map(n => Number(n)).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
}

function getTotalPages() {
    return Math.max(1, Math.ceil(drawsData.length / PAGE_SIZE));
}

function getCurrentPageDraws() {
    const totalPages = getTotalPages();
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return drawsData.slice(startIndex, startIndex + PAGE_SIZE);
}

function updatePaginationControls() {
    const totalPages = getTotalPages();
    document.getElementById('paginationStatus').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('firstPageBtn').disabled = currentPage === 1;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
    document.getElementById('lastPageBtn').disabled = currentPage >= totalPages;
}

function updateTicketDataColumns() {
    const hasTickets = Object.keys(ticketsData).length > 0;
    let styleEl = document.getElementById('ticket-data-column-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'ticket-data-column-style';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = hasTickets ? '' : '.ticket-data-column { display: none; }';
}

function updateStatsVisibility() {
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) statsContainer.style.display = Object.keys(ticketsData).length > 0 ? '' : 'none';
}

function updateExportButtonVisibility() {
    const exportButton = document.getElementById('exportDataBtn');
    if (exportButton) exportButton.style.display = Object.keys(ticketsData).length > 0 ? '' : 'none';
}

function calculateDrawNumber(dateObj) {
    const deltaDays = Math.floor((dateObj - BASE_DRAW_DATE) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(deltaDays / 7);
    const rem = deltaDays % 7;
    return BASE_DRAW_NUM + weeks * 2 + (rem === 4 ? 1 : 0);
}

function calculateDrawDate(drawNum) {
    const drawDelta = drawNum - BASE_DRAW_NUM;
    const weeks = Math.floor(drawDelta / 2);
    const rem = drawDelta % 2;
    const d = new Date(BASE_DRAW_DATE);
    d.setDate(d.getDate() + weeks * 7 + (rem === 1 ? 4 : 0));
    return d;
}

function formatDate(dateStrOrObj) {
    const dt = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    const day = dt.getDate();
    let suffix = 'th';
    if (day < 11 || day > 13) {
        if (day % 10 === 1) suffix = 'st';
        else if (day % 10 === 2) suffix = 'nd';
        else if (day % 10 === 3) suffix = 'rd';
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}${suffix} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatCurrency(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '0';
    return Number.isInteger(num) ? num.toLocaleString('en-GB') : num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getBallColorClass(num) {
    if (num >= 50) return 'ball-purple';
    if (num >= 40) return 'ball-yellow';
    if (num >= 30) return 'ball-green';
    if (num >= 20) return 'ball-pink';
    if (num >= 10) return 'ball-blue';
    return 'ball-white';
}

function renderBallHTML(num, userTicketNumbers, isBonus = false) {
    const isMatch = normalizeTicketNumbers(userTicketNumbers).includes(num);
    const matchedClass = isMatch ? 'matched' : '';
    let labelHTML = '';
    if (isBonus && isMatch) labelHTML = '<span class="ball-label match-label">BONUS<br/>MATCH</span>';
    else if (isBonus) labelHTML = '<span class="ball-label">BONUS</span>';
    else if (isMatch) labelHTML = '<span class="ball-label match-label">MATCH</span>';
    return `<div class="ball-wrapper"><span class="ball ${getBallColorClass(num)} ${matchedClass}">${num}</span>${labelHTML}</div>`;
}

function renderMatchCountHTML(mainNums, bonusNum, userTicketNumbers) {
    const numbers = normalizeTicketNumbers(userTicketNumbers);
    if (!numbers.length) return '<span class="match-text">n/a</span>';
    const matches = mainNums.filter(n => numbers.includes(n)).length;
    const bonusMatched = numbers.includes(bonusNum);
    const winClass = matches > 0 || bonusMatched ? 'has-match' : '';
    let text = '0';
    if (matches === 0 && bonusMatched) text = 'Bonus';
    else if (bonusMatched) text = `${matches} + Bonus`;
    else if (matches > 0) text = `${matches}`;
    return `<span class="match-text ${winClass}">${text}</span>`;
}

function saveTickets() {
    localStorage.setItem('lottery_tickets', JSON.stringify(ticketsData));
    renderApp();
}

function setWinnings(drawNum, currentAmount) {
    const amount = prompt('Enter ticket winnings (£):', currentAmount !== undefined ? currentAmount : '');
    if (amount !== null && amount.trim() !== '') {
        const numAmount = parseFloat(amount.replace(/,/g, '').trim());
        if (!isNaN(numAmount) && numAmount >= 0 && ticketsData[drawNum]) {
            ticketsData[drawNum].winnings = numAmount;
            saveTickets();
        } else if (isNaN(numAmount) || numAmount < 0) alert('Please enter a valid numeric amount.');
    }
}

function deleteTicket(drawNum) {
    if (ticketsData[drawNum]) {
        delete ticketsData[drawNum];
        saveTickets();
    }
}

function renderApp() {
    updateTicketDataColumns();
    updateStatsVisibility();
    updateExportButtonVisibility();

    const drawnNumbersSet = new Set(drawsData.map(d => d.draw_number));
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let pastTicketsCount = 0;
    let totalWinnings = 0;

    Object.keys(ticketsData).forEach(drawNumStr => {
        const drawNum = parseInt(drawNumStr, 10);
        if (calculateDrawDate(drawNum) <= today) pastTicketsCount++;
        totalWinnings += ticketsData[drawNumStr].winnings || 0;
    });

    const totalSpent = pastTicketsCount * 2;
    const profitLoss = totalWinnings - totalSpent;
    document.getElementById('totalSpentVal').textContent = `£${formatCurrency(totalSpent)}`;
    document.getElementById('totalWinningsVal').textContent = `£${formatCurrency(totalWinnings)}`;
    const plEl = document.getElementById('profitLossVal');
    plEl.className = `stat-value ${profitLoss > 0 ? 'pl-positive' : profitLoss < 0 ? 'pl-negative' : 'pl-neutral'}`;
    plEl.textContent = profitLoss < 0 ? `-£${formatCurrency(Math.abs(profitLoss))}` : `£${formatCurrency(profitLoss)}`;

    updatePaginationControls();
    const upcomingDrawNums = Object.keys(ticketsData).map(n => parseInt(n, 10)).filter(n => !drawnNumbersSet.has(n)).sort((a, b) => b - a);
    const upcomingSection = document.getElementById('upcomingSection');
    const upcomingTbody = document.getElementById('upcomingTableBody');
    if (upcomingDrawNums.length) {
        upcomingSection.style.display = 'block';
        upcomingTbody.innerHTML = upcomingDrawNums.map(drawNum => {
            const numbers = normalizeTicketNumbers(ticketsData[drawNum].numbers);
            return `<tr><td>${drawNum}</td><td>${formatDate(calculateDrawDate(drawNum))}</td><td><div class="ball-container">${numbers.map(n => renderBallHTML(n, [])).join('')}</div></td><td><button class="delete-ticket-btn" onclick="deleteTicket(${drawNum})">Delete</button></td></tr>`;
        }).join('');
    } else upcomingSection.style.display = 'none';

    document.getElementById('pastTableBody').innerHTML = getCurrentPageDraws().map(draw => {
        const userTicket = ticketsData[draw.draw_number];
        const ticketNums = userTicket ? normalizeTicketNumbers(userTicket.numbers) : null;
        const hasDraw2 = draw.draw_number > 3178 && !!draw.draw2;
        const m1Matches = ticketNums ? draw.draw1.numbers.filter(n => ticketNums.includes(n)).length : 0;
        const m2Matches = ticketNums && hasDraw2 ? draw.draw2.numbers.filter(n => ticketNums.includes(n)).length : 0;
        let winnings = '<span class="match-text">n/a</span>';
        if (userTicket) {
            if (m1Matches >= 2 || m2Matches >= 2) {
                const value = userTicket.winnings || 0;
                winnings = value > 0 ? `<a href="#" onclick="setWinnings(${draw.draw_number}, '${Number.isInteger(value) ? value : value.toString()}'); return false;" class="enter-winnings-link">£${formatCurrency(value)}</a>` : `<a href="#" onclick="setWinnings(${draw.draw_number}); return false;" class="enter-winnings-link">Enter winnings</a>`;
            } else winnings = '<span class="match-text">£0</span>';
        }
        return `<tr><td>${draw.draw_number}</td><td>${formatDate(draw.draw_date)}</td><td><div class="draw-stacked-container"><div class="draw-row"><span class="draw-label">${hasDraw2 ? 'Draw 1:' : ''}</span><div class="ball-container">${draw.draw1.numbers.map(n => renderBallHTML(n, ticketNums || [])).join('')}${renderBallHTML(draw.draw1.bonus, ticketNums || [], true)}</div></div>${hasDraw2 ? `<div class="draw-row"><span class="draw-label">Draw 2:</span><div class="ball-container">${draw.draw2.numbers.map(n => renderBallHTML(n, ticketNums || [])).join('')}${renderBallHTML(draw.draw2.bonus, ticketNums || [], true)}</div></div>` : ''}</div></td><td>${ticketNums ? `<div class="ball-container">${ticketNums.map(n => renderBallHTML(n, [])).join('')}</div>` : '<span class="match-text">n/a</span>'}</td><td>${ticketNums ? `<div class="draw-stacked-container"><div class="draw-row">${renderMatchCountHTML(draw.draw1.numbers, draw.draw1.bonus, ticketNums)}</div>${hasDraw2 ? `<div class="draw-row">${renderMatchCountHTML(draw.draw2.numbers, draw.draw2.bonus, ticketNums)}</div>` : ''}</div>` : '<span class="match-text">n/a</span>'}</td><td>${winnings}</td>${userTicket ? `<td><button class="delete-ticket-btn" onclick="deleteTicket(${draw.draw_number})">Delete</button></td>` : '<td></td>'}</tr>`;
    }).join('');
    updateTicketDataColumns();
}

function populateDrawOptions() {
    const selectEl = document.getElementById('drawDateSelect');
    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const options = [];
    for (let curr = new Date(today); curr <= endOfYear; curr.setDate(curr.getDate() + 1)) {
        const day = curr.getDay();
        if (day === 3 || day === 6) {
            const dateStr = curr.toISOString().split('T')[0];
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
            options.push(`<option value="${dateStr}">${dayName} ${formatDate(curr)} (Draw #${calculateDrawNumber(curr)})</option>`);
        }
    }
    selectEl.innerHTML = options.join('');
}

document.getElementById('openAddTicketModal').addEventListener('click', () => { populateDrawOptions(); document.getElementById('ticketModal').classList.add('active'); });
document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('ticketModal').classList.remove('active'));
document.getElementById('addTicketForm').addEventListener('submit', e => {
    e.preventDefault();
    const drawNum = calculateDrawNumber(new Date(document.getElementById('drawDateSelect').value));
    const numbers = normalizeTicketNumbers([1, 2, 3, 4, 5, 6].map(n => parseInt(document.getElementById(`n${n}`).value, 10)));
    ticketsData[drawNum] = { numbers, winnings: ticketsData[drawNum] ? (ticketsData[drawNum].winnings || 0) : 0 };
    saveTickets();
    document.getElementById('addTicketForm').reset();
    document.getElementById('ticketModal').classList.remove('active');
});

document.getElementById('exportDataBtn').addEventListener('click', () => {
    if (!Object.keys(ticketsData).length) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ticketsData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = dataStr;
    downloadAnchor.download = 'lottery_tickets_backup.json';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});
document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
document.getElementById('importFileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
        try {
            const importedTickets = JSON.parse(event.target.result);
            if (typeof importedTickets === 'object' && importedTickets !== null && !Array.isArray(importedTickets)) {
                Object.keys(importedTickets).forEach(drawNum => {
                    if (importedTickets[drawNum] && typeof importedTickets[drawNum] === 'object') importedTickets[drawNum].numbers = normalizeTicketNumbers(importedTickets[drawNum].numbers);
                });
                ticketsData = { ...ticketsData, ...importedTickets };
                saveTickets();
                alert('Ticket data imported successfully!');
            } else alert('Invalid JSON format.');
        } catch (err) { alert('Error parsing JSON file: ' + err.message); }
    };
    reader.readAsText(file);
});

document.getElementById('firstPageBtn').addEventListener('click', () => { currentPage = 1; renderApp(); });
document.getElementById('prevPageBtn').addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderApp(); });
document.getElementById('nextPageBtn').addEventListener('click', () => { currentPage = Math.min(getTotalPages(), currentPage + 1); renderApp(); });
document.getElementById('lastPageBtn').addEventListener('click', () => { currentPage = getTotalPages(); renderApp(); });

fetch('data/draws.json').then(res => res.json()).then(data => { drawsData = data; renderApp(); }).catch(err => { console.error('Failed to load draws.json', err); renderApp(); });
