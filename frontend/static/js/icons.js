/**
 * Iconos de línea (estilo Lucide) definidos localmente para que AmPu funcione
 * sin conexión. Ningún nombre proviene del usuario: solo se usan claves fijas.
 */

const TRAZOS = {
  inicio: '<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.6V21h13V9.6"/><path d="M9.5 21v-6.2h5V21"/>',
  distribuciones:
    '<path d="M3 20h18"/><path d="M4.5 18.6c1.6 0 2.2-1.2 2.9-4.7C8.3 9.6 9.7 5.5 12 5.5s3.7 4.1 4.6 8.4c.8 3.5 1.3 4.7 2.9 4.7"/>',
  descriptiva:
    '<path d="M4 20V11M8.7 20V6M13.3 20v-6M18 20V8.5"/><path d="M3 20h18"/>',
  probabilidad:
    '<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="8.8" cy="8.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="8.8" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.8" cy="15.2" r="1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="15.2" r="1" fill="currentColor" stroke="none"/>',
  inferencia:
    '<path d="M9.2 3h5.6"/><path d="M10 3v6.4L5.1 18a2.1 2.1 0 0 0 1.8 3.2h10.2a2.1 2.1 0 0 0 1.8-3.2L14 9.4V3"/><path d="M7.5 15.4h9"/>',
  regresion:
    '<path d="M4 4v16h16"/><path d="M6.5 16.5l3.8-4.7 3 2 4.7-6.6"/><circle cx="10.3" cy="11.8" r="1.4"/><circle cx="14.1" cy="13.8" r="1.4"/>',
  muestreo:
    '<circle cx="6.5" cy="6.5" r="2"/><circle cx="17.5" cy="6.5" r="2"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M9 9l6 6M15 9l-6 6"/>',
  simulacion:
    '<path d="M12 3v3.6M12 17.4V21M3 12h3.6M17.4 12H21"/><path d="M5.8 5.8l2.5 2.5M15.7 15.7l2.5 2.5M18.2 5.8l-2.5 2.5M8.3 15.7l-2.5 2.5"/><circle cx="12" cy="12" r="2.1"/>',
  teoria:
    '<path d="M4 19.3A2.3 2.3 0 0 1 6.3 17H20"/><path d="M6.3 2H20v20H6.3A2.3 2.3 0 0 1 4 19.7V4.3A2.3 2.3 0 0 1 6.3 2z"/><path d="M8.5 6.5h7"/>',
  buscar:
    '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.7 15.7 4.1 4.1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  sol: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/>',
  luna: '<path d="M20.2 14.2A8.4 8.4 0 0 1 9.8 3.8 8.6 8.6 0 1 0 20.2 14.2z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  ajustes:
    '<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9v.02A1.7 1.7 0 0 0 20.92 10H21a2 2 0 1 1 0 4h-.1A1.7 1.7 0 0 0 19.4 15z"/>',
  ayuda:
    '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.8"/><path d="M12 17.4h.01"/>',
  teclado:
    '<rect x="2.5" y="5.5" width="19" height="13" rx="2.3"/><path d="M6 9h.01M9.3 9h.01M12.6 9h.01M15.9 9h.01M19.2 9h.01M6 12.3h.01M9.3 12.3h.01M12.6 12.3h.01M15.9 12.3h.01M19.2 12.3h.01M7.5 15.6h9"/>',
  copiar:
    '<rect x="9" y="9" width="11.5" height="11.5" rx="2.2"/><path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7"/>',
  descargar:
    '<path d="M12 3.5v11.5M8 11.5l4 4 4-4"/><path d="M4 18.5v1A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-1"/>',
  imprimir:
    '<path d="M6.5 9V3.5h11V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.8"/><path d="M6.5 14.5h11V21h-11z"/>',
  enlace:
    '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.2 1.2"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.2-1.2"/>',
  'flecha-derecha': '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  'flecha-izquierda': '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>',
  'flecha-arriba': '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  'flecha-abajo': '<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
  comprobar: '<path d="m4.5 12.5 4.5 4.5L19.5 6.5"/>',
  'circulo-check': '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.6 2.6L16.4 9"/>',
  'circulo-x': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  alerta: '<path d="M10.3 3.8 2.4 17.4A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3.1L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.2M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8h.01"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  basura:
    '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l.8 13h10.4L18 7"/><path d="M10 11v5.5M14 11v5.5"/>',
  actualizar:
    '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
  reproducir: '<path d="M8 5.5 18.5 12 8 18.5z"/>',
  tabla:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9 9.5V20"/>',
  funcion:
    '<path d="M15.5 4.5c-2.6 0-3.3 1.5-3.7 4.2L10 20"/><path d="M7 11h7.5"/><path d="M13.5 15.5c1.2 1.8 2 3.2 4 3.2"/>',
  calculadora:
    '<rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M8.5 7.5h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 19h.01M12 19h.01M15.5 19h.01"/>',
  archivo:
    '<path d="M6 2.8h7.2L19 8.6v12.6H6z"/><path d="M13 2.8V9h6"/>',
  carpeta:
    '<path d="M3 7.5A1.8 1.8 0 0 1 4.8 5.7h4l2 2.4h8.4A1.8 1.8 0 0 1 21 9.9v8.3a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18.2z"/>',
  grafico:
    '<path d="M4 4v16h16"/><path d="M6.5 16.5 10 11l3.2 2.4L19 6.5"/>',
  histograma:
    '<path d="M3 20h18"/><rect x="5" y="11" width="3" height="8" rx=".6"/><rect x="10.5" y="6" width="3" height="13" rx=".6"/><rect x="16" y="13" width="3" height="6" rx=".6"/>',
  caja:
    '<path d="M3 12h3M18 12h3"/><rect x="6" y="7.5" width="12" height="9" rx="1.3"/><path d="M12 7.5v9"/>',
  dispersion:
    '<path d="M4 4v16h16"/><circle cx="8" cy="15" r="1.2"/><circle cx="11" cy="12" r="1.2"/><circle cx="14" cy="13" r="1.2"/><circle cx="17" cy="7" r="1.2"/><circle cx="19" cy="10" r="1.2"/>',
  externo:
    '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5.5H4.5V6H10"/>',
  candado:
    '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  rayo: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  historial:
    '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V11H10"/><path d="M12 8v4.5l3 1.8"/>',
  objetivo:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/>',
  sigma: '<path d="M18 4H6l6 8-6 8h12"/>',
  pi: '<path d="M4 7h16M8.5 7v13M16 7v13M13 7v6"/>',
  porcentaje:
    '<path d="M19 5 5 19"/><circle cx="7.2" cy="7.2" r="2.4"/><circle cx="16.8" cy="16.8" r="2.4"/>',
  documento:
    '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 12.5h6M10 16h6"/>',
  escudo:
    '<path d="M12 3 4.5 6v6c0 4.2 3 7.3 7.5 9 4.5-1.7 7.5-4.8 7.5-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  chispa:
    '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9z"/>',
  punto: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  marca:
    '<path d="M7 4h10M7 20h10M8.5 4 20 20M20 4 8.5 20"/>',
};

export const NOMBRES_ICONOS = Object.keys(TRAZOS);

export function svgIcono(nombre, tamano = 18) {
  const trazo = TRAZOS[nombre] || TRAZOS.punto;
  return `<svg viewBox="0 0 24 24" width="${tamano}" height="${tamano}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazo}</svg>`;
}

export function icono(nombre, { tamano = 18, clase = "" } = {}) {
  const span = document.createElement("span");
  span.className = `icono-svg ${clase}`.trim();
  span.style.display = "inline-grid";
  span.style.placeItems = "center";
  span.innerHTML = svgIcono(nombre, tamano);
  return span;
}

export function hidratarIconos(raiz = document) {
  raiz.querySelectorAll("[data-icono]").forEach((nodo) => {
    if (nodo.dataset.hidratado === "true") return;
    const nombre = nodo.dataset.icono;
    const tamano = Number(nodo.dataset.tamano || 18);
    nodo.innerHTML = svgIcono(nombre, tamano);
    nodo.dataset.hidratado = "true";
    nodo.setAttribute("aria-hidden", "true");
    nodo.style.display = "inline-grid";
    nodo.style.placeItems = "center";
  });
}
