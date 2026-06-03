// mini-distracting.js
// ==========================================
// CONFIG & STATE GLOBAL
// ==========================================
const IMAGE_BACKGROUND_URL = "https://i.ibb.co.com/0pspwjWz/not-mine.jpg";

let currentUser = "";
let userProfileData = { total_xp: 0, current_streak: 0 };
let poppedBubbles = 0;
let gameInterval = null;
let gameScore = 0;
let isGameRunning = false;
let canvas = null;
let ctx = null;
let isDrawing = false;

// Preloaded audio cache (coin, bubble, whack)
const SFX = {};
function preloadSfx(key, src, volume = 1) {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.preload = "auto";
    SFX[key] = audio;
}

function playSfx(key) {
    Object.values(SFX).forEach(a => {
        try {
            a.pause();
            a.currentTime = 0;
        } catch (e) {}
    });

    const audio = SFX[key];
    if (!audio) return;
    try {
        audio.play().catch(() => {});
    } catch (e) {}
}

// Vibration helper
function vibrate(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// ==========================================
// ENTRY POINT (KHUSUS MINI DISTRACTING PAGE)
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    preloadSfx("coinFlip",  "sounds/freesound_community-coin-flip-37787.mp3", 0.8);
    preloadSfx("bubblePop", "sounds/soundreality-pop-423717.mp3",             0.7);
    preloadSfx("hitTok",    "sounds/chieuk-coin-257878.mp3",                  0.8);

    const savedUser = localStorage.getItem('tss_logged_user');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = savedUser;

    const displaySpan = document.getElementById('user-display');
    if (displaySpan) {
        displaySpan.innerText = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
    }

    await syncUserSession();
    await loadMoodAnalytics();

    setTimeout(() => {
        initSandCanvas();
        generateBubbleWrap();
        setupWhackGrid();
    }, 300);
});

function goBackHome() {
    window.location.href = 'index.html';
}

function triggerFullReset() {
    if (confirm("Logout dan reset sesi?")) {
        localStorage.removeItem('tss_logged_user');
        window.location.href = 'index.html';
    }
}

// ==========================================
// DATA SYNC & XP (Supabase)
// ==========================================
function updateDashboardDOM() {
    if (userProfileData) {
        const xpEl = document.getElementById('xp-val');
        const streakEl = document.getElementById('streak-val');
        if (xpEl) xpEl.innerText = `+${userProfileData.total_xp} XP`;
        if (streakEl) streakEl.innerText = `${userProfileData.current_streak} Days 🔥`;
    }
}

async function syncUserSession() {
    if (typeof supabase === 'undefined' || !window.db) return;

    const { data: profile, error } = await db
        .from('user_profiles')
        .select('*')
        .eq('username', currentUser)
        .single();

    if (error) {
        console.error('Failed to load user profile:', error);
        return;
    }

    if (profile) {
        userProfileData = profile;
        updateDashboardDOM();
    }
}

async function updateXP(amount) {
    if (!userProfileData) return;
    userProfileData.total_xp += amount;
    updateDashboardDOM();

    if (typeof supabase !== 'undefined' && window.db) {
        const { error } = await db
            .from('user_profiles')
            .update({ total_xp: userProfileData.total_xp })
            .eq('username', currentUser);

        if (error) {
            console.error('Failed to update XP:', error);
        }
    }
}

// Simpan mood hari ini
async function saveMood(score) {
    const todayEl = document.getElementById('mood-today');
    if (todayEl) todayEl.innerText = `${score}%`;

    const todayStr = new Date().toISOString().split('T')[0];

    await updateXP(10);

    if (typeof supabase !== 'undefined' && window.db) {
        const { error } = await db
            .from('daily_logs')
            .upsert(
                {
                    username: currentUser,
                    log_date: todayStr,
                    mood_score: score
                },
                { onConflict: 'username,log_date' }
            );

        if (error) {
            console.error('Failed to save mood:', error);
            alert('Mood gagal disimpan, cek console.');
            return;
        }
    }

    await loadMoodAnalytics();
    confetti({ particleCount: 30, spread: 30 });
}

