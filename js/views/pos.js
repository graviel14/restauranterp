(function () {
  'use strict';
  var root, cart = [], cat = 'All', q = '', pay = 'cash', orderType = 'dinein', cashier = '';

  function getCashier() {
    var el = root && root.querySelector('#pos-cashier');
    return el ? el.value.trim() : cashier;
  }

  function hasCashier() {
    return !!getCashier();
  }

  function requireCashier() {
    if (hasCashier()) return true;
    var el = root && root.querySelector('#pos-cashier');
    if (el) {
      el.focus();
      el.style.borderColor = 'var(--err)';
    }
    UI.toast('Please enter Cashier name first before running POS', 'warn');
    return false;
  }

  function subtotal() {
    return cart.reduce(function (a, l) { var m = Store.menuItem(l.menuId); return a + (m ? m.price * l.qty : 0); }, 0);
  }
  function bagFee() { return orderType === 'takeaway' ? Store.BAG_FEE : 0; }
  function cartTotal() { return subtotal() + bagFee(); }

  function paintBomPreview() {
    var box = root.querySelector('#pos-bom');
    if (!box) return;
    if (!cart.length) {
      box.innerHTML = '<div class="muted" style="font-size:12px">BOM material usage will calculate automatically when items are added.</div>';
      return;
    }
    var bom = Store.calculateBom(cart.map(function (l) { return { menuId: l.menuId, qty: l.qty }; }));
    box.innerHTML = bom.length ? bom.map(function (b) {
      return '<div class="row sp" style="font-size:12px;padding:3px 0;border-bottom:1px dashed #f0dfc2"><span>' + UI.esc(b.name) + '</span><b>' + UI.num(b.qty) + ' ' + UI.esc(b.unit) + '</b></div>';
    }).join('') : '<div class="muted" style="font-size:12px">No BOM recipe linked.</div>';
  }

  function syncPosLock() {
    var active = hasCashier();
    var stEl = root.querySelector('#pos-cashier-status');
    if (stEl) {
      stEl.textContent = active ? 'Active: ' + getCashier() : 'Required before running POS';
      stEl.style.color = active ? 'var(--ok)' : 'var(--warn)';
    }
    Array.prototype.forEach.call(root.querySelectorAll('#pos-menu .mi'), function (btn) {
      var noStock = btn.getAttribute('data-nostock') === '1';
      btn.disabled = !active || noStock;
    });
    var payBtn = root.querySelector('#btn-pay');
    if (payBtn) payBtn.disabled = !active || !cart.length;
  }

  function paintMenu() {
    var s = Store.get();
    var active = hasCashier();
    var cats = ['All'].concat(s.menu.map(function (m) { return m.category; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    var items = s.menu.filter(function (m) {
      return (cat === 'All' || m.category === cat) && m.name.toLowerCase().indexOf(q.toLowerCase()) >= 0;
    });
    root.querySelector('#pos-cats').innerHTML = cats.map(function (c) {
      return '<button class="chip ' + (c === cat ? 'on' : '') + '" data-cat="' + UI.esc(c) + '">' + UI.esc(c) + '</button>';
    }).join('');
    root.querySelector('#pos-menu').innerHTML = items.length ? items.map(function (m) {
      var por = Store.portions(m), inCart = 0;
      cart.forEach(function (l) { if (l.menuId === m.id) inCart = l.qty; });
      var noStock = por - inCart <= 0;
      var dis = !active || noStock;
      return '<button class="mi" data-add="' + m.id + '" data-nostock="' + (noStock ? '1' : '0') + '" ' + (dis ? 'disabled' : '') + '>' +
        '<span class="muted" style="font-size:11px">' + UI.esc(m.category) + '</span>' +
        '<b>' + UI.esc(m.name) + '</b><span class="pr">' + UI.rp(m.price) + '</span>' +
        '<small>' + (!active ? 'Enter cashier name first' : (noStock ? 'Insufficient BOM stock' : 'Avail ~' + (por - inCart) + ' portions')) + '</small></button>';
    }).join('') : '<div class="empty" style="grid-column:1/-1">No menu items found</div>';
    syncPosLock();
  }

  function paintCart() {
    var box = root.querySelector('#cart-lines');
    if (!cart.length) box.innerHTML = '<div class="empty">Cart is empty.<br>Select menu items on the left.</div>';
    else box.innerHTML = cart.map(function (l, i) {
      var m = Store.menuItem(l.menuId);
      return '<div class="cart-line"><div><b>' + UI.esc(m.name) + '</b>' + (l.upsellQty ? ' <span class="badge" style="--c:#7c3aed">⭐ upsell ×' + l.upsellQty + '</span>' : '') + (l.note ? '<div class="muted" style="font-size:12px">📝 ' + UI.esc(l.note) + '</div>' : '') +
        '<a href="#" data-note="' + i + '" style="font-size:12px;color:var(--acc2)">' + (l.note ? 'edit' : '+') + ' note</a></div>' +
        '<div class="qtyc"><button data-dec="' + i + '">−</button><b>' + l.qty + '</b><button data-inc="' + i + '">+</button></div>' +
        '<div class="muted">' + UI.rp(m.price) + '</div><div style="text-align:right"><b>' + UI.rp(m.price * l.qty) + '</b></div></div>';
    }).join('');
    root.querySelector('#cart-sub').textContent = UI.rp(subtotal());
    root.querySelector('#cart-bag').style.display = orderType === 'takeaway' ? 'flex' : 'none';
    root.querySelector('#cart-bag-amt').textContent = UI.rp(Store.BAG_FEE);
    Array.prototype.forEach.call(root.querySelectorAll('[data-otype]'), function (b) { b.classList.toggle('on', b.getAttribute('data-otype') === orderType); });
    root.querySelector('#cart-total').textContent = UI.rp(cartTotal());
    root.querySelector('#cash-box').style.display = pay === 'cash' ? 'block' : 'none';
    Array.prototype.forEach.call(root.querySelectorAll('[data-pay]'), function (b) { b.classList.toggle('on', b.getAttribute('data-pay') === pay); });
    updateChange();
    paintBomPreview();
    syncPosLock();
  }

  function updateChange() {
    var got = parseFloat(root.querySelector('#cash-in').value) || 0;
    var ch = got - cartTotal();
    root.querySelector('#change').textContent = got ? (ch >= 0 ? 'Change: ' + UI.rp(ch) : 'Short: ' + UI.rp(-ch)) : '';
    root.querySelector('#change').className = 'muted ' + (got && ch < 0 ? 'neg' : '');
  }

  /* Upselling screen: shown after a non-Ala Carte menu is chosen */
  function upsell() {
    if (!requireCashier()) return;
    var menu = Store.get().menu;
    function room(m) {
      var inCart = 0;
      cart.forEach(function (l) { if (l.menuId === m.id) inCart = l.qty; });
      return Store.portions(m) - inCart;
    }
    var alas = menu.filter(function (m) { return m.upsell && room(m) > 0; });
    if (!alas.length) return;
    var picks = {};
    var body = '<p class="muted" style="margin-top:0">Offer the customer something extra: 22oz drinks, cheese crackling, rice, cheese dip or BBQ sauce.</p><div class="up-grid">' +
      alas.map(function (m) {
        return '<div class="up-item"><div><b>' + UI.esc(m.name) + '</b><div class="pr">' + UI.rp(m.price) + '</div></div>' +
          '<div class="qtyc"><button type="button" data-up-dec="' + m.id + '">−</button><b data-up-q="' + m.id + '">0</b><button type="button" data-up-inc="' + m.id + '">+</button></div></div>';
      }).join('') + '</div><div class="row sp" style="margin-top:12px"><span class="muted">Upselling total</span><b id="up-total">Rp 0</b></div>';
    var md = UI.modal({
      title: '⭐ Upselling — add something extra?', body: body, wide: true,
      actions: [{ label: 'No thanks' }, {
        label: 'Add to order', kind: 'primary', onClick: function () {
          alas.forEach(function (m) {
            var q = picks[m.id] || 0; if (!q) return;
            var ex = cart.filter(function (l) { return l.menuId === m.id; })[0];
            if (ex) { ex.qty += q; ex.upsellQty = (ex.upsellQty || 0) + q; }
            else cart.push({ menuId: m.id, qty: q, note: '', upsellQty: q });
          });
          paintMenu(); paintCart();
        }
      }]
    });
    md.el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var inc = b.getAttribute('data-up-inc'), dec = b.getAttribute('data-up-dec'), id = inc || dec;
      if (!id) return;
      var m = Store.menuItem(id), cur = picks[id] || 0;
      if (inc && cur < room(m)) cur++; else if (dec && cur > 0) cur--;
      picks[id] = cur;
      md.el.querySelector('[data-up-q="' + id + '"]').textContent = cur;
      var tot = 0; alas.forEach(function (x) { tot += (picks[x.id] || 0) * x.price; });
      md.el.querySelector('#up-total').textContent = UI.rp(tot);
    });
  }

  function checkout() {
    if (!requireCashier()) return;
    var total = cartTotal();
    if (!cart.length) return;
    var cash = parseFloat(root.querySelector('#cash-in').value) || 0;
    if (pay === 'cash' && cash && cash < total) { UI.toast('Cash received is less than total', 'err'); return; }
    var cName = getCashier();
    var o = Store.createOrder({
      channel: 'pos', orderType: orderType, customer: root.querySelector('#cust').value.trim(), cashier: cName, payment: pay, cashReceived: cash,
      items: cart.map(function (l) { return { menuId: l.menuId, qty: l.qty, note: l.note, upsellQty: l.upsellQty || 0 }; })
    });
    if (!o) { UI.toast('Failed to create order', 'err'); return; }
    UI.toast('Order ' + o.no + ' (' + cName + ') sent to KDS & BOM stock deducted', 'ok');
    cart = []; orderType = 'dinein'; root.querySelector('#cust').value = ''; root.querySelector('#cash-in').value = '';
    paintMenu(); paintCart();
  }

  function render(r) {
    var sh = Store.currentShift && Store.currentShift();
    root = r; cart = []; cat = 'All'; q = ''; pay = 'cash'; orderType = 'dinein';
    cashier = (sh && sh.cashier) ? sh.cashier : '';
    root.innerHTML =
      '<div class="pos-wrap"><div>' +
      '<input id="pos-q" placeholder="🔍 Search menu…"><div class="chips" id="pos-cats" style="margin-top:10px"></div><div class="menu-grid" id="pos-menu"></div></div>' +
      '<div class="card cart"><h3>New Order</h3>' +
      '<div class="fg"><div class="row sp" style="margin-bottom:4px"><label class="f" style="margin:0">Cashier Name *</label><span id="pos-cashier-status" style="font-size:11.5px;font-weight:600"></span></div>' +
      '<input id="pos-cashier" placeholder="Enter cashier name (required to run POS)" value="' + UI.esc(cashier) + '" required></div>' +
      '<div class="otype"><button data-otype="dinein">🍽️ Dine In</button><button data-otype="takeaway">🥡 Takeaway</button></div>' +
      '<div class="fg"><input id="cust" placeholder="Customer / Table no. (optional)"></div>' +
      '<div id="cart-lines"></div>' +
      '<div class="row sp muted" style="margin-top:10px"><span>Subtotal</span><span id="cart-sub">Rp 0</span></div>' +
      '<div class="row sp muted" id="cart-bag" style="display:none;margin-top:4px"><span>🛍️ Shopping bag (takeaway)</span><span id="cart-bag-amt"></span></div>' +
      '<div class="total"><span>Total</span><span id="cart-total">Rp 0</span></div>' +
      '<div class="pay-opts"><button data-pay="cash">💵 Cash</button><button data-pay="qris">📱 QRIS</button><button data-pay="edc">💳 EDC</button></div>' +
      '<div id="cash-box" class="fg"><input id="cash-in" type="number" min="0" placeholder="Cash received (optional)"><div id="change" class="muted" style="margin-top:4px"></div></div>' +
      '<button class="btn primary" id="btn-pay" style="width:100%;padding:12px">Pay & Send to Kitchen</button>' +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Estimated BOM Material Usage</div><div id="pos-bom"></div></div></div></div>';
    paintMenu(); paintCart();

    root.addEventListener('input', function (e) {
      if (e.target.id === 'pos-cashier') {
        cashier = e.target.value.trim();
        e.target.style.borderColor = cashier ? '' : 'var(--err)';
        paintMenu();
      }
      if (e.target.id === 'pos-q') { q = e.target.value; paintMenu(); }
      if (e.target.id === 'cash-in') updateChange();
    });
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button,a'); if (!t) return;
      if (t.hasAttribute('data-cat')) { cat = t.getAttribute('data-cat'); paintMenu(); }
      else if (t.hasAttribute('data-add')) {
        if (!requireCashier()) return;
        var id = t.getAttribute('data-add'), ex = cart.filter(function (l) { return l.menuId === id; })[0];
        if (ex) ex.qty++; else cart.push({ menuId: id, qty: 1, note: '' });
        paintMenu(); paintCart();
        var added = Store.menuItem(id);
        if (added && added.category !== 'Ala Carte') upsell();
      }
      else if (t.hasAttribute('data-inc')) {
        if (!requireCashier()) return;
        var l = cart[+t.getAttribute('data-inc')], m = Store.menuItem(l.menuId);
        if (Store.portions(m) > l.qty) l.qty++; else UI.toast('Insufficient BOM stock for extra portion', 'warn');
        paintMenu(); paintCart();
      }
      else if (t.hasAttribute('data-dec')) {
        var i = +t.getAttribute('data-dec'); cart[i].qty--; if (cart[i].upsellQty > cart[i].qty) cart[i].upsellQty = cart[i].qty; if (cart[i].qty <= 0) cart.splice(i, 1);
        paintMenu(); paintCart();
      }
      else if (t.hasAttribute('data-note')) {
        e.preventDefault();
        var li = cart[+t.getAttribute('data-note')];
        var v = window.prompt('Kitchen note (e.g. level 3, no sauce):', li.note || '');
        if (v !== null) { li.note = v.trim(); paintCart(); }
      }
      else if (t.hasAttribute('data-otype')) { orderType = t.getAttribute('data-otype'); paintCart(); }
      else if (t.hasAttribute('data-pay')) { pay = t.getAttribute('data-pay'); paintCart(); }
      else if (t.id === 'btn-pay') checkout();
    });
  }

  window.Views = window.Views || {};
  window.Views.pos = {
    title: 'POS Cashier', sub: 'Enter cashier name first, then choose Dine In or Takeaway (+Rp 4.000 shopping bag). Orders go straight to KDS and deduct material stock by BOM',
    render: render,
    onStore: function () { if (root) paintMenu(); }
  };
})();
