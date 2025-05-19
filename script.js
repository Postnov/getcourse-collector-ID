// ==UserScript==
// @name         Копирование ID уроков через запятую
// @namespace    http://tampermonkey.net/
// @version      v1.0
// @description  Copy all ID from lessons in  separated by commas
// @author       Daniil Postnov
// @match        *teach/control/stream/view/id/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

document.addEventListener('DOMContentLoaded', function() {
    // Создаем кнопку "Скопировать ID"
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Скопировать ID уроков на странице';
    copyButton.className = 'copy-button';
    document.body.appendChild(copyButton);

    // Стили для кнопки
    const buttonStyles = `
        position: fixed;
        top: 40px;
        right: 40px;
        padding: 15px 20px;
        color: #fff;
        border: none;
        cursor: pointer;
        background: #a75cf8;
        z-index: 10000;
        border-radius: 5px;
        font-family: 'Golos', sans-serif;
        font-size: 16px;
    `;

    // Применяем стили к кнопке через атрибут style
    copyButton.style.cssText = buttonStyles;

    // Сохраняем исходный цвет кнопки
    const originalButtonColor = copyButton.style.backgroundColor;

    // Добавляем обработчик клика на кнопку
    copyButton.addEventListener('click', async function() {
        // Находим все элементы с классом lesson-list
        const lessonLists = document.querySelectorAll('.lesson-list');

        if (lessonLists.length > 0) {
            // Создаем массив для хранения всех data-lesson-id
            const allLessonIds = [];

            // Проходим по каждому элементу с классом lesson-list
            lessonLists.forEach(function(lessonList) {
                // Находим все элементы li внутри текущего lessonList
                const lessonItems = lessonList.querySelectorAll('li');

                // Проходим по каждому элементу li
                lessonItems.forEach(function(item) {
                    // Получаем значение атрибута data-lesson-id и добавляем в массив
                    const lessonId = item.getAttribute('data-lesson-id');
                    if (lessonId) {
                        allLessonIds.push(lessonId);
                    }
                });
            });

            // Формируем строку из массива allLessonIds, разделенную запятыми
            const idString = allLessonIds.join(', ');

            // Пытаемся скопировать idString в буфер обмена
            try {
                await navigator.clipboard.writeText(idString);

                // Устанавливаем текст и цвет кнопки на "Скопировано" (зеленый)
                copyButton.textContent = 'Скопировано';
                copyButton.style.backgroundColor = '#3faa59';

                // Ждем 2 секунды, затем возвращаем текст и цвет кнопки на исходные
                setTimeout(function() {
                    copyButton.textContent = 'Скопировать ID уроков на странице';
                    copyButton.style.backgroundColor = originalButtonColor;
                }, 2000);
            } catch (err) {
                console.error('Не удалось скопировать список ID в буфер обмена:', err);
                alert('Ошибка при копировании ID в буфер обмена');
            }
        } else {
            console.error('Элементы с классом .lesson-list не найдены на странице.');
        }
    });
});

})();