/* UI helpers: formatting, toast, modal, file download, line editor */
(function (global) {
  'use strict';
  var UI = {};

  UI.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.rp = function (n) { return 'Rp ' + Math.round(n || 0).toLocaleString('en-US'); };
  UI.num = function (n) {
    n = Math.round((n || 0) * 10000) / 10000;
    return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };
  UI.today = function () { return Store.dateKey(Date.now()); };
  UI.time = function (ts) {
    if (!ts) return '-';
    var d = new Date(ts);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  };
  UI.dateTime = function (ts) {
    if (!ts) return '-';
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + UI.time(ts);
  };
  UI.dateLabel = function (iso) {
    if (!iso) return '-';
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  UI.duration = function (ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60); s = s % 60;
    return ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
  };
  UI.chBadge = function (ch) {
    var c = Store.CHANNELS[ch] || Store.CHANNELS.pos;
    return '<span class="badge" style="--c:' + c.color + '">' + UI.esc(c.label) + '</span>';
  };
  UI.typeBadge = function (o) {
    if (!o || !o.orderType) return '';
    return ' <span class="badge" style="--c:' + (o.orderType === 'takeaway' ? '#c2410c' : '#7c3aed') + '">' + (o.orderType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine In') + '</span>';
  };
  UI.statusPill = function (st) {
    var map = { new: 'New', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
    return '<span class="pill s-' + st + '">' + (map[st] || st) + '</span>';
  };

  UI.toast = function (msg, type) {
    var box = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3700);
  };

  UI.modal = function (opt) {
    var root = document.getElementById('modal-root');
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal ' + (opt.wide ? 'wide' : '') + '">' +
      '<div class="modal-h"><h3>' + UI.esc(opt.title) + '</h3><button class="icon-btn" data-close>&times;</button></div>' +
      '<div class="modal-b"></div>' +
      '<div class="modal-f"></div></div>';
    var body = wrap.querySelector('.modal-b');
    if (typeof opt.body === 'string') body.innerHTML = opt.body; else if (opt.body) body.appendChild(opt.body);
    var foot = wrap.querySelector('.modal-f');
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); if (opt.onClose) opt.onClose(); }
    (opt.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.kind || '');
      b.textContent = a.label;
      b.addEventListener('click', function () {
        var keep = a.onClick ? a.onClick(wrap, close) : undefined;
        if (keep !== false && !a.stay) close();
      });
      foot.appendChild(b);
    });
    if (!opt.actions || !opt.actions.length) foot.style.display = 'none';
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.hasAttribute('data-close')) close();
    });
    root.appendChild(wrap);
    return { el: wrap, close: close };
  };
  UI.confirm = function (title, text, okLabel, onOk) {
    UI.modal({
      title: title, body: '<p>' + text + '</p>',
      actions: [{ label: 'Cancel' }, { label: okLabel || 'Confirm', kind: 'primary', onClick: function () { onOk(); } }]
    });
  };

  UI.download = function (filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  UI.csv = function (rows, delim) {
    delim = delim || ',';
    var body = rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(delim);
    }).join('\r\n');
    return '\ufeff' + body;
  };
  UI.parseCsv = function (text) {
    text = text.replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/)[0] || '';
    var delim = (first.split(';').length > first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  };

  UI.lineEditor = function (container, opt) {
    opt = opt || {};
    var products = Store.get().products;
    container.innerHTML =
      '<table class="tbl lines"><thead><tr><th>Material / Product</th><th style="width:130px">Qty</th><th style="width:75px">UoM</th>' +
      (opt.showStock ? '<th style="width:115px">Current Stock</th>' : '') +
      (opt.extra ? '<th style="width:170px">' + UI.esc(opt.extra.label) + '</th>' : '') +
      '<th style="width:40px"></th></tr></thead><tbody></tbody></table>' +
      '<button type="button" class="btn ghost sm" data-add-line>+ Add row</button>';
    var tbody = container.querySelector('tbody');

    function optionsHtml() {
      return '<option value="">— select material —</option>' + products.map(function (p) {
        return '<option value="' + p.id + '">' + UI.esc(p.name) + '</option>';
      }).join('');
    }
    function refreshRow(tr) {
      var p = Store.product(tr.querySelector('select.prod').value);
      tr.querySelector('.unit').textContent = p ? p.unit : '-';
      var st = tr.querySelector('.stk');
      if (st) st.textContent = p ? UI.num(p.stock) : '-';
    }
    function addRow(pre) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><select class="prod">' + optionsHtml() + '</select></td>' +
        '<td><input type="number" class="qty" min="0" step="any" placeholder="0"></td>' +
        '<td class="unit muted">-</td>' +
        (opt.showStock ? '<td class="stk muted">-</td>' : '') +
        (opt.extra ? '<td><select class="extra">' + opt.extra.options.map(function (o) { return '<option>' + UI.esc(o) + '</option>'; }).join('') + '</select></td>' : '') +
        '<td><button type="button" class="icon-btn" data-rm title="Remove row">&times;</button></td>';
      tbody.appendChild(tr);
      if (pre) { tr.querySelector('select.prod').value = pre; refreshRow(tr); }
    }
    container.addEventListener('change', function (e) {
      if (e.target.classList.contains('prod')) refreshRow(e.target.closest('tr'));
    });
    container.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-add-line')) addRow();
      if (e.target.hasAttribute('data-rm')) {
        if (tbody.children.length > 1) e.target.closest('tr').remove();
        else { var tr = e.target.closest('tr'); tr.querySelector('select.prod').value = ''; tr.querySelector('.qty').value = ''; refreshRow(tr); }
      }
    });
    addRow();

    return {
      getLines: function () {
        var map = {}, order = [];
        Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
          var id = tr.querySelector('select.prod').value;
          var q = parseFloat(tr.querySelector('.qty').value);
          if (!id || !(q > 0)) return;
          var ex = tr.querySelector('.extra') ? tr.querySelector('.extra').value : '';
          var key = id + '|' + ex;
          if (!map[key]) { map[key] = { productId: id, qty: 0, reason: ex }; order.push(key); }
          map[key].qty += q;
        });
        return order.map(function (k) { return map[k]; });
      },
      reset: function () { tbody.innerHTML = ''; addRow(); }
    };
  };

  global.UI = UI;
})(window);
