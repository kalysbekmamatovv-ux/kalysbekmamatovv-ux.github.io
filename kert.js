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


// --- ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ FIREBASE (ИСПОЛЬЗУЕТСЯ АКТУАЛЬНЫЙ КЛЮЧ И ID) ---
// ВНИМАНИЕ: Проверьте правильность значений. Эта конфигурация должна быть скопирована из настроек вашего проекта Firebase.
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCshzHGrLcWZXBqcIP9-BqfSCO-URVWga8",
  authDomain: "koldon-kelet.firebaseapp.com",
  projectId: "koldon-kelet",
  storageBucket: "koldon-kelet.firebasestorage.app",
  messagingSenderId: "179403934698",
  appId: "1:179403934698:web:5680ad38bae74053108093",
  measurementId: "G-034PYJ5444"
};

let app, auth, db;

// Используем промис для отслеживания завершения инициализации
let firebaseInitPromise; 

// --- 1. Вспомогательная функция для сообщений (замена alert) ---
function showMessage(message, type = 'success', duration = 3000) {
    let msgBox = document.getElementById('message-box');
    if (!msgBox) {
        msgBox = document.createElement('div');
        msgBox.id = 'message-box';
        document.body.appendChild(msgBox);
    }
    
    msgBox.textContent = message;
    msgBox.className = type; 

    // Показать
    setTimeout(() => {
        msgBox.classList.add('show');
    }, 10); 

    // Скрыть
    setTimeout(() => {
        msgBox.classList.remove('show');
    }, duration);
}

// --- 2. Инициализация Firebase и Аутентификация ---
async function initFirebase(resolve, reject) {
    
    if (typeof console !== 'undefined') {
        console.log("Status: Попытка инициализации Firebase с предоставленной конфигурацией...");
    }

    try {
        // 1. Инициализация объектов Firebase
        app = initializeApp(FIREBASE_CONFIG); 
        auth = getAuth(app);
        db = getFirestore(app); 
        
        // ВАЖНО: Мы делаем дополнительную проверку здесь
        const authDomainCheck = auth.config.authDomain;
        if (!authDomainCheck.includes(FIREBASE_CONFIG.projectId)) {
             console.warn(`ПРЕДУПРЕЖДЕНИЕ: Проект ID "${FIREBASE_CONFIG.projectId}" не совпадает с доменом авторизации "${authDomainCheck}". Проверьте FIREBASE_CONFIG.`);
        }
        
        console.log("Инициализация успешно запущена. Ожидание состояния аутентификации.");

        // *** МОМЕНТ РАЗРЕШЕНИЯ PROMISE: объекты auth/db установлены ***
        resolve(); 

        // 2. Аутентификация (анонимный вход или вход с токеном)
        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            // Анонимный вход позволяет системе продолжить работу, даже если авторизация не настроена
            await signInAnonymously(auth);
        }
        
        // Слушатель состояния аутентификации
        onAuthStateChanged(auth, (user) => {
            updateNavUI(user);
            if (document.body.classList.contains('body-books')) {
                checkAccess(user);
            }
        });

    } catch (error) {
        // Ловим ошибки инициализации
        console.error("КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ Firebase:", error);
        
        let customError = "Критическая ошибка инициализации. Домен заблокирован или конфигурация неверна.";

        // Если ошибка связана с доменом, даем конкретные инструкции
        if (error.code === 'auth/unauthorized-domain') {
            customError = "КРИТИЧЕСКАЯ ОШИБКА: Домен 'kalysbekmamatovv-ux.github.io' не авторизован. Добавьте его в Firebase -> Authentication -> Settings -> Authorized domains.";
        } else if (error.message.includes('authDomain')) {
            customError = "КРИТИЧЕСКАЯ ОШИБКА: Проблема с параметром 'authDomain' в FIREBASE_CONFIG. Проверьте опечатку.";
        } else if (error.code === 'auth/operation-not-allowed') {
            customError = "КРИТИЧЕСКАЯ ОШИБКА: Метод входа Email/Password выключен. Включите его в Firebase -> Authentication -> Sign-in method.";
        }

        showMessage(customError, "error", 10000); 
        reject(error);
    }
}

// Оборачиваем initFirebase в промис для глобального отслеживания
firebaseInitPromise = new Promise((resolve, reject) => {
    initFirebase(resolve, reject); 
});

// --- 3. Функции Firestore (Диагностика и запись данных) ---

