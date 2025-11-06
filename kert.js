document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Функция для переключения контента
    function switchTab(targetId) {
        // 1. Убрать класс 'active' со всех кнопок и контента
        tabButtons.forEach(button => button.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // 2. Добавить класс 'active' к нужной кнопке и контенту
        // Ищем кнопку по атрибуту data-tab
        const activeButton = document.querySelector(`.tab-button[data-tab="${targetId}"]`);
        // Ищем контент по id
        const activeContent = document.getElementById(targetId);

        if (activeButton && activeContent) {
            activeButton.classList.add('active');
            activeContent.classList.add('active');
        }
    }

    // Обработчик событий для каждой кнопки
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-tab');
            switchTab(targetId);
        });
    });

    // При загрузке страницы показываем первую вкладку
    if (tabButtons.length > 0) {
        const initialTabId = tabButtons[0].getAttribute('data-tab');
        switchTab(initialTabId);
    }
});