// Hitung Today / 7-Day Avg / Streak
async function loadMoodAnalytics() {
    if (typeof supabase === 'undefined' || !window.db) return;

    const { data: logs, error } = await db
        .from('daily_logs')
        .select('log_date, mood_score')
        .eq('username', currentUser)
        .order('log_date', { ascending: false })
        .limit(7);

    const todayEl = document.getElementById('mood-today');
    const avgEl = document.getElementById('mood-avg-7');
    const streakEl = document.getElementById('streak-val');

    if (error) {
        console.error('Failed to load mood analytics:', error);
        if (todayEl) todayEl.innerText = '-';
        if (avgEl) avgEl.innerText = '-';
        if (streakEl) streakEl.innerText = '0 Days 🔥';
        return;
    }

    if (!logs || logs.length === 0) {
        if (todayEl) todayEl.innerText = '-';
        if (avgEl) avgEl.innerText = '-';
        if (streakEl) streakEl.innerText = '0 Days 🔥';
        userProfileData.current_streak = 0;
        updateDashboardDOM();
        return;
    }

    // Today Mood = log paling baru
    const latest = logs[0];
    if (todayEl) todayEl.innerText = `${latest.mood_score}%`;

    // 7-Day Avg
    const avg = Math.round(
        logs.reduce((sum, l) => sum + (l.mood_score || 0), 0) / logs.length
    );
    if (avgEl) avgEl.innerText = `${avg}%`;

    // --- Hitung streak ---
    const sortedAsc = [...logs].sort(
        (a, b) => new Date(a.log_date) - new Date(b.log_date)
    );

    const today = new Date();
    const todayDateOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    let streak = 0;
    let curCheck = new Date(todayDateOnly);

    while (true) {
        const curStr = curCheck.toISOString().split('T')[0];
        const found = sortedAsc.some(l => l.log_date === curStr);

        if (found) {
            streak++;
            curCheck.setDate(curCheck.getDate() - 1);
        } else {
            break;
        }
    }

    userProfileData.current_streak = streak;
    if (streakEl) streakEl.innerText = `${streak} Days 🔥`;

    if (typeof supabase !== 'undefined' && window.db) {
        const { error: streakErr } = await db
            .from('user_profiles')
            .update({ current_streak: streak })
            .eq('username', currentUser);

        if (streakErr) {
            console.error('Failed to update streak:', streakErr);
        }
    }

    updateDashboardDOM();
}

