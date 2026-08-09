"use strict";

if(typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
}

const SLOTS = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"];

const todayDateString = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

function safeJSONParse(str, fallback) {
    try { return str ? JSON.parse(str) : fallback; }
    catch(e) { console.warn('JSON parse error protected:', e); return fallback; }
}

function safeStorageSet(key, val) {
    try { localStorage.setItem(key, val); }
    catch(e) { console.error('Storage full or unavailable:', e); alert('Storage limit reached! Please clear some saves or audio files.'); }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openModal(id) {
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('active'), 10);
    }
}

function closeModalById(id) {
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove('active');
        setTimeout(() => el.classList.add('hidden'), 300);
    }
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.classList.add('flex');
    }
});

function triggerPWAInstall() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        alert("iPhone / iPad Installation:\n\n1. Tap the Share button below.\n2. Tap 'Add to Home Screen'.");
        return;
    }

    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showReaction("App installed successfully! 📲", "anim-bounce");
                const installBtn = document.getElementById('pwa-install-btn');
                if (installBtn) installBtn.style.display = 'none';
            }
            deferredPrompt = null;
        });
    } else {
        alert("Installation is not supported or already installed. Check your browser menu for 'Add to Home Screen'.");
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('ServiceWorker notice: ', err);
        });
    });
}

let appDataWrapper = safeJSONParse(localStorage.getItem('tyt_v4_data_daily'), null);
let appData = {};

if (appDataWrapper) {
    if (appDataWrapper.date === todayDateString) {
        appData = appDataWrapper.data;
    } else {
        appData = {};
    }
} else {
    appData = safeJSONParse(localStorage.getItem('tyt_v4_data'), {});
    safeStorageSet('tyt_v4_data_daily', JSON.stringify({ date: todayDateString, data: appData }));
}

const DEFAULT_STATS = {
    focusTime: { '08': 0, '11': 0, '14': 0, '17': 0, '20': 0, '23': 0 },
    energyLogs: { '08': 7, '11': 7, '14': 7, '17': 7, '20': 7, '23': 7 },
    totalFocusMins: 0
};

let waterWrapper = safeJSONParse(localStorage.getItem('tyt_v4_water_daily'), null);
let waterCount = (waterWrapper && waterWrapper.date === todayDateString) ? (parseInt(waterWrapper.count) || 0) : 0;

let statsWrapper = safeJSONParse(localStorage.getItem('tyt_v4_stats_daily'), null);
let todayStats = (statsWrapper && statsWrapper.date === todayDateString)
    ? statsWrapper.stats
    : JSON.parse(JSON.stringify(DEFAULT_STATS));

let isDarkMode = localStorage.getItem('tyt_v4_theme') === 'dark';

let progressHistory = safeJSONParse(localStorage.getItem('tyt_v4_history'), []);
let currentOpenHistoryDate = ""; 
let dayDetailsSource = 'history';

let displayMonthDate = new Date();

function openCalendarModal() {
    closeAllMenus();
    displayMonthDate = new Date(); 
    renderCalendar();
    openModal('calendar-modal');
}

function closeCalendarModal() {
    closeModalById('calendar-modal');
}

