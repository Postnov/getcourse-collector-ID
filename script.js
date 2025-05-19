// ==UserScript==
// @name         GetCourse ID Collector
// @namespace    https://dev-postnov.ru/
// @version      3.0.0
// @description  Виджет для сбора ID уроков и тренингов на страницах GetCourse с адаптивной контрастностью
// @author       Daniil Postnov
// @match        *://*/teach/control/stream/*
// @match        *://*/teach/control/*
// @match        *://*/teach/*
// @match        *://*/teach
// @match        *://*/teach/control
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ====== ФУНКЦИИ ДЛЯ КОНТРАСТНОЙ ПОДСТАНОВКИ ЦВЕТА ======

    // Определяем яркость цвета (0...255) на основе R,G,B
    function getLuminance(colorStr) {
        // Ищем в формате rgb(...) / rgba(...)
        const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!rgbMatch) {
            // Если фон не найден (transparent и т.д.), возвращаем белую яркость
            return 255;
        }
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);

        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Возвращаем пару (bg, text) для контрастной плашки
    function getContrastingColors(parentBgColor) {
        const lum = getLuminance(parentBgColor);

        const lightBg = '#F0F0F0';
        const lightText = '#000000';
        const darkBg = '#333333';
        const darkText = '#FFFFFF';

        // Выбираем «тёмная плашка» при светлом фоне, и наоборот
        if (lum > 127) {
            return {
                bg: darkBg,
                text: darkText
            };
        } else {
            return {
                bg: lightBg,
                text: lightText
            };
        }
    }

    // ====== DEBOUNCE ======
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ====== СЕЛЕКТОРЫ И ОБЩИЕ ПЕРЕМЕННЫЕ ======

    const LESSON_SELECTORS = [
        '.lesson-list li a',
        '.lesson-is-hidden',
        '[onclick*="/teach/control/lesson/view/id/"]'
    ].join(', ');



    let isUpdating = false; // флаг для защиты от рекурсии

    // ====== EXTRACT ID ======
    function extractId(element) {
        let id = null;

        if (element.href) {
            const match = element.href.match(/\/id\/(\d+)/);
            if (match) id = match[1];
        }
        if (!id && element.getAttribute('onclick')) {
            const match = element.getAttribute('onclick').match(/\/id\/(\d+)/);
            if (match) id = match[1];
        }
        return id;
    }

    // ====== ДОБАВЛЕНИЕ МЕТКИ ID ======
    function createIdLabel(id, parentElement) {
        const label = document.createElement('span');
        label.className = 'id-label';
        label.textContent = `ID: ${id}`;
        label.title = 'Нажмите, чтобы скопировать';

        // Определяем цвет фона родителя и выставляем контрастный
        const computedStyle = window.getComputedStyle(parentElement);
        const bgColorParent = computedStyle.backgroundColor;
        const {
            bg,
            text
        } = getContrastingColors(bgColorParent);

        label.style.backgroundColor = bg;
        label.style.color = text;

        // Клик по плашке (копирование)
        label.addEventListener('click', () => {
            GM_setClipboard(`'${id}'`);
            label.textContent = 'Скопировано!';
            setTimeout(() => {
                label.textContent = `ID: ${id}`;
            }, 1000);
        });

        return label;
    }

    // ====== ПОКАЗ ID ======
    function showIds() {
        if (isUpdating) return;
        isUpdating = true;

        try {
            // Удаляем старые плашки
            document.querySelectorAll('.id-label').forEach(label => label.remove());

            // ТРЕНИНГИ
            document.querySelectorAll('.training-row a').forEach(link => {
                const id = extractId(link);
                if (id) {
                    const td = link.closest('td');
                    if (td) {
                        const label = createIdLabel(id, td);
                        td.appendChild(label);
                    }
                }
            });

            // УРОКИ
            document.querySelectorAll(LESSON_SELECTORS).forEach(element => {
                const id = extractId(element);
                if (id) {
                    // 1) Пытаемся найти <td>
                    let container = element.closest('td');

                    // 2) Если нет <td>, пробуем найти <li>
                    if (!container) {
                        container = element.closest('li');
                    }

                    // 3) Если и <li> нет, как fallback берём родителя
                    if (!container) {
                        container = element.parentElement;
                    }

                    if (container) {
                        const label = createIdLabel(id, container);
                        container.appendChild(label);
                    }
                }
            });

        } catch (error) {
            console.error('Error in showIds:', error);
            GM_notification('Произошла ошибка при обновлении ID', 'GetCourse Widget');
        } finally {
            isUpdating = false;
        }
    }

    // ====== ОБРАБОТЧИК MUTATION OBSERVER ======
    const observer = new MutationObserver(
        debounce((mutations) => {
            const hasRelevantChanges = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== 1) return false;
                    const isOurElement =
                        node.classList?.contains('id-label') ||
                        node.classList?.contains('get-id-widget-panel') ||
                        node.classList?.contains('get-id-widget-tooltip');
                    return !isOurElement;
                });
            });
            if (hasRelevantChanges && !isUpdating) {
                if (!document.querySelector('.get-id-widget-panel')) {
                    addWidget();
                }
                showIds();
            }
        }, 100)
    );

    // ====== ДОБАВЛЕНИЕ ПАНЕЛИ И ТУЛТИПА ======
    function addWidget() {
        if (document.querySelector('.get-id-widget-panel')) return;

        const panel = document.createElement('div');
        panel.className = 'get-id-widget-panel';

        const copyButton = document.createElement('button');
        const viewButton = document.createElement('button');
        const clearButton = document.createElement('button');

        copyButton.textContent = 'Скопировать ID';
        viewButton.textContent = 'Посмотреть буфер';
        clearButton.textContent = 'Очистить буфер';

        panel.appendChild(copyButton);
        panel.appendChild(viewButton);
        panel.appendChild(clearButton);
        document.body.appendChild(panel);

        // Тултип
        const tooltip = document.createElement('div');
        tooltip.className = 'get-id-widget-tooltip';
        document.body.appendChild(tooltip);

        // Вызываем applyStyles() — сам CSS не приводим
        applyStyles();

        // ------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -------
        function updateButtonText(button, text, isError = false) {
            button.textContent = text;
            button.style.backgroundColor = isError ? '#f44336' : '#fff';
        }

        function getUniqueArray(arr) {
            return [...new Set(arr)];
        }

        // Парсинг буфера
        function parseClipboardContent(content) {
            const result = {
                trainings: [],
                lessons: []
            };

            const trainingsMatch = content.match(/\/\* Тренинги \*\/([\s\S]*?)(?=\/\* Уроки \*\/|$)/);
            if (trainingsMatch) {
                const trainingsContent = trainingsMatch[1].trim();
                if (trainingsContent) {
                    result.trainings = trainingsContent.split(/,\s*/).filter(id => id.length > 0);
                }
            }

            const lessonsMatch = content.match(/\/\* Уроки \*\/([\s\S]*)/);
            if (lessonsMatch) {
                const lessonsContent = lessonsMatch[1].trim();
                if (lessonsContent) {
                    result.lessons = lessonsContent.split(/,\s*/).filter(id => id.length > 0);
                }
            }
            return result;
        }

        // ------- ОБРАБОТЧИКИ СОБЫТИЙ -------
        // Копирование
        copyButton.addEventListener('click', () => {
            updateButtonText(copyButton, 'Собираем ID...');

            try {
                const trainingLinks = document.querySelectorAll('.training-row a');
                const newTrainingIds = Array.from(trainingLinks)
                    .map(link => extractId(link))
                    .filter(Boolean)
                    .map(id => `'${id}'`);

                const newLessonIds = Array.from(document.querySelectorAll(LESSON_SELECTORS))
                    .map(el => extractId(el))
                    .filter(Boolean)
                    .map(id => `'${id}'`);

                navigator.clipboard.readText()
                    .then(currentText => {
                        const currentIds = parseClipboardContent(currentText);
                        const updatedTrainingIds = getUniqueArray([...currentIds.trainings, ...newTrainingIds]);
                        const updatedLessonIds = getUniqueArray([...currentIds.lessons, ...newLessonIds]);

                        let clipboardText = '';
                        if (updatedTrainingIds.length > 0) {
                            clipboardText += `/* Тренинги */\n${updatedTrainingIds.join(', ')}`;
                        }
                        if (updatedLessonIds.length > 0) {
                            if (clipboardText) clipboardText += '\n\n';
                            clipboardText += `/* Уроки */\n${updatedLessonIds.join(', ')}`;
                        }
                        if (!clipboardText) {
                            clipboardText = 'Не найдено ID для копирования';
                        }

                        GM_setClipboard(clipboardText);
                        GM_notification('ID скопированы!', 'GetCourse Widget');
                        updateButtonText(copyButton, 'Скопировано! ✅');
                        setTimeout(() => updateButtonText(copyButton, 'Скопировать ID'), 3000);

                        // Обновим тултип
                        tooltip.innerHTML = clipboardText ?
                            `<div class="tooltip-content">${clipboardText}</div>` :
                            '<div class="tooltip-content">Буфер обмена пуст</div>';
                    })
                    .catch(() => {
                        updateButtonText(copyButton, 'Ошибка чтения буфера ❌', true);
                        setTimeout(() => updateButtonText(copyButton, 'Скопировать ID'), 3000);
                    });
            } catch (error) {
                console.error('Error copying IDs:', error);
                updateButtonText(copyButton, 'Ошибка ❌', true);
                setTimeout(() => updateButtonText(copyButton, 'Скопировать ID'), 3000);
            }
        });

        // Очистка буфера
        clearButton.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите очистить буфер обмена?')) {
                GM_setClipboard('');
                GM_notification('Буфер обмена очищен!', 'GetCourse Widget');
                updateButtonText(clearButton, 'Буфер очищен! ✅');
                setTimeout(() => updateButtonText(clearButton, 'Очистить буфер'), 3000);
                tooltip.innerHTML = '<div class="tooltip-content">Буфер обмена пуст</div>';
            }
        });

        // Просмотр буфера
        viewButton.addEventListener('click', () => {
            if (tooltip.classList.contains('show')) {
                tooltip.classList.remove('show');
                tooltip.style.display = 'none';
                viewButton.textContent = 'Посмотреть буфер';
            } else {
                navigator.clipboard.readText()
                    .then(bufferContent => {
                        tooltip.innerHTML = bufferContent ?
                            `<div class="tooltip-content">${bufferContent}</div>` :
                            '<div class="tooltip-content">Буфер обмена пуст</div>';
                        tooltip.classList.add('show');
                        tooltip.style.display = 'block';
                        tooltip.style.maxHeight = `${window.innerHeight - 100}px`;
                        tooltip.style.overflowY = 'auto';
                        viewButton.textContent = 'Закрыть буфер';
                    })
                    .catch(() => {
                        tooltip.innerHTML = '<div class="tooltip-content">Ошибка чтения буфера</div>';
                        tooltip.classList.add('show');
                        tooltip.style.display = 'block';
                        viewButton.textContent = 'Закрыть буфер';
                    });
            }
        });
    }

    // ====== applyStyles() (CSS-ЧАСТЬ ОПУЩЕНА) ======
    // Функция для применения стилей
    function applyStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `

.lesson-list li {
  position: relative !important;
}

      /* Панель виджета */
      .get-id-widget-panel {
        position: fixed !important;
        top: 0 !important;
        right: 20px !important;
        z-index: 999999 !important;
        display: flex !important;
        align-items: center !important;
        padding: 10px !important;
        background-color: #8F93FF !important;
        border-radius: 0 0 12px 12px !important;
        box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.2) !important;
        font-family: 'Roboto', sans-serif !important;
      }

      /* Стили кнопок */
      .get-id-widget-panel button {
        background-color: #fff !important;
        color: #222 !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 10px 20px !important;
        margin: 0 5px !important;
        font-size: 14px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        width: 200px !important;
      }

      /* Эффект наведения на кнопки */
      .get-id-widget-panel button:hover {
        opacity: .85 !important;
      }

      /* Тултип для отображения буфера */
      .get-id-widget-tooltip {
        position: fixed !important;
        display: none !important;
        background-color: #fff !important;
        color: #222 !important;
        border: 1px solid #8F93FF !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2) !important;
        white-space: pre-line !important;
        max-width: 500px !important;
        z-index: 999999 !important;
        top: 70px !important;
        right: 20px !important;
      }

      /* Видимость тултипа */
      .get-id-widget-tooltip.show {
        display: block !important;
      }

      /* Содержимое тултипа */
      .tooltip-content {
        max-height: 300px !important;
        overflow-y: auto !important;
      }

      /* Кнопка очистки буфера */
      .get-id-widget-panel button:nth-child(3) {
        position: absolute !important;
        bottom: -25px !important;
        padding: 1px 10px !important;
        font-size: 12px !important;
        color: red !important;
        width: max-content !important;
        background: none !important;
      }

      /* Стили для плашек с ID */
      .id-label {
      position: absolute !important;
      right: 20px !important;
      bottom: 20px !important;
        display: inline-block !important;
        margin-left: 10px !important;
        padding: 4px 10px !important;
        border-radius: 4px !important;
        color: #000;
        font-size: 14px !important;
        cursor: pointer !important;
        transition: opacity 0.2s ease-out !important;
        z-index: 100 !important;
        width: max-content !important;
        transform: translateZ(0) !important;
      }

      /* Эффект наведения на плашки */
      .id-label:hover {
        opacity: 0.8 !important;
      }

      /* Убираем прозрачность у training-row, чтобы ID были видны */
      .training-row td a {
        opacity: 1 !important;
      }

      /* Стили для ID внутри скрытых уроков */
      .lesson-is-hidden .id-label {
        margin-left: 5px !important;
        vertical-align: middle !important;
      }
    `;
        document.head.appendChild(styleElement);
    }

    // ====== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ======
    window.addEventListener('load', () => {
        if (!document.body) {
            console.error('Body element not found');
            return;
        }
        addWidget();
        showIds();
    });

    // Подключаем observer
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
})();