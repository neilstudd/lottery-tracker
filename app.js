const BASE_DRAW_NUM = 3200;
const BASE_DRAW_DATE = new Date(2026, 7, 22); // Month is 0-indexed (7 = August)

let drawsData = [];
let ticketsData = JSON.parse(localStorage.getItem('lottery_tickets') || '{}');

function normalizeTicketNumbers(numbers) {
    if (!Array.isArray(numbers)) return [];
    return [...numbers]
        .map(n => Number(n))
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b);
}

// Mathematical Draw Calculation Functions
function calculateDrawNumber(dateObj) {
    const deltaDays = Math.floor((dateObj - BASE_DRAW_DATE) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(deltaDays / 7);
    const rem = deltaDays % 7;
    const drawDelta = weeks * 2 + (rem === 4 ? 1 : 0);
    return BASE_DRAW_NUM + drawDelta;
}

function calculateDrawDate(drawNum) {
    const drawDelta = drawNum - BASE_DRAW_NUM;
    const weeks = Math.floor(drawDelta / 2);
    const rem = drawDelta % 2;
    const daysAdd = weeks * 7 + (rem === 1 ? 4 : 0);
    const d = new Date(BASE_DRAW_DATE);
    d.setDate(d.getDate() + daysAdd);
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
    if (Number.isInteger(num)) {
        return num.toLocaleString('en-GB');
    }
    return num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const colorClass = getBallColorClass(num);
    const normalizedUserNumbers = normalizeTicketNumbers(userTicketNumbers);
    const isMatch = normalizedUserNumbers.includes(num);
    const matchedClass = isMatch ? 'matched' : '';

    let labelHTML = '';
    if (isBonus && isMatch) labelHTML = '<span class="ball-label match-label">BONUS<br/>MATCH</span>';
    else if (isBonus) labelHTML = '<span class="ball-label">BONUS</span>';
    else if (isMatch) labelHTML = '<span class="ball-label match-label">MATCH</span>';

    return `
        <div class="ball-wrapper">
            <span class="ball ${colorClass} ${matchedClass}">${num}</span>
            ${labelHTML}
        </div>
    `;
}

function renderMatchCountHTML(mainNums, bonusNum, userTicketNumbers) {
    const normalizedUserNumbers = normalizeTicketNumbers(userTicketNumbers);
    if (!normalizedUserNumbers.length) return '<span class="match-text">n/a</span>';
    
    let matches = mainNums.filter(n => normalizedUserNumbers.includes(n)).length;
    let bonusMatched = normalizedUserNumbers.includes(bonusNum);
    let isWin = matches > 0 || bonusMatched;
    let winClass = isWin ? 'has-match' : '';

    let text = '0';
    if (matches === 0 && bonusMatched) text = 'Bonus';
    else if (bonusMatched) text = `${matches} + Bonus`;
    else if (matches > 0) text = `${matches}`;

    return `<span class="match-text ${winClass}">${text}</span>`;
}

// Data Handling & LocalStorage
function saveTickets() {
    localStorage.setItem('lottery_tickets', JSON.stringify(ticketsData));
    renderApp();
}

function setWinnings(drawNum, currentAmount) {
    const defaultVal = currentAmount !== undefined ? currentAmount : "";
    const amount = prompt("Enter ticket winnings (£):", defaultVal);
    if (amount !== null && amount.trim() !== "") {
        const cleanAmount = amount.replace(/,/g, '').trim();
        const numAmount = parseFloat(cleanAmount);
        if (!isNaN(numAmount) && numAmount >= 0) {
            if (ticketsData[drawNum]) {
                ticketsData[drawNum].winnings = numAmount;
                saveTickets();
            }
        } else {
            alert("Please enter a valid numeric amount.");
        }
    }
}

function deleteTicket(drawNum) {
    if (ticketsData[drawNum]) {
        delete ticketsData[drawNum];
        saveTickets();
    }
}

// UI Rendering Logic
function renderApp() {
    const drawnNumbersSet = new Set(drawsData.map(d => d.draw_number));
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Calculate Stats
    let pastTicketsCount = 0;
    let totalWinnings = 0;

    Object.keys(ticketsData).forEach(drawNumStr => {
        const drawNum = parseInt(drawNumStr, 10);
        const ticketDate = calculateDrawDate(drawNum);
        if (ticketDate <= today) {
            pastTicketsCount++;
        }
        totalWinnings += (ticketsData[drawNumStr].winnings || 0);
    });

    const totalSpent = pastTicketsCount * 2;
    const profitLoss = totalWinnings - totalSpent;

    document.getElementById('totalSpentVal').textContent = `£${formatCurrency(totalSpent)}`;
    document.getElementById('totalWinningsVal').textContent = `£${formatCurrency(totalWinnings)}`;
    
    const plEl = document.getElementById('profitLossVal');
    if (profitLoss > 0) {
        plEl.className = 'stat-value pl-positive';
        plEl.textContent = `£${formatCurrency(profitLoss)}`;
    } else if (profitLoss < 0) {
        plEl.className = 'stat-value pl-negative';
        plEl.textContent = `-£${formatCurrency(Math.abs(profitLoss))}`;
    } else {
        plEl.className = 'stat-value pl-neutral';
        plEl.textContent = '£0';
    }

    // Render Upcoming Tickets Table
    const upcomingDrawNums = Object.keys(ticketsData)
        .map(n => parseInt(n, 10))
        .filter(n => !drawnNumbersSet.has(n))
        .sort((a, b) => b - a);

    const upcomingSection = document.getElementById('upcomingSection');
    const upcomingTbody = document.getElementById('upcomingTableBody');

    if (upcomingDrawNums.length > 0) {
        upcomingSection.style.display = 'block';
        upcomingTbody.innerHTML = upcomingDrawNums.map(drawNum => {
            const ticket = ticketsData[drawNum];
            const sortedTicketNumbers = normalizeTicketNumbers(ticket.numbers);
            const drawDate = calculateDrawDate(drawNum);
            return `
                <tr>
                    <td>${drawNum}</td>
                    <td>${formatDate(drawDate)}</td>
                    <td>
                        <div class="ball-container">
                            ${sortedTicketNumbers.map(n => renderBallHTML(n, sortedTicketNumbers)).join('')}
                        </div>
                    </td>
                    <td>
                        <button class="delete-btn" onclick="deleteTicket(${drawNum})" title="Delete Ticket">&#128465;</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        upcomingSection.style.display = 'none';
    }

    // Render Past Results Table
    const pastTbody = document.getElementById('pastTableBody');
    pastTbody.innerHTML = drawsData.map(draw => {
        const userTicket = ticketsData[draw.draw_number];
        const ticketNums = userTicket ? normalizeTicketNumbers(userTicket.numbers) : null;

        const m1Matches = ticketNums ? draw.draw1.numbers.filter(n => ticketNums.includes(n)).length : 0;
        const m2Matches = (ticketNums && draw.draw_number > 3178) ? draw.draw2.numbers.filter(n => ticketNums.includes(n)).length : 0;

        let winningsCellHTML = '<span class="match-text">n/a</span>';
        if (userTicket) {
            if (m1Matches >= 3 || m2Matches >= 3) {
                const winVal = userTicket.winnings || 0;
                if (winVal > 0) {
                    const rawVal = Number.isInteger(winVal) ? winVal : winVal.toString();
                    winningsCellHTML = `
                        <a href="#" onclick="setWinnings(${draw.draw_number}, '${rawVal}'); return false;" class="enter-winnings-link">
                            £${formatCurrency(winVal)}
                        </a>`;
                } else {
                    winningsCellHTML = `<a href="#" onclick="setWinnings(${draw.draw_number}); return false;" class="enter-winnings-link">ENTER WINNINGS</a>`;
                }
            } else {
                winningsCellHTML = '<span class="match-text">£0</span>';
            }
        }

        return `
            <tr>
                <td>${draw.draw_number}</td>
                <td>${formatDate(draw.draw_date)}</td>
                <td>
                    <div class="draw-stacked-container">
                        <div class="draw-row">
                            <span class="draw-label">Draw 1:</span>
                            <div class="ball-container">
                                ${draw.draw1.numbers.map(n => renderBallHTML(n, ticketNums)).join('')}
                                <div class="divider"></div>
                                ${renderBallHTML(draw.draw1.bonus, ticketNums, true)}
                            </div>
                        </div>
                        ${draw.draw_number > 3178 ? `
                        <div class="draw-row">
                            <span class="draw-label">Draw 2:</span>
                            <div class="ball-container">
                                ${draw.draw2.numbers.map(n => renderBallHTML(n, ticketNums)).join('')}
                                <div class="divider"></div>
                                ${renderBallHTML(draw.draw2.bonus, ticketNums, true)}
                            </div>
                        </div>` : ''}
                    </div>
                </td>
                <td>
                    <div class="draw-stacked-container">
                        <div class="draw-row">${renderMatchCountHTML(draw.draw1.numbers, draw.draw1.bonus, ticketNums)}</div>
                        ${draw.draw_number > 3178 ? `<div class="draw-row">${renderMatchCountHTML(draw.draw2.numbers, draw.draw2.bonus, ticketNums)}</div>` : ''}
                    </div>
                </td>
                <td>${winningsCellHTML}</td>
            </tr>
        `;
    }).join('');
}

// Modal & Form Handlers
function populateDrawOptions() {
    const selectEl = document.getElementById('drawDateSelect');
    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const options = [];

    let curr = new Date(today);
    while (curr <= endOfYear) {
        const day = curr.getDay(); // Wed = 3, Sat = 6
        if (day === 3 || day === 6) {
            const dNum = calculateDrawNumber(curr);
            const dateStr = curr.toISOString().split('T')[0];
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
            options.push(`<option value="${dateStr}">${dayName} ${formatDate(curr)} (Draw #${dNum})</option>`);
        }
        curr.setDate(curr.getDate() + 1);
    }
    selectEl.innerHTML = options.join('');
}

// Event Listeners
document.getElementById('openAddTicketModal').addEventListener('click', () => {
    populateDrawOptions();
    document.getElementById('ticketModal').classList.add('active');
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('ticketModal').classList.remove('active');
});

document.getElementById('addTicketForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const dateStr = document.getElementById('drawDateSelect').value;
    const selectedDate = new Date(dateStr);
    const drawNum = calculateDrawNumber(selectedDate);

    const nums = normalizeTicketNumbers([
        parseInt(document.getElementById('n1').value, 10),
        parseInt(document.getElementById('n2').value, 10),
        parseInt(document.getElementById('n3').value, 10),
        parseInt(document.getElementById('n4').value, 10),
        parseInt(document.getElementById('n5').value, 10),
        parseInt(document.getElementById('n6').value, 10)
    ]);

    ticketsData[drawNum] = {
        numbers: nums,
        winnings: ticketsData[drawNum] ? (ticketsData[drawNum].winnings || 0) : 0
    };

    saveTickets();
    document.getElementById('addTicketForm').reset();
    document.getElementById('ticketModal').classList.remove('active');
});

// JSON Export Functionality
document.getElementById('exportDataBtn').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ticketsData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "lottery_tickets_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

// JSON Import Functionality
document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedTickets = JSON.parse(event.target.result);
            if (typeof importedTickets === 'object' && importedTickets !== null) {
                Object.keys(importedTickets).forEach(drawNum => {
                    const ticket = importedTickets[drawNum];
                    if (ticket && typeof ticket === 'object') {
                        ticket.numbers = normalizeTicketNumbers(ticket.numbers);
                    }
                });
                ticketsData = { ...ticketsData, ...importedTickets };
                saveTickets();
                alert('Ticket data imported successfully!');
            } else {
                alert('Invalid JSON format.');
            }
        } catch (err) {
            alert('Error parsing JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// App Initialization
fetch('data/draws.json')
    .then(res => res.json())
    .then(data => {
        drawsData = data;
        renderApp();
    })
    .catch(err => {
        console.error('Failed to load draws.json', err);
        renderApp();
    });