function prevMonth() {
    displayMonthDate.setDate(1);
    displayMonthDate.setMonth(displayMonthDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    displayMonthDate.setDate(1);
    displayMonthDate.setMonth(displayMonthDate.getMonth() + 1);
    renderCalendar();
}

function renderCalendar() {
    const monthYearLabel = document.getElementById('calendar-month-year');
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const year = displayMonthDate.getFullYear();
    const month = displayMonthDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    let html = '';

    for (let i = firstDayIndex; i > 0; i--) {
        html += `<div class="p-2 text-sm font-600 opacity-20 pointer-events-none">${prevMonthDays - i + 1}</div>`;
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const dateStringStr = new Date(year, month, i).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        const hasHistory = progressHistory.some(r => r.date === dateStringStr);

        let classes = 'relative p-2 text-sm font-800 rounded-full w-9 h-9 mx-auto flex items-center justify-center transition-all cursor-pointer hover:scale-110 ';
        
        if (isToday) {
            classes += 'bg-[#df7b54] text-white shadow-[0_0_10px_rgba(223,123,84,0.5)]';
        } else if (hasHistory) {
            classes += 'text-[#df7b54] bg-[#df7b54]/10 hover:bg-[#df7b54]/20 border border-[#df7b54]/30';
        } else {
            classes += 'hover:bg-[var(--border-color)]';
        }

        const clickAction = hasHistory ? `onclick="openHistoryDayFromCalendar('${dateStringStr}')"` : `onclick="${isToday ? 'closeCalendarModal()' : ''}"`;

        html += `<div class="${classes}" ${clickAction}>${i}</div>`;
    }

    const totalCells = firstDayIndex + daysInMonth;
    const remainingCells = 42 - totalCells; 
    for (let i = 1; i <= remainingCells; i++) {
        html += `<div class="p-2 text-sm font-600 opacity-20 pointer-events-none">${i}</div>`;
    }

    grid.innerHTML = html;
}

function openHistoryDayFromCalendar(dateString) {
    closeCalendarModal();
    setTimeout(() => {
        openDayDetails(dateString, 'calendar');
    }, 300);
}

let activeAlarmInterval = null;
let currentCustomAudio = null;
let currentCustomAudioUrl = null;
let currentMessageAudio = null;
let currentMessageAudioUrl = null;
let audioCtx = null;
let currentBgObjectUrl = null;
let currentRingingAlarmId = null; 

let customAlarmsLibrary = safeJSONParse(localStorage.getItem('tyt_v4_custom_alarms'), []);
let customMessagesLibrary = safeJSONParse(localStorage.getItem('tyt_v4_custom_messages'), []);

function initAudioContext() {
    if(!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if(AudioContext) audioCtx = new AudioContext();
    }
    if(audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function requestNotificationPermissionOnce() {
    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

function handleFirstUserGesture() {
    initAudioContext();
    requestNotificationPermissionOnce();
}
document.body.addEventListener('click', handleFirstUserGesture, { once: true });
document.body.addEventListener('touchstart', handleFirstUserGesture, { once: true, passive: true });

const msgToneLabels = { 'pop': 'Msg: Pop', 'chime': 'Msg: Chime', 'none': 'Msg: None 🔕' };
const alarmToneLabels = { 'classic': 'Alarm: Classic', 'marimba': 'Alarm: Marimba', 'soft': 'Alarm: Gentle', 'urgent': 'Alarm: Urgent' };

let petMenuOpen = false;
let bgMenuOpen = false;
let msgMenuOpen = false;
let alarmMenuOpen = false;

let petVisible = localStorage.getItem('tyt_v4_pet_visible');
if (petVisible === null) {
    petVisible = true;
} else {
    petVisible = petVisible === 'true';
}

let idleTimeout;
let isFocusing = false;
let currentPetEmoji = localStorage.getItem('tyt_v4_pet') || '🐱';

let timerInterval, eyeInterval;
let isStopwatchActive = false;
let stopwatchSecs = 0;
let currentTimerMins = 25; 

let alarmsList = safeJSONParse(localStorage.getItem('tyt_v4_alarms_list'), []);
let lastCheckedMinute = -1;
let editingAlarmId = null;

let pulseChart, trendChart, detailPulseChart, detailTrendChart; 

let notebook = safeJSONParse(localStorage.getItem('tyt_v4_notebook'), []);

function migrateLegacyNotes() {
    let oldNotes = safeJSONParse(localStorage.getItem('tyt_v4_notes_dict'), null);
    if (oldNotes && Object.keys(oldNotes).length > 0) {
        for (let date in oldNotes) {
            if(oldNotes[date] && oldNotes[date].trim() !== "") {
                notebook.push({
                    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    title: '',
                    text: oldNotes[date],
                    dateString: date,
                    timestamp: new Date(date).getTime() || Date.now()
                });
            }
        }
        localStorage.removeItem('tyt_v4_notes_dict');
        safeStorageSet('tyt_v4_notebook', JSON.stringify(notebook));
    }
}

let noteDebounceTimers = {};

function handleNoteInput(id, field, value) {
    const note = notebook.find(n => n.id === id);
    if(note) {
        note[field] = value;
        note.timestamp = Date.now();
    }
    
    safeStorageSet('tyt_v4_notebook', JSON.stringify(notebook));
    
    clearTimeout(noteDebounceTimers[id]);
    const indicator = document.getElementById('save-indicator-' + id);
    if(indicator) {
        indicator.style.opacity = '0'; 
        noteDebounceTimers[id] = setTimeout(() => {
            indicator.innerText = "Saved ✓";
            indicator.style.opacity = '1';
            setTimeout(() => { if (indicator) indicator.style.opacity = '0'; }, 2000);
        }, 800); 
    }
}

function createNewNote(specificDate = null) {
    const dateStr = specificDate || todayDateString;
    const newNote = {
        id: 'note_' + Date.now(),
        title: '',
        text: '',
        dateString: dateStr,
        timestamp: Date.now()
    };
    notebook.unshift(newNote); 
    safeStorageSet('tyt_v4_notebook', JSON.stringify(notebook));
    
    const notebookModal = document.getElementById('notebook-modal');
    const dayDetailsModal = document.getElementById('day-details-modal');
    
    if (notebookModal && notebookModal.classList.contains('active')) {
        renderNotebookGrid(document.getElementById('notebook-search').value);
    } else if (dayDetailsModal && dayDetailsModal.classList.contains('active')) {
        renderHistoryNotes(currentOpenHistoryDate);
    } else {
        renderActiveNotes();
        triggerAction('notes');
    }
    
    setTimeout(() => {
        const ta = document.getElementById('textarea-' + newNote.id);
        if (ta) ta.focus();
    }, 50);
}

function deleteNote(id) {
    notebook = notebook.filter(n => n.id !== id);
    safeStorageSet('tyt_v4_notebook', JSON.stringify(notebook));
    
    const notebookModal = document.getElementById('notebook-modal');
    const dayDetailsModal = document.getElementById('day-details-modal');

    if (notebookModal && notebookModal.classList.contains('active')) {
        renderNotebookGrid(document.getElementById('notebook-search').value);
    } else if (dayDetailsModal && dayDetailsModal.classList.contains('active')) {
        renderHistoryNotes(currentOpenHistoryDate);
    } else {
        renderActiveNotes();
    }
}

function renderActiveNotes() {
    const container = document.getElementById('active-notes-list');
    if(!container) return;
    container.innerHTML = '';
    
    const todayNotes = notebook.filter(n => n.dateString === todayDateString).sort((a,b) => b.timestamp - a.timestamp);
    
    if (todayNotes.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted mt-10 flex flex-col items-center justify-center h-full">
                <p class="text-sm font-bold">Your mind is clear.</p>
            </div>`;
        return;
    }
    
    todayNotes.forEach(note => {
        container.innerHTML += buildNoteHTML(note, false, false);
    });
}

function openNotebook() {
    document.getElementById('notebook-search').value = '';
    renderNotebookGrid('');
    openModal('notebook-modal');
}

function closeNotebook() {
    closeModalById('notebook-modal');
    renderActiveNotes(); 
}

function searchNotebook(query) {
    renderNotebookGrid(query);
}

function renderNotebookGrid(query) {
    const container = document.getElementById('notebook-grid');
    container.innerHTML = '';
    
    let filtered = notebook.slice().sort((a,b) => b.timestamp - a.timestamp);
    if (query.trim() !== '') {
        const q = query.toLowerCase();
        filtered = filtered.filter(n => n.text.toLowerCase().includes(q) || n.dateString.toLowerCase().includes(q) || (n.title && n.title.toLowerCase().includes(q)));
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-muted mt-10 font-bold text-sm">No notes found.</div>`;
        return;
    }
    
    filtered.forEach(note => {
        container.innerHTML += buildNoteHTML(note, true, true); 
    });
}

function renderHistoryNotes(dateStr) {
    const container = document.getElementById('detail-notes-list');
    if(!container) return;
    container.innerHTML = '';
    
    const dayNotes = notebook.filter(n => n.dateString === dateStr).sort((a,b) => b.timestamp - a.timestamp);
    
    if (dayNotes.length === 0) {
        container.innerHTML = `<p class="text-sm text-muted italic">No notes written on this day.</p>`;
        return;
    }
    
    dayNotes.forEach(note => {
        container.innerHTML += buildNoteHTML(note, false, false);
    });
}

function buildNoteHTML(note, showDate = false, isMasonry = false) {
    const timeStr = new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const dateHeader = showDate ? `<span class="px-2 py-1 bg-[#df7b54]/10 text-[#df7b54] rounded-md text-[9px] font-extrabold uppercase tracking-widest">${note.dateString}</span>` : '';
    const masonryClass = isMasonry ? 'break-inside-avoid mb-6' : '';
    
    return `
        <div class="app-subcard p-6 rounded-[2rem] relative group transition-all duration-300 hover:shadow-[0_15px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 focus-within:ring-2 ring-[#df7b54]/50 border border-[var(--border-color)] flex flex-col gap-4 ${masonryClass}">
            <div class="flex justify-between items-start gap-2">
                <div class="flex flex-col gap-2 w-full mr-2">
                    <input type="text" oninput="handleNoteInput('${note.id}', 'title', this.value)" value="${escapeHTML(note.title || '')}" placeholder="Note Title" class="w-full bg-transparent border-none outline-none font-800 text-xl text-[var(--text-main)] placeholder-muted/40 truncate transition-colors focus:text-[#df7b54]">
                    <div class="flex items-center gap-2 flex-wrap">
                        ${dateHeader}
                        <span class="text-[10px] text-muted font-bold uppercase tracking-widest">${timeStr}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <span id="save-indicator-${note.id}" class="text-[9px] text-[#669c6d] font-bold opacity-0 transition-opacity duration-300 whitespace-nowrap bg-[#669c6d]/10 px-2 py-1 rounded-full">Saved ✓</span>
                    <button onclick="deleteNote('${note.id}')" class="text-muted hover:text-[#e65c5c] hover:bg-[#e65c5c]/10 transition-all opacity-0 group-hover:opacity-100 p-2 rounded-xl" title="Delete Note">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            <textarea id="textarea-${note.id}" oninput="handleNoteInput('${note.id}', 'text', this.value)" class="w-full bg-transparent border-none outline-none resize-y min-h-[100px] text-sm font-600 history-scroll text-[var(--text-main)] placeholder-muted/40 leading-relaxed" placeholder="What's on your mind?">${escapeHTML(note.text)}</textarea>
        </div>
    `;
}

function renderAlarmDropdown() {
    const dropdown = document.getElementById('alarm-dropdown');
    dropdown.innerHTML = '';
    
    const defaultTones = [
        { id: 'classic', name: 'Alarm: Classic' },
        { id: 'marimba', name: 'Alarm: Marimba' },
        { id: 'soft', name: 'Alarm: Gentle' },
        { id: 'urgent', name: 'Alarm: Urgent' }
    ];

    defaultTones.forEach(tone => {
        dropdown.innerHTML += `<button onclick="selectAlarmTone('${tone.id}', '${tone.name}')" class="w-full text-left px-4 py-3 text-sm font-800 cursor-pointer border-b hover:opacity-70 truncate" style="border-color: var(--border-color);">${tone.name}</button>`;
    });

    customAlarmsLibrary.forEach(custom => {
        dropdown.innerHTML += `
            <div class="flex items-center justify-between border-b" style="border-color: var(--border-color);">
                <button data-tone-id="${escapeHTML(custom.id)}" data-tone-name="${escapeHTML(custom.name)}" class="js-select-alarm-tone flex-grow text-left px-4 py-3 text-sm font-800 cursor-pointer hover:opacity-70 truncate">${escapeHTML(custom.name)}</button>
                <button data-tone-id="${escapeHTML(custom.id)}" class="js-delete-alarm-tone px-4 py-3 text-[#e65c5c] font-bold hover:opacity-70 transition-opacity" title="Remove tone">✕</button>
            </div>
        `;
    });

    dropdown.innerHTML += `<button onclick="document.getElementById('alarm-audio-upload').click()" class="w-full text-left px-4 py-3 text-sm font-800 cursor-pointer hover:opacity-70 truncate text-[#df7b54] sticky bottom-0 z-10" style="background-color: var(--card-bg);">+ Add New 🎵</button>`;
}

function renderMsgDropdown() {
    const dropdown = document.getElementById('msg-dropdown');
    dropdown.innerHTML = '';
    
    const defaultTones = [
        { id: 'none', name: 'Msg: None 🔕' },
        { id: 'pop', name: 'Msg: Pop' },
        { id: 'chime', name: 'Msg: Chime' }
    ];

    defaultTones.forEach(tone => {
        dropdown.innerHTML += `<button onclick="selectMsgTone('${tone.id}', '${tone.name}')" class="w-full text-left px-4 py-3 text-sm font-800 cursor-pointer border-b hover:opacity-70 truncate" style="border-color: var(--border-color);">${tone.name}</button>`;
    });

    customMessagesLibrary.forEach(custom => {
        dropdown.innerHTML += `
            <div class="flex items-center justify-between border-b" style="border-color: var(--border-color);">
                <button data-tone-id="${escapeHTML(custom.id)}" data-tone-name="${escapeHTML(custom.name)}" class="js-select-msg-tone flex-grow text-left px-4 py-3 text-sm font-800 cursor-pointer hover:opacity-70 truncate">${escapeHTML(custom.name)}</button>
                <button data-tone-id="${escapeHTML(custom.id)}" class="js-delete-msg-tone px-4 py-3 text-[#e65c5c] font-bold hover:opacity-70 transition-opacity" title="Remove tone">✕</button>
            </div>
        `;
    });

    dropdown.innerHTML += `<button onclick="document.getElementById('message-audio-upload').click()" class="w-full text-left px-4 py-3 text-sm font-800 cursor-pointer hover:opacity-70 truncate text-[#df7b54] sticky bottom-0 z-10" style="background-color: var(--card-bg);">+ Add New 🎵</button>`;
}

let isAutoEnergy = true;

function toggleAutoEnergy() {
    isAutoEnergy = !isAutoEnergy;
    const btn = document.getElementById('auto-energy-btn');
    if(isAutoEnergy) {
        btn.style.background = 'var(--accent-main)';
        btn.style.color = 'white';
        btn.innerText = 'Auto: ON';
    } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
        btn.innerText = 'Auto: OFF';
    }
}

function resetEnergy() {
    updateEnergyValue(10);
    if(!isAutoEnergy) toggleAutoEnergy(); 
    showReaction("Energy fully restored! Let's go! ⚡", "anim-bounce", { emoji: ['⚡'], class: 'floatUp', count: 3 });
}

function updateEnergyValue(newVal) {
    newVal = Math.max(1, Math.min(10, newVal)); 
    const slider = document.getElementById('energy-slider');
    if (slider) slider.value = newVal;
    
    const block = getCurrentTimeBlock();
    todayStats.energyLogs[block] = newVal;
    saveStats();
    updateTrendChart();
}

const pet = document.getElementById('time-pet');
let isDragging = false;
let lastTapTime = 0;
let dragOffset = { x: 0, y: 0 };

function updateLiveTime() {
    const el = document.getElementById('live-time');
    if (!el) return;
    const now = new Date();
    
    const liveDateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    if (liveDateStr !== todayDateString) {
        if (isFocusing) stopTimer();
        window.location.reload(); 
        return;
    }

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    el.innerText = now.toLocaleString('en-US', options).replace(' at ', ', ');
    
    const currentMin = now.getMinutes();
    if (currentMin !== lastCheckedMinute) {
        lastCheckedMinute = currentMin;
        
        const hm = now.getHours().toString().padStart(2, '0') + ":" + currentMin.toString().padStart(2, '0');
        const todayStr = now.toDateString(); 
        
        alarmsList.forEach(al => {
            let isStandardTrigger = (al.time === hm && al.lastTriggered !== todayStr);
            let isSnoozeTrigger = (al.snoozeTime === hm);

            if (al.active && (isStandardTrigger || isSnoozeTrigger)) {
                if (isStandardTrigger) al.lastTriggered = todayStr;
                if (isSnoozeTrigger) al.snoozeTime = null; 
                safeStorageSet('tyt_v4_alarms_list', JSON.stringify(alarmsList));
                triggerAlarmEvent(al);
            }
        });
    }
}

function triggerAlarmEvent(alarmObj) {
    currentRingingAlarmId = alarmObj.id;
    showReaction(`Alarm! ${escapeHTML(alarmObj.label)}`, "anim-bounce", { emoji: ['⏰','❗'], class: 'floatUp', count: 5 });
    showAlarmModal(`⏰ ${escapeHTML(alarmObj.label)}`);
}

function forceCloseBg() { if(bgMenuOpen) { bgMenuOpen = false; document.getElementById('bg-dropdown').classList.remove('active'); } }
function forceClosePet() { if(petMenuOpen) { petMenuOpen = false; document.getElementById('pet-dropdown').classList.remove('active'); } }
function forceCloseMsg() { if(msgMenuOpen) { msgMenuOpen = false; document.getElementById('msg-dropdown').classList.remove('active'); } }
function forceCloseAlarm() { if(alarmMenuOpen) { alarmMenuOpen = false; document.getElementById('alarm-dropdown').classList.remove('active'); } }

function closeAllMenus() {
    forceCloseBg();
    forceClosePet();
    forceCloseMsg();
    forceCloseAlarm();
}

function toggleBgMenu(e) {
    if (e) e.stopPropagation();
    if (!bgMenuOpen) { forceClosePet(); forceCloseMsg(); forceCloseAlarm(); }
    bgMenuOpen = !bgMenuOpen;
    if (bgMenuOpen) document.getElementById('bg-dropdown').classList.add('active');
    else document.getElementById('bg-dropdown').classList.remove('active');
}

function togglePetMenu(e) {
    if (e) e.stopPropagation();
    if (!petMenuOpen) { forceCloseBg(); forceCloseMsg(); forceCloseAlarm(); }
    petMenuOpen = !petMenuOpen;
    if (petMenuOpen) document.getElementById('pet-dropdown').classList.add('active');
    else document.getElementById('pet-dropdown').classList.remove('active');
}

function toggleMsgMenu(e) {
    if (e) e.stopPropagation();
    if (!msgMenuOpen) { forceCloseBg(); forceClosePet(); forceCloseAlarm(); }
    msgMenuOpen = !msgMenuOpen;
    if (msgMenuOpen) document.getElementById('msg-dropdown').classList.add('active');
    else document.getElementById('msg-dropdown').classList.remove('active');
}

function toggleAlarmMenu(e) {
    if (e) e.stopPropagation();
    if (!alarmMenuOpen) { forceCloseBg(); forceClosePet(); forceCloseMsg(); }
    alarmMenuOpen = !alarmMenuOpen;
    if (alarmMenuOpen) document.getElementById('alarm-dropdown').classList.add('active');
    else document.getElementById('alarm-dropdown').classList.remove('active');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#bg-menu-container')) forceCloseBg();
    if (!e.target.closest('#pet-menu-container')) forceClosePet();
    if (!e.target.closest('#msg-dropdown') && !e.target.closest('[onclick*="toggleMsgMenu"]')) forceCloseMsg();
    if (!e.target.closest('#alarm-dropdown') && !e.target.closest('[onclick*="toggleAlarmMenu"]')) forceCloseAlarm();

    if (e.target.classList.contains('modal-backdrop')) {
        const id = e.target.id;
        if (id === 'active-alarm-modal') stopActiveAlarm();
        else if (id === 'set-alarm-modal') closeSetAlarmModal();
        else if (id === 'notebook-modal') closeNotebook();
        else if (id === 'end-of-day-modal') cancelModal();
        else if (id === 'history-modal') closeHistory();
        else if (id === 'day-details-modal') closeDayDetails();
        else if (id === 'calendar-modal') closeCalendarModal();
    }

    const selectAlarmBtn = e.target.closest('.js-select-alarm-tone');
    if (selectAlarmBtn) { selectAlarmTone(selectAlarmBtn.dataset.toneId, selectAlarmBtn.dataset.toneName); return; }

    const deleteAlarmBtn = e.target.closest('.js-delete-alarm-tone');
    if (deleteAlarmBtn) { deleteCustomAlarm(e, deleteAlarmBtn.dataset.toneId); return; }

    const selectMsgBtn = e.target.closest('.js-select-msg-tone');
    if (selectMsgBtn) { selectMsgTone(selectMsgBtn.dataset.toneId, selectMsgBtn.dataset.toneName); return; }

    const deleteMsgBtn = e.target.closest('.js-delete-msg-tone');
    if (deleteMsgBtn) { deleteCustomMsg(e, deleteMsgBtn.dataset.toneId); return; }
});

function selectMsgTone(val, displayName = 'Custom 🎵') {
    document.getElementById('msg-tone-label').innerText = displayName;
    safeStorageSet('tyt_v4_message_tone', val);
    safeStorageSet('tyt_v4_message_name', displayName);
    closeAllMenus();
    playMessageTone();
}

function selectAlarmTone(val, displayName = 'Custom 🎵') {
    document.getElementById('alarm-tone-label').innerText = displayName;
    safeStorageSet('tyt_v4_alarm', val);
    safeStorageSet('tyt_v4_alarm_name', displayName);
    closeAllMenus();
    playAlarmLoop();
    setTimeout(() => stopActiveAlarm(true), 4000);
}

async function handleMessageAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const blob = new Blob([file], { type: file.type });
    const customId = 'custom_msg_' + Date.now();
    const fileName = file.name.replace(/\.[^/.]+$/, "").substring(0, 20);
    
    try {
        await saveAudio(blob, customId);
        
        customMessagesLibrary.push({ id: customId, name: 'Custom: ' + fileName });
        safeStorageSet('tyt_v4_custom_messages', JSON.stringify(customMessagesLibrary));
        
        renderMsgDropdown();
        selectMsgTone(customId, 'Custom: ' + fileName);
        
    } catch (err) { 
        alert("Failed to save audio. Please try another file."); 
    } finally { 
        event.target.value = ''; 
        forceCloseMsg(); 
    }
}

async function handleAlarmAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const blob = new Blob([file], { type: file.type });
    const customId = 'custom_alarm_' + Date.now();
    const fileName = file.name.replace(/\.[^/.]+$/, "").substring(0, 20);
    
    try {
        await saveAudio(blob, customId);
        
        customAlarmsLibrary.push({ id: customId, name: 'Custom: ' + fileName });
        safeStorageSet('tyt_v4_custom_alarms', JSON.stringify(customAlarmsLibrary));
        
        renderAlarmDropdown();
        selectAlarmTone(customId, 'Custom: ' + fileName);
        
    } catch (err) { 
        alert("Failed to save audio. Please try another file."); 
    } finally { 
        event.target.value = ''; 
        forceCloseAlarm();
    }
}

