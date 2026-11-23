/* =========================================================
   Store — ERP state (localStorage) + BOM recipe stock engine
   All tabs/screens (POS, KDS, ERP) share state and sync via
   'storage' events.
   ========================================================= */
(function (global) {
  'use strict';
  var KEY = 'erp-resto-en-v1';
  var listeners = [];
  var state = null;

  function uid(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
  function dateKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }

  var BAG_FEE = 4000; // Rp, added automatically to takeaway orders

  var CHANNELS = {
    pos:        { label: 'POS Cashier', prefix: 'POS', color: '#0284c7' },
    gofood:     { label: 'GoFood',      prefix: 'GF',  color: '#16a34a' },
    grabfood:   { label: 'GrabFood',    prefix: 'GR',  color: '#059669' },
    shopeefood: { label: 'ShopeeFood',  prefix: 'SF',  color: '#ea580c' },
    kiosk:      { label: 'Kiosk',       prefix: 'KS',  color: '#0d9488' },
    qr:         { label: 'QR Order',    prefix: 'QR',  color: '#db2777' }
  };
  var ONLINE = ['gofood', 'grabfood', 'shopeefood'];          // delivery platforms
  var DINE_CHANNELS = ['pos', 'kiosk', 'qr'];                  // channels with Dine In / Takeaway

  function normType(t) { return /take/i.test(String(t || '')) ? 'takeaway' : 'dinein'; }

  /* ---- sales summary (end shift / end day) ---- */
  var PURPOSES = ['DINE IN', 'GOFOOD', 'GRABFOOD', 'KIOSK DINE IN', 'KIOSK TAKE AWAY', 'QR DINE IN', 'QR TAKE AWAY', 'SHOPEEFOOD', 'TAKE AWAY'];
  var PAYMENTS = ['BCA QRIS', 'CASH', 'DEBIT BCA', 'GOBIZ', 'GRABPAY', 'SHOPEEFOOD', 'XENDIT'];
  function purposeKey(o) {
    if (ONLINE.indexOf(o.channel) >= 0) return o.channel.toUpperCase();
    var t = o.orderType === 'takeaway' ? 'TAKE AWAY' : 'DINE IN';
    return (o.channel === 'kiosk' ? 'KIOSK ' : o.channel === 'qr' ? 'QR ' : '') + t;
  }
  function payKey(o) {
    if (o.payment === 'cash') return 'CASH';
    if (o.payment === 'qris') return 'BCA QRIS';
    if (o.payment === 'edc') return 'DEBIT BCA';
    if (o.payment === 'xendit') return 'XENDIT';
    return { gofood: 'GOBIZ', grabfood: 'GRABPAY', shopeefood: 'SHOPEEFOOD' }[o.channel] || 'OTHER';
  }
  function buildSummary(orders) {
    var live = orders.filter(function (o) { return o.status !== 'cancelled'; });
    var cancelled = orders.filter(function (o) { return o.status === 'cancelled'; });
    var sum = function (a) { return a.reduce(function (x, o) { return x + (Number(o.total) || 0); }, 0); };
    var sales = sum(live), bills = live.length;
    // The app does not track discounts, service charge, taxes or fees yet, so those lines are 0 and Gross = Net
    var net = sales, gross = net;
    var pur = {}, pay = {};
    PURPOSES.forEach(function (k) { pur[k] = { name: k, bills: 0, sales: 0 }; });
    PAYMENTS.forEach(function (k) { pay[k] = { name: k, qty: 0, total: 0 }; });
    live.forEach(function (o) {
      var a = purposeKey(o), b = payKey(o);
      pur[a] = pur[a] || { name: a, bills: 0, sales: 0 }; pur[a].bills++; pur[a].sales += o.total;
      pay[b] = pay[b] || { name: b, qty: 0, total: 0 }; pay[b].qty++; pay[b].total += o.total;
    });
    return {
      salesTotal: sales, menuDiscount: 0, billDiscount: 0, netSales: net,
      deliveryCost: 0, orderFee: 0, sc: 0, pb1: 0, ppn: 0, platformFee: 0, voucher: 0, rounding: 0,
      grossSales: gross, pax: bills, bills: bills,
      avgNetPax: bills ? net / bills : 0, avgSalesPax: bills ? gross / bills : 0,
      avgNetBill: bills ? net / bills : 0, avgSalesBill: bills ? gross / bills : 0,
      cancelTotal: sum(cancelled), cancelCount: cancelled.length, voidTotal: 0,
      purposes: Object.keys(pur).sort().map(function (k) { return pur[k]; }),
      payments: Object.keys(pay).sort().map(function (k) { return pay[k]; }),
      nonSales: 0
    };
  }
  function bbqProduct(lv) { return { id: 'mat_bbq_lv' + lv, name: 'BBQ Sauce Level ' + lv, unit: 'gr', category: 'Sauce & Dip', stock: 3000, min: 500, cycle: 'weekly' }; }
  function bbqMenu(lv) {
    return { id: 'm_bbq' + lv, sku: 'MNU-BBQ-' + pad(lv, 2), name: 'BBQ Sauce Level ' + lv, category: 'Ala Carte', price: 3000, usageNote: '1x BBQ Sauce Level ' + lv + ' (BOM 30 GRAM)', recipe: [{ productId: 'mat_bbq_lv' + lv, qty: 30, uom: 'GRAM' }], upsell: true };
  }
  // Menu items shown on the POS upselling screen (only 22oz drinks, cheese crackling, rice, cheese dip & BBQ sauces)
  var UPSELL_IDS = ['m8', 'm9', 'm10c', 'm11c', 'm12'];
  for (var _l = 0; _l <= 5; _l++) UPSELL_IDS.push('m_bbq' + _l);

  /* Convert BOM recipe qty into material stock unit */
  function convertQty(qty, bomUom, prodUom) {
    var q = Number(qty) || 0;
    var b = String(bomUom || '').trim().toLowerCase();
    var p = String(prodUom || '').trim().toLowerCase();
    if (!b || !p || b === p) return q;
    var isGram = function (u) { return u === 'gr' || u === 'gram' || u === 'grams' || u === 'g'; };
    var isKg = function (u) { return u === 'kg' || u === 'kilogram' || u === 'kilograms'; };
    if (isGram(b) && isKg(p)) return q / 1000;
    if (isKg(b) && isGram(p)) return q * 1000;
    return q;
  }

  function seed() {
    var P = function (id, name, unit, category, stock, min, cycle) {
      return { id: id, name: name, unit: unit, category: category, stock: stock, min: min, cycle: cycle };
    };

    // Materials from Excel sheet (NAME MATERIAL & UoM)
    var products = [
      P('mat_chicken_wing', 'Chicken Wing',               'pcs', 'Poultry',    80,  20, 'daily'),
      P('mat_whole_wings', 'Whole Wings',                'pcs', 'Poultry',    60,  15, 'daily'),
      P('mat_whole_chicken', 'Whole Chicken',              'pcs', 'Poultry',    40,  10, 'daily'),
      P('mat_chicken_rf_or', 'Chicken RF OR',                'pcs', 'Poultry',    80,  20, 'daily'),
      P('mat_skin', 'Skin',                       'gr',  'Poultry',    5000,1000,'daily'),
      P('mat_boneless', 'Boneless',                   'gr',  'Poultry',    4000,800, 'daily'),
      P('mat_fcc_1', 'Fried Chicken Coating',    'kg',  'Coating',    25,  5,  'weekly'),
      P('mat_beras', 'Beras (Rice)',               'kg',  'Dry Goods',  50,  10, 'weekly'),
      P('mat_ccc', 'Crispy Chicken Coating','gr', 'Coating',    8000,1500,'weekly'),
      P('mat_pink_lava', 'Pink Lava',                  'gr',  'Beverage',   6000,1000,'weekly'),
      P('mat_fruitarian', 'Fruitarian',                 'gr',  'Beverage',   6000,1000,'weekly'),
      P('mat_cheese_dip_2', 'Cheese Dip',             'kg',  'Sauce & Dip',15,  3,  'weekly'),
      P('mat_bbq_lv0', 'BBQ Sauce Level 0',          'gr',  'Sauce & Dip',3000,500, 'weekly'),
      P('mat_bbq_lv1', 'BBQ Sauce Level 1',          'gr',  'Sauce & Dip',3000,500, 'weekly'),
      P('mat_bbq_lv2', 'BBQ Sauce Level 2',          'gr',  'Sauce & Dip',3000,500, 'weekly'),
      P('mat_bbq_lv3', 'BBQ Sauce Level 3',    'gr',  'Sauce & Dip',3000,500, 'weekly'),
      P('mat_bbq_lv4',        'BBQ Sauce Level 4',          'gr',  'Sauce & Dip',3000,500, 'weekly'),
      P('mat_bbq_lv5',        'BBQ Sauce Level 5',          'gr',  'Sauce & Dip',3000,500, 'weekly'),
      P('mat_choc_angelito', 'Chocolate Angelito',         'kg',  'Dessert',    10,  2,  'monthly'),
      P('mat_beef_patty', 'Beef Patty',                 'pcs', 'Protein',    50,  10, 'daily'),
      P('mat_mineral_330', 'Air Mineral 330 ML',         'pcs', 'Beverage',   120, 24, 'monthly')
    ];


    var R = function (productId, qty, uom) { return { productId: productId, qty: qty, uom: uom }; };
    var M = function (id, sku, name, category, price, usageNote, recipe) {
      return { id: id, sku: sku, name: name, category: category, price: price, usageNote: usageNote || '', recipe: recipe };
    };

    // Menu & BOM recipes aligned with Workbook1.xlsx (including separated sizes for Pink Lava & Fruitarian)
    var menu = [
      M('m1', 'MNU-001', 'Combo 1 Fire Chicken', 'Paket Combo', 51000,
        'Rice, OR Chicken, Cheese Dip, BBQ Sauce, Pink/Fruitarian (customer choice), Fried Chicken Coating',
        [R('mat_beras', 0.077, 'KG'), R('mat_chicken_rf_or', 1, 'PCS'), R('mat_cheese_dip_2', 0.012, 'KG'), R('mat_bbq_lv1', 30, 'GRAM'), R('mat_pink_lava', 39.17, 'GRAM'), R('mat_fcc_1', 0.05, 'KG')]),
      M('m2', 'MNU-002', 'Combo Fire Wings', 'Paket Combo', 55000,
        'Rice, 4x Chicken Wing, Cheese Dip, BBQ Sauce, Pink/Fruitarian (customer choice), Fried Chicken Coating',
        [R('mat_beras', 0.077, 'KG'), R('mat_chicken_wing', 4, 'PCS'), R('mat_cheese_dip_2', 0.012, 'KG'), R('mat_bbq_lv1', 30, 'GRAM'), R('mat_pink_lava', 39.17, 'GRAM'), R('mat_fcc_1', 0.02, 'KG')]),
      M('m3', 'MNU-003', 'Combo Duo Fire Chicken', 'Paket Combo', 80000,
        'Rice, 2x OR Chicken, 1x Cheese Dip, 2x BBQ Sauce, Pink/Fruitarian (customer choice), 2x Fried Chicken Coating',
        [R('mat_beras', 0.077, 'KG'), R('mat_chicken_rf_or', 2, 'PCS'), R('mat_cheese_dip_2', 0.012, 'KG'), R('mat_bbq_lv1', 60, 'GRAM'), R('mat_pink_lava', 39.17, 'GRAM'), R('mat_fcc_1', 0.1, 'KG')]),
      M('m4', 'MNU-004', 'Mabar Flying Chicken', 'Combo Mabar', 175000,
        '4x Rice, 1x Whole Chicken, 4x Pink Lava/Fruitarian (cust choice), 3x Cheese Dip, Crispy Chicken Coating',
        [R('mat_beras', 0.308, 'KG'), R('mat_whole_chicken', 1, 'PCS'), R('mat_pink_lava', 156.68, 'GRAM'), R('mat_cheese_dip_2', 0.036, 'KG'), R('mat_ccc', 100, 'GRAM')]),
      M('m5', 'MNU-005', 'Mabar Fire Chicken', 'Combo Mabar', 180000,
        '3x Rice, 5x OR Chicken, 3x Cheese Dip, 3x Pink Lava/Fruitarian, 5x Fried Chicken Coating',
        [R('mat_beras', 0.231, 'KG'), R('mat_chicken_rf_or', 5, 'PCS'), R('mat_cheese_dip_2', 0.036, 'KG'), R('mat_pink_lava', 117.51, 'GRAM'), R('mat_fcc_1', 0.25, 'KG')]),
      M('m6', 'MNU-006', 'Combo Cheese Crackling', 'Paket Combo', 60000,
        'Rice, OR Chicken, Cheese Dip, BBQ Sauce, Pink/Fruitarian (customer choice), Fried Chicken Coating, 1x Cheese Crackling Combo',
        [R('mat_beras', 0.077, 'KG'), R('mat_chicken_rf_or', 1, 'PCS'), R('mat_cheese_dip_2', 0.012, 'KG'), R('mat_bbq_lv1', 30, 'GRAM'), R('mat_pink_lava', 39.17, 'GRAM'), R('mat_fcc_1', 0.05, 'KG'), R('mat_cheese_dip_2', 0.072, 'KG')]),
      M('m7', 'MNU-007', 'Hot Deals Fire Chicken Whole', 'Hot Deals', 180000,
        '1x Whole Chicken, 4x BBQ Sauce (customer choose level), 1x 1L Pink Lava/Fruitarian, 3x Cheese Dip',
        [R('mat_whole_chicken', 1, 'PCS'), R('mat_bbq_lv1', 120, 'GRAM'), R('mat_pink_lava', 155, 'GRAM'), R('mat_cheese_dip_2', 0.036, 'KG')]),
      M('m8', 'MNU-008', 'Cheese Crackling', 'Ala Carte', 20000,
        '1x Cheese Crackling Ala Carte (32g)',
        [R('mat_cheese_dip_2', 0.032, 'KG')]),
      M('m9', 'MNU-009', 'Rice', 'Ala Carte', 11000,
        '1x Rice (BOM 0.077 KG)',
        [R('mat_beras', 0.077, 'KG')]),
      M('m10a','MNU-010A','Pink Lava 12oz', 'Ala Carte', 13000,
        'Separated size option (12oz) — BOM 39.17 GRAM',
        [R('mat_pink_lava', 39.17, 'GRAM')]),
      M('m10b','MNU-010B','Pink Lava 16oz', 'Ala Carte', 17000,
        'Separated size option (16oz) — BOM 53 GRAM',
        [R('mat_pink_lava', 53, 'GRAM')]),
      M('m10c','MNU-010C','Pink Lava 22oz', 'Ala Carte', 20000,
        'Separated size option (22oz) — BOM 75.08 GRAM',
        [R('mat_pink_lava', 75.08, 'GRAM')]),
      M('m10d','MNU-010D','Pink Lava 1L', 'Ala Carte', 25000,
        'Separated size option (1L) — BOM 155 GRAM',
        [R('mat_pink_lava', 155, 'GRAM')]),
      M('m11a','MNU-011A','Fruitarian 12oz', 'Ala Carte', 13000,
        'Separated size option (12oz) — BOM 27 GRAM',
        [R('mat_fruitarian', 27, 'GRAM')]),
      M('m11b','MNU-011B','Fruitarian 16oz', 'Ala Carte', 17000,
        'Separated size option (16oz) — BOM 39 GRAM',
        [R('mat_fruitarian', 39, 'GRAM')]),
      M('m11c','MNU-011C','Fruitarian 22oz', 'Ala Carte', 20000,
        'Separated size option (22oz) — BOM 54 GRAM',
        [R('mat_fruitarian', 54, 'GRAM')]),
      M('m11d','MNU-011D','Fruitarian 1L', 'Ala Carte', 25000,
        'Separated size option (1L) — BOM 115 GRAM',
        [R('mat_fruitarian', 115, 'GRAM')]),
      M('m12', 'MNU-012', 'Cheese Dip', 'Ala Carte', 2000,
        '1x Cheese Dip (BOM 0.012 KG)',
        [R('mat_cheese_dip_2', 0.012, 'KG')])
    ];

    for (var bl = 0; bl <= 5; bl++) menu.push(bbqMenu(bl));
    menu.forEach(function (m) { m.upsell = UPSELL_IDS.indexOf(m.id) >= 0; });

    var s = {
      version: 2,
      settings: {
        restaurant: 'Fire & Crispy Kitchen',
        address: 'Jl. Jenderal Sudirman No. 88, Jakarta',
        channels: { gofood: true, grabfood: true, shopeefood: true },
        counters: { order: 0, receipt: 0, issue: 0, opname: 0 }
      },
      products: products,
      menu: menu,
      vendors: [
        { id: 'v1', name: 'WMS DC Central', contact: 'wms-dc@restaurant-erp.local' },
        { id: 'v2', name: 'PT Sumber Protein Nusantara', contact: '0812-0000-0001' },
        { id: 'v3', name: 'CV Dapur Segar', contact: '0812-0000-0002' }
      ],
      orders: [], movements: [], opnames: [], receipts: [], issues: [], waste: [], shifts: [], days: []
    };
    seedHistory(s);
    return s;
  }

  function seedHistory(s) {
    var seedN = 7;
    function rnd() { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; }
    var chs = ['pos', 'pos', 'pos', 'kiosk', 'qr', 'gofood', 'grabfood', 'shopeefood'];
    var pays = ['cash', 'qris', 'edc'];
    var now = Date.now();
    var curHour = new Date(now).getHours();
    for (var d = 7; d >= 0; d--) {
      if (d === 0 && curHour < 9) continue;
      var n = d === 0 ? 4 : 6 + Math.floor(rnd() * 6);
      for (var i = 0; i < n; i++) {
        var ts = new Date(now - d * 86400000);
        ts.setHours(d === 0 ? 8 + Math.floor(rnd() * Math.max(1, curHour - 8)) : 10 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
        if (ts.getTime() > now) ts = new Date(now - 60000);
        var ch = chs[Math.floor(rnd() * chs.length)];
        var items = [], cnt = 1 + Math.floor(rnd() * 3), total = 0;
        for (var k = 0; k < cnt; k++) {
          var m = s.menu[Math.floor(rnd() * s.menu.length)];
          var q = 1 + Math.floor(rnd() * 2);
          items.push({ menuId: m.id, sku: m.sku, name: m.name, qty: q, price: m.price, note: '' });
          total += q * m.price;
        }
        if (ch === 'pos' && items.some(function (x) { var mm = byId(s.menu, x.menuId); return mm && mm.category !== 'Ala Carte'; }) && rnd() < 0.4) {
          var alas = s.menu.filter(function (x) { return x.upsell; });
          var am = alas[Math.floor(rnd() * alas.length)];
          items.push({ menuId: am.id, sku: am.sku, name: am.name, qty: 1, price: am.price, note: '', upsellQty: 1 });
          total += am.price;
        }
        var dine = DINE_CHANNELS.indexOf(ch) >= 0;
        var otype = dine ? (rnd() < 0.35 ? 'takeaway' : 'dinein') : '';
        var bag = otype === 'takeaway' ? BAG_FEE : 0;
        total += bag;
        s.settings.counters.order++;
        var no = CHANNELS[ch].prefix + '-' + pad(s.settings.counters.order, 4);
        s.orders.push({
          orderType: otype, bagFee: bag,
          id: uid('o'), no: no, channel: ch, externalId: (ch === 'pos' || ch === 'kiosk' || ch === 'qr') ? '' : 'H' + s.settings.counters.order,
          customer: ch === 'pos' ? 'Guest' : 'Online Guest', items: items, total: total,
          payment: ch === 'pos' ? pays[Math.floor(rnd() * 3)] : (ch === 'kiosk' ? 'qris' : ch === 'qr' ? 'xendit' : 'online'),
          status: 'completed', createdAt: ts.getTime(), startedAt: ts.getTime() + 120000,
          readyAt: ts.getTime() + 600000, doneAt: ts.getTime() + 660000, stockDeducted: false, unmapped: []
        });
      }
    }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Failed to persist', e); }
  }
  /* Bring data saved by an older version up to date (idempotent) */
  var RENAMES = {
    mat_fcc_1: 'Fried Chicken Coating', mat_ccc: 'Crispy Chicken Coating', mat_cheese_dip_2: 'Cheese Dip',
    mat_bbq_lv0: 'BBQ Sauce Level 0', mat_bbq_lv1: 'BBQ Sauce Level 1', mat_bbq_lv2: 'BBQ Sauce Level 2', mat_bbq_lv3: 'BBQ Sauce Level 3'
  };
  var REMOVED = ['mat_bbq_k5016', 'mat_beboli_box', 'mat_wison_box', 'mat_photocard_twc', 'mat_fridge_magnet'];
  function migrate(st) {
    if (!st || !st.products) return;
    st.products = st.products.filter(function (p) { return REMOVED.indexOf(p.id) < 0; });
    st.shifts = st.shifts || []; st.days = st.days || [];
    st.products.forEach(function (p) {
      if (RENAMES[p.id]) p.name = RENAMES[p.id];
      if (/crispy fried chicken coating/i.test(p.name)) p.name = p.name.replace(/crispy fried chicken coating/ig, 'Crispy Chicken Coating');
      delete p.sku;
    });
    if ((st.mig || 0) < 2) {   // one-time additions (so items you delete later are not re-created)
      for (var lv = 4; lv <= 5; lv++) if (!byId(st.products, 'mat_bbq_lv' + lv)) st.products.push(bbqProduct(lv));
      for (var ml = 0; ml <= 5; ml++) if (!byId(st.menu, 'm_bbq' + ml)) st.menu.push(bbqMenu(ml));
      st.menu.forEach(function (m) { if (typeof m.upsell === 'undefined') m.upsell = UPSELL_IDS.indexOf(m.id) >= 0; });
      st.mig = 2;
    }
    if ((st.mig || 0) < 3) {
      var BBQ_6_10_P = ['mat_bbq_lv6', 'mat_bbq_lv7', 'mat_bbq_lv8', 'mat_bbq_lv9', 'mat_bbq_lv10'];
      var BBQ_6_10_M = ['m_bbq6', 'm_bbq7', 'm_bbq8', 'm_bbq9', 'm_bbq10'];
      st.products = st.products.filter(function (p) { return BBQ_6_10_P.indexOf(p.id) < 0; });
      if (st.menu) {
        st.menu = st.menu.filter(function (m) { return BBQ_6_10_M.indexOf(m.id) < 0; });
        st.menu.forEach(function (m) {
          if (m.recipe) m.recipe = m.recipe.filter(function (r) { return BBQ_6_10_P.indexOf(r.productId) < 0; });
        });
      }
      st.mig = 3;
    }
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); migrate(state); return; }
    } catch (e) { console.warn('Corrupt data, loading seed', e); }
    state = seed();
    persist();
  }
  function emit(src) {
    listeners.slice().forEach(function (fn) { try { fn(src); } catch (e) { console.error(e); } });
  }
  if (global.addEventListener) {
    global.addEventListener('storage', function (e) {
      if (e.key === KEY) { load(); emit('remote'); }
    });
  }
  function mutate(fn) {
    load();
    var r = fn(state);
    persist();
    emit('local');
    return r;
  }

  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function addMove(s, productId, qty, type, ref, note, subType, tsOverride) {
    var p = byId(s.products, productId);
    if (!p) return;
    p.stock = Math.round((p.stock + qty) * 10000) / 10000;
    s.movements.push({
      id: uid('mv'),
      ts: tsOverride || Date.now(),
      productId: productId,
      qty: qty,
      type: type,
      subType: subType || '',
      ref: ref || '',
      note: note || '',
      balance: p.stock
    });
    if (s.movements.length > 4000) s.movements.splice(0, s.movements.length - 4000);
  }

  function nextNo(s, counter, prefix) {
    s.settings.counters[counter] = (s.settings.counters[counter] || 0) + 1;
    return prefix + '-' + dateKey(Date.now()).replace(/-/g, '') + '-' + pad(s.settings.counters[counter], 3);
  }

  function resolveMenu(s, it) {
    if (it.menuId) { var m = byId(s.menu, it.menuId); if (m) return m; }
    var i;
    if (it.sku) for (i = 0; i < s.menu.length; i++) if (s.menu[i].sku.toLowerCase() === String(it.sku).toLowerCase()) return s.menu[i];
    if (it.name) for (i = 0; i < s.menu.length; i++) if (s.menu[i].name.toLowerCase() === String(it.name).toLowerCase()) return s.menu[i];
    return null;
  }

  /** Calculate BOM consumption per material for a list of order items [{menuId/sku/name, qty}] */
  function calculateBom(items) {
    var s = Store.get();
    var map = {};
    (items || []).forEach(function (it) {
      var m = resolveMenu(s, it);
      if (!m || !m.recipe) return;
      var orderQty = Math.max(1, Number(it.qty) || 1);
      m.recipe.forEach(function (r) {
        var p = byId(s.products, r.productId);
        if (!p) return;
        var usedInProdUnit = convertQty((Number(r.qty) || 0) * orderQty, r.uom || p.unit, p.unit);
        if (!map[p.id]) {
          map[p.id] = { productId: p.id, name: p.name, unit: p.unit, qty: 0, bomRaw: 0, bomUom: r.uom || p.unit };
        }
        map[p.id].qty = Math.round((map[p.id].qty + usedInProdUnit) * 10000) / 10000;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  var Store = {
    CHANNELS: CHANNELS, BAG_FEE: BAG_FEE, ONLINE: ONLINE, DINE_CHANNELS: DINE_CHANNELS, buildSummary: buildSummary,
    uid: uid, dateKey: dateKey, convertQty: convertQty, calculateBom: calculateBom,
    get: function () { if (!state) load(); return state; },
    on: function (fn) { listeners.push(fn); },
    off: function (fn) { listeners = listeners.filter(function (f) { return f !== fn; }); },
    reset: function () { localStorage.removeItem(KEY); load(); emit('local'); },
    product: function (id) { return byId(Store.get().products, id); },
    vendor: function (id) { return byId(Store.get().vendors, id); },
    menuItem: function (id) { return byId(Store.get().menu, id); },
    channelEnabled: function (ch) { var c = Store.get().settings.channels; return ch === 'pos' || c[ch] !== false; },

    portions: function (m) {
      var s = Store.get(), min = Infinity;
      if (!m.recipe || !m.recipe.length) return 999;
      m.recipe.forEach(function (r) {
        var p = byId(s.products, r.productId);
        var uQty = convertQty(r.qty, r.uom || (p && p.unit), p && p.unit);
        var can = p && uQty > 0 ? Math.floor((p.stock + 1e-9) / uQty) : 0;
        if (can < min) min = can;
      });
      return min === Infinity ? 0 : Math.max(0, min);
    },

    stockStatus: function (p) {
      if (p.stock <= 0) return 'out';
      if (p.stock <= p.min) return 'low';
      return 'ok';
    },

    createOrder: function (o) {
      return mutate(function (s) {
        if (o.externalId) {
          for (var i = 0; i < s.orders.length; i++) {
            if (s.orders[i].channel === o.channel && s.orders[i].externalId === o.externalId) return null;
          }
        }
        var items = [], unmapped = [], total = 0;
        (o.items || []).forEach(function (it) {
          var m = resolveMenu(s, it);
          var qty = Math.max(1, Number(it.qty) || 1);
          var price = it.price != null && it.price !== '' ? Number(it.price) : (m ? m.price : 0);
          items.push({ menuId: m ? m.id : null, sku: m ? m.sku : (it.sku || ''), name: m ? m.name : (it.name || 'Item'), qty: qty, price: price, note: it.note || '', upsellQty: Math.min(qty, Math.max(0, Number(it.upsellQty) || 0)) });
          if (!m) unmapped.push(it.name || it.sku || 'Item');
          total += qty * price;
        });
        if (!items.length) return null;
        var ch = CHANNELS[o.channel] ? o.channel : 'pos';
        var orderType = DINE_CHANNELS.indexOf(ch) >= 0 ? normType(o.orderType) : '';
        var bagFee = orderType === 'takeaway' ? BAG_FEE : 0;
        total += bagFee;
        s.settings.counters.order++;
        var no = CHANNELS[ch].prefix + '-' + pad(s.settings.counters.order, 4);
        var bomBreakdown = [];
        items.forEach(function (it) {
          var m = it.menuId ? byId(s.menu, it.menuId) : null;
          if (!m) return;
          m.recipe.forEach(function (r) {
            var p = byId(s.products, r.productId);
            if (!p) return;
            var uQty = convertQty((Number(r.qty) || 0) * it.qty, r.uom || p.unit, p.unit);
            addMove(s, r.productId, -uQty, 'sale', no, it.name + ' x' + it.qty + ' (BOM)');
            bomBreakdown.push({ menuName: it.name, orderQty: it.qty, productId: p.id, material: p.name, unit: p.unit, qty: uQty });
          });
        });
        var order = {
          id: uid('o'), no: no, channel: ch, externalId: o.externalId || '', customer: o.customer || '', cashier: o.cashier || '',
          orderType: orderType, bagFee: bagFee,
          items: items, bomBreakdown: bomBreakdown, total: total,
          payment: o.payment || ({ pos: 'cash', kiosk: 'qris', qr: 'xendit' }[ch] || 'online'),
          cashReceived: o.cashReceived || 0,
          status: 'new', createdAt: Date.now(), startedAt: null, readyAt: null, doneAt: null,
          stockDeducted: true, unmapped: unmapped
        };
        s.orders.push(order);
        return order;
      });
    },

    setOrderStatus: function (id, status) {
      return mutate(function (s) {
        var o = byId(s.orders, id);
        if (!o || o.status === status) return o;
        var now = Date.now();
        if (status === 'preparing') o.startedAt = o.startedAt || now;
        if (status === 'ready') { o.startedAt = o.startedAt || now; o.readyAt = now; }
        if (status === 'completed') { o.startedAt = o.startedAt || now; o.readyAt = o.readyAt || now; o.doneAt = now; }
        if (status === 'cancelled' && o.stockDeducted && o.status !== 'cancelled') {
          o.items.forEach(function (it) {
            var m = it.menuId ? byId(s.menu, it.menuId) : null;
            if (!m) return;
            m.recipe.forEach(function (r) {
              var p = byId(s.products, r.productId);
              if (!p) return;
              var uQty = convertQty((Number(r.qty) || 0) * it.qty, r.uom || p.unit, p.unit);
              addMove(s, r.productId, uQty, 'sale-void', o.no, 'Void ' + it.name + ' x' + it.qty);
            });
          });
          o.stockDeducted = false;
          o.doneAt = now;
        }
        o.status = status;
        return o;
      });
    },

    saveOpname: function (type, date, lines, note, officer) {
      return mutate(function (s) {
        var no = nextNo(s, 'opname', 'OPN');
        var out = [];
        lines.forEach(function (l) {
          var p = byId(s.products, l.productId);
          if (!p) return;
          var sys = p.stock, phys = Number(l.physical);
          if (isNaN(phys)) return;
          var diff = Math.round((phys - sys) * 10000) / 10000;
          if (diff !== 0) addMove(s, p.id, diff, 'opname', no, type);
          out.push({ productId: p.id, name: p.name, unit: p.unit, system: sys, physical: phys, diff: diff });
        });
        var doc = { id: uid('op'), no: no, type: type, date: date, officer: officer || '', note: note || '', lines: out, createdAt: Date.now() };
        s.opnames.push(doc);
        return doc;
      });
    },

    createReceipt: function (r) {
      return mutate(function (s) {
        var no = nextNo(s, 'receipt', 'GR');
        var vendorName = (r.vendorName || '').trim();
        var grType = r.grType || 'gr_po_wms';
        var lines = r.lines.map(function (l) {
          var p = byId(s.products, l.productId);
          addMove(s, l.productId, Number(l.qty), 'receive', no, vendorName, grType);
          return { productId: l.productId, name: p.name, unit: p.unit, qty: Number(l.qty) };
        });
        var doc = { id: uid('gr'), no: no, date: r.date, vendorName: vendorName || '-', grType: grType, receiver: r.receiver || '', ref: r.ref || '', note: r.note || '', lines: lines, createdAt: Date.now() };
        s.receipts.push(doc);
        return doc;
      });
    },

    createIssue: function (r) {
      return mutate(function (s) {
        var no = nextNo(s, 'issue', 'GI');
        var lines = r.lines.map(function (l) {
          var p = byId(s.products, l.productId);
          addMove(s, l.productId, -Number(l.qty), 'issue', no, (r.outlet ? r.outlet + ' → ' : '') + r.recipient, 'gi_tf');
          return { productId: l.productId, name: p.name, unit: p.unit, qty: Number(l.qty) };
        });
        var doc = { id: uid('gi'), no: no, date: r.date, outlet: r.outlet || '', recipient: r.recipient, sender: r.sender || '', note: r.note || '', lines: lines, createdAt: Date.now() };
        s.issues.push(doc);
        return doc;
      });
    },

    addWaste: function (date, lines, officer) {
      return mutate(function (s) {
        lines.forEach(function (l) {
          var p = byId(s.products, l.productId);
          if (!p) return;
          addMove(s, p.id, -Number(l.qty), 'waste', 'WST-' + date, l.reason || '', 'waste');
          s.waste.push({ id: uid('w'), date: date, productId: p.id, name: p.name, unit: p.unit, qty: Number(l.qty), reason: l.reason || '', officer: officer || '', createdAt: Date.now() });
        });
      });
    },

    ordersBetween: function (from, to) {
      return Store.get().orders.filter(function (o) { return o.createdAt >= from && o.createdAt <= (to || Date.now()); });
    },
    currentShift: function () {
      var a = Store.get().shifts || [];
      for (var i = a.length - 1; i >= 0; i--) if (!a[i].closedAt) return a[i];
      return null;
    },
    startShift: function (d) {
      return mutate(function (s) {
        if (s.shifts.some(function (x) { return !x.closedAt; })) return null;
        var sh = { id: uid('sh'), type: 'shift', no: nextNo(s, 'shift', 'SH'), date: dateKey(Date.now()), openedAt: Date.now(), closedAt: null,
          cashier: d.cashier || '', openingCash: Number(d.openingCash) || 0, closedBy: '', countedCash: null, summary: null };
        s.shifts.push(sh);
        return sh;
      });
    },
    endShift: function (d) {
      return mutate(function (s) {
        var sh = null;
        s.shifts.forEach(function (x) { if (!x.closedAt) sh = x; });
        if (!sh) return null;
        var now = Date.now();
        sh.closedAt = now; sh.closedBy = d.closedBy || sh.cashier;
        sh.countedCash = (d.countedCash === '' || d.countedCash == null) ? null : Number(d.countedCash);
        sh.summary = buildSummary(s.orders.filter(function (o) { return o.createdAt >= sh.openedAt && o.createdAt <= now; }));
        return sh;
      });
    },
    endDay: function (d) {
      return mutate(function (s) {
        if (s.shifts.some(function (x) { return !x.closedAt; })) return null;
        var date = dateKey(Date.now());
        var shifts = s.shifts.filter(function (x) { return x.date === date && x.closedAt; });
        var rec = { id: uid('ed'), type: 'day', no: nextNo(s, 'day', 'ED'), date: date, closedAt: Date.now(), closedBy: d.closedBy || '',
          shiftNos: shifts.map(function (x) { return x.no; }),
          summary: buildSummary(s.orders.filter(function (o) { return dateKey(o.createdAt) === date; })) };
        s.days.push(rec);
        return rec;
      });
    },
    setMinStock: function (id, v) {
      return mutate(function (s) { var p = byId(s.products, id); if (p) p.min = Math.max(0, Number(v) || 0); return p; });
    },
    saveProduct: function (p) {
      return mutate(function (s) {
        var ex = p.id ? byId(s.products, p.id) : null;
        if (ex) { ex.name = p.name; ex.unit = p.unit; ex.category = p.category; ex.min = Number(p.min) || 0; ex.cycle = p.cycle; return ex; }
        var np = { id: uid('p'), name: p.name, unit: p.unit, category: p.category, stock: 0, min: Number(p.min) || 0, cycle: p.cycle };
        s.products.push(np);
        if (Number(p.stock) > 0) addMove(s, np.id, Number(p.stock), 'opname', 'OPENING-BAL', 'Opening balance');
        return np;
      });
    },
    saveMenu: function (m) {
      return mutate(function (s) {
        var ex = m.id ? byId(s.menu, m.id) : null;
        if (ex) { ex.name = m.name; ex.sku = m.sku; ex.category = m.category; ex.price = Number(m.price) || 0; ex.usageNote = m.usageNote || ''; ex.recipe = m.recipe; ex.upsell = !!m.upsell; return ex; }
        var nm = { id: uid('m'), sku: m.sku, name: m.name, category: m.category, price: Number(m.price) || 0, usageNote: m.usageNote || '', recipe: m.recipe, upsell: !!m.upsell };
        s.menu.push(nm);
        return nm;
      });
    },
    deleteMenu: function (id) { mutate(function (s) { s.menu = s.menu.filter(function (m) { return m.id !== id; }); }); },
    saveVendor: function (v) {
      return mutate(function (s) {
        var ex = v.id ? byId(s.vendors, v.id) : null;
        if (ex) { ex.name = v.name; ex.contact = v.contact; return ex; }
        var nv = { id: uid('v'), name: v.name, contact: v.contact || '' };
        s.vendors.push(nv);
        return nv;
      });
    },
    deleteVendor: function (id) { mutate(function (s) { s.vendors = s.vendors.filter(function (v) { return v.id !== id; }); }); },
    saveSettings: function (st) {
      mutate(function (s) { s.settings.restaurant = st.restaurant; s.settings.address = st.address; });
    },
    setChannel: function (ch, on) { mutate(function (s) { s.settings.channels[ch] = !!on; }); }
  };

  global.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
