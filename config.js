// ══════════════════════════════════════════════════════════════
// Configuración de Yesos Fer Kukúmita.
// Aquí viven los valores que cambian según el entorno (links, IDs, correos).
// Si mueves la hoja, creas un nuevo despliegue del Apps Script o agregas un
// administrador, solo editas este archivo y subes el cambio.
// Se carga ANTES que app.js (ver index.html). Si lo editas, sube también el
// número de versión de <script src="config.js?v=..."> en index.html.
// ══════════════════════════════════════════════════════════════
const CONFIG = {
  // URL de despliegue del Apps Script (Code.gs): agregar / configurar / mover / eliminar productos.
  // Termina en /exec.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwrQsN8Br0EYD3SItH1O_61yWC7flbIA0_n3VtwdzzRnLM-mydr29Pg3U-Wk6a8AoS85A/exec",

  // Hoja de cálculo del catálogo de Yesos (pública, se lee como CSV vía gviz).
  SHEET_ID: "1GbAmlu9nHVQipFDeOPK4EBrq-5dZrni9cs5tWJDPGvc",

  // Hoja de cálculo de Velas Kukúmita (botón "Etiquetas" y zonas "Mostrar más").
  // La Hoja 1 se lee como pestaña por defecto; la segunda pestaña se llama:
  SHEET_ID_ETIQUETAS: "1jin2wMYingvbPD2csGxIbm5AhulfRvCRvIzAKJTUNMw",
  SHEET_NOMBRE_ETIQUETAS: "Hoja 2",

  // ── Pestañas del catálogo de Yesos (misma hoja de cálculo, SHEET_ID) ──
  // Cada pestaña "Hoja N" = una PÁGINA del catálogo (Hoja 2 → página 2, etc.).
  // La "Hoja 1" ya no aporta productos propios: la página 1 se arma sola con los
  // primeros 3 productos de las Hojas 2 a 10 (una fila de 3 por hoja) y, en la fila 10,
  // los primeros 3 productos de Velas Kukúmita.
  // Si renombras una pestaña, cambia aquí el prefijo/nombre; si reordenas, cambia el orden.
  HOJA_PREFIJO: "Hoja ",
  HOJAS_YESOS: [
    { num: 2,  titulo: "Figuras de $5" },
    { num: 3,  titulo: "Bases" },
    { num: 4,  titulo: "Figuras de $10" },
    { num: 5,  titulo: "Macetas" },
    { num: 6,  titulo: "Figuras de $15" },
    { num: 7,  titulo: "Figuras Religiosas" },
    { num: 8,  titulo: "Figuras de $20" },
    { num: 9,  titulo: "Alajeros" },
    { num: 10, titulo: "Figuras de $25" },
    { num: 11, titulo: "Figuras de $5 (pág. 2)" },
    { num: 12, titulo: "Figuras de $30" },
    { num: 13, titulo: "Figuras de $10 (pág. 2)" },
    { num: 14, titulo: "Figuras de $15 (pág. 2)" },
    { num: 15, titulo: "Bases (pág. 2)" },
    { num: 16, titulo: "Figuras de $20 (pág. 2)" },
    { num: 17, titulo: "Figuras de $25 (pág. 2)" },
  ],
  // Cuántas hojas (empezando por la 2) aportan sus primeros 3 productos a la página 1.
  // 9 → Hojas 2 a 10 (filas 1 a 9 de la página 1). La fila 10 es siempre Velas Kukúmita.
  PORTADA_HOJAS: 9,
  PORTADA_PRODUCTOS_POR_FILA: 3,

  // Botón al final de una página que lleva a su continuación: { página origen: página destino }.
  PAGINAS_VER_MAS: { 2: 11, 3: 15, 4: 13, 6: 14, 8: 16, 10: 17 },

  // Cloudflare Worker para compartir en redes sociales (imagen en Facebook, etc.).
  // Déjalo vacío ("") para desactivarlo.
  OG_WORKER_URL: "https://yesos-fer-kukumita-linker.dulceprincesa086.workers.dev",

  // Configuración web de Firebase. Estos valores no son secretos: la seguridad real
  // está en las reglas de Firebase, en los dominios autorizados y en la verificación
  // del idToken que hace el Apps Script.
  FIREBASE: {
    apiKey: "AIzaSyBF09xyHMIy0nZH4nnSKEoYHycUmVCJBdQ",
    authDomain: "yesosferkukumita-4a379.firebaseapp.com",
    projectId: "yesosferkukumita-4a379",
    storageBucket: "yesosferkukumita-4a379.firebasestorage.app",
    messagingSenderId: "667938933315",
    appId: "1:667938933315:web:ba47732f4a119c8b41e2f6",
    measurementId: "G-EX63CLDFSB",
  },

  // Correos con permiso de administrador (solo para MOSTRAR u ocultar los botones;
  // la verificación real la repite el servidor con CORREOS_ADMIN en Code.gs, así que
  // si agregas uno aquí, agrégalo también allá).
  CORREOS_ADMIN: [
    "dulceprincesa086@gmail.com",
    "dulcefernandaguzmanrodriguez@gmail.com",
    "celvaguzman72@gmail.com",
    "celvapreciosa27@gmail.com",
    "velaskuku@gmail.com",
    "yesosferkukumita@gmail.com",
  ],
};