async function deleteCustomMsg(event, id) {
    event.stopPropagation();
    
    const db = await initDB();
    const tx = db.transaction('audioStore', 'readwrite');
    tx.objectStore('audioStore').delete(id);
    
    customMessagesLibrary = customMessagesLibrary.filter(c => c.id !== id);
    safeStorageSet('tyt_v4_custom_messages', JSON.stringify(customMessagesLibrary));
    
    if (localStorage.getItem('tyt_v4_message_tone') === id) {
        selectMsgTone('pop', 'Msg: Pop');
    }
    renderMsgDropdown();
}

async function deleteCustomAlarm(event, id) {
    event.stopPropagation();
    
    const db = await initDB();
    const tx = db.transaction('audioStore', 'readwrite');
    tx.objectStore('audioStore').delete(id);
    
    customAlarmsLibrary = customAlarmsLibrary.filter(c => c.id !== id);
    safeStorageSet('tyt_v4_custom_alarms', JSON.stringify(customAlarmsLibrary));
    
    if (localStorage.getItem('tyt_v4_alarm') === id) {
        selectAlarmTone('classic', 'Alarm: Classic');
    }
    renderAlarmDropdown();
}

document.addEventListener('DOMContentLoaded', () => {
    updateLiveTime();
    setInterval(updateLiveTime, 1000);
    
    changePet(currentPetEmoji, true);
    checkIdleState();

    renderMsgDropdown();
    renderAlarmDropdown();

    const savedMessageTone = localStorage.getItem('tyt_v4_message_tone') || 'pop';
    const savedMessageName = localStorage.getItem('tyt_v4_message_name') || msgToneLabels[savedMessageTone] || (savedMessageTone === 'custom' ? 'Custom 🎵' : 'Msg: Pop');
    document.getElementById('msg-tone-label').innerText = savedMessageName;

    const savedAlarmTone = localStorage.getItem('tyt_v4_alarm') || 'classic';
    const savedAlarmName = localStorage.getItem('tyt_v4_alarm_name') || alarmToneLabels[savedAlarmTone] || (savedAlarmTone === 'custom' ? 'Custom 🎵' : 'Alarm: Classic');
    document.getElementById('alarm-tone-label').innerText = savedAlarmName;
    
    const dateLabelBtn = document.getElementById('date-label');
    if (dateLabelBtn) {
        dateLabelBtn.innerText = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    init();
});

const dbName = "tytDB";

function initDB() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(dbName, 4); 
            request.onerror = () => reject("DB Error");
            request.onblocked = () => reject("DB Blocked");
            request.onsuccess = (e) => resolve(e.target.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('bgStore')) {
                    db.createObjectStore('bgStore');
                }
                if (!db.objectStoreNames.contains('audioStore')) {
                    db.createObjectStore('audioStore');
                }
            };
        } catch(err) { reject(err); }
    });
}