/**
 * Сохраняет время входа пользователя в Firestore.
 * Используется для проверки полной работоспособности базы данных.
 * @param {string} userId - UID текущего пользователя.
 */
async function saveLoginTime(userId) {
    try {
        const timestamp = new Date().toISOString();
        // ВНИМАНИЕ: Используем путь artifacts/{appId}/users/{userId}/...
        // Но так как у нас нет __app_id, используем простой путь для диагностики
        const userDocRef = doc(db, "users", userId); 

        // Записываем данные в /users/{userId}
        await setDoc(userDocRef, { 
            lastLogin: timestamp,
            email: auth.currentUser.email || 'anon' 
        }, { merge: true }); // Используем merge: true для обновления, а не перезаписи
        
        console.log(`[Firestore] Успешно записано время входа для ${userId}.`);

    } catch (error) {
        // Если здесь ошибка, то проблема в правилах безопасности Firestore (Security Rules)
        console.error("[Firestore] Ошибка записи данных (проверьте Security Rules).", error);
    }
}


// --- 4. Обновление UI навигации ---
function updateNavUI(user) {
    const navLinksContainer = document.querySelector('.nav-links');
    if (!navLinksContainer) return;

    // Очищаем существующие кнопки входа/регистрации
    let existingAuthElements = navLinksContainer.querySelectorAll('.btn-login, .btn-logout, .user-info');
    existingAuthElements.forEach(el => el.remove());

    // Всегда оставляем кнопку Библиотеки/На главную
    const libraryLink = navLinksContainer.querySelector('a[href="books.html"]');
    if (libraryLink) libraryLink.style.display = 'inline-block';

    if (user && !user.isAnonymous) {
        // Пользователь вошел в систему
        const userInfo = document.createElement('span');
        userInfo.classList.add('user-info');
        // Показываем только email или 'Пользователь'
        const email = user.email ? user.email.split('@')[0] : 'Пользователь';
        userInfo.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${email}`;

        const logoutBtn = document.createElement('a');
        logoutBtn.href = "#";
        logoutBtn.classList.add('btn', 'btn-logout');
        logoutBtn.textContent = 'Выход';
        logoutBtn.addEventListener('click', handleLogout);

        navLinksContainer.appendChild(userInfo);
        navLinksContainer.appendChild(logoutBtn);
    } else {
        // Пользователь не вошел в систему (или аноним)
        const loginLink = document.createElement('a');
        loginLink.href = "login.html";
        loginLink.classList.add('btn', 'btn-login');
        loginLink.textContent = 'Вход в аккаунт';

        const registerLink = document.createElement('a');
        registerLink.href = "register.html";
        registerLink.classList.add('btn', 'btn-login');
        registerLink.textContent = 'Регистрация';

        // Добавляем ссылки только если они не ведут на текущую страницу
        if (!window.location.pathname.includes('login.html')) {
            navLinksContainer.appendChild(loginLink);
        }
        if (!window.location.pathname.includes('register.html')) {
            navLinksContainer.appendChild(registerLink);
        }
    }
}

// --- 5. Обработчики Аутентификации ---
async function handleLogin(event) {
    event.preventDefault();
    
    // ГАРАНТИРУЕМ, что Firebase инициализирован до продолжения
    try {
        await firebaseInitPromise; 
    } catch (e) {
        showMessage("Не удалось подключиться к системе аутентификации. Пожалуйста, обновите страницу.", "error");
        return;
    }
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Диагностика: Пытаемся записать в Firestore
        await saveLoginTime(userCredential.user.uid); 
        
        showMessage("Успешный вход! Перенаправление...", "success");
        setTimeout(() => {
            window.location.href = 'books.html'; 
        }, 1500);
    } catch (error) {
        let errorMessage = 'Ошибка входа.';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'Пользователь с таким email не найден.';
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Неверный пароль или email.';
        } else {
            errorMessage = 'Ошибка: ' + error.message;
        }
        showMessage(errorMessage, "error");
        console.error("Ошибка входа:", error);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    // ГАРАНТИРУЕМ, что Firebase инициализирован до продолжения
    try {
        await firebaseInitPromise; 
    } catch (e) {
        showMessage("Не удалось подключиться к системе аутентификации. Пожалуйста, обновите страницу.", "error");
        return;
    }
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        showMessage("Пароли не совпадают.", "error");
        return;
    }
    if (password.length < 6) {
         showMessage("Пароль должен быть не менее 6 символов.", "error");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Диагностика: Пытаемся записать в Firestore
        await saveLoginTime(userCredential.user.uid); 

        showMessage("Регистрация успешна! Вы вошли в систему.", "success");
        setTimeout(() => {
            window.location.href = 'books.html'; 
        }, 1500);
    } catch (error) {
        let errorMessage = 'Ошибка регистрации.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Этот email уже используется.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Некорректный email адрес.';
        } else {
            errorMessage = 'Ошибка: ' + error.message;
        }
        showMessage(errorMessage, "error");
        console.error("Ошибка регистрации:", error);
    }
}

async function handleLogout(event) {
    event.preventDefault();
    
    // ГАРАНТИРУЕМ, что Firebase инициализирован до продолжения
    try {
        await firebaseInitPromise; 
    } catch (e) {
        showMessage("Не удалось подключиться к системе аутентификации. Пожалуйста, обновите страницу.", "error");
        return;
    }

    try {
        await signOut(auth);
        showMessage("Вы вышли из аккаунта.", "success");
        // Перенаправление на главную или страницу входа после выхода
        setTimeout(() => {
            window.location.href = 'index.html'; 
        }, 1000);
    } catch (error) {
        showMessage("Ошибка выхода: " + error.message, "error");
        console.error("Ошибка выхода:", error);
    }
}


// --- 6. Логика Динамических Эффектов ---

// Эффект параллакса для главной страницы
function setupParallaxEffect() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return; 

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        // Смещение фона, чтобы создать эффект параллакса
        heroSection.style.backgroundPositionY = `calc(50% + ${scrolled * 0.3}px)`;
    });
}

// Контроль доступа к Библиотеке
function checkAccess(user) {
    const booksSection = document.querySelector('.books-section');
    const bookListWrapper = document.getElementById('book-list-wrapper');
    if (!booksSection || !bookListWrapper) return;

    // Если пользователь не существует или он анонимный
    if (!user || user.isAnonymous) {
        // Создаем оверлей, если его нет
        if (!document.getElementById('access-denied-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'access-denied-overlay';
            overlay.classList.add('access-denied-overlay');
            overlay.innerHTML = `
                <h2>Доступ ограничен</h2>
                <p>Для чтения и скачивания книг, пожалуйста, войдите в свой аккаунт или зарегистрируйтесь.</p>
                <a href="login.html" class="btn-login-link"><i class="fa-solid fa-lock"></i> Войти в систему</a>
            `;
            bookListWrapper.appendChild(overlay);
        }
        // Скрываем список книг
        const bookList = document.querySelector('.book-list');
        if (bookList) bookList.style.opacity = '0.3';
    } else {
        // Пользователь авторизован - убираем оверлей и восстанавливаем opacity
        const overlay = document.getElementById('access-denied-overlay');
        if (overlay) overlay.remove();
        
        const bookList = document.querySelector('.book-list');
        if (bookList) bookList.style.opacity = '1';
    }
}


// --- 7. Запуск всех скриптов ---
document.addEventListener('DOMContentLoaded', () => {
    // 2. Логика для главной страницы (Вкладки + Parallax)
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabButtons.length > 0) {
        function switchTab(targetId) {
            tabButtons.forEach(button => button.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            const activeButton = document.querySelector(`.tab-button[data-tab="${targetId}"]`);
            const activeContent = document.getElementById(targetId);

            if (activeButton && activeContent) {
                activeButton.classList.add('active');
                activeContent.classList.add('active');
            }
        }
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-tab');
                switchTab(targetId);
            });
        });
        // Активируем первую вкладку по умолчанию
        const initialTabId = tabButtons[0].getAttribute('data-tab');
        switchTab(initialTabId);
    }
    
    // Запуск параллакса
    setupParallaxEffect();

    // 3. Логика для страницы Библиотеки (Фильтр + Контроль доступа)
    const filterButtons = document.querySelectorAll('.filter-btn');
    const bookItems = document.querySelectorAll('.book-item');
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const filterValue = button.getAttribute('data-filter');
                bookItems.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');
                    if (filterValue === 'all' || filterValue === itemCategory) {
                        item.classList.remove('hide');
                        item.style.animation = 'fadeIn 0.5s ease'; // Повторный запуск анимации
                    } else {
                        item.classList.add('hide');
                    }
                });
            });
        });
    }


    // 4. Обработчики форм Входа и Регистрации
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});
