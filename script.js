(function() {
    // ---------- FIREBASE CONFIGURATION ----------
    // REPLACE THE VALUES BELOW WITH YOUR OWN FROM THE FIREBASE CONSOLE
   const firebaseConfig = {
  apiKey: "AIzaSyBmxCHkVb9K6Q0lKmeJPqE2VhMoodsAjXE",
  authDomain: "bookings-7f94b.firebaseapp.com",
  databaseURL: "https://bookings-7f94b-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "bookings-7f94b",
  storageBucket: "bookings-7f94b.firebasestorage.app",
  messagingSenderId: "90586531013",
  appId: "1:90586531013:web:c51a1ddb0a865eae009cac",
  measurementId: "G-2VVJ27S1VD"
};

    // =====================================================================
    // 👑 ADMIN USERS: Add usernames here to give them power to delete ANY booking
    // =====================================================================
    const ADMIN_USERS = ["admin", "coled", "owner"];

    // ---------- FIREBASE INITIALIZATION (STRICT) ----------
    // If Firebase fails, we throw an error so you know it's not working.
    let db = null;
    try {
        if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.databaseURL.includes("firebaseio.com")) {
            throw new Error("Firebase config is missing or incomplete. Please update script.js.");
        }
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log("Firebase initialized successfully. Global sharing is ACTIVE.");
    } catch (error) {
        console.error("FIREBASE ERROR:", error.message);
        alert("Database connection failed. Bookings will not be shared. Check the developer console.");
    }

    // ---------- STORAGE KEYS ----------
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
    const loginBtn = document.getElementById('loginBtn');
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');
    
    const bookingDate = document.getElementById('bookingDate');
    const bookingStartTime = document.getElementById('bookingStartTime');
    const bookingEndTime = document.getElementById('bookingEndTime');
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

    // Check if current user is an admin
    function isAdmin() {
        if (!currentUser) return false;
        return ADMIN_USERS.some(admin => admin.toLowerCase() === currentUser.username.toLowerCase());
    }

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

    // ---------- DATA SYNC (FIREBASE ONLY) ----------
    function initBookingsListener() {
        if (!db) {
            showStatus("Database not connected. Refusing to load.", "error");
            return;
        }

        // Listen to Firebase in real-time
        db.ref('bookings').on('value', (snapshot) => {
            const data = snapshot.val();
            bookings = data ? Object.values(data) : [];
            
            // Re-render UI whenever data changes from ANY user
            renderSlots();
        }, (error) => {
            console.error("Firebase read error:", error);
            showStatus("Database read error: " + error.message, "error");
        });
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
    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

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

    // ---------- CANCEL LOGIC ----------
    function cancelBooking(id) {
        if (!currentUser) {
            showStatus('You must be logged in to cancel.', 'error');
            return;
        }
        const booking = bookings.find(b => b.id === id);
        if (!booking) return;

        const userIsAdmin = isAdmin();
        const isMyBooking = booking.username.toLowerCase() === currentUser.username.toLowerCase();

        if (!isMyBooking && !userIsAdmin) {
            showStatus('You can only cancel your own bookings.', 'error');
            return;
        }

        const confirmMsg = userIsAdmin && !isMyBooking 
            ? `[ADMIN] Are you sure you want to cancel ${booking.username}'s booking on ${booking.date}?`
            : `Are you sure you want to cancel your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime}?`;

        if (confirm(confirmMsg)) {
            // Remove from Firebase
            db.ref('bookings/' + id).remove().catch(err => {
                showStatus("Failed to cancel: " + err.message, "error");
            });
        }
    }

    // ---------- UI UPDATE ----------
    function updateUserBadge() {
        if (currentUser) {
            const initial = currentUser.username.charAt(0).toUpperCase();
            const adminBadge = isAdmin() ? ' <span style="font-size:0.7rem; background: #e4b862; color: #0b2b4f; padding: 0.1rem 0.4rem; border-radius: 10px; font-weight: bold; margin-left: 0.3rem;">ADMIN</span>' : '';
            userBadge.innerHTML = `
                <div class="avatar">${initial}</div>
                <span>${currentUser.username}${adminBadge}</span>
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
                    ${currentUser.username} ${isAdmin() ? '(Admin)' : ''}<br>
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
        }, 5000);
    }

    // ---------- RENDER WEEK CALENDAR ----------
    function renderWeekCalendar() {
        if (!weekRange) return; 
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
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

            let pillsHtml = '';
            if (dayBookings.length === 0) {
                pillsHtml = `<div class="day-empty">no bookings</div>`;
            } else {
                dayBookings.forEach(b => {
                    const isMyBooking = currentUser && b.username.toLowerCase() === currentUser.username.toLowerCase();
                    const canCancel = isMyBooking || isAdmin();
                    const ownerDisplay = isMyBooking ? 'You' : b.username;
                    
                    let pillClass = 'booking-pill';
                    if (isMyBooking) pillClass += ' mine';
                    else if (isAdmin()) pillClass += ' admin-view';

                    pillsHtml += `
                        <div class="${pillClass}" data-id="${b.id}" title="${b.startTime}-${b.endTime} · ${ownerDisplay} ${canCancel ? '(Click to cancel)' : ''}">
                            <span class="pill-time">${b.startTime} - ${b.endTime}</span>
                            <span class="pill-owner">${ownerDisplay} ${isAdmin() && !isMyBooking ? '(Admin)' : ''}</span>
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

        document.querySelectorAll('.booking-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const id = pill.dataset.id;
                const b = bookings.find(x => x.id === id);
                if (!b) return;
                const isMyBooking = currentUser && b.username.toLowerCase() === currentUser.username.toLowerCase();
                if (isMyBooking || isAdmin()) {
                    cancelBooking(id);
                }
            });
        });
    }

    // ---------- RENDER ALL BOOKINGS LIST ----------
    function renderSlots() {
        renderWeekCalendar();

        const sorted = [...bookings].sort((a,b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });
        slotCount.textContent = `${sorted.length} slot${sorted.length !== 1 ? 's' : ''}`;

        if (sorted.length === 0) {
            slotsGrid.innerHTML = `<div class="empty-slots">No bookings yet. Be the first to book a slot!</div>`;
            return;
        }

        let html = '';
        sorted.forEach(b => {
            const isMyBooking = currentUser && b.username.toLowerCase() === currentUser.username.toLowerCase();
            const canCancel = isMyBooking || isAdmin();
            
            let slotClass = 'booked';
            if (isMyBooking) slotClass = 'mine';

            const ownerDisplay = isMyBooking ? 'You' : (b.username || 'unknown');

            html += `
                <div class="slot-item ${slotClass}" data-id="${b.id}">
                    <div class="slot-time">${b.startTime} - ${b.endTime}</div>
                    <div style="font-size:0.8rem; opacity:0.9;">${b.date}</div>
                    <div class="slot-owner">${ownerDisplay} ${isAdmin() && !isMyBooking ? '(Admin)' : ''}</div>
                    ${canCancel ? `<button class="cancel-btn ${isAdmin() && !isMyBooking ? 'admin-cancel' : ''}" data-id="${b.id}">${isMyBooking ? 'Cancel Booking' : 'Admin Cancel'}</button>` : ''}
                </div>
            `;
        });

        slotsGrid.innerHTML = html;

        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                cancelBooking(btn.dataset.id);
            });
        });
    }

    // ---------- BOOKING LOGIC (WITH GLOBAL DOUBLE-BOOK PREVENTION) ----------
    function bookSlot() {
        if (!db) {
            showStatus('Database not connected.', 'error');
            return;
        }
        if (!currentUser) {
            showStatus('You must be logged in to book a slot. Please log in or sign up.', 'error');
            authSection.style.boxShadow = '0 0 0 2px #d97a7a';
            setTimeout(() => { authSection.style.boxShadow = 'none'; }, 2000);
            return;
        }

        const date = bookingDate.value.trim();
        const startTime = bookingStartTime.value.trim();
        const endTime = bookingEndTime.value.trim();

        if (!date || !startTime || !endTime) {
            showStatus('Please select a date, start time, and end time.', 'error');
            return;
        }

        if (!isTimeAllowed(startTime) || !isTimeAllowed(endTime)) {
            showStatus(`Bookings are only allowed between 08:00 and 22:00.`, 'error');
            return;
        }

        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(endTime);

        if (startMins >= endMins) {
            showStatus('End time must be after start time.', 'error');
            return;
        }

        // CRITICAL FIX: Fetch the freshest data directly from Firebase before checking overlaps
        // This prevents two people clicking at the exact same second from double booking.
        db.ref('bookings').once('value').then((snapshot) => {
            const latestData = snapshot.val();
            const latestBookings = latestData ? Object.values(latestData) : [];

            const hasOverlap = latestBookings.some(b => {
                if (b.date !== date) return false;
                const bStart = timeToMinutes(b.startTime);
                const bEnd = timeToMinutes(b.endTime);
                return (startMins < bEnd && endMins > bStart);
            });

            if (hasOverlap) {
                showStatus(`This time slot overlaps with a booking someone else just made on ${date}. Please choose another time.`, 'error');
                return;
            }

            // Proceed with booking
            const newBooking = {
                id: 'b' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                date,
                startTime,
                endTime,
                username: currentUser.username,
            };
            
            // Save directly to Firebase
            db.ref('bookings/' + newBooking.id).set(newBooking).then(() => {
                const bookedDate = parseDateStr(date);
                weekStart = getStartOfWeek(bookedDate);
                showStatus(`Booked ${date} from ${startTime} to ${endTime}!`, 'success');
            }).catch(err => {
                showStatus("Database save error: " + err.message, "error");
            });

        }).catch(err => {
            showStatus("Database read error: " + err.message, "error");
        });
    }

    // ---------- AUTHENTICATION LOGIC ----------
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

        currentUser = { username: existing.username };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserBadge();
        renderAccountArea();
        renderSlots();
        showStatus(`Welcome back, ${existing.username}!`, 'success');
        newUsername.value = '';
        newPassword.value = '';
    }

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
        
        // 1. Force the calendar to load the current week immediately
        weekStart = getStartOfWeek(new Date());
        renderWeekCalendar();

        // 2. Start the database listener
        if (db) {
            initBookingsListener();
        }

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

        const today = new Date().toISOString().slice(0,10);
        bookingDate.value = today;
        bookingStartTime.value = '10:00';
        bookingEndTime.value = '11:00';

        updateUserBadge();
        renderAccountArea();

        loginBtn.addEventListener('click', handleLogin);
        signupSubmitBtn.addEventListener('click', handleSignup);

        newPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });

        bookBtn.addEventListener('click', bookSlot);

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
    }

    init();
})();
