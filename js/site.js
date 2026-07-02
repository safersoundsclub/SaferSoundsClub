/* ── Safer Sounds Club — shared site behavior ────────────────────────────
   Loaded (defer) on every page. Handles:
   1. nav active-link highlighting
   2. hamburger toggle
   3. quiz popup — shows once per visit after ~11s cumulative time on site,
      on whatever page the visitor is on. No cross-session memory.        */

(function () {
  'use strict';

  var BASE = window.location.pathname.indexOf('/blog/') !== -1 ? '../' : '';
  var nav = document.querySelector('nav');

  /* ── 1. Active nav link ── */
  var page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (href === page || href === '../' + page) a.classList.add('active');
  });

  /* ── 2. Hamburger ── */
  var toggle = document.querySelector('.nav-toggle');
  if (toggle && nav) {
    toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  /* ── 3. Quiz popup ── */
  if (document.body.hasAttribute('data-no-popup')) return;

  var DONE_KEY = 'ssc-pop-done';   // dismissed or shown this visit
  var TIME_KEY = 'ssc-pop-t';      // cumulative seconds on site this visit
  var SHOW_AT = 11;                // seconds

  if (sessionStorage.getItem(DONE_KEY)) return;

  function buildPopup() {
    var el = document.createElement('div');
    el.id = 'ssc-popup';
    el.innerHTML =
      '<div class="ssc-popup-card">' +
      '<h2>Let’s sit down to a meal together.</h2>' +
      '<p class="ssc-pop-body">I’ll tell you why the clinks and crunches feel like a personal attack.</p>' +
      '<p class="ssc-pop-body" style="margin-bottom:16px;">In just a couple of minutes, we’ll uncover what your nervous system is actually reacting to.</p>' +
      '<a href="' + BASE + 'quiz.html" class="ssc-pop-btn">' +
      '<span class="ssc-pop-bg" aria-hidden="true"><img src="' + BASE + 'images/brushstroke-sage.png" alt=""></span>' +
      '<span class="ssc-pop-label">Pull Up a Chair</span></a>' +
      '<img class="ssc-pop-chair" src="' + BASE + 'images/Chair.png" alt="" aria-hidden="true">' +
      '<p class="ssc-pop-skip">No thanks, I’ll skip it</p>' +
      '</div>';
    document.body.appendChild(el);

    function dismiss() {
      el.classList.remove('visible');
      sessionStorage.setItem(DONE_KEY, '1');
    }
    el.addEventListener('click', function (e) { if (e.target === el) dismiss(); });
    el.querySelector('.ssc-pop-skip').addEventListener('click', dismiss);
    el.querySelector('.ssc-pop-btn').addEventListener('click', function () {
      sessionStorage.setItem(DONE_KEY, '1');
    });
    return el;
  }

  var elapsed = parseInt(sessionStorage.getItem(TIME_KEY) || '0', 10);
  var popupEl = null;

  var timer = setInterval(function () {
    if (document.hidden) return;              // only count time actually on the page
    elapsed++;
    sessionStorage.setItem(TIME_KEY, String(elapsed));
    if (elapsed >= SHOW_AT) {
      clearInterval(timer);
      if (sessionStorage.getItem(DONE_KEY)) return;
      popupEl = buildPopup();
      popupEl.classList.add('visible');
      sessionStorage.setItem(DONE_KEY, '1');  // shown = done for this visit
    }
  }, 1000);
})();
