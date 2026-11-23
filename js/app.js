/* Router, sidebar, webhook SSE stream (Feature Map removed, English UI) */
(function () {
  'use strict';
  window.Views = window.Views || {};

  var ROUTES = [
    { g: 'General' },
    { id: 'dashboard', ic: '📊', label: 'Dashboard' },
    { g: 'Operations' },
    { id: 'pos', ic: '🧾', label: 'POS Cashier' },
    { id: 'kds', ic: '👨‍🍳', label: 'Kitchen Display (KDS)' },
    { id: 'queue', ic: '🔔', label: 'Queue Screen' },
    { id: 'orders', ic: '📥', label: 'Incoming Orders' },
    { id: 'shift', ic: '🧮', label: 'End Shift / End Day' },
    { g: 'Inventory' },
    { id: 'stock', ic: '🔍', label: 'Stock Control' },
    { id: 'opname', ic: '📋', label: 'Stock Opname' },
    { id: 'receive', ic: '📦', label: 'Goods Receive' },
    { id: 'issue', ic: '🚚', label: 'Goods Issue' },
    { id: 'waste', ic: '🗑️', label: 'Daily Waste' },
    { id: 'variance', ic: '⚖️', label: 'Stock Variance' },
    { g: 'Reports & System' },
    { id: 'upselling', ic: '🛍️', label: 'Upselling' },
    { id: 'sales', ic: '📈', label: 'Sales Export' },
    { id: 'integrations', ic: '🔌', label: 'Channel Integrations' },
    { id: 'master', ic: '⚙️', label: 'Master Data' }
  ];
  window.ROUTES = ROUTES;

  var current = null, currentId = null;

  function buildNav() {
    document.getElementById('nav').innerHTML = ROUTES.map(function (r) {
      if (r.g) return '<div class="nav-g">' + r.g + '</div>';
      return '<a class="nav-a" href="#/' + r.id + '" data-id="' + r.id + '"><span class="ic">' + r.ic + '</span>' + r.label + '</a>';
    }).join('');
  }

  function route() {
    var id = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard';
    if (!window.Views[id]) id = 'dashboard';
    if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
    document.body.classList.remove('kds-full');
    currentId = id;
    current = window.Views[id];
    var def = ROUTES.filter(function (r) { return r.id === id; })[0];
    document.getElementById('page-title').textContent = current.title || (def && def.label) || 'Dashboard';
    document.getElementById('page-sub').textContent = current.sub || '';
    Array.prototype.forEach.call(document.querySelectorAll('.nav-a'), function (a) {
      a.classList.toggle('on', a.getAttribute('data-id') === id);
    });
    document.getElementById('sidebar').classList.remove('open');
    var old = document.getElementById('view');
    var root = old.cloneNode(false);
    old.parentNode.replaceChild(root, old);
    try { current.render(root); } catch (e) { console.error(e); root.innerHTML = '<div class="card">Error rendering page: ' + UI.esc(e.message) + '</div>'; }
    window.scrollTo(0, 0);
  }
  window.go = function (id) { location.hash = '#/' + id; };

  Store.on(function (src) {
    document.getElementById('brand-resto').textContent = Store.get().settings.restaurant;
    if (current && current.onStore) { try { current.onStore(src); } catch (e) { console.error(e); } }
  });

  function setConn(on, text) {
    var c = document.getElementById('conn');
    c.classList.toggle('on', on);
    c.querySelector('span').textContent = text;
  }
  function connectStream() {
    if (!window.EventSource || location.protocol === 'file:') { setConn(false, 'Local mode (no server)'); return; }
    var es = new EventSource('/api/stream');
    es.onopen = function () { setConn(true, 'Webhook server connected'); };
    es.onerror = function () { setConn(false, 'Webhook server disconnected'); };
    es.addEventListener('order', function (ev) {
      var p; try { p = JSON.parse(ev.data); } catch (e) { return; }
      if (!Store.channelEnabled(p.channel)) return;
      var o = Store.createOrder({ channel: p.channel, externalId: p.externalId, customer: p.customer, items: p.items, orderType: p.orderType, payment: p.payment });
      if (o) UI.toast('Incoming ' + Store.CHANNELS[o.channel].label + ' order: ' + o.no, 'ok');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildNav();
    document.getElementById('brand-resto').textContent = Store.get().settings.restaurant;
    document.getElementById('btn-menu').addEventListener('click', function () { document.getElementById('sidebar').classList.toggle('open'); });
    document.getElementById('btn-reset').addEventListener('click', function () {
      UI.confirm('Reset demo data', 'All data (stock, orders, documents) will be reset to the demo dataset. Continue?', 'Reset', function () {
        Store.reset(); UI.toast('Data reset to demo dataset', 'ok'); route();
      });
    });
    function tick() {
      document.getElementById('clock').textContent = new Date().toLocaleString('en-US', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick(); setInterval(tick, 1000);
    window.addEventListener('hashchange', route);
    route();
    connectStream();
  });
})();
