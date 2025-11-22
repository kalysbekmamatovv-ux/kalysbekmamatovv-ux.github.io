document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ЛОГИКА ДЛЯ ГЛАВНОЙ СТРАНИЦЫ (ВКЛАДКИ)
    // ==========================================
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

    // ==========================================
    // 2. ЛОГИКА ДЛЯ БИБЛИОТЕКИ (ФИЛЬТР КНИГ)
    // ==========================================
    const filterButtons = document.querySelectorAll('.filter-btn');
    const bookItems = document.querySelectorAll('.book-item');

    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                
                // Убираем активность у всех кнопок
                filterButtons.forEach(btn => btn.classList.remove('active'));
                // Делаем активной нажатую
                button.classList.add('active');

                const filterValue = button.getAttribute('data-filter');

                bookItems.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');

                    if (filterValue === 'all' || filterValue === itemCategory) {
                        // Показать книгу
                        item.classList.remove('hide');
                    } else {
                        // Скрыть книгу
                        item.classList.add('hide');
                    }
                });
            });
        });
    }

});
