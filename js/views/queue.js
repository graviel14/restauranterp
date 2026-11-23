/* Queue Screen — orders finalized in KDS (status "ready") show up here automatically.
   Two separate boards: Generic (POS: dine in & takeaway) and Online (GoFood / GrabFood / ShopeeFood). */
(function () {
  'use strict';
  var root, timer = null;

  function tile(o, online) {
    var sub = online
      ? UI.chBadge(o.channel) + (o.externalId ? ' <span class="muted">' + UI.esc(o.externalId) + '</span>' : '')
      : (o.channel !== 'pos' ? UI.chBadge(o.channel) : '') + UI.typeBadge(o);
    return '<div class="qtile' + (online ? ' online' : '') + '"' + (online ? ' style="--c:' + Store.CHANNELS[o.channel].color + '"' : '') + '>' +
      '<div class="qno">' + UI.esc(o.no) + '</div>' +
      '<div class="qsub">' + sub + '</div>' +
      (o.customer ? '<div class="qcust">' + UI.esc(o.customer) + '</div>' : '') +
      '<div class="qwait muted" data-since="' + (o.readyAt || o.createdAt) + '">Ready 00:00</div></div>';
  }

  function paint() {
    var ready = Store.get().orders.filter(function (o) { return o.status === 'ready'; })
      .sort(function (a, b) { return (a.readyAt || 0) - (b.readyAt || 0); });
    var generic = ready.filter(function (o) { return Store.ONLINE.indexOf(o.channel) < 0; });
    var online = ready.filter(function (o) { return Store.ONLINE.indexOf(o.channel) >= 0; });
    function col(title, ic, list, isOnline, hint) {
      return '<section class="qcol' + (isOnline ? ' online' : '') + '"><div class="qh"><h2>' + ic + ' ' + title + '</h2><span class="qcount">' + list.length + '</span></div>' +
        '<div class="muted qhint">' + hint + '</div>' +
        '<div class="qgrid">' + (list.map(function (o) { return tile(o, isOnline); }).join('') || '<div class="empty">No orders ready</div>') + '</div></section>';
    }
    root.querySelector('#q-board').innerHTML =
      col('Dine In & Takeaway', '🍽️', generic, false, 'POS, Kiosk & QR orders — customers: collect when your number is shown') +
      col('Online Orders', '🛵', online, true, 'Drivers: pick up by order number / platform ID');
    tick();
  }

  function tick() {
    Array.prototype.forEach.call(root.querySelectorAll('.qwait'), function (el) {
      el.textContent = 'Ready ' + UI.duration(Date.now() - (+el.getAttribute('data-since')));
    });
  }

  window.Views = window.Views || {};
  window.Views.queue = {
    title: 'Queue Screen', sub: 'Orders finalized in KDS appear here automatically — separate boards for generic and online orders',
    render: function (r) {
      root = r;
      root.innerHTML = '<div class="row sp" style="margin-bottom:12px"><span class="muted">Shows orders marked Ready in KDS. They leave this screen once picked up / delivered.</span>' +
        '<button class="btn sm" id="q-full">⛶ Fullscreen</button></div><div class="queue" id="q-board"></div>';
      root.addEventListener('click', function (e) {
        if (e.target.id !== 'q-full') return;
        document.body.classList.toggle('kds-full');
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
      });
      paint();
      timer = setInterval(tick, 1000);
    },
    onStore: function () { if (root) paint(); },
    destroy: function () {
      clearInterval(timer);
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };
})();
