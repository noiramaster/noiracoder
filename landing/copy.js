/* NoiraCoder copy-buttons — mejora progresiva vanilla (sin dependencias):
 * Añade botón "Copiar" a cada bloque <pre> de comandos y a cada comando
 * de la tabla .cmds. Etiquetas vía noiraT('copy.*') con fallback EN,
 * se re-etiquetan al cambiar de idioma (evento 'noira-lang').
 * Copia con navigator.clipboard + fallback textarea (file://, HTTP).
 */
(function () {
  function T(key, fb) {
    try {
      if (typeof noiraT === 'function') {
        var lang = (typeof noiraGetLang === 'function') ? noiraGetLang() : 'en';
        return noiraT(key, lang);
      }
    } catch (e) {}
    return fb;
  }
  function labels() {
    return {
      btn: T('copy.btn', 'Copy'),
      ok: T('copy.copied', '✓ Copied'),
      toast: T('copy.toast', 'Copied to clipboard')
    };
  }
  var L = labels();

  function copyText(s, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(function () { done(true); }, function () { done(false); });
    } else {
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = s;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
      } catch (e) {}
      done(ok);
    }
  }

  var toast = null;
  function showToast() {
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'noira-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = L.toast;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  function flash(btn) {
    btn.textContent = L.ok;
    btn.classList.add('ok');
    clearTimeout(btn._t);
    btn._t = setTimeout(function () {
      btn.textContent = L.btn;
      btn.classList.remove('ok');
    }, 1800);
  }

  function enhance(el, text, mini) {
    if (el._noiraCopy) return;
    el._noiraCopy = true;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy-btn' + (mini ? ' mini' : '');
    b.textContent = L.btn;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      copyText(text, function () { flash(b); showToast(); });
    });
    if (mini) {
      el.appendChild(document.createTextNode(' '));
      el.appendChild(b);
    } else {
      var w = document.createElement('div');
      w.className = 'codewrap';
      el.parentNode.insertBefore(w, el);
      w.appendChild(el);
      w.appendChild(b);
    }
  }

  function relabel() {
    L = labels();
    var bs = document.querySelectorAll('.copy-btn');
    for (var i = 0; i < bs.length; i++) {
      if (!bs[i].classList.contains('ok')) bs[i].textContent = L.btn;
    }
  }

  function init() {
    var pres = document.querySelectorAll('pre');
    for (var i = 0; i < pres.length; i++) {
      var t = pres[i].innerText.replace(/\s+$/, '');
      if (t) enhance(pres[i], t, false);
    }
    var tds = document.querySelectorAll('table.cmds td:first-child');
    for (var j = 0; j < tds.length; j++) {
      if (tds[j].querySelector('.copy-btn')) continue;
      var c = tds[j].textContent.trim();
      if (c) enhance(tds[j], c, true);
    }
    document.addEventListener('noira-lang', relabel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
