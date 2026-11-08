document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const openFormBtn = document.getElementById('openFormBtn');
    const closeFormBtn = document.getElementById('closeFormBtn');
    const formModal = document.getElementById('formModal');
    const applicationForm = document.getElementById('applicationForm');
    const statementTextArea = document.getElementById('statementText');
    const charCounterSpan = document.getElementById('currentChars');
    
    // Логика открытия/закрытия модального окна
    function toggleModal(show) {
        if (show) {
            formModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Блокировка скролла фона
        } else {
            formModal.classList.add('hidden');
            document.body.style.overflow = ''; // Возврат скролла
        }
    }

    openFormBtn.addEventListener('click', () => {
        toggleModal(true);
        // Очистка формы при каждом открытии для чистоты
        applicationForm.reset();
        updateCharCount();
    });

    closeFormBtn.addEventListener('click', () => {
        toggleModal(false);
    });

    // Закрытие по клику вне контента модалки
    formModal.addEventListener('click', (e) => {
        if (e.target === formModal) {
            toggleModal(false);
        }
    });

    // Подсчет символов в тексте заявления
    function updateCharCount() {
        const currentLength = statementTextArea.value.length;
        charCounterSpan.textContent = currentLength;
        
        // Визуальная индикация приближения к лимиту
        if (currentLength > 2800) {
            charCounterSpan.parentElement.style.color = '#e74c3c';
        } else {
            charCounterSpan.parentElement.style.color = '#666';
        }
    }

    statementTextArea.addEventListener('input', updateCharCount);

    // Обработка отправки формы
    applicationForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Предотвращаем стандартную отправку
        
        // Сбор данных
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const adTypeSelect = document.getElementById('adType');
        const adTypeValue = adTypeSelect.options[adTypeSelect.selectedIndex].text;
        const statementText = statementTextArea.value.trim();

        // Простая валидация (хотя HTML атрибуты required уже помогают)
        if (!fullName || !email || !adTypeSelect.value || !statementText) {
            alert("Пожалуйста, заполните все обязательные поля.");
            return;
        }

        // Формирование тела письма
        // Используем \n\n для абзацев в mailto
        const subject = encodeURIComponent(`Заявка на модерацию XcortexRek: ${fullName}`);
        
        const bodyContent = [
            "=== ДАННЫЕ ЗАЯВИТЕЛЯ ===",
            "",
            `ФИО: ${fullName}`,
            `Email: ${email}`,
            `Тип саморекламы: ${adTypeValue}`,
            "",
            "=== ТЕКСТ ЗАЯВЛЕНИЯ ===",
            "",
            statementText,
            "",
            "=========================",
            "Это автоматическое сообщение от сайта XcortexRek."
        ].join('\n');

        const body = encodeURIComponent(bodyContent);
        const recipient = "platon.99art@mail.ru";

        // Создание ссылки mailto
        const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;

        // Открытие почтового клиента
        window.location.href = mailtoLink;

        // Опционально: закрыть модалку после инициирования отправки
        setTimeout(() => {
            toggleModal(false);
            alert("Ваше заявление было передано в почтовый клиент. Пожалуйста, нажмите кнопку 'Отправить' в нем.");
        }, 500);
    });
});
