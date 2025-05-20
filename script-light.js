// ==UserScript==
// @name         GetCourse ID Collector Light
// @namespace    https://dev-postnov.ru/
// @version      1.0.0
// @description  Упрощенная версия виджета для отображения ID уроков и тренингов на GetCourse с адаптивной контрастностью
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
            GM_setClipboard(id);
            label.textContent = 'Скопировано!';
            GM_notification(`ID: ${id} скопирован!`, 'GetCourse ID Collector Light');
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
                    const isOurElement = node.classList?.contains('id-label');
                    return !isOurElement;
                });
            });
            if (hasRelevantChanges && !isUpdating) {
                showIds();
            }
        }, 100)
    );

    // ====== ПРИМЕНЕНИЕ СТИЛЕЙ ======
    function applyStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
.lesson-list li {
  position: relative !important;
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
        applyStyles();
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