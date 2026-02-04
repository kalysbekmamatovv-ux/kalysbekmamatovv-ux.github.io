import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// КОНФИГУРАЦИЯ FIREBASE
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDoixf1ARGsy12WM7jU5CElYYp6kGPqin0", 
    projectId: "akajon-e1ab7", 
    authDomain: "akajon-e1ab7.firebaseapp.com", 
    storageBucket: "akajon-e1ab7.firebasestorage.app", 
    messagingSenderId: "84897464590",
    appId: "1:84897464590:web:cd298bfc043393a981175f",
    measurementId: "G-255QNSNKNM" 
};

let app, auth, db;
let firebaseInitPromise; 

// --- Вспомогательные функции ---
function showMessage(message, type = 'success', duration = 3000) {
    let msgBox = document.getElementById('message-box');
    if (!msgBox) {
        msgBox = document.createElement('div');
        msgBox.id = 'message-box';
        document.body.appendChild(msgBox);
    }
    msgBox.textContent = message;
    msgBox.className = type; 
    setTimeout(() => msgBox.classList.add('show'), 10); 
    setTimeout(() => msgBox.classList.remove('show'), duration);
}

// --- Инициализация ---
async function initFirebase(resolve, reject) {
    try {
        app = initializeApp(FIREBASE_CONFIG); 
        auth = getAuth(app);
        db = getFirestore(app); 
        
        console.log("Firebase Init Success");
        resolve(); 

        // Проверка токена или анонимный вход
        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
             // Анонимный вход нужен только если нет активной сессии
             // В реальном приложении лучше проверять currentUser
        }
        
        // Слушатель состояния
        onAuthStateChanged(auth, (user) => {
            updateNavUI(user);
            // Если мы на странице книг, проверяем доступ
            if (document.querySelector('.books-section')) {
                checkAccess(user);
            }
        });

    } catch (error) {
        console.error("Firebase Error:", error);
        reject(error);
    }
}

firebaseInitPromise = new Promise((resolve, reject) => initFirebase(resolve, reject));

// --- Firestore: Запись входа (для диагностики) ---
async function saveLoginTime(userId) {
    try {
        if (!db) await firebaseInitPromise; 
        const timestamp = new Date().toISOString();
        const userDocRef = doc(db, "users", userId); 
        await setDoc(userDocRef, { 
            lastLogin: timestamp,
            email: auth.currentUser?.email || 'anon' 
        }, { merge: true });
    } catch (error) {
        console.error("Firestore Save Error:", error);
    }
}

// --- UI: Навигация ---
function updateNavUI(user) {
    const navLinksContainer = document.querySelector('.nav-links');
    if (!navLinksContainer) return;

    // Очистка старых кнопок
    const authBtns = navLinksContainer.querySelectorAll('.btn-login, .btn-logout, .user-info');
    authBtns.forEach(el => el.remove());

    const isLibraryPage = window.location.pathname.includes('books.html');

    if (user && !user.isAnonymous) {
        // --- Пользователь ВОШЕЛ ---
        const userInfo = document.createElement('span');
        userInfo.classList.add('user-info');
        const emailShort = user.email ? user.email.split('@')[0] : 'User';
        userInfo.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${emailShort}`;

        const logoutBtn = document.createElement('button');
        logoutBtn.classList.add('btn-logout');
        logoutBtn.textContent = 'Выход';
        logoutBtn.addEventListener('click', handleLogout);

        navLinksContainer.appendChild(userInfo);
        navLinksContainer.appendChild(logoutBtn);
    } else {
        // --- Пользователь НЕ вошел ---
        if (!isLibraryPage && !window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
             // На страницах входа/регистрации кнопки можно не дублировать, если не нужно
        } else {
             const loginLink = document.createElement('a');
             loginLink.href = "login.html";
             loginLink.className = "btn btn-login";
             loginLink.textContent = "Вход";
             
             const regLink = document.createElement('a');
             regLink.href = "register.html";
             regLink.className = "btn btn-login";
             regLink.textContent = "Регистрация";

             navLinksContainer.appendChild(loginLink);
             navLinksContainer.appendChild(regLink);
        }
    }
}

// --- Обработчики Входа/Регистрации (ИСПРАВЛЕНЫ) ---

async function handleLogin(event) {
    event.preventDefault();
    
    // Получаем элементы
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    // Визуальная обратная связь
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Входим...";

    try {
        await firebaseInitPromise;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        await saveLoginTime(userCredential.user.uid);
        
        showMessage("Успешно! Перенаправление...", "success");

        // Мгновенная переадресация
        setTimeout(() => {
            window.location.href = 'books.html'; 
        }, 500);

    } catch (error) {
        // Возврат кнопки в исходное состояние
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        let msg = "Ошибка входа";
        if (error.code === 'auth/user-not-found') msg = "Пользователь не найден";
        if (error.code === 'auth/wrong-password') msg = "Неверный пароль";
        if (error.code === 'auth/invalid-credential') msg = "Неверный email или пароль";
        showMessage(msg, "error");
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (password !== confirmPassword) {
        showMessage("Пароли не совпадают", "error");
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Создаем аккаунт...";

    try {
        await firebaseInitPromise;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveLoginTime(userCredential.user.uid);

        showMessage("Аккаунт создан! Входим...", "success");
        setTimeout(() => {
            window.location.href = 'books.html';
        }, 500);

    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
        let msg = "Ошибка регистрации: " + error.message;
        if (error.code === 'auth/email-already-in-use') msg = "Этот Email уже занят";
        if (error.code === 'auth/weak-password') msg = "Пароль слишком слабый (мин. 6 символов)";
        showMessage(msg, "error");
    }
}

async function handleLogout(event) {
    event.preventDefault();
    try {
        await signOut(auth);
        showMessage("Вы вышли из системы", "success");
        setTimeout(() => window.location.reload(), 500);
    } catch (error) {
        console.error(error);
    }
}

// --- Логика страниц ---
function setupTabs() {
    const buttons = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');
    
    if(!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if(target) target.classList.add('active');
        });
    });
}

function checkAccess(user) {
    const listWrapper = document.getElementById('book-list-wrapper');
    if (!listWrapper) return;

    // Если нет пользователя или он аноним
    if (!user || user.isAnonymous) {
        if (!document.getElementById('access-denied-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'access-denied-overlay';
            overlay.className = 'access-denied-overlay';
            overlay.innerHTML = `
                <h2>Доступ ограничен</h2>
                <p>Пожалуйста, войдите, чтобы читать книги.</p>
                <a href="login.html" class="btn-login-link"><i class="fa-solid fa-lock"></i> Войти</a>
            `;
            listWrapper.appendChild(overlay);
        }
        const list = document.querySelector('.book-list');
        if(list) list.style.filter = "blur(5px)";
    } else {
        const overlay = document.getElementById('access-denied-overlay');
        if (overlay) overlay.remove();
        const list = document.querySelector('.book-list');
        if(list) list.style.filter = "none";
    }
}

function setupFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    const items = document.querySelectorAll('.book-item');
    if(!btns.length) return;

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            items.forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.classList.remove('hide');
                } else {
                    item.classList.add('hide');
                }
            });
        });
    });
}

// --- ЗАПУСК ---
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFilters();

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const regForm = document.getElementById('register-form');
    if (regForm) regForm.addEventListener('submit', handleRegister);
});
