(function () {
  'use strict';
  var root, timer = null, seen = null, audio = null;

  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain();
      o.connect(g); g.connect(audio.destination); o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(audio.currentTime + 0.18);
    } catch (e) {}
  }

  function ticket(o) {
    var next = { new: ['preparing', 'Start Cooking'], preparing: ['ready', 'Mark Ready'], ready: ['completed', 'Picked Up / Delivered'] }[o.status];
    return '<div class="ticket t-' + o.status + '"><div class="hd"><div><b>' + o.no + '</b> ' + UI.chBadge(o.channel) +
      '<div class="muted" style="font-size:12px">' + UI.esc(o.customer || '') + (o.externalId ? ' · ' + UI.esc(o.externalId) : '') + '</div></div>' +
      '<span class="timer" data-since="' + o.createdAt + '" data-st="' + o.status + '">00:00</span></div>' +
      '<ul>' + o.items.map(function (it) {
        return '<li><b>' + it.qty + '×</b>' + UI.esc(it.name) + (it.note ? '<em>📝 ' + UI.esc(it.note) + '</em>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<button class="btn ' + (o.status === 'ready' ? 'ok' : 'primary') + '" data-st="' + next[0] + '" data-id="' + o.id + '">' + next[1] + '</button>' +
      (o.status === 'new' ? '<button class="btn danger sm" style="width:100%;margin-top:6px" data-st="cancelled" data-id="' + o.id + '">Cancel</button>' : '') + '</div>';
  }

  function paint() {
    var s = Store.get();
    var live = s.orders.filter(function (o) { return o.status === 'new' || o.status === 'preparing' || o.status === 'ready'; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
    var cols = [['new', 'New'], ['preparing', 'Cooking'], ['ready', 'Ready']];
    root.querySelector('#kds-board').innerHTML = cols.map(function (c) {
      var list = live.filter(function (o) { return o.status === c[0]; });
      return '<div class="kcol"><h3>' + c[1] + ' <span>' + list.length + '</span></h3>' +
        (list.map(ticket).join('') || '<div class="empty card">No tickets</div>') + '</div>';
    }).join('');

    var ids = live.filter(function (o) { return o.status === 'new'; }).map(function (o) { return o.id; });
    if (seen) { var fresh = ids.filter(function (id) { return seen.indexOf(id) < 0; }); if (fresh.length) beep(); }
    seen = ids;
    tick();
  }

  function tick() {
    Array.prototype.forEach.call(root.querySelectorAll('.timer'), function (el) {
      var ms = Date.now() - (+el.getAttribute('data-since'));
      el.textContent = UI.duration(ms);
      var min = ms / 60000, st = el.getAttribute('data-st');
      el.classList.toggle('late', st !== 'ready' && min > 15);
      el.classList.toggle('warn', st !== 'ready' && min > 8 && min <= 15);
    });
  }

  window.Views = window.Views || {};
  window.Views.kds = {
    title: 'Kitchen Display (KDS)', sub: 'Tickets from POS and GoFood / GrabFood / ShopeeFood appear automatically. Ready tickets go to the Queue Screen',
    render: function (r) {
      root = r; seen = null;
      root.innerHTML = '<div class="row sp" style="margin-bottom:12px"><span class="muted">Normal &lt; 8m · Warning 8–15m · Late &gt; 15m since order received</span>' +
        '<button class="btn sm" id="kds-full">⛶ Fullscreen</button></div><div class="kds" id="kds-board"></div>';
      root.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-st]');
        if (b) Store.setOrderStatus(b.getAttribute('data-id'), b.getAttribute('data-st'));
        if (e.target.id === 'kds-full') {
          document.body.classList.toggle('kds-full');
          if (document.fullscreenElement) document.exitFullscreen();
          else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
        }
      });
      paint();
      timer = setInterval(tick, 1000);
    },
    onStore: function () { paint(); },
    destroy: function () {
      clearInterval(timer);
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };
})();
