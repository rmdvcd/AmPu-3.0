/**
 * Evita el destello de tema al cargar: resuelve la preferencia antes del
 * primer pintado. Es un script clásico y bloqueante a propósito, y vive en
 * un archivo propio porque la política de seguridad de contenido (CSP) de
 * AmPu no permite scripts en línea.
 */
(function () {
  try {
    var guardado = JSON.parse(localStorage.getItem("ampu.prefs.v1") || "{}");
    var tema = guardado.tema || "sistema";
    var oscuro = tema === "oscuro" || (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", oscuro ? "#0a151d" : "#0d3b3a");
    if (guardado.densidad === "compacta") document.documentElement.dataset.densidad = "compacta";
    if (guardado.reducir_movimiento) document.documentElement.dataset.movimiento = "reducido";
  } catch (e) {
    /* preferencias corruptas: se usarán los valores por defecto */
  }
})();