async function saveBg(blob) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('bgStore', 'readwrite');
        const store = tx.objectStore('bgStore');
        const req = store.put(blob, 'customBgBlob');
        req.onsuccess = () => resolve();
        req.onerror = () => reject();
    });
}

async function loadBg() {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction('bgStore', 'readonly');
        const store = tx.objectStore('bgStore');
        const req = store.get('customBgBlob');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function clearBg() {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction('bgStore', 'readwrite');
        const store = tx.objectStore('bgStore');
        const req = store.delete('customBgBlob');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
    });
}

async function saveAudio(blob, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('audioStore', 'readwrite');
        const store = tx.objectStore('audioStore');
        const req = store.put(blob, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject();
    });
}

function init() {
    applyThemeState(isDarkMode);
    migrateLegacyNotes();
    
    renderActiveNotes(); 
    
    renderTimeline();
    renderAlarms();
    try { initCharts(); } catch (e) { console.error("Charts init warning:", e); }
    updateStats();
    startEyeRestTimer();
    
    const waterEl = document.getElementById('water-count');
    if (waterEl) waterEl.innerText = waterCount;

    const slider = document.getElementById('energy-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            if (isAutoEnergy) toggleAutoEnergy(); 
            
            const val = parseFloat(e.target.value);
            updateEnergyValue(val);
            
            clearTimeout(idleTimeout);
            if(val <= 3) {
                showReaction("Zzz... energy... so low... 🥱", "anim-breathe", { emoji: ['💤'], class: 'floatUp', count: 2 });
            } else if (val >= 8) {
                showReaction("I'm hyped! Full power! ⚡", "anim-bounce", { emoji: ['⚡','🔥'], class: 'floatUp', count: 3 });
            } else {
                showReaction("Feeling balanced! 🌱", "anim-breathe");
            }
            idleTimeout = setTimeout(checkIdleState, 3000);
        });
    }

    loadBg().then(bgBlob => {
        if (bgBlob) {
            const objectUrl = URL.createObjectURL(bgBlob);
            applyCustomBackground(objectUrl);
        }
    }).catch(err => { console.warn("Background load skipped:", err); });
}

function changePet(emoji, silentLoad = false) {
    currentPetEmoji = emoji;
    safeStorageSet('tyt_v4_pet', emoji);
    
    const avatar = document.getElementById('pet-avatar');
    if (avatar) {
        avatar.innerText = emoji;
        avatar.className = `pet-character pet-${emoji}`; 
    }
    
    const btn = document.getElementById('current-pet-btn');
    if (btn) btn.innerText = emoji;
    
    if (!silentLoad) {
        triggerAction('switch');
    }
    closeAllMenus();
}

function triggerAction(action) {
    clearTimeout(idleTimeout);
    let text = "";
    let anim = "";
    let particles = null;
    
    switch(action) {
        case 'theme':
            text = "Changing mode, then I shall too! ✨";
            anim = "anim-spin";
            break;
        case 'hit':
            const curses = ["Hey! %#@* you! 🤬", "Ouch! Why did you do that?! 😭", "Stop poking me! 💢", "Watch it! 😠"];
            text = curses[Math.floor(Math.random() * curses.length)];
            anim = "anim-shake";
            particles = { emoji: ['💧','💦','💢'], class: 'sweat', count: 6 };
            break;
        case 'water':
            text = "Glug glug... ahh! Hydration is key! 💧";
            anim = "anim-bounce";
            particles = { emoji: ['💧','✨'], class: 'floatUp', count: 4 };
            break;
        case 'eyes':
            text = "20-20-20 rule! Look away & rest... 😌";
            anim = "anim-breathe";
            particles = { emoji: ['💤'], class: 'floatUp', count: 2 };
            break;
        case 'notes':
            text = "Brain dump! Get those ideas out! 📝";
            anim = "anim-tilt";
            particles = { emoji: ['💡','✨'], class: 'floatUp', count: 3 };
            break;
        case 'study_start':
            text = "Laser focus mode engaged! 🎯 Shh...";
            anim = "anim-float";
            particles = { emoji: ['📚','🧠'], class: 'floatUp', count: 2 };
            break;
        case 'study_stop':
            text = "Focus mode off. Good work! 🎉";
            anim = "anim-bounce";
            particles = { emoji: ['🎉'], class: 'floatUp', count: 3 };
            break;
        case 'run':
            text = "Cardio time! Gotta go fast! 🏃💨";
            anim = "anim-run";
            particles = { emoji: ['💨', '💦'], class: 'sweat', count: 5 };
            break;
        case 'streak':
            text = "Streak saved! I'm so proud of you! 🔥";
            anim = "anim-bounce";
            particles = { emoji: ['⭐','💖','🎉'], class: 'floatUp', count: 7 };
            break;
        case 'switch':
            text = "Ooh! A new form! ✨";
            anim = "anim-spin";
            particles = { emoji: ['✨'], class: 'floatUp', count: 3 };
            break;
    }
    
    if (['water', 'eyes', 'study_stop', 'hit', 'run', 'streak'].includes(action)) {
        playMessageTone();
    }

    showReaction(text, anim, particles);
    idleTimeout = setTimeout(checkIdleState, 4000); 
}

function showReaction(text, animClass, particleConfig) {
    const speechEl = document.getElementById('pet-message');
    const petEl = document.getElementById('pet-avatar');
    
    speechEl.innerText = text;
    speechEl.classList.add('show');
    
    petEl.className = petEl.className.replace(/anim-\w+/g, '').trim();
    void petEl.offsetWidth; 
    if(animClass) petEl.classList.add(animClass);

    if(particleConfig) spawnParticles(particleConfig);
}

function checkIdleState() {
    const speechEl = document.getElementById('pet-message');
    const petEl = document.getElementById('pet-avatar');
    
    speechEl.classList.remove('show');
    petEl.className = petEl.className.replace(/anim-\w+/g, '').trim();
    
    const slider = document.getElementById('energy-slider');
    const currentEnergy = slider ? parseInt(slider.value) : 7;
    
    if (isFocusing) {
        petEl.classList.add('anim-float');
    } else if (currentEnergy <= 3) {
        petEl.classList.add('anim-breathe');
    } else if (currentEnergy >= 8) {
        petEl.classList.add('anim-bounce');
    } else {
        petEl.classList.add('anim-breathe');
    }
}

function spawnParticles(config) {
    const wrapper = document.getElementById('pet-container');
    for(let i=0; i<config.count; i++) {
        const p = document.createElement('div');
        p.innerText = config.emoji[Math.floor(Math.random() * config.emoji.length)];
        p.className = `particle ${config.class}`;
        
        if(config.class === 'sweat') {
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 50;
            p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
        }
        
        p.style.left = `calc(50% + ${(Math.random() - 0.5) * 60}px)`;
        p.style.top = `calc(50% + ${(Math.random() - 0.5) * 60}px)`;
        
        wrapper.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
}

function startDrag(clientX, clientY) {
    isDragging = true;
    const rect = pet.getBoundingClientRect();
    dragOffset.x = clientX - rect.left; dragOffset.y = clientY - rect.top;
    pet.style.transition = "none";
    showReaction("Wheeeee! Flying! ✨", "anim-spin", { emoji: ['✨'], class: 'floatUp', count: 3 });
}

function onDrag(clientX, clientY) {
    if (!isDragging) return;
    pet.style.left = (clientX - dragOffset.x) + 'px';
    pet.style.top = (clientY - dragOffset.y) + 'px';
}

function endDrag() {
    if (isDragging) {
        isDragging = false;
        pet.style.transition = "top 3s cubic-bezier(0.4, 0, 0.2, 1), left 3s cubic-bezier(0.4, 0, 0.2, 1)";
        checkIdleState();
        
        const speechEl = document.getElementById('pet-message');
        speechEl.innerText = "That was fun! Let's get back to work.";
        speechEl.classList.add('show');
        
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(checkIdleState, 3000);
    }
}

pet.addEventListener('mousedown', (e) => {
    const currentTime = new Date().getTime();
    if (currentTime - lastTapTime < 300) { triggerAction('hit'); } 
    else { startDrag(e.clientX, e.clientY); }
    lastTapTime = currentTime;
});

document.addEventListener('mouseup', endDrag);

pet.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const currentTime = new Date().getTime();
        if (currentTime - lastTapTime < 300) { triggerAction('hit'); } 
        else { startDrag(touch.clientX, touch.clientY); }
        lastTapTime = currentTime;
    }
}, { passive: true });

