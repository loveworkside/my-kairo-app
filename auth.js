// auth.js

let currentUser = "";
let userProfileData = { total_xp: 0, current_streak: 0 };

window.addEventListener('DOMContentLoaded', async () => {
    const savedUser = localStorage.getItem('tss_logged_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('menu-section').classList.remove('hidden');

        const displayName = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
        const welcomeNameEl = document.getElementById('welcome-name');
        if (welcomeNameEl) welcomeNameEl.innerText = displayName;

        await syncUserSession();
    }
});

async function authLogin() {
    const userInput = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value;

    if ((userInput === 'kairo' && passInput === 'oilove') ||
        (userInput === 'oilove' && passInput === 'kairo')) {
        currentUser = userInput;
        localStorage.setItem('tss_logged_user', currentUser);

        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('menu-section').classList.remove('hidden');

        const displayName = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
        const welcomeNameEl = document.getElementById('welcome-name');
        if (welcomeNameEl) welcomeNameEl.innerText = displayName;

        await syncUserSession();
    } else {
        alert("Identitas salah! Gunakan password silang.");
    }
}

function openMessageStage() {
    window.location.href = 'message-satu.html';
}

function openDistractingStage() {
    window.location.href = 'mini-distracting.html';
}

function triggerFullReset() {
    if (confirm("Logout dan reset sesi?")) {
        localStorage.removeItem('tss_logged_user');
        window.location.reload();
    }
}

// opsi: sync profil dasar, kalau kamu butuh data XP/streak di menu
async function syncUserSession() {
    if (!window.db) return;
    const { data: profile } = await db
        .from('user_profiles')
        .select('*')
        .eq('username', currentUser)
        .single();

    if (profile) {
        userProfileData = profile;
    }
}