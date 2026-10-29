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
    var FONDO_POLO_SRC = (typeof CONFIG !== 'undefined' && CONFIG.FONDO_AZUL_URL) || 'imagenes/fondo-azul.webp'; // misma pieza, fondo de Yesos Polo (vive en el repo de Polo)
    var LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.6.0/+esm';

    // ── Rendimiento ──
    // El modelo se ejecuta en un Web Worker (hilo aparte) para que la página no se congele.
    // La foto se reduce antes de procesarla: el modelo trabaja a 1024 px de todos modos y la pieza
    // en la imagen final ocupa como máximo ~730 px, así que una foto de 12 MP solo hacía más lento todo.
    var MAX_LADO_FOTO = 1280;
    // 'isnet_fp16' (por defecto, mejor recorte) | 'isnet_quint8' (~40 MB, más ligero y rápido, algo menos fino en los bordes)
    var MODELO = 'isnet_fp16';
    var CIERRE_WORKER_MS = 120000; // el worker (y su memoria) se libera tras 2 min sin usarse

    var CODIGO_WORKER = [
        "self.onmessage = async function (ev) {",
        "  var d = ev.data;",
        "  try {",
        "    var mod = await import(d.lib);",
        "    var fn = mod.removeBackground || mod.default;",
        "    var res = await fn(d.blob, {",
        "      model: d.modelo,",
        "      progress: function (k, cur, tot) { self.postMessage({ progreso: true, cur: cur, tot: tot }); }",
        "    });",
        "    self.postMessage({ ok: true, blob: res });",
        "  } catch (e) {",
        "    self.postMessage({ error: String((e && e.message) || e) });",
        "  }",
        "};"
    ].join('\n');

    var F_TIT   = '700 #px Fredoka, "Baloo 2", sans-serif';
    var F_LOGO  = '900 #px "Playfair Display", serif';

    var S = { fondo: null, fondoPolo: null, foto: null, tam: 100, x: 0, y: 0, tamTexto: 100,
              tituloEditado: false, titulo: '', ocupado: false, timer: null,
              worker: null, workerTimer: null, id: 0, repetir: false, sinFoto: false,
              // Cada versión (Fer / Polo) tiene su propia imagen de la pieza: foto de origen, resultado y si ya se le quitó el fondo.
              // v sube cada vez que cambia su foto (sirve para descartar resultados viejos).
              // completa = se muestra tal cual (sin fondo, título ni marca); agregada = vino de "Agregar imagen Fer/Polo".
              lado: { fer: { foto: null, producto: null, quitado: false, completa: false, agregada: false, v: 0 },
                      polo: { foto: null, producto: null, quitado: false, completa: false, agregada: false, v: 0 } } };
    var NOMBRE_LADO = { fer: 'Fer', polo: 'Polo' };

    function $(id) { return document.getElementById(id); }
    function val(id) { var e = $(id); return e ? e.value.trim() : ''; }

    function cargarImg(src) {
        return new Promise(function (ok, err) {
            var i = new Image();
            i.onload = function () { ok(i); };
            i.onerror = function () { err(new Error('No se pudo cargar la imagen')); };
            // Imágenes de otro dominio (fondo azul en el repo de Polo): sin esto el canvas queda "contaminado" y no se puede exportar
            if (/^https?:/i.test(src)) i.crossOrigin = 'anonymous';
            i.src = src;
        });
    }

    // Si una zona suelta mide menos de este % de la pieza principal, se considera "resto" (letras, marcas) y se borra.
    // Súbelo (ej. 0.08) si siguen quedando restos grandes; bájalo (ej. 0.01) si se borran partes reales de la pieza.
    var MIN_ZONA_PIEZA = 0.04;
    var UMBRAL_ALFA = 40;

    // Quita las motas sueltas (texto, marcas de agua) que el modelo dejó fuera de la pieza principal
    // y recorta los bordes transparentes para poder centrar y escalar bien la pieza.
    function recortar(img) {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'); g.drawImage(img, 0, 0);
        var im = g.getImageData(0, 0, w, h), d = im.data, n = w * h;

        // Etiquetado de zonas conectadas (8 vecinos) sobre los píxeles visibles
        var lab = new Int32Array(n), pila = new Int32Array(n), tam = [0], cur = 0;
        for (var i = 0; i < n; i++) {
            if (lab[i] || d[i * 4 + 3] <= UMBRAL_ALFA) continue;
            cur++; var sp = 0, cnt = 0; pila[sp++] = i; lab[i] = cur;
            while (sp) {
                var k = pila[--sp]; cnt++;
                var kx = k % w, ky = (k - kx) / w;
                for (var dy = -1; dy <= 1; dy++) {
                    var yy = ky + dy; if (yy < 0 || yy >= h) continue;
                    for (var dx = -1; dx <= 1; dx++) {
                        var xx = kx + dx; if (xx < 0 || xx >= w) continue;
                        var q = yy * w + xx;
                        if (!lab[q] && d[q * 4 + 3] > UMBRAL_ALFA) { lab[q] = cur; pila[sp++] = q; }
                    }
                }
            }
            tam[cur] = cnt;
        }
        if (!cur) return img;
        var max = 0; for (var z = 1; z <= cur; z++) if (tam[z] > max) max = tam[z];
        var minPx = max * MIN_ZONA_PIEZA;

        // Borra las zonas pequeñas y mide el recuadro de lo que se queda
        var x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var j = y * w + x, l = lab[j];
            if (!l) continue;
            if (tam[l] < minPx) { d[j * 4 + 3] = 0; continue; }
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 <= x0 || y1 <= y0) return img;
        g.putImageData(im, 0, 0);
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

    // Título arriba de la imagen. esc = escala respecto al lienzo de 1024 px; S.tamTexto (%) lo agranda o encoge.
    function pintarTitulo(g, esc) {
        var titulo = S.titulo; if (!titulo) return;
        var m = (S.tamTexto || 100) / 100;
        g.save(); g.scale(esc, esc);
        var lineas = titulo.split('\n');
        if (lineas.length === 1) {
            var t1 = 72 * m;
            texto(g, titulo, TAM / 2, 50 + t1 / 2, t1, F_TIT, '#fff', '#111', 12 * m, 940);
        } else {
            // 2 o 3 renglones: letra un poco más chica para que no choquen con la pieza
            var tamL = (lineas.length === 2 ? 64 : 54) * m, sepL = tamL * 1.08, y0 = 50 + tamL / 2;
            lineas.forEach(function (ln, i) {
                texto(g, ln, TAM / 2, y0 + i * sepL, tamL, F_TIT, '#fff', '#111', 12 * m, 940);
            });
        }
        g.restore();
    }

    // Una línea del logo: letra blanca con borde negro delgado. Con "flama", la ú se dibuja como "u"
    // y encima va una flamita en lugar del acento (como en el logo de Yesos Kukúmita).
    function renglonLogo(g, txt, x, base, tam, flama) {
        g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
        g.font = F_LOGO.replace('#', tam);
        var h = Math.max(2, tam * 0.06), u = null; // grosor del borde negro (la mitad queda afuera de la letra)
        if (flama) {
            var ini = g.measureText(flama.antes).width, wu = g.measureText('u').width, tot = g.measureText(txt).width;
            var asc = g.measureText('u').actualBoundingBoxAscent || tam * 0.52;
            u = { x: x - tot / 2 + ini + wu / 2, y: base - asc };
        }
        g.lineWidth = h; g.strokeStyle = '#000'; g.strokeText(txt, x, base);
        g.fillStyle = '#fff'; g.fillText(txt, x, base);
        if (u) {
            var fh = tam * 0.62, fw = fh * 0.52, bx = u.x, by = u.y - tam * 0.06;
            g.beginPath();
            g.moveTo(bx, by);
            g.bezierCurveTo(bx - fw * 0.55, by - fh * 0.25, bx - fw * 0.15, by - fh * 0.55, bx + fw * 0.12, by - fh);
            g.bezierCurveTo(bx + fw * 0.10, by - fh * 0.60, bx + fw * 0.60, by - fh * 0.35, bx, by);
            g.closePath();
            g.lineWidth = h; g.strokeStyle = '#000'; g.stroke();
            g.fillStyle = '#fff'; g.fill();
        }
    }

    // Logo en la esquina inferior derecha. W/H = tamaño real del lienzo; esc = escala respecto a 1024 px.
    // Fer dice "Yesos Fer Kukúmita" y Polo "Yesos Polo Kukúmita" (los dos con el mismo tamaño de letra).
    function pintarLogo(g, esc, W, H, quien) {
        g.save();
        g.translate(W - TAM * esc, H - TAM * esc); g.scale(esc, esc);
        var cx = 837, maxW = 330, t1 = 64;
        g.font = F_LOGO.replace('#', t1);
        while (g.measureText('Yesos Polo').width > maxW && t1 > 20) { t1 -= 2; g.font = F_LOGO.replace('#', t1); }
        renglonLogo(g, quien === 'polo' ? 'Yesos Polo' : 'Yesos Fer', cx, 934, t1, null);
        renglonLogo(g, 'Kukumita', cx, 1000, Math.round(t1 * 0.82), { antes: 'Kuk' });
        g.restore();
    }

    // Pinta la imagen completa (fondo + pieza + título + marca) en el contexto g, con el fondo indicado
    function pintar(g, fondo, colorRespaldo, L, quien) {
        var cv = g.canvas, prod = L && L.producto;

        // Imagen agregada con "Agregar imagen Fer/Polo": se muestra COMPLETA, tal como se subió.
        // El canvas toma la proporción de la imagen (máx. TAM px por lado, sin ampliarla), así no se recorta ni se estira.
        if (prod && L.completa) {
            var iw = prod.naturalWidth || prod.width, ih = prod.naturalHeight || prod.height;
            var kk = Math.min(1, TAM / Math.max(iw, ih));
            var cw = Math.max(1, Math.round(iw * kk)), ch = Math.max(1, Math.round(ih * kk));
            if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
            cv.classList.add('img-completa');
            g.clearRect(0, 0, cw, ch);
            g.drawImage(prod, 0, 0, cw, ch);
            pintarTitulo(g, cw / TAM); // el título (si hay) queda ARRIBA de la imagen
            pintarLogo(g, cw / TAM, cw, ch, quien);
            return;
        }
        cv.classList.remove('img-completa');
        if (cv.width !== TAM || cv.height !== TAM) { cv.width = TAM; cv.height = TAM; }

        g.clearRect(0, 0, TAM, TAM);
        if (fondo) g.drawImage(fondo, 0, 0, TAM, TAM);
        else { g.fillStyle = colorRespaldo; g.fillRect(0, 0, TAM, TAM); }

        // Sin primera foto y este lado todavía vacío: solo se muestra el fondo con un aviso (no se exporta)
        if (!prod && S.sinFoto) {
            texto(g, 'Sin imagen', TAM / 2, TAM / 2, 64, F_TIT, 'rgba(255,255,255,.85)', null, 0, 900);
            return;
        }

        // Pieza
        var p = prod;
        if (p) {
            var w = p.naturalWidth || p.width, h = p.naturalHeight || p.height;
            var esc = Math.min(620 / w, 730 / h) * (S.tam / 100), dw = w * esc, dh = h * esc;
            g.save();
            g.shadowColor = 'rgba(60,20,40,.35)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
            g.drawImage(p, TAM / 2 + S.x - dw / 2, 590 + S.y - dh / 2, dw, dh);
            g.restore();
        }

        // Título
        pintarTitulo(g, 1);

        // Logo (esquina inferior derecha)
        pintarLogo(g, 1, TAM, TAM, quien);
    }

    // Lo que se ve en pantalla (fondo rosa de Yesos Fer)
    function dibujar() {
        var c = $('canvasImagenProducto'); if (!c) return;
        pintar(c.getContext('2d'), S.fondo, '#d8788a', S.lado.fer, 'fer');
        // Vista previa de la versión de Yesos Polo (fondo azul), siempre al lado de la de Fer
        var cp = $('canvasImagenPoloProducto');
        if (cp) pintar(cp.getContext('2d'), S.fondoPolo, '#2f6a9a', S.lado.polo, 'polo');
    }

    // Imagen final de Fer (fondo rosa) como dataURL, tal como se ve en pantalla
    async function imagenFer() {
        var c = $('canvasImagenProducto'); if (!c || !S.lado.fer.producto) return '';
        await fuentes(); dibujar();
        var u = c.toDataURL('image/webp', 0.9);
        if (u.indexOf('data:image/webp') !== 0) u = c.toDataURL('image/jpeg', 0.9); // Safari viejo
        return u;
    }

    // Carga una imagen (del propio sitio o de otro dominio) de forma robusta:
    // 1) <img> con CORS y un parámetro extra, para no reutilizar una copia en caché guardada SIN permisos CORS
    //    (pasa cuando ese mismo archivo ya se cargó antes con un <img> normal);
    // 2) fetch → blob, que además dice el motivo real del fallo (HTTP 404, bloqueo, sin conexión…).
    async function cargarImgRobusta(src) {
        if (/^data:/i.test(src)) return cargarImg(src); // incrustada en el código: no hay descarga que pueda fallar
        try { return await cargarImg(src + (src.indexOf('?') < 0 ? '?' : '&') + 'cors=1'); } catch (e1) {}
        var r;
        try { r = await fetch(src, { cache: 'reload' }); }
        catch (e2) { throw new Error('no respondió (' + (e2 && e2.message ? e2.message : 'sin conexión o bloqueado') + ')'); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var ou = URL.createObjectURL(await r.blob());
        try { return await cargarImg(ou); }
        catch (e3) { throw new Error('el archivo llegó pero no se pudo abrir como imagen'); }
        finally { URL.revokeObjectURL(ou); }
    }

    // Carga el fondo azul probando varias direcciones (la primera es FONDO_AZUL_URL de config.js).
    // Si ninguna carga, guarda en S.motivoPolo qué se intentó. Devuelve true/false (nunca lanza error).
    async function cargarFondoPolo() {
        if (S.fondoPolo) return true;
        // 1º la copia del propio sitio (imagenes/fondo-azul.webp, igual que el fondo rosa: la más segura, sin permisos de otro dominio)
        // y después las direcciones del repo de Polo como respaldo.
        var lista = [window.FONDO_AZUL_DATA || '', 'imagenes/fondo-azul.webp', FONDO_POLO_SRC,
            'https://cdn.jsdelivr.net/gh/elpologr/yesospolokukumita@main/imagenes/fondo-azul.webp',
            'https://elpologr.github.io/yesospolokukumita/imagenes/fondo-azul.webp'
        ].filter(function (u, i, a) { return u && a.indexOf(u) === i; });
        var fallos = [];
        for (var k = 0; k < lista.length; k++) {
            try { S.fondoPolo = await cargarImgRobusta(lista[k]); S.motivoPolo = ''; return true; }
            catch (e) { fallos.push((/^data:/i.test(lista[k]) ? '(fondo incluido en el código)' : lista[k]) + ' → ' + (e && e.message ? e.message : 'falló')); console.warn('[fondo azul] no cargó:', /^data:/i.test(lista[k]) ? 'fondo incluido' : lista[k], e); }
        }
        S.motivoPolo = 'no se pudo cargar fondo-azul.webp. Resultado de cada dirección: ' + fallos.join(' | ') + '. Si dice HTTP 404 el archivo no está en esa ruta; si dice "no respondió", revisa tu conexión o extensiones que bloqueen github.';
        return false;
    }

    // Misma imagen con el fondo azul de Yesos Polo (se genera solo al guardar, fuera de pantalla)
    async function imagenPolo() {
        S.motivoPolo = '';
        if (!S.lado.polo.producto) { S.motivoPolo = 'no hay una imagen lista para Polo en el editor (elige una foto o usa "Agregar imagen Polo").'; return ''; }
        // Una imagen "completa" no usa el fondo azul, así que no lo necesita
        if (!S.lado.polo.completa && !(await cargarFondoPolo())) return ''; // sin el archivo del fondo azul no se puede generar la versión de Polo
        await fuentes();
        try {
            var c = document.createElement('canvas'); c.width = TAM; c.height = TAM;
            pintar(c.getContext('2d'), S.fondoPolo, '#2f6a9a', S.lado.polo, 'polo');
            var u = c.toDataURL('image/webp', 0.9);
            if (u.indexOf('data:image/webp') !== 0) u = c.toDataURL('image/jpeg', 0.9); // Safari viejo
            return u;
        } catch (e) {
            S.fondoPolo = null; // por si quedó una copia sin permiso de CORS
            S.motivoPolo = 'el navegador bloqueó exportar la imagen azul (' + (e && e.message ? e.message : 'CORS') + '). Recarga con Ctrl+F5 e inténtalo de nuevo.';
            return '';
        }
    }

    function exportar() {
        var c = $('canvasImagenProducto');
        if (!c || !S.lado.fer.producto) { window._imagenProductoSeleccionada = null; return; } // Fer aún sin imagen
        var u = c.toDataURL('image/webp', 0.9);
        if (u.indexOf('data:image/webp') !== 0) u = c.toDataURL('image/jpeg', 0.9); // Safari viejo
        window._imagenProductoSeleccionada = u;
    }

    async function fuentes() {
        try {
            await Promise.all([
                document.fonts.load('700 60px Fredoka'),
                document.fonts.load('900 40px "Playfair Display"')
            ]);
        } catch (e) {}
    }

    function redibujar() {
        clearTimeout(S.timer);
        S.timer = setTimeout(async function () {
            await fuentes(); dibujar(); exportar();
            // Avisa al formulario: si ya había enlaces de imgbb publicados, dejan de corresponder a esta imagen
            document.dispatchEvent(new CustomEvent('editorImagenCambio'));
        }, 60);
    }

    function estado(t, error) {
        var e = $('estadoEditorImagen');
        if (e) { e.textContent = t || ''; e.className = 'sap-estado' + (error ? ' error' : ''); }
    }


    // ══════════════════════════════════════════════════════════════
    // REFINADO DEL RECORTE (piezas blancas sostenidas con la mano)
    // El modelo recorta bien la forma, pero suele dejar dedos, hilos de colores y manchas.
    // Aquí se limpia usando el color: la pieza (yeso) es casi gris/blanca (saturación ~0.02-0.05)
    // y la piel, el hilo o los objetos de colores tienen mucha más saturación.
    // ══════════════════════════════════════════════════════════════
    var REFINAR_RECORTE = true;   // false = usar el recorte del modelo tal cual
    var SAT_MARGEN = 0.07;        // cuánto más saturado que la pieza debe ser un píxel para considerarlo "mano/color"
    var SAT_MIN = 0.10, SAT_MAX = 0.16; // límites del umbral de saturación
    var CROMA_MIN = 21;           // diferencia mínima (0-255) entre canales para contarlo como color (evita confundir sombras grises)
    var PIEZA_MAX_SAT = 0.10;     // si la pieza misma es más colorida que esto, NO se quita nada por color (piezas pintadas)
    var MIN_CONSERVAR = 0.40;     // si el refinado deja menos de este % del recorte original, se descarta (seguridad)

    // Ventana deslizante (cuadrada, separable): dilata o erosiona una máscara binaria con radio r
    function morfo(m, w, h, r, dilatar) {
        if (r < 1) return m;
        var tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
        var win = 2 * r + 1, fuera = dilatar ? 0 : 1; // al erosionar, fuera de la imagen cuenta como "lleno" (no se come los bordes)
        function pasada(src, dst, len, n, paso, salto) {
            var pre = new Int32Array(len + 1);
            for (var l = 0; l < n; l++) {
                var base = l * salto;
                for (var i = 0; i < len; i++) pre[i + 1] = pre[i] + src[base + i * paso];
                for (var j = 0; j < len; j++) {
                    var lo = Math.max(j - r, 0), hi = Math.min(j + r, len - 1);
                    var suma = pre[hi + 1] - pre[lo] + (win - (hi - lo + 1)) * fuera;
                    dst[base + j * paso] = dilatar ? (suma > 0 ? 1 : 0) : (suma === win ? 1 : 0);
                }
            }
        }
        pasada(m, tmp, w, h, 1, w);   // filas
        pasada(tmp, out, h, w, w, 1); // columnas
        return out;
    }

    // Etiqueta zonas conectadas (valor===v) con 8 vecinos (4 si ocho=false). Devuelve {lab, tam, n}
    function zonas(m, w, h, v, ocho) {
        var n = w * h, lab = new Int32Array(n), pila = new Int32Array(n), tam = [0], cur = 0;
        for (var i = 0; i < n; i++) {
            if (lab[i] || m[i] !== v) continue;
            cur++; var sp = 0, cnt = 0; pila[sp++] = i; lab[i] = cur;
            while (sp) {
                var k = pila[--sp]; cnt++;
                var kx = k % w, ky = (k - kx) / w;
                for (var dy = -1; dy <= 1; dy++) {
                    var yy = ky + dy; if (yy < 0 || yy >= h) continue;
                    for (var dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        if (!ocho && dx && dy) continue;
                        var xx = kx + dx; if (xx < 0 || xx >= w) continue;
                        var q = yy * w + xx;
                        if (!lab[q] && m[q] === v) { lab[q] = cur; pila[sp++] = q; }
                    }
                }
            }
            tam[cur] = cnt;
        }
        return { lab: lab, tam: tam, n: cur };
    }

    // Desenfoque de caja separable (2 pasadas ≈ gaussiano) sobre Float32Array
    function difuminar(a, w, h, r) {
        if (r < 1) return a;
        var tmp = new Float32Array(w * h), win = 2 * r + 1;
        function pasada(src, dst, len, n, paso, salto) {
            for (var l = 0; l < n; l++) {
                var base = l * salto, suma = 0, i;
                for (i = -r; i <= r; i++) suma += src[base + Math.min(Math.max(i, 0), len - 1) * paso];
                for (i = 0; i < len; i++) {
                    dst[base + i * paso] = suma / win;
                    suma += src[base + Math.min(i + r + 1, len - 1) * paso] - src[base + Math.max(i - r, 0) * paso];
                }
            }
        }
        for (var k = 0; k < 2; k++) {
            pasada(a, tmp, w, h, 1, w);
            pasada(tmp, a, h, w, w, 1);
        }
        return a;
    }

    // d = datos RGBA (Uint8ClampedArray) del recorte del modelo. Modifica SOLO el canal alfa.
    function refinarAlfa(d, w, h) {
        var n = w * h, side = Math.max(w, h), i;
        var bin0 = new Uint8Array(n), sat = new Float32Array(n), croma = new Uint8Array(n);
        var area0 = 0;
        for (i = 0; i < n; i++) {
            var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
            var mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
            sat[i] = mx ? (mx - mn) / mx : 0; croma[i] = mx - mn;
            if (d[i * 4 + 3] > 128) { bin0[i] = 1; area0++; }
        }
        if (area0 < 500) return false;

        // Saturación típica de la pieza: mediana en su zona central
        var nucleo = morfo(bin0, w, h, Math.round(side * 0.02), false), cnt = 0, hist = new Int32Array(1001);
        for (i = 0; i < n; i++) if (nucleo[i]) { hist[Math.min(1000, Math.round(sat[i] * 1000))]++; cnt++; }
        if (cnt < 500) { nucleo = bin0; cnt = area0; hist.fill(0); for (i = 0; i < n; i++) if (bin0[i]) hist[Math.min(1000, Math.round(sat[i] * 1000))]++; }
        var acum = 0, med = 0;
        for (var q = 0; q <= 1000; q++) { acum += hist[q]; if (acum >= cnt / 2) { med = q / 1000; break; } }

        var keep = bin0;
        if (med <= PIEZA_MAX_SAT) {
            // 1) fuera lo que tenga color marcado (mano, hilos…) + un margen para los píxeles mezclados del borde
            var T = Math.min(SAT_MAX, Math.max(SAT_MIN, med + SAT_MARGEN));
            var piel = new Uint8Array(n);
            for (i = 0; i < n; i++) if (bin0[i] && sat[i] > T && croma[i] >= CROMA_MIN) piel[i] = 1;
            piel = morfo(piel, w, h, Math.max(1, Math.round(side * 0.003)), true);
            var k1 = new Uint8Array(n), area1 = 0;
            for (i = 0; i < n; i++) if (bin0[i] && !piel[i]) { k1[i] = 1; area1++; }
            if (area1 >= area0 * MIN_CONSERVAR) keep = k1;
        }

        // 2) abrir: quita rebabas finas que quedaron pegadas (restos de dedos, sombras)
        var ro = Math.max(2, Math.round(side * 0.005));
        keep = morfo(morfo(keep, w, h, ro, false), w, h, ro, true);

        // 3) quedarse con la pieza principal (y zonas grandes)
        var z = zonas(keep, w, h, 1, true), max = 0, c;
        for (c = 1; c <= z.n; c++) if (z.tam[c] > max) max = z.tam[c];
        if (!max) return false;
        var minPx = max * MIN_ZONA_PIEZA, out = new Uint8Array(n), area = 0;
        for (i = 0; i < n; i++) if (keep[i] && z.tam[z.lab[i]] >= minPx) { out[i] = 1; area++; }

        // 4) rellenar huecos pequeños interiores (puntitos, poros)
        var hz = zonas(out, w, h, 0, false), toca = new Uint8Array(hz.n + 1);
        for (var x = 0; x < w; x++) { toca[hz.lab[x]] = 1; toca[hz.lab[(h - 1) * w + x]] = 1; }
        for (var y = 0; y < h; y++) { toca[hz.lab[y * w]] = 1; toca[hz.lab[y * w + w - 1]] = 1; }
        for (i = 0; i < n; i++) { var hl = hz.lab[i]; if (!out[i] && hl && !toca[hl] && hz.tam[hl] < area * 0.01) out[i] = 1; }

        // 5) borde limpio: 1 px menos (quita el halo del fondo) y suavizado
        out = morfo(out, w, h, 1, false);
        var al = new Float32Array(n);
        for (i = 0; i < n; i++) al[i] = out[i];
        al = difuminar(al, w, h, Math.max(1, Math.round(side * 0.0012)));
        for (i = 0; i < n; i++) {
            var v = (al[i] - 0.2) / 0.6; v = v < 0 ? 0 : (v > 1 ? 1 : v);
            d[i * 4 + 3] = Math.round(v * 255);
        }
        return true;
    }

    // Recibe la imagen que devolvió el modelo y devuelve un canvas con el recorte ya limpio
    function refinarRecorte(img) {
        if (!REFINAR_RECORTE) return img;
        try {
            var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
            var c = document.createElement('canvas'); c.width = w; c.height = h;
            var g = c.getContext('2d'); g.drawImage(img, 0, 0);
            var im = g.getImageData(0, 0, w, h);
            if (!refinarAlfa(im.data, w, h)) return img;
            g.putImageData(im, 0, 0);
            return c;
        } catch (e) {
            console.warn('[editor-imagen] no se pudo refinar el recorte, se usa el del modelo:', e);
            return img;
        }
    }

    // El título de la imagen solo cambia al presionar el botón "Aplicar" (o Ctrl+Enter)
    // Siempre envuelve el texto con "¡ ... !" (quita los signos que ya tenga para no duplicarlos).
    // Solo afecta al texto dentro de la imagen; el nombre del archivo en imgbb sale del nombre
    // del producto, sin estos signos.
    function envolverTitulo(t) {
        var lineas = String(t || '').split(/\r?\n/).map(function (l) {
            return l.replace(/[¡!]/g, ' ').replace(/\s+/g, ' ').trim();
        }).filter(Boolean).slice(0, 3); // máximo 3 renglones
        if (!lineas.length) return '';
        lineas[0] = '¡ ' + lineas[0];
        lineas[lineas.length - 1] += ' !';
        return lineas.join('\n');
    }

    function aplicarTitulo() {
        S.titulo = envolverTitulo(val('inputTituloImagen'));
        var t = $('inputTituloImagen'); if (t) t.value = S.titulo;
        redibujar();
    }

    function sincronizarTitulo() {
        var t = $('inputTituloImagen'); if (!t || S.tituloEditado) return;
        var n = val('inputNombreProducto');
        t.value = n; // sin signos: se agregan al aplicar
    }

    // Reduce la foto (si es más grande que MAX_LADO_FOTO) y la devuelve como Blob JPEG
    async function fotoLigera(dataUrl) {
        var img = await cargarImg(dataUrl);
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, MAX_LADO_FOTO / Math.max(w, h));
        if (k >= 1) return (await fetch(dataUrl)).blob();
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return new Promise(function (ok, err) {
            c.toBlob(function (b) { b ? ok(b) : err(new Error('No se pudo reducir la foto')); }, 'image/jpeg', 0.92);
        });
    }

    function cerrarWorker() {
        clearTimeout(S.workerTimer);
        if (S.worker) { S.worker.terminate(); S.worker = null; }
    }

    // Quita el fondo en un Web Worker: la página sigue fluida mientras trabaja el modelo
    function quitarFondoEnWorker(blob) {
        return new Promise(function (ok, err) {
            var w;
            try {
                if (!S.worker) {
                    var url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: 'text/javascript' }));
                    S.worker = new Worker(url, { type: 'module' });
                }
                w = S.worker;
            } catch (e) { return err(e); }
            clearTimeout(S.workerTimer);
            w.onmessage = function (ev) {
                var d = ev.data || {};
                if (d.progreso) { if (d.tot) estado('⏳ Procesando… ' + Math.round(d.cur / d.tot * 100) + '%'); return; }
                S.workerTimer = setTimeout(cerrarWorker, CIERRE_WORKER_MS);
                if (d.ok) ok(d.blob); else { cerrarWorker(); err(new Error(d.error || 'Error en el worker')); }
            };
            w.onerror = function (e) { cerrarWorker(); err(new Error((e && e.message) || 'Error en el worker')); };
            w.postMessage({ lib: LIB_URL, blob: blob, modelo: MODELO });
        });
    }

    // Plan B (navegadores sin soporte de module workers): en la página, pero con la foto ya reducida
    async function quitarFondoEnPagina(blob) {
        var mod = await import(LIB_URL);
        var fn = mod.removeBackground || mod.default;
        return fn(blob, { model: MODELO, progress: function (k, cur, tot) {
            if (tot) estado('⏳ Procesando… ' + Math.round(cur / tot * 100) + '%');
        } });
    }

    // Texto/visibilidad de los botones de cada lado según si su foto ya se recortó o sigue original
    function actualizarBotonesFondo() {
        ['fer', 'polo'].forEach(function (l) {
            var N = NOMBRE_LADO[l], q = S.lado[l].quitado;
            var b = $('btnQuitarFondo' + N), r = $('btnFotoOriginal' + N);
            if (b) b.textContent = (q ? '✂️ Volver a quitar fondo ' : '✂️ Quitar fondo ') + N;
            if (r) r.style.display = q ? '' : 'none';
        });
    }

    function botonesQuitar(deshabilitar) {
        ['Fer', 'Polo'].forEach(function (N) { var b = $('btnQuitarFondo' + N); if (b) b.disabled = deshabilitar; });
    }

    // Deja la foto de ese lado tal como se subió (sin recortar)
    async function usarFotoOriginal(l) {
        var L = S.lado[l]; if (!L.foto || S.ocupado) return;
        L.producto = await cargarImg(L.foto);
        L.quitado = false;
        L.completa = !!L.agregada; // una imagen agregada vuelve a verse completa; la foto base, sobre el fondo
        actualizarBotonesFondo();
        estado('Foto original para ' + NOMBRE_LADO[l] + '. Si quieres recortarla, presiona "✂️ Quitar fondo ' + NOMBRE_LADO[l] + '".');
        redibujar();
    }

    // Quita el fondo de la foto de UN lado ('fer' o 'polo')
    async function quitarFondo(l) {
        var L = S.lado[l]; if (!L) return;
        var N = NOMBRE_LADO[l];
        if (!L.foto) { estado('⚠️ Primero agrega una imagen para ' + N + '.', true); return; }
        if (S.ocupado) { S.repetir = l; estado('⏳ Esperando a que termine el proceso anterior…'); return; }
        S.repetir = false;

        // Si el otro lado usa la misma foto y ya la recortó, se reutiliza su resultado (no hay que procesar de nuevo)
        var otro = S.lado[l === 'fer' ? 'polo' : 'fer'];
        if (otro.quitado && otro.producto && otro.foto === L.foto) {
            L.producto = otro.producto; L.quitado = true; L.completa = false;
            actualizarBotonesFondo();
            estado('✅ Fondo quitado para ' + N + ' (se reutilizó el recorte de la otra imagen).');
            redibujar();
            return;
        }

        S.ocupado = true;
        var gen = S.id, ver = L.v; // si mientras trabaja se cambia esta foto, este resultado ya no sirve
        botonesQuitar(true);
        estado('⏳ Quitando el fondo (' + N + ')… la primera vez descarga el modelo y puede tardar un poco.');
        try {
            var blob = await fotoLigera(L.foto);
            var res;
            try {
                res = await quitarFondoEnWorker(blob);
            } catch (e1) {
                console.warn('[editor-imagen] el worker falló, se usa la página principal:', e1);
                res = await quitarFondoEnPagina(blob);
            }
            var img = await cargarImg(URL.createObjectURL(res));
            if (gen !== S.id || ver !== L.v) return; // se cambió la foto: se descarta
            L.producto = recortar(refinarRecorte(img));
            L.quitado = true; L.completa = false; // ya recortada, vuelve a ir sobre el fondo
            estado('✅ Fondo quitado (' + N + '). Ajusta tamaño y posición si hace falta.');
        } catch (e) {
            console.error('[editor-imagen]', e);
            if (gen === S.id && ver === L.v) estado('⚠️ No se pudo quitar el fondo (' + N + '). Se usa la foto tal cual; puedes reintentar.', true);
        } finally {
            S.ocupado = false;
            botonesQuitar(false);
            actualizarBotonesFondo();
            redibujar();
            if (S.repetir) { var pend = S.repetir; S.repetir = false; quitarFondo(pend); } // había otra petición esperando
        }
    }

    // Lee una imagen elegida desde el equipo. Conserva la transparencia (PNG/WebP ya recortados) y reduce las muy grandes.
    function leerArchivoImagen(archivo) {
        return new Promise(function (ok, err) {
            var lector = new FileReader();
            lector.onerror = function () { err(new Error('lectura')); };
            lector.onload = async function () {
                try {
                    var url = lector.result, img = await cargarImg(url);
                    var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1600 / Math.max(w, h));
                    if (k >= 1) return ok(url);
                    var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    ok(archivo.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'));
                } catch (e) { err(e); }
            };
            lector.readAsDataURL(archivo);
        });
    }

    // Abre el editor SIN foto base (para "Agregar imagen Fer/Polo" cuando aún no se eligió la primera imagen)
    async function abrirEditorSinFoto() {
        if (S.foto || S.sinFoto) return;
        S.sinFoto = true;
        S.id++; S.repetir = false;
        var ed = $('editorImagenProducto'); if (ed) ed.style.display = 'block';
        var pv = $('previewImagenProducto'); if (pv) pv.style.display = 'none';
        sincronizarTitulo();
        S.titulo = envolverTitulo(val('inputTituloImagen'));
        var tIni = $('inputTituloImagen'); if (tIni) tIni.value = S.titulo;
        try { S.fondo = S.fondo || await cargarImg(FONDO_SRC); } catch (e) { S.fondo = null; }
        await cargarFondoPolo();
    }

    // "Agregar imagen Fer/Polo": una imagen distinta solo para ese lado (la otra conserva la suya).
    // Funciona con o sin foto base, y la imagen se muestra COMPLETA (sin ponerla sobre el fondo rosa/azul).
    async function agregarImagen(l, archivo) {
        if (!archivo) return;
        var L = S.lado[l], N = NOMBRE_LADO[l];
        if (archivo.type && archivo.type.indexOf('image/') !== 0) { estado('⚠️ Ese archivo no es una imagen.', true); return; }
        var url;
        try { url = await leerArchivoImagen(archivo); }
        catch (e) { estado('⚠️ No se pudo leer esa imagen (' + N + ').', true); return; }
        var producto;
        try { producto = await cargarImg(url); }
        catch (e) { estado('⚠️ No se pudo abrir esa imagen (' + N + ').', true); return; }
        if (!S.foto && !S.sinFoto) await abrirEditorSinFoto();
        L.v++; L.foto = url; L.producto = producto; L.quitado = false; L.agregada = true; L.completa = true;
        actualizarBotonesFondo();
        estado('🖼️ Imagen agregada para ' + N + ' (se muestra completa, con el título arriba si lo aplicas y el logo abajo a la derecha). Si quieres usarla como pieza sobre el fondo, presiona "✂️ Quitar fondo ' + N + '".');
        redibujar();
        // Avisa al formulario (app.js): con Fer cuenta como imagen principal del producto
        document.dispatchEvent(new CustomEvent('editorImagenAgregada', { detail: { lado: l } }));
    }

    async function cargarFoto(dataUrl) {
        S.foto = dataUrl; S.sinFoto = false; S.tam = 100; S.x = 0; S.y = 0;
        S.id++; S.repetir = false; // si aún procesaba la foto anterior, su resultado se descarta
        S.tamTexto = 100; var rt = $('rangoTamTexto'); if (rt) rt.value = 100;
        ['rangoTamImagen', 'rangoXImagen', 'rangoYImagen'].forEach(function (id, i) {
            var r = $(id); if (r) r.value = i === 0 ? 100 : 0;
        });
        var ed = $('editorImagenProducto'); if (ed) ed.style.display = 'block';
        var pv = $('previewImagenProducto'); if (pv) pv.style.display = 'none';
        sincronizarTitulo();
        S.titulo = envolverTitulo(val('inputTituloImagen'));
        var tIni = $('inputTituloImagen'); if (tIni) tIni.value = S.titulo;
        try { S.fondo = S.fondo || await cargarImg(FONDO_SRC); } catch (e) { S.fondo = null; }
        await cargarFondoPolo();
        var img = await cargarImg(dataUrl);
        ['fer', 'polo'].forEach(function (l) {
            var L = S.lado[l]; L.v++; L.foto = dataUrl; L.producto = img; L.quitado = false; L.completa = false; L.agregada = false;
        });
        redibujar();
        actualizarBotonesFondo();
        // El fondo NO se quita solo: se hace con "Quitar fondo Fer" / "Quitar fondo Polo" (o se deja la foto como está)
        estado('📷 Foto lista. Escribe el título, o quita el fondo de la imagen de Fer y/o de Polo con los botones de abajo.');
    }

    function reset() {
        S.id++; S.repetir = false; S.foto = null; S.sinFoto = false; ['fer', 'polo'].forEach(function (l) { var L = S.lado[l]; L.v++; L.foto = null; L.producto = null; L.quitado = false; L.completa = false; L.agregada = false; }); S.tituloEditado = false; S.titulo = ''; S.tam = 100; S.x = 0; S.y = 0; S.tamTexto = 100;
        var rt = $('rangoTamTexto'); if (rt) rt.value = 100;
        var ed = $('editorImagenProducto'); if (ed) ed.style.display = 'none';
        var t = $('inputTituloImagen'); if (t) t.value = '';
        estado('');
        window._imagenProductoSeleccionada = null;
        document.dispatchEvent(new CustomEvent('editorImagenCambio'));
    }

    // ── Conexión con el formulario ──
    var nom = $('inputNombreProducto');
    if (nom) {
        nom.addEventListener('input', sincronizarTitulo); // solo rellena el campo de título, no la imagen
        nom.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aplicarTitulo(); } });
    }
    var tit = $('inputTituloImagen');
    if (tit) {
        tit.addEventListener('input', function () { S.tituloEditado = tit.value.trim() !== ''; });
        tit.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); aplicarTitulo(); return; }
            // Enter agrega un renglón nuevo, hasta 3 renglones
            if (tit.value.split('\n').length >= 3) e.preventDefault();
        });
    }
    var ba = $('btnAplicarTitulo'); if (ba) ba.addEventListener('click', aplicarTitulo);
    [['rangoTamImagen', 'tam'], ['rangoXImagen', 'x'], ['rangoYImagen', 'y'], ['rangoTamTexto', 'tamTexto']].forEach(function (par) {
        var r = $(par[0]);
        if (r) r.addEventListener('input', function () { S[par[1]] = Number(r.value); redibujar(); });
    });
    ['fer', 'polo'].forEach(function (l) {
        var N = NOMBRE_LADO[l];
        var bq = $('btnQuitarFondo' + N); if (bq) bq.addEventListener('click', function () { quitarFondo(l); });
        var bo = $('btnFotoOriginal' + N); if (bo) bo.addEventListener('click', function () { usarFotoOriginal(l); });
        var ba2 = $('btnAgregarImagen' + N), inp = $('inputAgregarImagen' + N);
        if (ba2 && inp) {
            ba2.addEventListener('click', function () { inp.click(); });
            inp.addEventListener('change', function () {
                var f = inp.files && inp.files[0]; inp.value = ''; // se limpia para poder elegir el mismo archivo otra vez
                agregarImagen(l, f);
            });
        }
    });

    // Ver en grande: al tocar la vista previa de Fer o de Polo se abre sobre la pantalla (sin salir del formulario)
    var visor = null;
    function cerrarVisor() { if (visor) visor.style.display = 'none'; }
    function abrirVisor(canvas, nombre) {
        if (!canvas || !(canvas.width > 0)) return;
        if (!visor) {
            var st = document.createElement('style');
            st.textContent =
                '#visorImagenEditor{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;padding:12px;cursor:zoom-out}' +
                '#visorImagenEditor img{max-width:96vw;max-height:84vh;object-fit:contain;border-radius:10px;background:repeating-conic-gradient(#e6e6e6 0% 25%,#fff 0% 50%) 50%/16px 16px;box-shadow:0 8px 40px rgba(0,0,0,.6)}' +
                '#visorImagenEditor .visor-txt{color:#fff;font:600 15px system-ui,sans-serif;text-align:center}' +
                '#visorImagenEditor .visor-x{position:absolute;top:10px;right:14px;width:42px;height:42px;border:none;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:24px;cursor:pointer}' +
                '#canvasImagenProducto,#canvasImagenPoloProducto{cursor:zoom-in}';
            document.head.appendChild(st);
            visor = document.createElement('div');
            visor.id = 'visorImagenEditor';
            visor.innerHTML = '<button type="button" class="visor-x" aria-label="Cerrar">✕</button><img alt=""><div class="visor-txt"></div>';
            visor.addEventListener('click', cerrarVisor);
            document.body.appendChild(visor);
            document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cerrarVisor(); });
        }
        var u = canvas.toDataURL('image/webp', 0.92);
        if (u.indexOf('data:image/webp') !== 0) u = canvas.toDataURL('image/png');
        visor.querySelector('img').src = u;
        visor.querySelector('.visor-txt').textContent = nombre + ' — toca para cerrar';
        visor.style.display = 'flex';
    }
    [['canvasImagenProducto', 'Yesos Fer'], ['canvasImagenPoloProducto', 'Yesos Polo']].forEach(function (par) {
        var cv = $(par[0]); if (!cv) return;
        cv.title = 'Toca para verla en grande';
        cv.addEventListener('click', function () { abrirVisor(cv, par[1]); });
    });

    // Descarga la imagen ya editada (PNG 1024×1024) sin necesidad de guardar el producto
    async function descargar() {
        var c = $('canvasImagenProducto'); if (!c) return;
        if (!S.lado.fer.producto) { estado('⚠️ Agrega primero la imagen de Fer para poder descargarla.', true); return; }
        await fuentes(); dibujar(); // asegura que lo descargado sea lo que se ve
        c.toBlob(function (b) {
            if (!b) { estado('⚠️ No se pudo generar la imagen para descargar.', true); return; }
            var nombre = val('inputNombreProducto').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'producto';
            var url = URL.createObjectURL(b), a = document.createElement('a');
            a.href = url; a.download = nombre + '.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        }, 'image/png');
    }
    var bd = $('btnDescargarImagen'); if (bd) bd.addEventListener('click', descargar);

    window.editorImagenProducto = {
        cargarFoto: cargarFoto,
        reset: reset,
        imagenPolo: imagenPolo,
        motivoPolo: function () { return S.motivoPolo || ''; },
        imagenFer: imagenFer,
        ocupado: function () { return S.ocupado; },
        // ¿Ese lado ('fer' o 'polo') ya tiene imagen lista?
        tieneImagen: function (l) { return !!(S.lado[l] && S.lado[l].producto); },
        tituloPendiente: function () {
            var hay = !!(S.lado.fer.producto || S.lado.polo.producto);
            return hay && envolverTitulo(val('inputTituloImagen')) !== S.titulo;
        }
    };
})();
