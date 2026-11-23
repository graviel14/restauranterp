(function () {
  'use strict';
  var root;

  function paint() {
    var s = Store.get(), today = UI.today();
    var todays = s.orders.filter(function (o) { return Store.dateKey(o.createdAt) === today && o.status !== 'cancelled'; });
    var omzet = todays.reduce(function (a, o) { return a + o.total; }, 0);
    var active = s.orders.filter(function (o) { return o.status === 'new' || o.status === 'preparing'; }).length;
    var low = s.products.filter(function (p) { return Store.stockStatus(p) !== 'ok'; });
    var wasteToday = s.waste.filter(function (w) { return w.date === today; }).length;

    var byCh = {};
    todays.forEach(function (o) { byCh[o.channel] = (byCh[o.channel] || 0) + o.total; });
    var max = Math.max.apply(null, Object.keys(Store.CHANNELS).map(function (k) { return byCh[k] || 0; }).concat([1]));
    var bars = Object.keys(Store.CHANNELS).map(function (k) {
      var v = byCh[k] || 0;
      return '<div style="margin:10px 0"><div class="row sp"><span>' + UI.chBadge(k) + '</span><b>' + UI.rp(v) + '</b></div>' +
        '<div style="height:7px;background:#ffe9c7;border-radius:99px;margin-top:6px"><div style="height:100%;width:' + (v / max * 100) + '%;background:' + Store.CHANNELS[k].color + ';border-radius:99px"></div></div></div>';
    }).join('');

    var recent = s.orders.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 6).map(function (o) {
      return '<tr><td><b>' + o.no + '</b></td><td>' + UI.chBadge(o.channel) + '</td><td class="muted">' + UI.time(o.createdAt) + '</td><td class="r">' + UI.rp(o.total) + '</td><td>' + UI.statusPill(o.status) + '</td></tr>';
    }).join('');

    var lowRows = low.slice(0, 8).map(function (p) {
      var st = Store.stockStatus(p);
      return '<tr><td>' + UI.esc(p.name) + '</td><td class="r">' + UI.num(p.stock) + ' ' + p.unit + '</td><td class="r muted">min ' + UI.num(p.min) + '</td><td class="st-' + st + '">' + st + '</td></tr>';
    }).join('');

    root.innerHTML =
      '<div class="grid g4">' +
      '<div class="card stat"><span>Today\'s Sales</span><b>' + UI.rp(omzet) + '</b><small>' + todays.length + ' orders</small></div>' +
      '<div class="card stat"><span>Active Orders (KDS)</span><b>' + active + '</b><small><a href="#/kds" style="color:var(--acc2)">Open kitchen display →</a></small></div>' +
      '<div class="card stat"><span>Low / Out of Stock</span><b class="' + (low.length ? 'st-low' : '') + '">' + low.length + '</b><small>out of ' + s.products.length + ' materials</small></div>' +
      '<div class="card stat"><span>Today\'s Waste Logs</span><b>' + wasteToday + '</b><small><a href="#/waste" style="color:var(--acc2)">Log waste →</a></small></div>' +
      '</div>' +
      '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><h3>Today\'s Sales by Channel</h3>' + bars + '</div>' +
      '<div class="card"><h3>Materials Needing Attention</h3>' + (lowRows ? '<table class="tbl"><tbody>' + lowRows + '</tbody></table>' : '<div class="empty">All material stocks healthy 👍</div>') + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px"><div class="row sp"><h3>Recent Orders</h3><a class="btn ghost sm" href="#/orders" style="text-decoration:none">View all</a></div>' +
      '<div class="tbl-wrap"><table class="tbl"><tbody>' + recent + '</tbody></table></div></div>';
  }

  window.Views = window.Views || {};
  window.Views.dashboard = {
    title: 'Dashboard', sub: 'Today\'s restaurant operations overview',
    render: function (r) { root = r; paint(); },
    onStore: function () { paint(); }
  };
})();
