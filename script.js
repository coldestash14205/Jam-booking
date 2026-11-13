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
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

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
        }, (error) => {
            console.error("Firebase error:", error);
            showStatus("Failed to connect to database. Check Firebase config.", "error");
        });
    }

    function saveBookings() {
        const updates = {};
        bookings.forEach(b => {
            updates[b.id] = b;
        });
        db.ref('bookings').set(updates).
