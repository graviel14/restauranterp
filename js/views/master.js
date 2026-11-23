(function () {
  'use strict';
  var root, tab = 'menu';
  var CYCLE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

  function tabsHtml() {
    var t = [['menu', 'Menu & BOM'], ['products', 'Materials'], ['vendors', 'Vendors'], ['resto', 'Restaurant Profile']];
    return '<div class="tabs">' + t.map(function (x) { return '<button class="tab ' + (tab === x[0] ? 'on' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }

  function paint() {
    var s = Store.get(), body = '';
    if (tab === 'menu') {
      body = '<div class="card"><div class="row sp" style="margin-bottom:10px"><h3 style="margin:0">Menu Items & BOM Recipes</h3><button class="btn primary sm" data-menu="">+ Add Menu Option</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>SKU</th><th>Menu Option</th><th>Category</th><th class="r">Price</th><th>BOM (per portion)</th><th></th></tr></thead><tbody>' +
        s.menu.map(function (m) {
          var rec = (m.recipe || []).map(function (r) {
            var p = Store.product(r.productId);
            return p ? UI.num(r.qty) + ' ' + (r.uom || p.unit) + ' ' + p.name : '';
          }).filter(Boolean).join(', ');
          return '<tr><td class="muted">' + UI.esc(m.sku) + '</td><td><b>' + UI.esc(m.name) + '</b>' + (m.upsell ? ' <span class="badge" style="--c:#7c3aed">⭐ upsell</span>' : '') + (m.usageNote ? '<div class="muted" style="font-size:11.5px">' + UI.esc(m.usageNote) + '</div>' : '') + '</td><td>' + UI.esc(m.category) + '</td><td class="r">' + UI.rp(m.price) + '</td><td class="muted" style="max-width:340px">' + UI.esc(rec) + '</td>' +
            '<td class="row"><button class="btn sm" data-menu="' + m.id + '">Edit</button><button class="btn sm danger" data-delmenu="' + m.id + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'products') {
      body = '<div class="card"><div class="row sp" style="margin-bottom:10px"><h3 style="margin:0">Materials (NAME MATERIAL & UoM)</h3><button class="btn primary sm" data-prod="">+ Add Material</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name Material</th><th>Category</th><th>UoM</th><th class="r">Stock</th><th class="r">Min</th><th>Count Cycle</th><th></th></tr></thead><tbody>' +
        s.products.map(function (p) {
          return '<tr><td>' + UI.esc(p.name) + '</td><td>' + UI.esc(p.category) + '</td><td>' + UI.esc(p.unit) + '</td><td class="r">' + UI.num(p.stock) + '</td><td class="r">' + UI.num(p.min) + '</td><td>' + CYCLE[p.cycle] + '</td><td><button class="btn sm" data-prod="' + p.id + '">Edit</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'vendors') {
      body = '<div class="card"><div class="row sp" style="margin-bottom:10px"><h3 style="margin:0">Vendors</h3><button class="btn primary sm" data-vendor="">+ Add Vendor</button></div><table class="tbl"><thead><tr><th>Name</th><th>Contact</th><th></th></tr></thead><tbody>' +
        s.vendors.map(function (v) { return '<tr><td>' + UI.esc(v.name) + '</td><td class="muted">' + UI.esc(v.contact) + '</td><td class="row"><button class="btn sm" data-vendor="' + v.id + '">Edit</button><button class="btn sm danger" data-delvendor="' + v.id + '">Delete</button></td></tr>'; }).join('') + '</tbody></table></div>';
    } else {
      body = '<div class="card" style="max-width:520px"><h3>Restaurant Profile</h3><p class="muted" style="margin-top:0">Shown on PDF headers.</p>' +
        '<div class="fg"><label class="f">Restaurant Name</label><input id="rs-name" value="' + UI.esc(s.settings.restaurant) + '"></div>' +
        '<div class="fg"><label class="f">Address</label><input id="rs-addr" value="' + UI.esc(s.settings.address) + '"></div><button class="btn primary" id="rs-save">Save</button></div>';
    }
    root.innerHTML = tabsHtml() + body;
  }

  function productForm(id) {
    var p = id ? Store.product(id) : { name: '', unit: 'kg', category: '', min: 0, cycle: 'weekly' };
    var body = '<div class="fgrid"><div class="fg"><label class="f">Material Name</label><input id="pf-name" value="' + UI.esc(p.name) + '"></div><div class="fg"><label class="f">UoM</label><input id="pf-unit" value="' + UI.esc(p.unit) + '" placeholder="kg, gr, pcs…"></div><div class="fg"><label class="f">Category</label><input id="pf-cat" value="' + UI.esc(p.category) + '"></div>' +
      '<div class="fg"><label class="f">Minimum Stock</label><input type="number" step="any" id="pf-min" value="' + p.min + '"></div>' +
      '<div class="fg"><label class="f">Count Cycle</label><select id="pf-cycle">' + Object.keys(CYCLE).map(function (k) { return '<option value="' + k + '"' + (p.cycle === k ? ' selected' : '') + '>' + CYCLE[k] + '</option>'; }).join('') + '</select></div>' +
      (id ? '' : '<div class="fg"><label class="f">Opening Stock</label><input type="number" step="any" id="pf-stock" value="0"></div>') + '</div>';
    UI.modal({
      title: id ? 'Edit Material' : 'New Material', body: body,
      actions: [{ label: 'Cancel' }, {
        label: 'Save', kind: 'primary', onClick: function (w) {
          var g = function (x) { return w.querySelector(x).value.trim(); };
          if (!g('#pf-name') || !g('#pf-unit')) { UI.toast('Name and UoM are required', 'warn'); return false; }
          var dupe = Store.get().products.some(function (x) { return x.name.toLowerCase() === g('#pf-name').toLowerCase() && x.id !== id; });
          if (dupe) { UI.toast('Material name already exists', 'err'); return false; }
          Store.saveProduct({ id: id || null, name: g('#pf-name'), unit: g('#pf-unit'), category: g('#pf-cat'), min: g('#pf-min'), cycle: g('#pf-cycle'), stock: w.querySelector('#pf-stock') ? g('#pf-stock') : 0 });
          paint();
        }
      }]
    });
  }

  function menuForm(id) {
    var m = id ? Store.menuItem(id) : { name: '', sku: '', category: 'Paket Combo', price: 0, usageNote: '', recipe: [] };
    var prods = Store.get().products;
    var opts = function (sel) { return '<option value="">— material —</option>' + prods.map(function (p) { return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + UI.esc(p.name) + ' (' + p.unit + ')</option>'; }).join(''); };
    var uomOpts = function (sel) {
      return ['KG', 'GRAM', 'PCS'].map(function (u) { return '<option value="' + u + '"' + (String(sel || '').toUpperCase() === u ? ' selected' : '') + '>' + u + '</option>'; }).join('');
    };
    var rowHtml = function (r) {
      return '<div class="row rrow" style="flex-wrap:nowrap;margin-bottom:6px"><select class="r-p">' + opts(r.productId) + '</select>' +
        '<input type="number" step="any" min="0" class="r-q" style="width:105px" placeholder="BOM qty" value="' + (r.qty || '') + '">' +
        '<select class="r-u" style="width:90px">' + uomOpts(r.uom) + '</select>' +
        '<button type="button" class="icon-btn" data-rr>&times;</button></div>';
    };
    var body = '<div class="fgrid"><div class="fg"><label class="f">Menu Name / Option</label><input id="mf-name" value="' + UI.esc(m.name) + '"></div><div class="fg"><label class="f">SKU</label><input id="mf-sku" value="' + UI.esc(m.sku) + '"></div>' +
      '<div class="fg"><label class="f">Category</label><select id="mf-cat">' + ['Paket Combo', 'Combo Mabar', 'Hot Deals', 'Ala Carte'].map(function (c) { return '<option' + (m.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="fg"><label class="f">Price (Rp)</label><input type="number" id="mf-price" value="' + m.price + '"></div></div>' +
      '<div class="fg"><label class="f">Material Usage Note</label><input id="mf-note" value="' + UI.esc(m.usageNote || '') + '"></div>' +
      '<label class="row" style="gap:8px;margin-bottom:12px"><input type="checkbox" id="mf-up" style="width:auto"' + (m.upsell ? ' checked' : '') + '> Show in POS upselling screen</label>' +
      '<label class="f">BOM Recipe — material usage per 1 portion</label><div id="mf-rec">' + ((m.recipe && m.recipe.length) ? m.recipe : [{}]).map(rowHtml).join('') + '</div><button type="button" class="btn ghost sm" id="mf-add">+ Add BOM Line</button>';
    var md = UI.modal({
      title: id ? 'Edit Menu & BOM' : 'New Menu & BOM', body: body, wide: true,
      actions: [{ label: 'Cancel' }, {
        label: 'Save', kind: 'primary', onClick: function (w) {
          var name = w.querySelector('#mf-name').value.trim(), sku = w.querySelector('#mf-sku').value.trim();
          if (!name || !sku) { UI.toast('Name and SKU are required', 'warn'); return false; }
          if (Store.get().menu.some(function (x) { return x.sku === sku && x.id !== id; })) { UI.toast('Menu SKU already in use', 'err'); return false; }
          var rec = [];
          Array.prototype.forEach.call(w.querySelectorAll('.rrow'), function (r) {
            var pid = r.querySelector('.r-p').value, q = parseFloat(r.querySelector('.r-q').value), u = r.querySelector('.r-u').value;
            if (pid && q > 0) rec.push({ productId: pid, qty: q, uom: u });
          });
          Store.saveMenu({ id: id || null, name: name, sku: sku, category: w.querySelector('#mf-cat').value, price: w.querySelector('#mf-price').value, usageNote: w.querySelector('#mf-note').value.trim(), recipe: rec, upsell: w.querySelector('#mf-up').checked });
          paint();
        }
      }]
    });
    md.el.addEventListener('click', function (e) {
      if (e.target.id === 'mf-add') md.el.querySelector('#mf-rec').insertAdjacentHTML('beforeend', rowHtml({}));
      if (e.target.hasAttribute('data-rr')) e.target.closest('.rrow').remove();
    });
  }

  function vendorForm(id) {
    var v = id ? Store.vendor(id) : { name: '', contact: '' };
    UI.modal({
      title: id ? 'Edit Vendor' : 'New Vendor',
      body: '<div class="fg"><label class="f">Vendor Name</label><input id="vf-name" value="' + UI.esc(v.name) + '"></div><div class="fg"><label class="f">Contact</label><input id="vf-contact" value="' + UI.esc(v.contact) + '"></div>',
      actions: [{ label: 'Cancel' }, {
        label: 'Save', kind: 'primary', onClick: function (w) {
          var n = w.querySelector('#vf-name').value.trim(); if (!n) { UI.toast('Vendor name is required', 'warn'); return false; }
          Store.saveVendor({ id: id || null, name: n, contact: w.querySelector('#vf-contact').value.trim() }); paint();
        }
      }]
    });
  }

  window.Views = window.Views || {};
  window.Views.master = {
    title: 'Master Data', sub: 'Menu options & BOM recipes, materials, vendors, restaurant profile',
    render: function (r) {
      root = r; tab = 'menu'; paint();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-tab')) { tab = t.getAttribute('data-tab'); paint(); }
        else if (t.hasAttribute('data-prod')) productForm(t.getAttribute('data-prod') || null);
        else if (t.hasAttribute('data-menu')) menuForm(t.getAttribute('data-menu') || null);
        else if (t.hasAttribute('data-vendor')) vendorForm(t.getAttribute('data-vendor') || null);
        else if (t.hasAttribute('data-delmenu')) UI.confirm('Delete menu', 'This menu item will be removed from POS.', 'Delete', function () { Store.deleteMenu(t.getAttribute('data-delmenu')); paint(); });
        else if (t.hasAttribute('data-delvendor')) UI.confirm('Delete vendor', 'Existing receipts keep the vendor name.', 'Delete', function () { Store.deleteVendor(t.getAttribute('data-delvendor')); paint(); });
        else if (t.id === 'rs-save') { Store.saveSettings({ restaurant: root.querySelector('#rs-name').value.trim() || 'Restaurant', address: root.querySelector('#rs-addr').value.trim() }); UI.toast('Profile saved', 'ok'); }
      });
    }
  };
})();
