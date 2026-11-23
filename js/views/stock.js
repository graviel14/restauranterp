(function () {
  'use strict';
  var root;

  function statusCell(p) {
    var st = Store.stockStatus(p);
    return '<td class="st-' + st + '" data-st>● ' + st + '</td>';
  }

  function paint() {
    var s = Store.get();
    root.innerHTML = '<div class="card"><div class="muted" style="font-size:12.5px;margin-bottom:10px">Set the minimum stock for each material yourself — the status turns Low when stock reaches the minimum.</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Material</th><th class="r">Stock</th><th style="width:150px">Minimum Stock</th><th>Status</th></tr></thead><tbody>' +
      s.products.map(function (p) {
        return '<tr data-pid="' + p.id + '"><td>' + UI.esc(p.name) + '</td><td class="r"><b>' + UI.num(p.stock) + '</b> ' + UI.esc(p.unit) + '</td>' +
          '<td><input type="number" step="any" min="0" class="min-in" value="' + p.min + '" placeholder="0"></td>' + statusCell(p) + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  window.Views = window.Views || {};
  window.Views.stock = {
    title: 'Stock Control', sub: 'Current stock levels and minimum stock',
    render: function (r) {
      root = r; paint();
      root.addEventListener('change', function (e) {
        if (!e.target.classList.contains('min-in')) return;
        var tr = e.target.closest('tr'), id = tr.getAttribute('data-pid');
        var p = Store.setMinStock(id, e.target.value);
        e.target.value = p.min;
        var old = tr.querySelector('[data-st]');
        old.outerHTML = statusCell(p);
        UI.toast('Minimum stock for ' + p.name + ' saved', 'ok');
      });
    },
    onStore: function () {
      if (!root) return;
      var a = document.activeElement;
      if (a && a.classList && a.classList.contains('min-in')) return; // don't steal focus while typing
      paint();
    }
  };
})();