document.addEventListener('touchend', endDrag);

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        onDrag(e.clientX, e.clientY);
    } else if (petVisible && document.body.classList.contains('dark')) {
        const rect = pet.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const avatar = document.getElementById('pet-avatar');
        
        if(distance < 400) {
            const tiltX = Math.max(-15, Math.min(15, -(dy / 25))); 
            const tiltY = Math.max(-15, Math.min(15, (dx / 25)));  
            avatar.style.animation = 'none'; 
            avatar.style.transform = `scale(1.05) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        } else {
            avatar.style.transform = ''; 
            checkIdleState(); 
        }
    }
});

document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
        onDrag(e.touches[0].clientX, e.touches[0].clientY); 
    }
}, { passive: true });

function togglePetVisibility() {
    closeAllMenus();

    petVisible = !petVisible;
    safeStorageSet('tyt_v4_pet_visible', petVisible);
    
    const petContainer = document.getElementById('time-pet');
    if (petContainer) {
        petContainer.style.display = petVisible ? 'flex' : 'none';
    }
    const btn = document.getElementById('pet-toggle-btn');
    if (btn) btn.innerText = petVisible ? 'Hide Guardian' : 'Show Guardian';
    
    if (petVisible) {
        triggerAction('switch'); 
    }
}

function applyThemeState(darkMode) {
    isDarkMode = darkMode;
    safeStorageSet('tyt_v4_theme', isDarkMode ? 'dark' : 'light');
    
    closeAllMenus();
    
    const knob = document.getElementById('theme-knob');
    const guardianControls = document.getElementById('guardian-controls');
    const petContainer = document.getElementById('time-pet');

    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        if (knob) {
            knob.style.transform = 'translateX(40px)';
            knob.innerHTML = `<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
        }
        
        if (guardianControls) guardianControls.style.display = 'flex';
        if (petContainer) petContainer.style.display = petVisible ? 'flex' : 'none';
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        if (knob) {
            knob.style.transform = 'translateX(0px)';
            knob.innerHTML = `<svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
        }

        if (guardianControls) guardianControls.style.display = 'none';
        if (petContainer) petContainer.style.display = 'none';
    }
    
    const petToggleBtn = document.getElementById('pet-toggle-btn');
    if (petToggleBtn) petToggleBtn.innerText = petVisible ? 'Hide Guardian' : 'Show Guardian';

    if (typeof updateChartColors === "function") updateChartColors();

    if (currentBgObjectUrl) {
        applyCustomBackground(currentBgObjectUrl);
    }
}

function toggleTheme() { 
    const newIsDark = !isDarkMode;
    
    if (!document.startViewTransition) {
        applyThemeState(newIsDark);
        return;
    }

    document.startViewTransition(() => {
        applyThemeState(newIsDark);
    });
}

async function handleBackgroundUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const blob = new Blob([file], { type: file.type });
    try {
        await saveBg(blob);
        const objectUrl = URL.createObjectURL(blob);
        applyCustomBackground(objectUrl);
        forceCloseBg();
    } catch (err) { alert("Failed to save background. Try again."); } 
    finally { event.target.value = ''; }
}

function applyCustomBackground(url) {
    if (currentBgObjectUrl && currentBgObjectUrl !== url) {
        URL.revokeObjectURL(currentBgObjectUrl);
    }
    currentBgObjectUrl = url;
    if (url) {
        const overlay = isDarkMode ? 'rgba(26, 23, 21, 0.85), rgba(26, 23, 21, 0.95)' : 'rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.6)';
        document.documentElement.style.setProperty('--custom-bg', `linear-gradient(${overlay}), url(${url})`);
        document.documentElement.style.setProperty('--custom-card-bg', isDarkMode ? 'rgba(38, 33, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)');
    } else {
        currentBgObjectUrl = null;
        document.documentElement.style.removeProperty('--custom-bg');
        document.documentElement.style.removeProperty('--custom-card-bg');
    }
}

async function resetBackground() {
    await clearBg();
    applyCustomBackground(null);
    forceCloseBg();
}

function switchChronoTab(tab) {
    const tBtn = document.getElementById('tab-timer');
    const aBtn = document.getElementById('tab-alarms');
    const tWrap = document.getElementById('chrono-display-wrapper');
    const aWrap = document.getElementById('alarm-manager-wrapper');

    tBtn.style.background = 'transparent'; tBtn.style.color = 'var(--text-main)'; tBtn.style.opacity = '0.5';
    aBtn.style.background = 'transparent'; aBtn.style.color = 'var(--text-main)'; aBtn.style.opacity = '0.5';

    if (tab === 'timer') {
        tBtn.style.background = 'var(--accent-main)'; tBtn.style.color = 'white'; tBtn.style.opacity = '1';
        tWrap.classList.remove('hidden');
        tWrap.classList.add('flex');
        aWrap.classList.add('hidden');
        aWrap.classList.remove('flex');
    } else {
        aBtn.style.background = 'var(--accent-main)'; aBtn.style.color = 'white'; aBtn.style.opacity = '1';
        aWrap.classList.remove('hidden');
        aWrap.classList.add('flex');
        tWrap.classList.add('hidden');
        tWrap.classList.remove('flex');
    }
}

let selectedHour = '12';
let selectedMinute = '00';
let selectedAmpm = 'AM';

function createWheel(id, dataList) {
    const wheel = document.getElementById(id);
    if(wheel.childElementCount > 0) return; 
    
    const spacerTop = document.createElement('div');
    spacerTop.className = 'h-[50px] shrink-0 pointer-events-none';
    wheel.appendChild(spacerTop);

    dataList.forEach(val => {
        const div = document.createElement('div');
        div.className = 'wheel-item val h-[40px] shrink-0 flex items-center justify-center snap-center text-2xl font-800 text-muted transition-all duration-200 cursor-pointer';
        div.dataset.val = val;
        div.innerText = val;
        
        div.onclick = () => {
            const idx = dataList.indexOf(val);
            wheel.scrollTo({ top: idx * 40, behavior: 'smooth' });
        };
        wheel.appendChild(div);
    });

    const spacerBot = document.createElement('div');
    spacerBot.className = 'h-[50px] shrink-0 pointer-events-none';
    wheel.appendChild(spacerBot);
    
    wheel.addEventListener('scroll', () => {
        clearTimeout(wheel.scrollTimeout);
        wheel.scrollTimeout = setTimeout(() => updateWheelSelection(id, dataList), 50);
    });
}

function updateWheelSelection(id, dataList) {
    const wheel = document.getElementById(id);
    const index = Math.round(wheel.scrollTop / 40);
    const items = wheel.querySelectorAll('.wheel-item.val');
    
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('text-[#df7b54]', 'scale-110');
            item.classList.remove('text-muted');
            if (id === 'wheel-hour') selectedHour = item.dataset.val;
            if (id === 'wheel-minute') selectedMinute = item.dataset.val;
            if (id === 'wheel-ampm') selectedAmpm = item.dataset.val;
        } else {
            item.classList.remove('text-[#df7b54]', 'scale-110');
            item.classList.add('text-muted');
        }
    });
}

function populateTimeSelectors() {
    const hours = Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0'));
    const mins = Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0'));
    const ampm = ['AM', 'PM'];
    
    createWheel('wheel-hour', hours);
    createWheel('wheel-minute', mins);
    createWheel('wheel-ampm', ampm);
}

function setWheelTo(id, value) {
    const wheel = document.getElementById(id);
    const items = wheel.querySelectorAll('.wheel-item.val');
    let index = 0;
    items.forEach((item, i) => {
        if (item.dataset.val === value) index = i;
    });
    
    wheel.scrollTop = index * 40;
    
    setTimeout(() => {
        const event = new Event('scroll');
        wheel.dispatchEvent(event);
    }, 10);
}

function openSetAlarmModal(alarmId = null) {
    populateTimeSelectors();
    editingAlarmId = alarmId;
    
    if (alarmId) {
        const al = alarmsList.find(a => a.id === alarmId);
        let timeStr = al.displayTime || formatTo12h(al.time);
        let [timePart, ampm] = timeStr.split(' ');
        let [h, m] = timePart.split(':');
        
        setWheelTo('wheel-hour', h);
        setWheelTo('wheel-minute', m);
        setWheelTo('wheel-ampm', ampm);
    } else {
        const now = new Date();
        let h = now.getHours();
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if(h === 0) h = 12;
        let m = now.getMinutes();
        
        setWheelTo('wheel-hour', h.toString().padStart(2, '0'));
        setWheelTo('wheel-minute', m.toString().padStart(2, '0'));
        setWheelTo('wheel-ampm', ampm);
    }

    openModal('set-alarm-modal');
}

function closeSetAlarmModal() {
    editingAlarmId = null;
    closeModalById('set-alarm-modal');
}

function saveCustomAlarmData() {
    const hour = selectedHour;
    const minute = selectedMinute;
    const ampm = selectedAmpm;
    const labelVal = 'Alarm';
    
    let hr24 = parseInt(hour, 10);
    if (ampm === "PM" && hr24 !== 12) hr24 += 12;
    if (ampm === "AM" && hr24 === 12) hr24 = 0;
    
    const internalTime = hr24.toString().padStart(2, '0') + ':' + minute;
    const displayTime = `${hour}:${minute} ${ampm}`;
    
    if (editingAlarmId) {
        const al = alarmsList.find(a => a.id === editingAlarmId);
        if (al) {
            al.time = internalTime;
            al.displayTime = displayTime;
            al.label = labelVal;
            al.active = true;
            al.lastTriggered = "";
            al.snoozeTime = null;
        }
        editingAlarmId = null;
    } else {
        alarmsList.push({ id: Date.now(), time: internalTime, displayTime: displayTime, label: labelVal, active: true, lastTriggered: "", snoozeTime: null });
    }
    
    safeStorageSet('tyt_v4_alarms_list', JSON.stringify(alarmsList));
    
    renderAlarms();
    closeSetAlarmModal();
    showReaction("Alarm set and ready! ⏰", "anim-bounce");
}

function snoozeActiveAlarm() {
    if (currentRingingAlarmId) {
        const al = alarmsList.find(a => a.id === currentRingingAlarmId);
        if (al) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 10);
            const snoozeHm = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
            al.snoozeTime = snoozeHm;
            safeStorageSet('tyt_v4_alarms_list', JSON.stringify(alarmsList));
            showReaction("Alarm snoozed for 10 minutes! 😴", "anim-breathe");
        }
    }
    stopActiveAlarm();
}

function formatTo12h(timeStr) {
    if (!timeStr) return "";
    let [h, m] = timeStr.split(':');
    h = parseInt(h, 10);
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

function renderAlarms() {
    const container = document.getElementById('alarm-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    if(alarmsList.length === 0) {
        container.innerHTML = '<p class="text-center text-muted mt-10 text-sm font-bold">No alarms set. Add one above!</p>';
        return;
    }

    alarmsList.forEach(al => {
        const displayStr = al.displayTime || formatTo12h(al.time);
        const div = document.createElement('div');
        div.className = "app-subcard p-4 rounded-2xl flex justify-between items-center transition-all hover:scale-[1.01]";
        div.innerHTML = `
            <div>
                <h4 class="text-2xl font-800 ${al.active ? 'text-[#df7b54]' : 'textmuted'}">${displayStr}</h4>
                <p class="text-[10px] text-muted uppercase font-bold tracking-widest mt-1">${escapeHTML(al.label)}</p>
            </div>
            <div class="flex items-center gap-2 sm:gap-3">
                <input type="checkbox" ${al.active ? 'checked' : ''} onchange="toggleAlarm(${al.id}, this.checked)" class="w-6 h-6 rounded-md accent-[#df7b54] cursor-pointer">
                <button onclick="openSetAlarmModal(${al.id})" class="app-subcard w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-blue-400 hover:opacity-70 transition-opacity border-[var(--border-color)]">✏️</button>
                <button onclick="deleteAlarm(${al.id})" class="app-subcard w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-[#e65c5c] hover:opacity-70 transition-opacity border-[var(--border-color)]">✕</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleAlarm(id, state) {
    const al = alarmsList.find(a => a.id === id);
    if(al) al.active = state;
    safeStorageSet('tyt_v4_alarms_list', JSON.stringify(alarmsList));
    renderAlarms();
}

function deleteAlarm(id) {
    alarmsList = alarmsList.filter(a => a.id !== id);
    safeStorageSet('tyt_v4_alarms_list', JSON.stringify(alarmsList));
    renderAlarms();
}

function startStopwatch(btnElement) {
    if (btnElement && btnElement.style.background === 'var(--accent-main)') { stopTimer(); return; }
    clearInterval(timerInterval);
    isStopwatchActive = true;
    stopwatchSecs = 0;
    
    isFocusing = true;
    triggerAction('study_start');
    
    document.querySelectorAll('.timer-btn').forEach(b => {
        b.style.background = 'var(--sub-bg)';
        b.style.color = 'var(--text-main)';
    });

    if (btnElement) {
        btnElement.style.background = 'var(--accent-main)';
        btnElement.style.color = 'white';
    }

    timerInterval = setInterval(() => {
        stopwatchSecs++;
        const h = Math.floor(stopwatchSecs / 3600);
        const m = Math.floor((stopwatchSecs % 3600) / 60); 
        const s = stopwatchSecs % 60;
        
        let display = "";
        if (h > 0) {
            display = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } else {
            display = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        
        document.getElementById('timer-display').innerText = display;
    }, 1000);
}

function startTimer(mins, btnElement) {
    if (btnElement && btnElement.style.background === 'var(--accent-main)') { stopTimer(); return; }
    clearInterval(timerInterval);
    isStopwatchActive = false; 
    currentTimerMins = mins;
    let secs = mins * 60;
    
    isFocusing = true;
    triggerAction('study_start');
    
    document.querySelectorAll('.timer-btn').forEach(b => {
        b.style.background = 'var(--sub-bg)';
        b.style.color = 'var(--text-main)';
    });

    if (btnElement) {
        btnElement.style.background = 'var(--accent-main)';
        btnElement.style.color = 'white';
    }

    timerInterval = setInterval(() => {
        secs--;
        const m = Math.floor(secs / 60); const s = secs % 60;
        document.getElementById('timer-display').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        if (secs <= 0) {
            clearInterval(timerInterval);
            isFocusing = false;
            triggerAction('study_stop');
            
            const block = getCurrentTimeBlock();
            todayStats.focusTime[block] += mins; 
            todayStats.totalFocusMins += mins;
            
            if (isAutoEnergy) {
                const currentEnergy = parseFloat(document.getElementById('energy-slider').value);
                let energyChange = 0;
                if (btnElement && btnElement.dataset.type === 'break') {
                    energyChange = 2.5; 
                } else if (mins === 25) {
                    energyChange = -1.5; 
                } else if (mins === 50) {
                    energyChange = -3.5; 
                }
                updateEnergyValue(currentEnergy + energyChange);
            }
            
            saveStats(); updateTrendChart(); stopTimer(); 
            showAlarmModal("Focus session complete! 🎯");
            
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Track Your Time", { body: "Focus session complete! 🎯" });
            }
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    
    if (isStopwatchActive) {
        const loggedMins = Math.floor(stopwatchSecs / 60);
        if (loggedMins > 0) {
            const block = getCurrentTimeBlock();
            todayStats.focusTime[block] += loggedMins; 
            todayStats.totalFocusMins += loggedMins;
            
            if (isAutoEnergy) {
                const currentEnergy = parseFloat(document.getElementById('energy-slider').value);
                let energyChange = -(loggedMins / 25) * 1.5; 
                updateEnergyValue(currentEnergy + energyChange);
            }
            saveStats(); updateTrendChart();
            alert(`Stopwatch stopped: ${loggedMins} minutes added to your daily focus time!`);
        }
        isStopwatchActive = false;
    }

    document.getElementById('timer-display').innerText = `${currentTimerMins.toString().padStart(2, '0')}:00`;
    document.querySelectorAll('.timer-btn').forEach(b => {
        b.style.background = 'var(--sub-bg)';
        b.style.color = 'var(--text-main)';
    });
    if (isFocusing) {
        isFocusing = false;
        triggerAction('study_stop');
    }
}

function startEyeRestTimer() {
    if (eyeInterval) clearInterval(eyeInterval);
    let secs = 1200;
    const eyeTimerEl = document.getElementById('eye-timer');
    const eyeCardEl = eyeTimerEl ? eyeTimerEl.parentElement : null; 

    eyeInterval = setInterval(() => {
        secs--;
        const m = Math.floor(secs / 60); const s = secs % 60;
        if(eyeTimerEl) eyeTimerEl.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        
        if(secs <= 0) {
            triggerAction('eyes');
            if(eyeCardEl) {
                eyeCardEl.style.transition = "background 0.5s ease";
                eyeCardEl.style.background = 'rgba(102, 156, 109, 0.6)';
                setTimeout(() => eyeCardEl.style.background = 'rgba(102, 156, 109, 0.1)', 1000);
                setTimeout(() => eyeCardEl.style.background = 'rgba(102, 156, 109, 0.6)', 2000);
                setTimeout(() => eyeCardEl.style.background = 'rgba(102, 156, 109, 0.1)', 3000);
            }

            showAlarmModal("👀 20-20-20 Rule: Time to rest your eyes!");
            
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Track Your Time", { body: "👀 20-20-20 Rule: Time to rest your eyes!" });
            }
            
            secs = 1200; 
        }
    }, 1000);
}

function showAlarmModal(text) {
    document.getElementById('active-alarm-label').innerText = text;
    openModal('active-alarm-modal');
    playAlarmLoop();
    
    if ("Notification" in window && Notification.permission === "granted" && text.includes("Alarm")) {
        new Notification("Track Your Time", { body: text });
    }
}

function playMessageTone() {
    const toneType = localStorage.getItem('tyt_v4_message_tone') || 'pop';
    
    if (toneType === 'none') return;
    
    if (toneType.startsWith('custom_msg_') || toneType === 'custom') {
        const fetchId = toneType === 'custom' ? 'customMessageBlob' : toneType;
        initDB().then(db => {
            const tx = db.transaction('audioStore', 'readonly');
            const store = tx.objectStore('audioStore');
            const req = store.get(fetchId);
            req.onsuccess = () => {
                if(req.result) {
                    if (currentMessageAudioUrl) URL.revokeObjectURL(currentMessageAudioUrl);
                    currentMessageAudioUrl = URL.createObjectURL(req.result);
                    
                    if(currentMessageAudio) currentMessageAudio.pause();
                    
                    currentMessageAudio = new Audio(currentMessageAudioUrl);
                    currentMessageAudio.play().catch(() => {});
                } else {
                    startSynthMessage('pop');
                }
            };
            req.onerror = () => startSynthMessage('pop');
        }).catch(() => startSynthMessage('pop'));
        return;
    }
    startSynthMessage(toneType);
}

function startSynthMessage(type) {
    initAudioContext();
    if(!audioCtx) return;

    if (type === 'chime') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = 1046.50; 
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 1);
    } else { 
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.1);
    }
}

function playAlarmLoop() {
    stopActiveAlarm(true); 

    const alarmType = localStorage.getItem('tyt_v4_alarm') || 'classic';
    
    if (alarmType.startsWith('custom_alarm_') || alarmType === 'custom') {
        const fetchId = alarmType === 'custom' ? 'customAlarmBlob' : alarmType;
        initDB().then(db => {
            const tx = db.transaction('audioStore', 'readonly');
            const store = tx.objectStore('audioStore');
            const req = store.get(fetchId);
            req.onsuccess = () => {
                if(req.result) {
                    if(currentCustomAudioUrl) URL.revokeObjectURL(currentCustomAudioUrl);
                    currentCustomAudioUrl = URL.createObjectURL(req.result);
                    
                    if(currentCustomAudio) currentCustomAudio.pause();
                    
                    currentCustomAudio = new Audio(currentCustomAudioUrl);
                    currentCustomAudio.loop = true; 
                    currentCustomAudio.play().catch(() => {});
                } else {
                    startSynthLoop('classic');
                }
            };
            req.onerror = () => startSynthLoop('classic');
        }).catch(() => startSynthLoop('classic'));
        return;
    }

    startSynthLoop(alarmType);
}

function startSynthLoop(type) {
    initAudioContext();
    if(!audioCtx) return;

    if (type === 'marimba') {
        const notes = [659.25, 783.99, 880.00, 1046.50, 783.99, 0, 659.25, 0];
        let step = 0;
        const playPluck = (freq) => {
            if(freq === 0) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.4);
        };
        playPluck(notes[0]); step++;
        activeAlarmInterval = setInterval(() => {
            playPluck(notes[step % notes.length]); step++;
        }, 200);
    } else if (type === 'soft') {
        const chords = [ [261.63, 329.63, 392.00], [261.63, 349.23, 440.00] ];
        let step = 0;
        const playChord = (chord) => {
            chord.forEach(freq => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle'; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 1);
                gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 3);
            });
        };
        playChord(chords[0]); step++;
        activeAlarmInterval = setInterval(() => {
            playChord(chords[step % chords.length]); step++;
        }, 3000);
    } else if (type === 'urgent') {
        let step = 0;
        const playBeep = () => {
            if (step % 8 < 6) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square'; osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.1);
            }
            step++;
        };
        playBeep();
        activeAlarmInterval = setInterval(playBeep, 150);
    } else {
        let step = 0;
        const playBeep = () => {
            if (step % 6 < 4) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine'; osc.frequency.value = 1000;
                gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.1);
            }
            step++;
        };
        playBeep();
        activeAlarmInterval = setInterval(playBeep, 200);
    }
}

