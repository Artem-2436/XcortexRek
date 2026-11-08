// === КОНФИГУРАЦИЯ SUPABASE ===
// ВСТАВЬ СЮДА СВОИ ДАННЫЕ ИЗ ПАНЕЛИ SUPABASE -> PROJECT SETTINGS -> API
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; 
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY_HERE'; 

// Инициализация клиента
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const articlesContainer = document.getElementById('articlesContainer');
    const openFormBtn = document.getElementById('openFormBtn');
    const closeFormBtn = document.getElementById('closeFormBtn');
    const formModal = document.getElementById('formModal');
    const applicationForm = document.getElementById('applicationForm');
    const tagSearchInput = document.getElementById('tagSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchStatus = document.getElementById('searchStatus');

    let currentPosts = []; // Кэш всех постов для быстрого поиска
    let currentUserEmail = null; // Определяем текущего пользователя для лайков

    // --- ИНИЦИАЛИЗАЦИЯ ---
    
    // Попытка получить email из localStorage (если пользователь ранее вводил его)
    // Или можно использовать prompt, но лучше сохранять после первой отправки формы
    const savedEmail = localStorage.getItem('xc_rek_user_email');
    if(savedEmail) currentUserEmail = savedEmail;

    loadPosts();

    // --- ОБРАБОТЧИКИ СОБЫТИЙ UI ---

    // Открытие/закрытие модалки
    openFormBtn.addEventListener('click', () => {
        formModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        applicationForm.reset();
    });

    closeFormBtn.addEventListener('click', closeModal);
    formModal.addEventListener('click', (e) => {
        if(e.target === formModal) closeModal();
    });

    function closeModal() {
        formModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Поиск по тегам
    tagSearchInput.addEventListener('input', debounce(handleSearch, 300));
    
    clearSearchBtn.addEventListener('click', () => {
        tagSearchInput.value = '';
        handleSearch();
    });

    // Отправка формы
    applicationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitNewPost();
    });

    // --- ЛОГИКА SUPABASE ---

    async function loadPosts() {
        articlesContainer.innerHTML = '<div class="loading-state">Загрузка...</div>';
        
        try {
            // Выбираем все одобренные посты, сортируем по лайкам (убывание)
            const { data, error } = await supabaseClient
                .from('xc_rek_content_vault')
                .select('*')
                .eq('is_approved', true)
                .order('like_count', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            currentPosts = data || [];
            renderPosts(currentPosts);
        } catch (err) {
            console.error(err);
            articlesContainer.innerHTML = `<div class="error-message">Ошибка загрузки данных: ${err.message}</div>`;
        }
    }

    async function submitNewPost() {
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const title = document.getElementById('postTitle').value.trim();
        const adType = document.getElementById('adType').value;
        const rawTags = document.getElementById('tagsInput').value.trim();
        const bodyText = document.getElementById('statementText').value.trim();

        if(!fullName || !email || !title || !rawTags || !bodyText) {
            alert("Заполните все поля");
            return;
        }

        // Парсинг тегов: убираем пробелы, приводим к нижнему регистру, удаляем пустые
        const tagsArray = rawTags.split(',')
            .map(t => t.trim().replace(/^#+/, '').toLowerCase()) // Удаляем # если пользователь поставил
            .filter(t => t.length > 0);

        if(tagsArray.length === 0) {
            alert("Введите хотя бы один тег");
            return;
        }

        // Сохраняем email пользователя локально для будущих лайков
        localStorage.setItem('xc_rek_user_email', email);
        currentUserEmail = email;

        // 1. Проверяем/создаем пользователя в registry (упрощенно, просто пытаемся вставить или игнорируем ошибку дубликата)
        // Для MVP пропускаем создание отдельной записи в users, привязываем напрямую через email в engagement log
        
        // 2. Вставляем пост
        const { data: postData, error: postError } = await supabaseClient
            .from('xc_rek_content_vault')
            .insert({
                title: title,
                body_text: bodyText,
                tags_array: tagsArray,
                like_count: 0,
                is_approved: true // Автоматическая модерация для теста
                // user_id оставляем null или генерируем, но для простоты будем опираться на email в лайках
            })
            .select();

        if (postError) {
            alert("Ошибка при отправке: " + postError.message);
            return;
        }

        alert("Заявление успешно опубликовано!");
        closeModal();
        loadPosts(); // Обновляем ленту
    }

    async function toggleLike(postId) {
        if (!currentUserEmail) {
            alert("Для оценки необходимо сначала отправить заявление или указать email в настройках (демо-режим: укажите email в форме перед лайком)");
            return;
        }

        const button = document.querySelector(`button[data-post-id="${postId}"]`);
        const countSpan = button.querySelector('.like-count');
        const originalCount = parseInt(countSpan.textContent);

        // Проверка, лайкнул ли уже этот пользователь?
        // Делаем быстрый запрос или проверяем кэш. Для простоты попробуем удалить, если ошибка - значит вставим.
        // Но лучший способ: проверить наличие записи в xc_rek_engagement_log
        
        const { data: existingLike, error: checkErr } = await supabaseClient
            .from('xc_rek_engagement_log')
            .select('id')
            .eq('post_id', postId)
            .eq('user_email', currentUserEmail)
            .single();

        if (checkErr && checkErr.code !== 'PGRST116') { // PGRST116 означает "not found", это ок
             console.error(checkErr);
             return;
        }

        if (existingLike) {
            // Убираем лайк
            const { error: delErr } = await supabaseClient
                .from('xc_rek_engagement_log')
                .delete()
                .eq('id', existingLike.id);
            
            if(delErr) {
                alert("Ошибка удаления лайка");
                return;
            }
            
            // Обновляем UI
            button.classList.remove('active');
            countSpan.textContent = Math.max(0, originalCount - 1);
        } else {
            // Ставим лайк
            const { error: insErr } = await supabaseClient
                .from('xc_rek_engagement_log')
                .insert({
                    post_id: postId,
                    user_email: currentUserEmail
                });

            if(insErr) {
                alert("Ошибка постановки лайка");
                return;
            }

            // Обновляем UI
            button.classList.add('active');
            countSpan.textContent = originalCount + 1;
        }
    }

    // --- РЕНДЕРИНГ ---

    function renderPosts(postsToRender) {
        articlesContainer.innerHTML = '';

        if (postsToRender.length === 0) {
            articlesContainer.innerHTML = '<div class="loading-state">Ничего не найдено. Будьте первым!</div>';
            return;
        }

        postsToRender.forEach(post => {
            const articleEl = document.createElement('article');
            articleEl.className = 'article-card glass-card';
            
            // Форматируем дату
            const dateObj = new Date(post.created_at);
            const formattedDate = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

            // Генерируем HTML тегов
            const tagsHtml = post.tags_array.map(tag => 
                `<span class="tag-pill" onclick="applyTagFilter('${tag}')">#${tag}</span>`
            ).join('');

            // SVG сердечко
            const heartSvg = `<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

            articleEl.innerHTML = `
                <div class="article-header">
                    <h3 class="article-title">${escapeHtml(post.title)}</h3>
                    <span class="article-date">${formattedDate}</span>
                </div>
                <div class="article-body">
                    <p>${escapeHtml(post.body_text)}</p>
                </div>
                <div class="article-meta">
                    <div class="tags-list">
                        ${tagsHtml}
                    </div>
                    <button class="like-btn" data-post-id="${post.id}" onclick="window.handleLikeClick('${post.id}', this)">
                        ${heartSvg}
                        <span class="like-count">${post.like_count}</span>
                    </button>
                </div>
            `;
            articlesContainer.appendChild(articleEl);
        });
    }

    // Глобальные функции для вызова из inline onclick (упрощение для single-file approach)
    window.applyTagFilter = function(tag) {
        tagSearchInput.value = '#' + tag;
        handleSearch();
    };

    window.handleLikeClick = function(postId, btnElement) {
        toggleLike(postId);
    };

    // --- ПОИСК ---

    function handleSearch() {
        const query = tagSearchInput.value.toLowerCase().trim();
        
        if (query === '') {
            showAllPosts();
            return;
        }

        // Извлекаем тег, убирая # и лишние пробелы
        const cleanQuery = query.replace(/#/g, '').trim();
        
        if (!cleanQuery) {
            showAllPosts();
            return;
        }

        // Фильтруем кэш постов
        const filtered = currentPosts.filter(post => {
            return post.tags_array.some(tag => tag.includes(cleanQuery));
        });

        searchStatus.textContent = `Найдено совпадений: ${filtered.length}`;
        clearSearchBtn.classList.remove('hidden');
        renderPosts(filtered);
    }

    function showAllPosts() {
        searchStatus.textContent = '';
        clearSearchBtn.classList.add('hidden');
        renderPosts(currentPosts);
    }

    // Утилита защиты от XSS
    function escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Debounce для поиска
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});
