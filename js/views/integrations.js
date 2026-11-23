(function () {
  'use strict';
  var root;
  var NAMES = ['Alex', 'Sarah', 'Budi', 'Dewi', 'Rizky', 'Maya', 'Kevin', 'Lina'];
  var NOTES = ['', '', 'Extra spicy', 'No sauce', 'Pack neatly', ''];

  function simulate(channel) {
    var s = Store.get();
    var n = 1 + Math.floor(Math.random() * 3), items = [];
    for (var i = 0; i < n; i++) {
      var m = s.menu[Math.floor(Math.random() * s.menu.length)];
      if (Store.portions(m) < 1) continue;
      items.push({ sku: m.sku, name: m.name, qty: 1 + Math.floor(Math.random() * 2), price: m.price, note: NOTES[Math.floor(Math.random() * NOTES.length)] });
    }
    if (!items.length) { UI.toast('Insufficient BOM stock to simulate order', 'warn'); return; }
    var self = Store.DINE_CHANNELS.indexOf(channel) >= 0;
    var o = Store.createOrder({
      channel: channel, externalId: Store.CHANNELS[channel].prefix + '-' + Math.floor(10000 + Math.random() * 89999),
      customer: self ? (channel === 'qr' ? 'Table ' : 'Kiosk #') + (1 + Math.floor(Math.random() * 20)) : NAMES[Math.floor(Math.random() * NAMES.length)],
      items: items, orderType: Math.random() < 0.5 ? 'dinein' : 'takeaway'
    });
    if (o) UI.toast(Store.CHANNELS[channel].label + ' order ' + o.no + ' received → KDS & BOM stock updated', 'ok');
  }

  function paint() {
    var st = Store.get().settings.channels, base = location.protocol === 'file:' ? 'http://localhost:3000' : location.origin;
    var card = function (k) {
      var c = Store.CHANNELS[k];
      return '<div class="card"><div class="row sp"><h3 style="margin:0">' + c.label + '</h3><label class="row" style="gap:6px"><input type="checkbox" style="width:auto" data-toggle="' + k + '" ' + (st[k] !== false ? 'checked' : '') + '> active</label></div>' +
        '<p class="muted" style="margin:8px 0">Order webhook endpoint:</p><pre>POST ' + base + '/api/webhook/' + k + '</pre>' +
        '<button class="btn primary" data-sim="' + k + '" ' + (st[k] === false ? 'disabled' : '') + '>Simulate incoming order</button></div>';
    };
    var cards = Store.ONLINE.map(card).join(''), selfCards = ['kiosk', 'qr'].map(card).join('');
    root.innerHTML =
      '<div class="note" style="margin-bottom:14px">Kiosk, QR and online delivery orders are <b>simulated</b> in this prototype. Incoming orders appear in Incoming Orders &amp; KDS and automatically deduct material stock according to BOM recipes.</div>' +
      '<h3 style="margin:0 0 10px">Delivery platforms</h3><div class="grid g3">' + cards + '</div>' +
      '<h3 style="margin:18px 0 10px">Self-order: Kiosk &amp; QR (Dine In / Takeaway)</h3><div class="grid g2">' + selfCards + '</div>' +
      '<div class="card" style="margin-top:14px"><h3>Test webhook via terminal</h3><p class="muted" style="margin-top:0">Run <code>node server.js</code>, open <code>http://localhost:3000</code>, then send:</p>' +
      '<pre>curl -X POST ' + base + '/api/webhook/gofood \\\n  -H "Content-Type: application/json" \\\n  -d \'{"externalId":"GF-12345","customer":"Alex","items":[{"sku":"MNU-001","name":"Combo 1 Fire Chicken","qty":2,"price":51000,"note":"extra spicy"}]}\'</pre>' +
      '<p class="muted" style="margin:12px 0 4px">Kiosk / QR order (use <code>orderType</code>: <code>dinein</code> or <code>takeaway</code>; optional <code>payment</code>: cash, qris, edc, xendit). Takeaway orders automatically get the Rp 4.000 shopping bag:</p>' +
      '<pre>curl -X POST ' + base + '/api/webhook/qr \\\n  -H "Content-Type: application/json" \\\n  -d \'{"externalId":"QR-1001","customer":"Table 7","orderType":"takeaway","payment":"xendit","items":[{"name":"Combo Fire Wings","qty":1}]}\'</pre></div>';
  }

  window.Views = window.Views || {};
  window.Views.integrations = {
    title: 'Channel Integrations', sub: 'Kiosk · QR · GoFood · GrabFood · ShopeeFood',
    render: function (r) {
      root = r; paint();
      root.addEventListener('click', function (e) { var t = e.target.closest('[data-sim]'); if (t) simulate(t.getAttribute('data-sim')); });
      root.addEventListener('change', function (e) {
        var k = e.target.getAttribute('data-toggle');
        if (k) { Store.setChannel(k, e.target.checked); paint(); }
      });
    }
  };
})();