function stopActiveAlarm(onlySound = false) {
    if(activeAlarmInterval) {
        clearInterval(activeAlarmInterval);
        activeAlarmInterval = null;
    }
    if(typeof currentCustomAudio !== 'undefined' && currentCustomAudio) {
        currentCustomAudio.pause();
        currentCustomAudio.currentTime = 0;
    }
    if(!onlySound) {
        closeModalById('active-alarm-modal');
        currentRingingAlarmId = null;
    }
}

function addWater() {
    waterCount = Math.min(waterCount + 1, 8);
    document.getElementById('water-count').innerText = waterCount;
    safeStorageSet('tyt_v4_water_daily', JSON.stringify({ date: todayDateString, count: waterCount }));
    
    if(isAutoEnergy) {
        const currentEnergy = parseFloat(document.getElementById('energy-slider').value);
        updateEnergyValue(currentEnergy + 0.5); 
    }

    if(waterCount === 8) {
        showReaction("You're a hydration legend! 🌊", "anim-bounce", { emoji: ['🌊','🏆'], class: 'floatUp', count: 3 });
    } else {
        triggerAction('water');
    }
}

function renderTimeline() {
    const container = document.getElementById('timeline-slots');
    if (!container) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    SLOTS.forEach(time => {
        const data = appData[time] || { text: "", done: false };
        const textDecoration = data.done ? 'line-through opacity-40' : '';
        const div = document.createElement('div');
        div.className = "app-subcard flex items-center gap-3 sm:gap-5 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] transition-all group";
        div.innerHTML = `
            <span class="text-muted w-16 sm:w-24 text-[9px] sm:text-[10px] font-800 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-tighter flex-shrink-0">${time}</span>
            <input type="text" onblur="saveTask('${time}', 'text', this.value)" 
                   value="${escapeHTML(data.text)}" placeholder="Plan your move..." 
                   class="flex-grow bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent focus:bg-transparent font-bold text-xs sm:text-sm min-w-[100px] shadow-none ${textDecoration}"
                   style="background-color: transparent !important; box-shadow: none !important;">
            <input type="checkbox" ${data.done ? 'checked' : ''} onchange="saveTask('${time}', 'done', this.checked)"
                   class="custom-checkbox w-6 h-6 rounded-[0.4rem] border-2 border-[#df7b54]/50 bg-black/60 checked:bg-[#df7b54] checked:border-[#df7b54] focus:outline-none hover:shadow-[0_0_12px_rgba(223,123,84,0.6)] checked:shadow-[0_0_15px_rgba(223,123,84,0.8)] transition-all duration-300 cursor-pointer flex-shrink-0">
        `;
        frag.appendChild(div);
    });
    container.appendChild(frag);
}

