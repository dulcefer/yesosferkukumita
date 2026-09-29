/* ══════════════════════════════════════════════════════════════
 * YESOS FER KUKÚMITA — editor-imagen.js
 * Foto del producto → quita el fondo → la pone sobre el fondo rosa
 * con textos editables → imagen final de 1024×1024 lista para imgbb.
 * Se conecta con el formulario "Agregar producto" (app.js).
 * ══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var TAM = 1024;
    var FONDO_SRC = 'imagenes/fondo-rosa.webp';
    var LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.6.0/+esm';

    var F_TIT   = '700 #px Fredoka, "Baloo 2", sans-serif';
    var F_SERIF = '800 #px "Playfair Display", serif';
    var F_ORI   = 'italic 700 #px "Playfair Display", serif';

    var S = { fondo: null, foto: null, producto: null, tam: 100, x: 0, y: 0,
              tituloEditado: false, titulo: '', ocupado: false, timer: null };

    function $(id) { return document.getElementById(id); }
    function val(id) { var e = $(id); return e ? e.value.trim() : ''; }
    function numero(v) { return v !== '' && isFinite(Number(v)) ? Number(v) : null; }
    function dinero(n) { return '$' + n.toFixed(2) + ' MXN'; }

    function cargarImg(src) {
        return new Promise(function (ok, err) {
            var i = new Image();
            i.onload = function () { ok(i); };
            i.onerror = function () { err(new Error('No se pudo cargar la imagen')); };
            i.src = src;
        });
    }

    // Recorta los bordes transparentes para poder centrar y escalar bien la pieza
    function recortar(img) {
        var w = img.naturalWidth, h = img.naturalHeight;
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'); g.drawImage(img, 0, 0);
        var d = g.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] > 20) {
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
        }
        if (x1 <= x0 || y1 <= y0) return img;
        var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
        o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
        return o;
    }

    // Texto con contorno que se encoge solo si no cabe en maxW
    function texto(g, txt, x, y, tam, fam, relleno, borde, grosor, maxW) {
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        while (true) {
            g.font = fam.replace('#', tam);
            if (g.measureText(txt).width <= maxW || tam <= 14) break;
            tam -= 2;
        }
        if (borde) { g.lineWidth = grosor; g.strokeStyle = borde; g.strokeText(txt, x, y); }
        g.fillStyle = relleno; g.fillText(txt, x, y);
    }

    function dibujar() {
        var c = $('canvasImagenProducto'); if (!c) return;
        var g = c.getContext('2d');
        g.clearRect(0, 0, TAM, TAM);
        if (S.fondo) g.drawImage(S.fondo, 0, 0, TAM, TAM);
        else { g.fillStyle = '#d8788a'; g.fillRect(0, 0, TAM, TAM); }

        // Pieza
        var p = S.producto;
        if (p) {
            var w = p.naturalWidth || p.width, h = p.naturalHeight || p.height;
            var esc = Math.min(620 / w, 730 / h) * (S.tam / 100), dw = w * esc, dh = h * esc;
            g.save();
            g.shadowColor = 'rgba(60,20,40,.35)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
            g.drawImage(p, TAM / 2 + S.x - dw / 2, 590 + S.y - dh / 2, dw, dh);
            g.restore();
        }

        // Título
        var titulo = S.titulo;
        if (titulo) texto(g, titulo, TAM / 2, 86, 72, F_TIT, '#fff', '#111', 12, 940);

        var po = numero(val('inputPrecioOriginal')), pb = numero(val('inputPrecioBazar'));

        // Precio original (izquierda)
        if (po !== null) {
            g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 6;
            texto(g, 'Precio Original:', 156, 283, 42, F_ORI, '#fff', '#000', 3, 292);
            texto(g, dinero(po), 156, 331, 40, F_TIT, '#fff', '#000', 3, 292);
            g.restore();
        }

        // Precio de bazar (derecha)
        if (pb !== null) {
            var gr = g.createRadialGradient(876, 430, 20, 876, 430, 230);
            gr.addColorStop(0, 'rgba(15,140,135,.85)'); gr.addColorStop(1, 'rgba(15,140,135,0)');
            g.fillStyle = gr; g.fillRect(590, 190, 434, 500);
            texto(g, 'PRECIO DE', 876, 285, 54, F_TIT, '#fff36a', '#0b3a3a', 6, 262);
            texto(g, 'BAZAR', 876, 343, 54, F_TIT, '#fff36a', '#0b3a3a', 6, 262);
            texto(g, 'Solo', 876, 392, 44, F_SERIF, '#fff', '#000', 5, 262);
            texto(g, '$' + pb.toFixed(2), 876, 458, 90, F_TIT, '#fff36a', '#0b3a3a', 8, 262);
            texto(g, 'MXN', 876, 522, 42, F_SERIF, '#fff', '#000', 5, 262);
        }

        // Marca
        texto(g, 'Yesos Fer', 862, 930, 54, F_SERIF, '#111', '#fff', 8, 290);
        texto(g, 'Kukúmita', 862, 988, 66, F_SERIF, '#111', '#fff', 8, 290);
    }

    function exportar() {
        var c = $('canvasImagenProducto'); if (!c || !S.foto) return;
        var u = c.toDataURL('image/webp', 0.9);
        if (u.indexOf('data:image/webp') !== 0) u = c.toDataURL('image/jpeg', 0.9); // Safari viejo
        window._imagenProductoSeleccionada = u;
    }

    async function fuentes() {
        try {
            await Promise.all([
                document.fonts.load('700 60px Fredoka'),
                document.fonts.load('800 40px "Playfair Display"'),
                document.fonts.load('italic 700 30px "Playfair Display"')
            ]);
        } catch (e) {}
    }

    function redibujar() {
        clearTimeout(S.timer);
        S.timer = setTimeout(async function () { await fuentes(); dibujar(); exportar(); }, 60);
    }

    function estado(t, error) {
        var e = $('estadoEditorImagen');
        if (e) { e.textContent = t || ''; e.className = 'sap-estado' + (error ? ' error' : ''); }
    }

    // El título de la imagen solo cambia cuando se presiona Enter o el botón "Aplicar"
    function aplicarTitulo() {
        S.titulo = val('inputTituloImagen');
        redibujar();
    }

    function sincronizarTitulo() {
        var t = $('inputTituloImagen'); if (!t || S.tituloEditado) return;
        var n = val('inputNombreProducto');
        t.value = n ? '¡ ' + n + ' !' : '';
    }

    async function quitarFondo() {
        if (!S.foto || S.ocupado) return;
        S.ocupado = true;
        var btn = $('btnQuitarFondo'); if (btn) btn.disabled = true;
        estado('⏳ Quitando el fondo… la primera vez descarga el modelo y puede tardar un poco.');
        try {
            var mod = await import(LIB_URL);
            var fn = mod.removeBackground || mod.default;
            var blob = await (await fetch(S.foto)).blob();
            var res = await fn(blob, { progress: function (k, cur, tot) {
                if (tot) estado('⏳ Procesando… ' + Math.round(cur / tot * 100) + '%');
            } });
            var img = await cargarImg(URL.createObjectURL(res));
            S.producto = recortar(img);
            estado('✅ Fondo quitado. Ajusta tamaño y posición si hace falta.');
        } catch (e) {
            console.error('[editor-imagen]', e);
            estado('⚠️ No se pudo quitar el fondo. Se usa la foto tal cual; puedes reintentar.', true);
        } finally {
            S.ocupado = false;
            if (btn) btn.disabled = false;
            redibujar();
        }
    }

    async function cargarFoto(dataUrl) {
        S.foto = dataUrl; S.tam = 100; S.x = 0; S.y = 0;
        ['rangoTamImagen', 'rangoXImagen', 'rangoYImagen'].forEach(function (id, i) {
            var r = $(id); if (r) r.value = i === 0 ? 100 : 0;
        });
        var ed = $('editorImagenProducto'); if (ed) ed.style.display = 'block';
        var pv = $('previewImagenProducto'); if (pv) pv.style.display = 'none';
        sincronizarTitulo();
        S.titulo = val('inputTituloImagen');
        try { S.fondo = S.fondo || await cargarImg(FONDO_SRC); } catch (e) { S.fondo = null; }
        S.producto = await cargarImg(dataUrl);
        redibujar();
        quitarFondo(); // automático
    }

    function reset() {
        S.foto = null; S.producto = null; S.tituloEditado = false; S.titulo = ''; S.tam = 100; S.x = 0; S.y = 0;
        var ed = $('editorImagenProducto'); if (ed) ed.style.display = 'none';
        var t = $('inputTituloImagen'); if (t) t.value = '';
        estado('');
        window._imagenProductoSeleccionada = null;
    }

    // ── Conexión con el formulario ──
    ['inputPrecioOriginal', 'inputPrecioBazar'].forEach(function (id) {
        var e = $(id); if (e) e.addEventListener('input', redibujar);
    });
    var nom = $('inputNombreProducto');
    if (nom) {
        nom.addEventListener('input', sincronizarTitulo); // solo rellena el campo de título, no la imagen
        nom.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aplicarTitulo(); } });
    }
    var tit = $('inputTituloImagen');
    if (tit) {
        tit.addEventListener('input', function () { S.tituloEditado = tit.value.trim() !== ''; });
        tit.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aplicarTitulo(); } });
    }
    var ba = $('btnAplicarTitulo'); if (ba) ba.addEventListener('click', aplicarTitulo);
    [['rangoTamImagen', 'tam'], ['rangoXImagen', 'x'], ['rangoYImagen', 'y']].forEach(function (par) {
        var r = $(par[0]);
        if (r) r.addEventListener('input', function () { S[par[1]] = Number(r.value); redibujar(); });
    });
    var bq = $('btnQuitarFondo'); if (bq) bq.addEventListener('click', quitarFondo);

    window.editorImagenProducto = {
        cargarFoto: cargarFoto,
        reset: reset,
        ocupado: function () { return S.ocupado; },
        tituloPendiente: function () { return !!S.foto && val('inputTituloImagen') !== S.titulo; }
    };
})();
