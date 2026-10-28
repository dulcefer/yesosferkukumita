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
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwR1NvkT3jeiaVFyUwp8-cZeWsqpxO8QEZGkcOp6skxXgkBP5sjqvKUzPS_CdjEL5EL5g/exec",

  // Hoja de cálculo del catálogo de Yesos (pública, se lee como CSV vía gviz).
  SHEET_ID: "1GbAmlu9nHVQipFDeOPK4EBrq-5dZrni9cs5tWJDPGvc",

  // Hoja de cálculo de Velas Kukúmita (botón "Etiquetas" y zonas "Mostrar más").
  // La Hoja 1 se lee como pestaña por defecto; la segunda pestaña se llama:
  SHEET_ID_ETIQUETAS: "1jin2wMYingvbPD2csGxIbm5AhulfRvCRvIzAKJTUNMw",
  SHEET_NOMBRE_ETIQUETAS: "Hoja 2",

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