function saveTask(time, key, val) {
    if (!appData[time]) appData[time] = { text: "", done: false };
    appData[time][key] = val;
    
    safeStorageSet('tyt_v4_data_daily', JSON.stringify({ date: todayDateString, data: appData }));
    safeStorageSet('tyt_v4_data', JSON.stringify(appData)); 
    
    updateStats();
}

function updateStats() {
    const entries = Object.values(appData).filter(t => t && typeof t.text === 'string' && t.text.trim());
    const doneCount = entries.filter(t => t.done).length;
    const pct = entries.length > 0 ? Math.round((doneCount / entries.length) * 100) : 0;
    const pulsePct = document.getElementById('pulse-pct');
    if (pulsePct) pulsePct.innerText = pct + '%';
    if (pulseChart) {
        pulseChart.data.datasets[0].data = [doneCount, Math.max(0.1, entries.length - doneCount)];
        pulseChart.update();
    }
}

function getCurrentTimeBlock() {
    const hour = new Date().getHours();
    if (hour < 11) return '08'; if (hour < 14) return '11';
    if (hour < 17) return '14'; if (hour < 20) return '17';
    if (hour < 23) return '20'; return '23';
}

function saveStats() { safeStorageSet('tyt_v4_stats_daily', JSON.stringify({ date: todayDateString, stats: todayStats })); }

function openHistory() {
    closeAllMenus();

    const list = document.getElementById('history-list');
    list.innerHTML = ''; 
    
    const fragment = document.createDocumentFragment();
    
    if (progressHistory.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = "text-center text-muted mt-10";
        emptyMsg.innerText = "No history yet! Complete a day to see it here.";
        fragment.appendChild(emptyMsg);
    } else {
        progressHistory.slice().reverse().forEach((record) => {
            const item = document.createElement('div');
            item.className = "app-subcard p-5 rounded-2xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform duration-300";
            item.onclick = () => openDayDetails(record.date, 'history');
            
            const notesCount = notebook.filter(n => n.dateString === record.date && ((n.text && n.text.trim() !== "") || (n.title && n.title.trim() !== ""))).length;
            const hasNotesIcon = notesCount > 0 ? `<span title="Contains Notes" class="text-xs font-bold text-[#df7b54] ml-1 bg-[#df7b54]/20 px-2 py-0.5 rounded-full">📝 ${notesCount}</span>` : "";

            item.innerHTML = `
                <div class="flex justify-between items-center mb-3 pointer-events-none">
                    <span class="font-800">${record.date}</span>
                    <span class="px-3 py-1 bg-[#df7b54]/20 text-[#df7b54] rounded-full text-[10px] font-bold uppercase">${record.taskPct} Done</span>
                </div>
                <div class="flex gap-4 text-xs font-600 text-muted pointer-events-none items-center">
                    <span>⏱️ ${record.focusTime}</span>
                    <span>⚡ ${record.avgEnergy}/10</span>
                    <span>💧 ${record.water}/8</span>
                    ${hasNotesIcon}
                </div>
            `;
            fragment.appendChild(item);
        });
    }
    
    list.appendChild(fragment);
    openModal('history-modal');
}

function closeHistory() { closeModalById('history-modal'); }

function openDayDetails(dateString, source = 'history') {
    const record = progressHistory.find(r => r.date === dateString);
    if (!record) return;

    dayDetailsSource = source; 
    currentOpenHistoryDate = dateString; 

    if (source === 'history') closeModalById('history-modal');
    else if (source === 'calendar') closeModalById('calendar-modal');
    
    document.getElementById('detail-date-title').innerText = record.date;
    document.getElementById('detail-task-pct').innerText = record.taskPct;

    const scheduleList = document.getElementById('detail-schedule-list');
    scheduleList.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    const savedTasks = record.tasks || {}; 
    
    SLOTS.forEach(time => {
        const data = savedTasks[time];
        if (data && data.text.trim() !== "") {
            const statusIcon = data.done ? '✅' : '⏳';
            const textStyle = data.done ? 'line-through opacity-50' : '';
            
            const div = document.createElement('div');
            div.className = "app-subcard flex gap-4 items-center p-3 rounded-xl";
            div.innerHTML = `
                <span class="w-16 text-[10px] font-800 text-muted uppercase">${time}</span>
                <span class="flex-grow font-bold text-sm ${textStyle}">${escapeHTML(data.text)}</span>
                <span>${statusIcon}</span>
            `;
            fragment.appendChild(div);
        }
    });

    if(fragment.childNodes.length === 0) {
        const p = document.createElement('p');
        p.className = "text-sm text-muted italic";
        p.innerText = "No tasks logged for this day.";
        fragment.appendChild(p);
    }
    scheduleList.appendChild(fragment);

    renderHistoryNotes(dateString);

    const savedGraph = record.graphStats || { focusTime: {}, energyLogs: {} };
    if (detailTrendChart) {
        detailTrendChart.data.datasets[0].data = Object.values(savedGraph.focusTime || { '08': 0, '11': 0, '14': 0, '17': 0, '20': 0, '23': 0 });
        detailTrendChart.data.datasets[1].data = Object.values(savedGraph.energyLogs || { '08': 7, '11': 7, '14': 7, '17': 7, '20': 7, '23': 7 }).map(v => v * 10);
        detailTrendChart.update();
    }

    const doneCount = Object.values(savedTasks).filter(t => t.text && t.done).length;
    const plannedCount = Object.values(savedTasks).filter(t => t.text).length;
    if (detailPulseChart) {
        detailPulseChart.data.datasets[0].data = [doneCount, Math.max(0.1, plannedCount - doneCount)];
        detailPulseChart.update();
    }

    setTimeout(() => { openModal('day-details-modal'); }, 50);
}