// ==========================================
// ZEN SAND CANVAS (NO SOUND, NO AUTO RESET)
// ==========================================
function initSandCanvas() {
    canvas = document.getElementById("sand-canvas");
    const container = document.getElementById("canvas-wrapper");

    if (!canvas || !container) return;

    const newCanvas = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
    ctx = canvas.getContext("2d");

    container.style.backgroundImage = `url("${IMAGE_BACKGROUND_URL}")`;
    container.style.backgroundSize = "cover";
    container.style.backgroundPosition = "center";

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#EED9B3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: x - rect.left, y: y - rect.top };
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const p = getPos(e);
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
        ctx.fill();
    };

    canvas.addEventListener("mousedown", (e) => {
        isDrawing = true;
        vibrate(10);
        draw(e);
    });
    canvas.addEventListener("mousemove", draw);
    window.addEventListener("mouseup", () => { isDrawing = false; });

    canvas.addEventListener("touchstart", (e) => {
        isDrawing = true;
        vibrate(10);
        draw(e);
        if (e.cancelable) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
        draw(e);
        if (e.cancelable) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchend", () => { isDrawing = false; });
}

function clearSandCanvas() {
    if (!ctx || !canvas) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#EED9B3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ==========================================
// COIN & SHREDDER (shred: vibrate only)
// ==========================================
function flipDecisionCoin() {
    const visual = document.getElementById('coin-visual');
    const res = document.getElementById('coin-result');
    const o1 = document.getElementById('coin-opt-1').value || "Opsi 1";
    const o2 = document.getElementById('coin-opt-2').value || "Opsi 2";

    playSfx("coinFlip");
    vibrate(15);

    visual.classList.add('coin-flip');
    res.innerText = "Memutar...";

    setTimeout(() => {
        visual.classList.remove('coin-flip');
        const win = Math.random() < 0.5 ? o1 : o2;
        res.innerHTML = `HASIL: <span class="text-rose-500 font-black">${win.toUpperCase()}</span>`;
        updateXP(5);
    }, 1200);
}

function shredRantDestructive() {
    const input = document.getElementById('rant-input');
    const cont = document.getElementById('rant-container');
    const btn = document.getElementById('shred-btn');
    const delay = parseInt(document.getElementById('shred-delay').value) * 1000;

    if (!input.value.trim()) return;
    input.disabled = true;
    btn.disabled = true;
    cont.classList.add('shredder-jump');

    vibrate([60, 40, 60]);

    const floaters = setInterval(() => {
        const el = document.createElement('div');
        el.className = 'floating-text';
        el.innerText = 'Hilang!';
        el.style.left = Math.random() * 80 + '%';
        el.style.top = Math.random() * 60 + '%';
        cont.appendChild(el);
        setTimeout(() => el.remove(), 700);
    }, 250);

    setTimeout(() => {
        clearInterval(floaters);
        cont.classList.remove('shredder-jump');
        input.value = "";
        input.disabled = false;
        btn.disabled = false;
        updateXP(20);
        confetti({ particleCount: 40 });
        vibrate(35);
    }, delay);
}

// ==========================================
// BUBBLE WRAP + SFX
// ==========================================
function generateBubbleWrap() {
    const grid = document.getElementById('bubble-wrap-grid');
    if (!grid) return;
    grid.innerHTML = "";
    poppedBubbles = 0;
    const popEl = document.getElementById('pop-count');
    if (popEl) popEl.innerText = "0 Popped";

    for (let i = 0; i < 24; i++) {
        const b = document.createElement('div');
        b.className = "w-10 h-10 bg-sky-100 rounded-full border-2 border-sky-200 cursor-pointer active:scale-75 transition-all flex items-center justify-center";
        b.onclick = function() {
            if (!this.classList.contains('popped')) {
                this.classList.add('popped', 'bg-slate-200');
                this.innerHTML = `<span class="text-[8px] font-bold text-slate-400">PLOP</span>`;
                poppedBubbles++;
                document.getElementById('pop-count').innerText = `${poppedBubbles} Popped`;
                updateXP(1);

                playSfx("bubblePop");
                vibrate(8);
            }
        };
        grid.appendChild(b);
    }
}

function resetBubbleWrap() { generateBubbleWrap(); }

// ==========================================
// WHACK-A-STRESSOR + SFX (9 kotak, X minus poin, no sound)
// ==========================================
function setupWhackGrid() {
    const grid = document.getElementById('whack-grid');
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < 9; i++) {
        const box = document.createElement('div');
        box.className = "bg-slate-50 rounded-xl border border-dashed flex items-center justify-center text-2xl cursor-pointer h-16 select-none";
        box.onclick = function() {
            const val = this.innerText.trim();

            if (val === "👾") {
                this.innerText = "";
                gameScore += 10;
                document.getElementById('game-score').innerText = `Score: ${gameScore}`;
                updateXP(2);
                playSfx("hitTok");
                vibrate(12);
            } else if (val === "X") {
                this.innerText = "";
                gameScore = Math.max(0, gameScore - 5);
                document.getElementById('game-score').innerText = `Score: ${gameScore}`;
                vibrate(20); // no sound
            }
        };
        grid.appendChild(box);
    }
}

function toggleWhackGame() {
    const btn = document.getElementById('game-btn');
    if (isGameRunning) {
        clearInterval(gameInterval);
        isGameRunning = false;
        btn.innerText = "Mulai Game";
        setupWhackGrid();
        return;
    }
    isGameRunning = true;
    gameScore = 0;
    document.getElementById('game-score').innerText = "Score: 0";
    btn.innerText = "Stop Game";

    gameInterval = setInterval(() => {
        const boxes = document.querySelectorAll('#whack-grid div');
        if (boxes.length === 0) return;
        boxes.forEach(b => b.innerText = "");

        const alienIndex = Math.floor(Math.random() * boxes.length);
        boxes[alienIndex].innerText = "👾";

        const showX = Math.random() < 0.35;
        if (showX) {
            let xIndex;
            do {
                xIndex = Math.floor(Math.random() * boxes.length);
            } while (xIndex === alienIndex);
            boxes[xIndex].innerText = "X";
        }
    }, 850);
}