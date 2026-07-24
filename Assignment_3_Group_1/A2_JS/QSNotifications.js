/* QSNotify: QueueSmart pop-up notifications through toast
 
 Assignment 3 UPDATE (Richard): the data now comes from the Notification BACKEND, not
 localStorage. The UI fetches the notification list from the API and posts to it
 when queue events happen
 
 Requires the notification server running which you can do with npm start(in NotificationBackend/)
 
 When something changes in the user's queue, a notification popup appears in the
 corner of the screen. Clicking it takes the user to the Queue status page.
 Notifications are also kept on the notification page as a list.
 */

(function (global) {
    'use strict';

    // Config
    var API_BASE = 'http://localhost:3001/api/notifications';

    // Which user these notifications belong to. Login is expected to save the id
    // after a successful sign-in sessionStorage.setItem('qs_userId', data.id)
    // Until that is wired, we fall back to a demo user (should change in the next asssignment)
    var USER_ID =
        (global.sessionStorage && sessionStorage.getItem('qs_userId')) || '1';

    var TOAST_MS = 6000; // how long a popup stays before sliding away

    // When the notification is clicked, it should take the user to queue status
    var thisScript = document.currentScript;
    var QUEUE_STATUS_URL =
        (thisScript && thisScript.getAttribute('data-queue-status')) || 'queue-status.html';

    // Notification types with icons
    var TYPES = {
        queue:  {label: 'Queue Update',  icon: '↕'},
        status: {label: 'Status Change', icon: '●'},
        info:   {label: 'Info',          icon: 'ℹ'}
    };

    // Data layer
    // `cache` holds the last list fetched from the server so rendering stays sync
    var cache = [];

    function getAll() {
        return Array.isArray(cache) ? cache : [];
    }

    // Pull this user's notifications from the API, refresh the cache, rerender
    function refresh() {
        return fetch(API_BASE + '/' + encodeURIComponent(USER_ID))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                cache = Array.isArray(data.notifications) ? data.notifications : [];
                renderAll();
                return cache;
            })
            .catch(function () {
                // Server unreachable, so keep whatever we last had, don't crash the page
                renderAll();
                return cache;
            });
    }

    // POST a queue event to the API. THe server returns the created
    // notification or null when there is nothing to announce, we toast it then refresh
    function post(path, body) {
        return fetch(API_BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
        .then(function (r) {
            return r.json().then(function (data) { return { ok: r.ok, data: data }; });
        })
        .then(function (res) {
            if (res.ok && res.data && res.data.notification) {
                showToast(res.data.notification);
            }
            return refresh().then(function () { return res.data; });
        })
        .catch(function () {
            showToast({ type: 'info', title: 'Offline',
                        message: 'Could not reach the notification server.' });
        });
    }

    // Trigger helpers
    function queueJoined(service) {
        return post('/queue-joined', { userId: USER_ID, serviceName: service });
    }
    function positionUpdate(service, position) {
        return post('/position-update', { userId: USER_ID, serviceName: service, position: position });
    }
    function served(service) {
        return post('/served', { userId: USER_ID, serviceName: service });
    }
    function left(service) {
        return post('/queue-left', { userId: USER_ID, serviceName: service });
    }

    // Goes through the API's validating create endpoint
    function add(notif) {
        notif = notif || {};
        return post('', { userId: USER_ID, type: notif.type, title: notif.title, message: notif.message });
    }

    function clearAll() {
        return fetch(API_BASE + '/' + encodeURIComponent(USER_ID), { method: 'DELETE' })
            .then(function () { return refresh(); })
            .catch(function () { /* ignore */ });
    }

    // Backwards compatible wrappers 
    // The A2 pages/buttons call queueUpdate()/statusChange() and keeps them working by
    // mapping them onto the backend triggers
    function queueUpdate(service, from, to) {
        // A2 passed (from, to) the backend cares about the new position
        return positionUpdate(service, to);
    }
    function statusChange(service, status) {
        if (status === 'served')       { return served(service); }
        if (status === 'almost-ready') { return positionUpdate(service, 1); }
        if (status === 'waiting')      { return queueJoined(service); }
        // anything else just a plain status note through the validating create endpoint
        return add({ type: 'status', title: 'Status update', message: 'Status changed for ' + service + '.' });
    }

    // Helpers
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
        if (!document.body) { return; }
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

        el.addEventListener('click', function () {
            global.location.assign(QUEUE_STATUS_URL);
        });
        el.querySelector('.qs-toast-close').addEventListener('click', function (e) {
            e.stopPropagation();
            hideToast(el);
        });

        wrap.appendChild(el);
        void el.offsetWidth; // force the slide in transition
        el.classList.add('is-visible');

        setTimeout(function () { hideToast(el); }, TOAST_MS);
    }

    // List view
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
        if (dash) { renderInto(dash, 4); }   // dashboard latest few
        var full = document.getElementById('qs-notify-full');
        if (full) { renderInto(full, 0); }   // notifications page all
    }

    // init 
    function init() { refresh(); }   // pull from the backend on load

    global.QSNotify = {
        // backend triggers
        queueJoined: queueJoined,
        positionUpdate: positionUpdate,
        served: served,
        left: left,
        // A2 compatible API (kept so existing buttons/pages keep working)
        add: add,
        queueUpdate: queueUpdate,
        statusChange: statusChange,
        getAll: getAll,
        clearAll: clearAll,
        render: renderAll,
        refresh: refresh
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}(window));