function closeDayDetails() {
    closeModalById('day-details-modal');
    
    if (dayDetailsSource === 'history') {
        setTimeout(() => { openModal('history-modal'); }, 50);
    } else if (dayDetailsSource === 'calendar') {
        setTimeout(() => { openModal('calendar-modal'); }, 50);
    }
}

function showEndOfDay() {
    const entries = Object.values(appData).filter(t => t.text.trim());
    const doneCount = entries.filter(t => t.done).length;
    const taskPct = entries.length > 0 ? Math.round((doneCount / entries.length) * 100) : 0;
    
    const energies = Object.values(todayStats.energyLogs);
    const avgEnergy = Math.round(energies.reduce((a,b) => a+b, 0) / energies.length);
    
    document.getElementById('modal-task-pct').innerText = taskPct + '%';
    document.getElementById('modal-focus-time').innerText = todayStats.totalFocusMins + ' min';
    document.getElementById('modal-avg-energy').innerText = avgEnergy + '/10';
    
    openModal('end-of-day-modal');
}

function closeModal() {
    const taskPctStr = document.getElementById('modal-task-pct').innerText;
    const focusTimeStr = document.getElementById('modal-focus-time').innerText;
    const avgEnergyStr = document.getElementById('modal-avg-energy').innerText.split('/')[0];
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const savePayload = {
        date: todayStr, taskPct: taskPctStr, focusTime: focusTimeStr,
        avgEnergy: avgEnergyStr, water: waterCount,
        tasks: JSON.parse(JSON.stringify(appData)), graphStats: JSON.parse(JSON.stringify(todayStats)) 
    };

    const existingIndex = progressHistory.findIndex(record => record.date === todayStr);
    if (existingIndex >= 0) { progressHistory[existingIndex] = savePayload; } 
    else { progressHistory.push(savePayload); }
    
    safeStorageSet('tyt_v4_history', JSON.stringify(progressHistory));
    
    triggerAction('streak');
    closeModalById('end-of-day-modal');
}

function cancelModal() { closeModalById('end-of-day-modal'); }

function exportData() {
    const dataToExport = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('tyt_v4_')) {
            dataToExport[key] = localStorage.getItem(key);
        }
    }
    
    const dataStr = JSON.stringify(dataToExport);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `TYT_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showReaction("Backup saved to your device! 💾", "anim-bounce");
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            let count = 0;
            for (const key in importedData) {
                if (key.startsWith('tyt_v4_')) {
                    localStorage.setItem(key, importedData[key]);
                    count++;
                }
            }
            if (count > 0) {
                alert("Data restored successfully! The app will now reload.");
                window.location.reload();
            } else {
                alert("No valid data found in this file.");
            }
        } catch (err) {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

function initCharts() {
    const pCanvas = document.getElementById('pulseChart'); const tCanvas = document.getElementById('trendChart');
    const dpCanvas = document.getElementById('detailPulseChart'); const dtCanvas = document.getElementById('detailTrendChart');
    if (!pCanvas || !tCanvas || typeof Chart === 'undefined') return;

    const pCtx = pCanvas.getContext('2d'); const tCtx = tCanvas.getContext('2d');
    const dpCtx = dpCanvas ? dpCanvas.getContext('2d') : null; const dtCtx = dtCanvas ? dtCanvas.getContext('2d') : null;

    const pulseConfig = {
        type: 'doughnut',
        data: { labels: ['Done', 'Planned'], datasets: [{ data: [0, 1], backgroundColor: ['#df7b54', 'rgba(0,0,0,0.05)'], borderWidth: 0, hoverOffset: 15 }] },
        options: { cutout: '85%', maintainAspectRatio: false, plugins: { legend: { display: false } } }
    };

    const trendConfig = {
        type: 'line',
        data: {
            labels: ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00'],
            datasets: [
                { label: 'Focus Time (min)', data: [0, 0, 0, 0, 0, 0], borderColor: '#df7b54', backgroundColor: 'rgba(223, 123, 84, 0.1)', fill: true, tension: 0.45, pointRadius: 0 },
                { label: 'Energy', data: [70, 70, 70, 70, 70, 70], borderColor: '#669c6d', borderDash: [5, 5], tension: 0.45, pointRadius: 0 }
            ]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false, beginAtZero: true }, x: { grid: { display: false }, ticks: { font: { weight: '800', size: 9 }, color: '#df7b54' } } } }
    };

    pulseChart = new Chart(pCtx, JSON.parse(JSON.stringify(pulseConfig)));
    trendChart = new Chart(tCtx, JSON.parse(JSON.stringify(trendConfig)));
    if (dpCtx) detailPulseChart = new Chart(dpCtx, JSON.parse(JSON.stringify(pulseConfig)));
    if (dtCtx) detailTrendChart = new Chart(dtCtx, JSON.parse(JSON.stringify(trendConfig)));
    
    updateChartColors(); updateTrendChart(); 
}

function updateChartColors() {
    if (!pulseChart || !trendChart) return;
    const color = '#f5f3f0'; const pulseEmpty = isDarkMode ? '#1a1715' : 'rgba(0,0,0,0.3)';
    
    pulseChart.data.datasets[0].backgroundColor[1] = pulseEmpty;
    trendChart.options.scales.x.ticks.color = color;
    
    if (detailPulseChart && detailTrendChart) {
        detailPulseChart.data.datasets[0].backgroundColor[1] = pulseEmpty;
        detailTrendChart.options.scales.x.ticks.color = color;
        detailPulseChart.update(); detailTrendChart.update();
    }
    pulseChart.update(); trendChart.update();
}

function updateTrendChart() {
    if (!trendChart) return;
    const dayBtn = document.getElementById('view-day');
    if(dayBtn && dayBtn.style.background === 'var(--accent-main)') {
        trendChart.data.datasets[0].data = Object.values(todayStats.focusTime);
        trendChart.data.datasets[1].data = Object.values(todayStats.energyLogs).map(v => v * 10); 
        trendChart.update();
    }
}

function getHistoryWithToday() {
    const combined = progressHistory.map(r => ({
        date: r.date,
        focusMins: parseInt(r.focusTime) || 0,
        avgEnergy: parseFloat(r.avgEnergy) || 0
    }));

    const alreadyLogged = combined.some(r => r.date === todayDateString);
    if (!alreadyLogged) {
        const energies = Object.values(todayStats.energyLogs);
        const liveAvgEnergy = energies.length ? (energies.reduce((a, b) => a + b, 0) / energies.length) : 0;
        combined.push({ date: todayDateString, focusMins: todayStats.totalFocusMins || 0, avgEnergy: liveAvgEnergy });
    }

    combined.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (isNaN(da) || isNaN(db)) return 0;
        return da - db;
    });

    return combined;
}

function getWeekPerformanceData() {
    const days = getHistoryWithToday().slice(-7);
    return {
        labels: days.map(d => (d.date.split(',')[0] || d.date).trim()),
        focusData: days.map(d => d.focusMins),
        energyData: days.map(d => Math.round(d.avgEnergy * 10))
    };
}

function getMonthPerformanceData() {
    const days = getHistoryWithToday().slice(-28);
    if (days.length === 0) {
        return { labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'], focusData: [0, 0, 0, 0], energyData: [0, 0, 0, 0] };
    }
    const bucketCount = Math.min(4, Math.ceil(days.length / 7));
    const bucketSize = Math.ceil(days.length / bucketCount);
    const labels = [], focusData = [], energyData = [];
    for (let i = 0; i < bucketCount; i++) {
        const bucket = days.slice(i * bucketSize, (i + 1) * bucketSize);
        if (bucket.length === 0) continue;
        const totalFocus = bucket.reduce((sum, d) => sum + d.focusMins, 0);
        const avgEnergy = bucket.reduce((sum, d) => sum + d.avgEnergy, 0) / bucket.length;
        labels.push(`Wk ${i + 1}`);
        focusData.push(totalFocus);
        energyData.push(Math.round(avgEnergy * 10));
    }
    return { labels, focusData, energyData };
}

function switchView(view) {
    if (!trendChart) return;
    const views = ['day', 'week', 'month'];
    views.forEach(v => {
        const btn = document.getElementById('view-' + v);
        if (btn) { btn.style.background = "transparent"; btn.style.color = "inherit"; }
    });
    const activeBtn = document.getElementById('view-' + view);
    if (activeBtn) { activeBtn.style.background = "var(--accent-main)"; activeBtn.style.color = "white"; }

    if(view === 'day') {
        trendChart.data.labels = ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00'];
        updateTrendChart(); 
    } else if(view === 'week') {
        const { labels, focusData, energyData } = getWeekPerformanceData();
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = focusData;
        trendChart.data.datasets[1].data = energyData;
        trendChart.update();
    } else {
        const { labels, focusData, energyData } = getMonthPerformanceData();
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = focusData;
        trendChart.data.datasets[1].data = energyData;
        trendChart.update();
    }
}