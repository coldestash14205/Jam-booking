(function() {
    // ---------- FIREBASE CONFIGURATION ----------
    // REPLACE THE VALUES BELOW WITH YOUR OWN FROM THE FIREBASE CONSOLE
   const firebaseConfig = {
  apiKey: "AIzaSyBmxCHkVb9K6Q0lKmeJPqE2VhMoodsAjXE",
  authDomain: "bookings-7f94b.firebaseapp.com",
  databaseURL: "https://bookings-7f94b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bookings-7f94b",
  storageBucket: "bookings-7f94b.firebasestorage.app",
  messagingSenderId: "90586531013",
  appId: "1:90586531013:web:c51a1ddb0a865eae009cac",
  measurementId: "G-2VVJ27S1VD"
};

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // ---------- STORAGE KEYS (Local only for users/theme) ----------
    const USERS_KEY = 'shared_booking_users_v2';
    const THEME_KEY = 'shared_bookings_theme';

    // ---------- BOOKABLE HOURS ----------
    const MIN_HOUR = 8;
    const MAX_HOUR = 22;

    // ---------- STATE ----------
    let currentUser = null;
    let bookings = [];
    let weekStart = getStartOfWeek(new Date());

    // ---------- DOM refs ----------
    const userBadge = document.getElementById('userBadge');
    const accountArea = document.getElementById('accountArea');
    const newUsername = document.getElementById('newUsername');
    const newPassword = document.getElementById('newPassword');
    
    // We will dynamically create these buttons in the HTML
    const loginBtn = document.getElementById('loginBtn');
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');
    
    const bookingDate = document.getElementById('bookingDate');
    const bookingTime = document.getElementById('bookingTime');
    const bookBtn = document.getElementById('bookBtn');
    const slotsGrid = document.getElementById('slotsGrid');
    const slotCount = document.getElementById('slotCount');
    const statusMessage = document.getElementById('statusMessage');
    const weekGrid = document.getElementById('weekGrid');
    const weekRange = document.getElementById('weekRange');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const thisWeekBtn = document.getElementById('thisWeekBtn');
    const themeToggle = document.getElementById('themeToggle');
    const authSection = document.getElementById('authSection');

    // ---------- THEME ----------
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
        localStorage.setItem(THEME_KEY, theme);
    }

    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') {
            applyTheme(saved);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    }

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // ---------- FIREBASE DATA SYNC ----------
    function initBookingsListener() {
        db.ref('bookings').on('value', (snapshot) => {
            const data = snapshot.val();
            bookings = data ? Object.values(data) : [];
            renderSlots();
        });
    }

    function saveBookings() {
        const updates = {};
        bookings.forEach(b => {
            updates[b.id] = b;
        });
        db.ref('bookings').set(updates);
    }

    // ---------- LOCAL USER HELPERS ----------
    function loadUsers() {
        const raw = localStorage.getItem(USERS_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    // ---------- UTILITIES ----------
    function isTimeAllowed(timeStr) {
        if (!timeStr) return false;
        const [hourStr, minuteStr] = timeStr.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr || '0', 10);
        if (isNaN(hour) || isNaN(minute)) return false;
        if (hour < MIN_HOUR || hour > MAX_HOUR) return false;
        if (hour === MAX_HOUR && minute > 0) return false;
        return true;
    }

    function toDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function parseDateStr(s) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diff);
        return d;
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function formatWeekRange(start) {
        const end = addDays(start, 6);
        const startStr = start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        const endStr = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        return `${startStr} – ${endStr}`;
    }

    // ---------- UI UPDATE ----------
    function updateUserBadge() {
        if (currentUser) {
            const initial = currentUser.username.charAt(0).toUpperCase();
            userBadge.innerHTML = `
                <div class="avatar">${initial}</div>
                <span>${currentUser.username}</span>
                <button id="logoutBtn">Logout</button>
            `;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                currentUser = null;
                localStorage.removeItem('currentUser');
                updateUserBadge();
                renderAccountArea();
                renderSlots();
                showStatus('Logged out.', 'info');
            });
        } else {
            userBadge.innerHTML = `<span>Guest</span>`;
        }
    }

    function renderAccountArea() {
        if (currentUser) {
            accountArea.innerHTML = `
                <div class="account-info">
                    <strong>Logged in as</strong><br>
                    ${currentUser.username}<br>
                    <span style="font-size:0.8rem; opacity:0.8;">You can book & cancel</span>
                </div>
                <button class="danger-outline" id="logoutBtn2">Logout</button>
            `;
            document.getElementById('logoutBtn2').addEventListener('click', () => {
                currentUser = null;
                localStorage.removeItem('currentUser');
                updateUserBadge();
                renderAccountArea();
                renderSlots();
                showStatus('Logged out.', 'info');
            });
        } else {
            accountArea.innerHTML = `
                <div class="account-info" style="background: var(--bg-account-guest);">
                    <span style="color: var(--text-muted);">Not logged in. Please log in or create an account below.</span>
                </div>
            `;
        }
    }

    let statusTimeout = null;
    function showStatus(msg, type = 'info') {
        statusMessage.textContent = msg;
        statusMessage.style.display = 'block';
        statusMessage.className = 'status-message ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
        if (statusTimeout) clearTimeout(statusTimeout);
        statusTimeout = setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 4000);
    }

    // ---------- RENDER WEEK CALENDAR ----------
    function renderWeekCalendar() {
        weekRange.textContent = formatWeekRange(weekStart);

        const todayStr = toDateStr(new Date());
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let html = '';

        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(weekStart, i);
            const dayStr = toDateStr(dayDate);
            const isToday = dayStr === todayStr;

            const dayBookings = bookings
                .filter(b => b.date === dayStr)
                .sort((a, b) => a.time.localeCompare(b.time));

            let pillsHtml = '';
            if (dayBookings.length === 0) {
                pillsHtml = `<div class="day-empty">no bookings</div>`;
            } else {
                dayBookings.forEach(b => {
                    const isMine = currentUser && b.username.toLowerCase() === currentUser.username.toLowerCase();
                    const ownerDisplay = isMine ? 'You' : b.username;
                    pillsHtml += `
                        <div class="booking-pill ${isMine ? 'mine' : ''}" title="${b.time} · ${ownerDisplay}">
                            <span class="pill-time">${b.time}</span>
                            <span class="pill-owner">${ownerDisplay}</span>
                        </div>
                    `;
                });
            }

            html += `
                <div class="day-column ${isToday ? 'today' : ''}">
                    <div class="day-header">
                        <div class="day-name">${dayNames[i]}</div>
                        <div class="day-date">${dayDate.getDate()}</div>
                    </div>
                    <div class="day-bookings">
                        ${pillsHtml}
                    </div>
                </div>
            `;
        }

        weekGrid.innerHTML = html;
    }

    // ---------- RENDER ALL BOOKINGS LIST ----------
    function renderSlots() {
        renderWeekCalendar();

        const sorted = [...bookings].sort((a,b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
        slotCount.textContent = `${sorted.length} slot${sorted.length !== 1 ? 's' : ''}`;

        if (sorted.length === 0) {
            slotsGrid.innerHTML = `<div class="empty-slots">No bookings yet. Be the first to book a slot!</div>`;
            return;
        }

        let html = '';
        sorted.forEach(b => {
            const isMine = currentUser && b.username.toLowerCase() === currentUser.username.toLowerCase();
            let slotClass = 'booked';
            if (isMine) slotClass = 'mine';

            const ownerDisplay = isMine ? 'You' : (b.username || 'unknown');

            html += `
                <div class="slot-item ${slotClass}" data-id="${b.id}" data-date="${b.date}" data-time="${b.time}" data-username="${b.username}">
                    <div class="slot-time">${b.time}</div>
                    <div style="font-size:0.8rem; opacity:0.9;">${b.date}</div>
                    <div class="slot-owner">${ownerDisplay}</div>
                    ${isMine ? `<button class="cancel-booking" data-id="${b.id}" style="background:transparent; border:none; font-size:0.75rem; margin-top:0.2rem; cursor:pointer; text-decoration:underline;">cancel</button>` : ''}
                </div>
            `;
        });

        slotsGrid.innerHTML = html;

        document.querySelectorAll('.cancel-booking').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (!currentUser) {
                    showStatus('You must be logged in to cancel.', 'error');
                    return;
                }
                const booking = bookings.find(b => b.id === id);
                if (!booking) return;
                if (booking.username.toLowerCase() !== currentUser.username.toLowerCase()) {
                    showStatus('You can only cancel your own bookings.', 'error');
                    return;
                }
                bookings = bookings.filter(b => b.id !== id);
                saveBookings(); 
                showStatus('Booking cancelled.', 'success');
            });
        });
    }

    // ---------- BOOKING LOGIC ----------
    function bookSlot() {
        if (!currentUser) {
            showStatus('You must be logged in to book a slot. Please log in or sign up.', 'error');
            // Highlight the auth section
            authSection.style.boxShadow = '0 0 0 2px #d97a7a';
            setTimeout(() => { authSection.style.boxShadow = 'none'; }, 2000);
            return;
        }

        const date = bookingDate.value.trim();
        const time = bookingTime.value.trim();

        if (!date || !time) {
            showStatus('Please select both date and time.', 'error');
            return;
        }

        if (!isTimeAllowed(time)) {
            showStatus(`Bookings are only allowed between 08:00 and 22:00. (${time} is outside.)`, 'error');
            return;
        }

        const isTaken = bookings.some(b => b.date === date && b.time === time);
        if (isTaken) {
            showStatus(`Slot on ${date} at ${time} is already booked. Choose another.`, 'error');
            return;
        }

        const newBooking = {
            id: 'b' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            date,
            time,
            username: currentUser.username,
        };
        
        bookings.push(newBooking);
        saveBookings();

        const bookedDate = parseDateStr(date);
        weekStart = getStartOfWeek(bookedDate);

        showStatus(`Booked ${date} at ${time}!`, 'success');
    }

    // ---------- AUTHENTICATION LOGIC ----------
    
    // Login existing user only
    function handleLogin() {
        const username = newUsername.value.trim();
        const password = newPassword.value.trim();

        if (!username || !password) {
            showStatus('Please enter both username and password.', 'error');
            return;
        }

        const users = loadUsers();
        const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (!existing) {
            showStatus('Username not found. Please sign up.', 'error');
            return;
        }

        if (existing.password !== password) {
            showStatus('Incorrect password. Please try again.', 'error');
            return;
        }

        // Success
        currentUser = { username: existing.username };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserBadge();
        renderAccountArea();
        renderSlots();
        showStatus(`Welcome back, ${existing.username}!`, 'success');
        newUsername.value = '';
        newPassword.value = '';
    }

    // Create new user only
    function handleSignup() {
        const username = newUsername.value.trim();
        const password = newPassword.value.trim();

        if (!username || username.length < 2) {
            showStatus('Username must be at least 2 characters.', 'error');
            return;
        }
        if (!password || password.length < 3) {
            showStatus('Password must be at least 3 characters.', 'error');
            return;
        }

        const users = loadUsers();
        const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (existing) {
            showStatus('Username already exists. Please log in instead.', 'error');
            return;
        }

        // Create user
        users.push({ username, password });
        saveUsers(users);
        
        currentUser = { username };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserBadge();
        renderAccountArea();
        renderSlots();
        showStatus(`Account created! You are now logged in as ${username}.`, 'success');
        newUsername.value = '';
        newPassword.value = '';
    }

    // ---------- INIT ----------
    function init() {
        initTheme();
        initBookingsListener();

        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                const users = loadUsers();
                if (users.some(u => u.username.toLowerCase() === parsed.username.toLowerCase())) {
                    currentUser = { username: parsed.username };
                } else {
                    localStorage.removeItem('currentUser');
                }
            } catch(e) {}
        }

        weekStart = getStartOfWeek(new Date());

        const today = new Date().toISOString().slice(0,10);
        bookingDate.value = today;
        bookingTime.value = '10:00';

        updateUserBadge();
        renderAccountArea();

        // Attach Listeners for Auth
        loginBtn.addEventListener('click', handleLogin);
        signupSubmitBtn.addEventListener('click', handleSignup);

        // Allow Enter key on password field to trigger login
        newPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });

        bookBtn.addEventListener('click', bookSlot);

        bookingTime.addEventListener('change', () => {
            const time = bookingTime.value;
            if (time && !isTimeAllowed(time)) {
                showStatus(`Time ${time} is outside bookable hours (08:00 – 22:00). Please pick another.`, 'error');
            }
        });

        prevWeekBtn.addEventListener('click', () => {
            weekStart = addDays(weekStart, -7);
            renderWeekCalendar();
        });
        nextWeekBtn.addEventListener('click', () => {
            weekStart = addDays(weekStart, 7);
            renderWeekCalendar();
        });
        thisWeekBtn.addEventListener('click', () => {
            weekStart = getStartOfWeek(new Date());
            renderWeekCalendar();
        });

        if (currentUser) {
            updateUserBadge();
        }
    }

    init();
})();