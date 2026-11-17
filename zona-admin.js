// ══════════════════════════════════════════════════════════════
// YESOS POLO KUKÚMITA — Zona privada (solo administradores)
// Misma idea que la Mesa: botón en el perfil + pantalla completa.
// Se carga DESPUÉS de app.js (usa: auth, esCorreoAdmin, CONFIG.CORREOS_ADMIN).
// El botón y la pantalla solo existen para los correos de CONFIG.CORREOS_ADMIN
// (la misma lista que CORREOS_ADMIN en CodePolo.gs).
// Para poner contenido: ver zonaConstruirContenido() más abajo.
// ══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var TITULO = 'Zona';   // ← cambia el nombre aquí (y en el botón de index.html)
    var root = null, abierta = false;

    function esAdmin() {
        var u = (typeof auth !== 'undefined') ? auth.currentUser : null;
        return typeof esCorreoAdmin === 'function' && esCorreoAdmin(u);
    }

    // Contenido de la zona: aquí va lo que quieras mostrar. "cuerpo" es un <div> vacío.
    function zonaConstruirContenido(cuerpo) {
        cuerpo.innerHTML = '<p style="color:#a8a0b0;text-align:center;margin-top:40px;">Zona lista. Aquí va el contenido.</p>';
    }

    function estilos() {
        if (document.getElementById('estilosZonaAdmin')) return;
        var st = document.createElement('style');
        st.id = 'estilosZonaAdmin';
        st.textContent =
            '#pantallaZona,#pantallaZona *{box-sizing:border-box;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif}' +
            '#pantallaZona{display:none;position:fixed;inset:0;z-index:30000;flex-direction:column;color:#e8e2dc;' +
                'background:radial-gradient(ellipse at 50% 35%,#34343e 0%,#1b1b22 55%,#0d0d11 100%)}' +
            '#pantallaZona.abierta{display:flex}' +
            '#pantallaZona .zona-header{position:relative;flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:64px;padding:0 16px;background:rgba(0,0,0,.35);border-bottom:1px solid #2c2c35}' +
            '#pantallaZona .zona-header h3{margin:0;font-size:17px;font-weight:700;color:#f1ebe4}' +
            '#pantallaZona .zona-volver{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:40px;height:40px;border:none;border-radius:50%;background:transparent;color:#f1ebe4;cursor:pointer;font-size:30px;line-height:1;padding-bottom:4px}' +
            '#pantallaZona .zona-volver:hover{background:rgba(255,255,255,.1)}' +
            '#pantallaZona .zona-cuerpo{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px}';
        document.head.appendChild(st);
    }

    function construir() {
        if (root) return;
        estilos();
        root = document.createElement('div');
        root.id = 'pantallaZona';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', TITULO);
        root.innerHTML =
            '<div class="zona-header">' +
                '<button class="zona-volver" type="button" aria-label="Volver">‹</button>' +
                '<h3></h3>' +
            '</div>' +
            '<div class="zona-cuerpo" id="zonaCuerpo"></div>';
        root.querySelector('h3').textContent = TITULO;
        root.querySelector('.zona-volver').addEventListener('click', cerrar);
        document.body.appendChild(root);
        zonaConstruirContenido(document.getElementById('zonaCuerpo'));
        document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && abierta) cerrar(); });
    }

    function abrir() {
        if (!esAdmin()) return;
        construir();
        root.classList.add('abierta');
        document.body.style.overflow = 'hidden';
        abierta = true;
    }

    function cerrar() {
        if (!root || !abierta) return;
        root.classList.remove('abierta');
        abierta = false;
        var perfil = document.getElementById('pantallaPerfil');
        if (!(perfil && perfil.classList.contains('activo'))) document.body.style.overflow = '';
    }

    // Botón del perfil: solo se muestra a administradores; si se cierra la sesión, la zona se cierra
    function actualizarBoton() {
        var admin = esAdmin(), btn = document.getElementById('btnAbrirZona');
        if (btn) btn.style.display = admin ? 'flex' : 'none';
        if (!admin && abierta) cerrar();
    }

    (function enganchar() {
        if (typeof auth === 'undefined' || !auth.onAuthStateChanged || typeof esCorreoAdmin !== 'function') {
            setTimeout(enganchar, 300);
            return;
        }
        auth.onAuthStateChanged(actualizarBoton);
        actualizarBoton();
    })();

    window.abrirZona = abrir;
    window.cerrarZona = cerrar;
})();
