/* QSNotify: QueueSmart pop-up notifications through toast
* When something changes in the user's queue, a notification pop-up appears in the 
* corner of the screen. Clicking it takes the user to the Queue status page. 
* Notifications are also kept on the notification page as a list ( can be removed if we feel we don't need it)
* 
*/


(function (global) {
    'use strict';

    var STORAGE_KEY = 'qs_notifications';
    var TOAST_MS = 6000; // how long a pop-up stays before sliding away

    // When the notification is clicked, it should take the user to queue status
  
    var thisScript = document.currentScript;
    var QUEUE_STATUS_URL =
        (thisScript && thisScript.getAttribute('data-queue-status')) || 'queue-status.html';

    // Notification types with icons
    var TYPES = {
        queue: {label: 'Queue Update',  icon: '↕'},
        status: {label: 'Status Change', icon: '●'},
        info: {label: 'Info',          icon: 'ℹ'}
    };

    // Storage

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) { return JSON.parse(raw); }
        } catch (e) { /* unavailable or bad JSON */ }
        return null;
    }

    function save(list) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
        catch (e) { /* ignore */ }
    }

    // Sample notifications, so its not empty
    function seed() {
        var now = Date.now();
        var min = 60 * 1000;
        return [
            { id: now - 1, type: 'status', title: 'Almost ready',
              message: 'You are next in line for Academic Advising.',
              time: new Date(now - 3 * min).toISOString() },
            { id: now - 2, type: 'queue', title: 'Position updated',
              message: 'Your position for Academic Advising changed from 4 to 3.',
              time: new Date(now - 15 * min).toISOString() }
        ];
    }

    if (load() === null) { save(seed()); }

    // Data

    function getAll() {
        var list = load();
        return Array.isArray(list) ? list : [];
    }

    // Adds a notification, stores it, refresh list, and send a toast noti
    function add(notif) {
        notif = notif || {};
        var type = TYPES[notif.type] ? notif.type : 'info';
        var item = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            type: type,
            title: notif.title || TYPES[type].label,
            message: notif.message || '',
            time: new Date().toISOString()
        };
        var list = getAll();
        list.unshift(item);
        save(list);
        renderAll();
        showToast(item);
        return item;
    }

    // The two notis needed for this project, also wrapped so team members can use
    function queueUpdate(service, from, to) {
        return add({
            type: 'queue',
            title: 'Position updated',
            message: 'Your position for ' + service + ' changed from ' + from + ' to ' + to + '.'
        });
    }

    function statusChange(service, status) {
        var messages = {
            'waiting':      { title: 'Waiting',      msg: 'You are now waiting in the ' + service + ' queue.' },
            'almost-ready': { title: 'Almost ready', msg: 'You are almost up for ' + service + '. Please stay nearby.' },
            'served':       { title: 'Served',       msg: 'Your ' + service + ' request has been completed.' }
        };
        var m = messages[status] || { title: 'Status update', msg: 'Status changed for ' + service + '.' };
        var item = add({ type: 'status', title: m.title, message: m.msg });

        // Added to clear the notification list after being served
        if (status === 'served') { clearAll(); }

        return item;
    }

    function clearAll() { save([]); renderAll(); }

    // Helper functions

    function relativeTime(iso) {
        var diff = Date.now() - new Date(iso).getTime();
        var sec = Math.round(diff / 1000);
        if (sec < 60) { return 'just now'; }
        var min = Math.round(sec / 60);
        if (min < 60) { return min + ' min ago'; }
        var hr = Math.round(min / 60);
        if (hr < 24) { return hr + (hr === 1 ? ' hour ago' : ' hours ago'); }
        var day = Math.round(hr / 24);
        return day + (day === 1 ? ' day ago' : ' days ago');
    }

    function esc(value) {
        var div = document.createElement('div');
        div.textContent = (value == null) ? '' : String(value);
        return div.innerHTML;
    }

    function iconFor(type) { return (TYPES[type] || TYPES.info).icon; }
    function labelFor(type) { return (TYPES[type] || TYPES.info).label; }

    // Toast

    // Fixed container that holds the pop ups
    function toastWrap() {
        var wrap = document.querySelector('.qs-toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'qs-toast-wrap';
            document.body.appendChild(wrap);
        }
        return wrap;
    }

    function hideToast(el) {
        el.classList.add('is-leaving');
        setTimeout(function () {
            if (el.parentNode) { el.parentNode.removeChild(el); }
        }, 300);
    }

    function showToast(item) {
        if (!document.body) { return; } // nothing to attach to yet
        var wrap = toastWrap();

        var el = document.createElement('div');
        el.className = 'qs-toast qs-toast-' + item.type;
        el.setAttribute('role', 'alert');
        el.innerHTML =
            '<span class="qs-dot qs-' + item.type + '">' + iconFor(item.type) + '</span>' +
            '<div class="qs-toast-body">' +
                '<div class="qs-toast-title">' + esc(item.title) + '</div>' +
                '<div class="qs-toast-msg">' + esc(item.message) + '</div>' +
                '<div class="qs-toast-hint">Click to view queue status &rarr;</div>' +
            '</div>' +
            '<button class="qs-toast-close" aria-label="Dismiss">×</button>';

        // Click the toast body go to Queue Status
        el.addEventListener('click', function () {
            global.location.assign(QUEUE_STATUS_URL);
        });
        // Close button dismisses without navigating
        el.querySelector('.qs-toast-close').addEventListener('click', function (e) {
            e.stopPropagation();
            hideToast(el);
        });

        wrap.appendChild(el);

        // force so the slide in transition runs
        void el.offsetWidth;
        el.classList.add('is-visible');

        setTimeout(function () { hideToast(el); }, TOAST_MS);
    }

    // List view

    // Each notification is a clickable link to the Queue Status page
    function row(n) {
        return '' +
            '<li>' +
                '<a class="qs-item" href="' + QUEUE_STATUS_URL + '">' +
                    '<span class="qs-dot qs-' + n.type + '" title="' + esc(labelFor(n.type)) + '">' +
                        iconFor(n.type) +
                    '</span>' +
                    '<div class="qs-body">' +
                        '<div class="qs-title">' + esc(n.title) + '</div>' +
                        '<div class="qs-msg">' + esc(n.message) + '</div>' +
                        '<div class="qs-time">' + esc(labelFor(n.type)) + ' &middot; ' + relativeTime(n.time) + '</div>' +
                    '</div>' +
                    '<span class="qs-go">&rarr;</span>' +
                '</a>' +
            '</li>';
    }

    function renderInto(el, limit) {
        var list = getAll();
        if (limit) { list = list.slice(0, limit); }
        el.innerHTML = list.length ?
            list.map(row).join('') :
            '<li class="qs-empty">No notifications yet.</li>';
    }

    function renderAll() {
        var dash = document.getElementById('qs-notify-dashboard');
        if (dash) { renderInto(dash, 4); }   // dashboard: latest few
        var full = document.getElementById('qs-notify-full');
        if (full) { renderInto(full, 0); }   // notifications page: all
    }

    // init

    function init() { renderAll(); }

    global.QSNotify = {
        add: add,
        queueUpdate: queueUpdate,
        statusChange: statusChange,
        getAll: getAll,
        clearAll: clearAll,
        render: renderAll
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}(window));
