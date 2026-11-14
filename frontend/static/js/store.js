/**
 * Estado compartido de AmPu: preferencias, historial, caché de metadatos y
 * navegación. Persistencia local inmediata; el servidor guarda una copia.
 */

import { api } from "./api.js";
import { config } from "./ui.js";

const CLAVE_PREFS = "ampu.prefs.v1";
const CLAVE_HISTORIAL = "ampu.historial.v1";
const CLAVE_MODELOS = "ampu.modelos.v1";

export const PREFERENCIAS_POR_DEFECTO = {
  tema: "sistema",
  decimales: 4,
  notacion: "auto",
  densidad: "comoda",
  calculo_automatico: true,
  sidebar: true,
  reducir_movimiento: false,
};

function leerJson(clave, respaldo) {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return respaldo;
    const valor = JSON.parse(crudo);
    return valor ?? respaldo;
  } catch {
    return respaldo;
  }
}

function escribirJson(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

export const prefs = { ...PREFERENCIAS_POR_DEFECTO, ...leerJson(CLAVE_PREFS, {}) };
export let hayPrefsLocales = Boolean(leerJson(CLAVE_PREFS, null));

function sanearPrefs() {
  if (!["claro", "oscuro", "sistema"].includes(prefs.tema)) prefs.tema = PREFERENCIAS_POR_DEFECTO.tema;
  if (!["auto", "fija", "cientifica"].includes(prefs.notacion)) prefs.notacion = PREFERENCIAS_POR_DEFECTO.notacion;
  if (!["comoda", "compacta"].includes(prefs.densidad)) prefs.densidad = PREFERENCIAS_POR_DEFECTO.densidad;
  const decimales = Number(prefs.decimales);
  prefs.decimales = Number.isFinite(decimales) ? Math.min(10, Math.max(0, Math.round(decimales))) : PREFERENCIAS_POR_DEFECTO.decimales;
  prefs.calculo_automatico = prefs.calculo_automatico !== false;
  prefs.sidebar = prefs.sidebar !== false;
  prefs.reducir_movimiento = Boolean(prefs.reducir_movimiento);
}
sanearPrefs();

/* ------------------------------------------------------------------ */
/* Tema y preferencias                                                 */
/* ------------------------------------------------------------------ */

export function sistemaOscuro() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function temaResuelto(tema = prefs.tema) {
  if (tema === "sistema") return sistemaOscuro() ? "oscuro" : "claro";
  return tema;
}

let restaurarTransicionesTema = null;

export function aplicarPreferenciasVisuales() {
  const resuelto = temaResuelto();
  const raiz = document.documentElement;
  const cambiaTema = raiz.dataset.tema !== resuelto;
  if (cambiaTema) {
    // Evita interpolar fondos mientras la tinta ya pertenece al tema nuevo.
    if (restaurarTransicionesTema !== null) cancelAnimationFrame(restaurarTransicionesTema);
    raiz.dataset.cambiandoTema = "true";
  }
  raiz.dataset.tema = resuelto;
  raiz.dataset.densidad = prefs.densidad;
  if (cambiaTema) {
    // Resolver estilos antes de devolver las transiciones de hover/foco.
    raiz.getBoundingClientRect();
    restaurarTransicionesTema = requestAnimationFrame(() => {
      delete raiz.dataset.cambiandoTema;
      restaurarTransicionesTema = null;
    });
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resuelto === "oscuro" ? "#0a151d" : "#0d3b3a");
  Object.assign(config, {
    decimales: prefs.decimales,
    notacion: prefs.notacion,
    densidad: prefs.densidad,
    calculoAutomatico: prefs.calculo_automatico,
  });
}

let temporizadorServidor = null;

function sincronizarServidor() {
  clearTimeout(temporizadorServidor);
  temporizadorServidor = setTimeout(() => {
    api.post("/api/preferences", prefs).catch(() => {
      /* es una copia de seguridad: el almacenamiento local ya se actualizó */
    });
  }, 700);
}

export function guardarPrefs(cambios, { servidor = true, silencioso = true } = {}) {
  Object.assign(prefs, cambios);
  hayPrefsLocales = true;
  sanearPrefs();
  escribirJson(CLAVE_PREFS, prefs);
  aplicarPreferenciasVisuales();
  if (servidor) sincronizarServidor();
  window.dispatchEvent(new CustomEvent("ampu:prefs", { detail: { ...prefs } }));
  return prefs;
}

export function cicloTema() {
  const orden = ["claro", "oscuro", "sistema"];
  const siguiente = orden[(orden.indexOf(prefs.tema) + 1) % orden.length];
  guardarPrefs({ tema: siguiente });
  return siguiente;
}

export async function inicializarPreferencias() {
  if (!hayPrefsLocales) {
    try {
      const remotas = await api.get("/api/preferences");
      // La navegación puede usarse mientras llega la copia: no pisar cambios nuevos.
      if (!hayPrefsLocales && remotas && typeof remotas === "object") {
        Object.assign(prefs, remotas);
        sanearPrefs();
      }
    } catch {
      /* el servidor puede no estar disponible al arrancar; usamos los valores locales */
    }
  }
  aplicarPreferenciasVisuales();
  return prefs;
}

if (window.matchMedia) {
  const consulta = window.matchMedia("(prefers-color-scheme: dark)");
  const alCambiar = () => {
    if (prefs.tema === "sistema") aplicarPreferenciasVisuales();
  };
  if (consulta.addEventListener) consulta.addEventListener("change", alCambiar);
  else if (consulta.addListener) consulta.addListener(alCambiar);
}

/* ------------------------------------------------------------------ */
/* Metadatos del motor                                                 */
/* ------------------------------------------------------------------ */

export const meta = { datos: null, error: null };
let promesaMeta = null;

export function cargarMeta({ recargar = false } = {}) {
  if (meta.datos && !recargar) return Promise.resolve(meta.datos);
  if (promesaMeta && !recargar) return promesaMeta;
  promesaMeta = api
    .get("/api/meta")
    .then((datos) => {
      meta.datos = datos;
      meta.error = null;
      return datos;
    })
    .catch((error) => {
      meta.error = error;
      promesaMeta = null;
      throw error;
    });
  return promesaMeta;
}

export function distribucion(clave) {
  return meta.datos?.distribuciones?.find((d) => d.clave === clave) || null;
}

export function leccion(clave) {
  return meta.datos?.teoria?.find((l) => l.clave === clave) || null;
}

export const ejemplos = { datos: null };
let promesaEjemplos = null;

export function cargarEjemplos() {
  if (ejemplos.datos) return Promise.resolve(ejemplos.datos);
  if (promesaEjemplos) return promesaEjemplos;
  promesaEjemplos = api
    .get("/api/ejemplos")
    .then((datos) => {
      ejemplos.datos = datos;
      return datos;
    })
    .catch((error) => {
      promesaEjemplos = null;
      throw error;
    });
  return promesaEjemplos;
}

/* ------------------------------------------------------------------ */
/* Navegación                                                          */
/* ------------------------------------------------------------------ */

export function rutaActual() {
  const crudo = (location.hash || "#/inicio").replace(/^#\/?/, "");
  const [vistaCruda, ...resto] = crudo.split("/");
  const vista = vistaCruda || "inicio";
  let parametro = "";
  try {
    parametro = decodeURIComponent(resto.join("/"));
  } catch {
    parametro = resto.join("/");
  }
  return { vista, parametro, ruta: `${vista}${parametro ? `/${parametro}` : ""}` };
}

export function navegar(ruta, { reemplazar = false } = {}) {
  const limpia = String(ruta).replace(/^#?\/?/, "");
  const destino = `#/${limpia}`;
  if (location.hash === destino) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  if (reemplazar) {
    history.replaceState(null, "", destino);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = destino;
  }
}

export const transito = {
  simulacion: null,
  inferencia: null,
  vista: null,
};

/* ------------------------------------------------------------------ */
/* Historial de actividad                                              */
/* ------------------------------------------------------------------ */

export function historial() {
  const lista = leerJson(CLAVE_HISTORIAL, []);
  return Array.isArray(lista) ? lista : [];
}

export function registrarHistorial({ titulo, detalle = "", ruta, tipo = "calculo", icono = "historial" }) {
  if (!titulo || !ruta) return;
  const lista = historial();
  const primera = lista[0];
  if (primera && primera.ruta === ruta && primera.titulo === titulo && Date.now() - new Date(primera.fecha).getTime() < 20000) {
    return;
  }
  lista.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    titulo: String(titulo).slice(0, 120),
    detalle: String(detalle).slice(0, 160),
    ruta,
    tipo,
    icono,
    fecha: new Date().toISOString(),
  });
  escribirJson(CLAVE_HISTORIAL, lista.slice(0, 24));
}

export function limpiarHistorial() {
  escribirJson(CLAVE_HISTORIAL, []);
}

/* ------------------------------------------------------------------ */
/* Estado por modelo de distribución                                   */
/* ------------------------------------------------------------------ */

function leerModelos() {
  const datos = leerJson(CLAVE_MODELOS, {});
  return datos && typeof datos === "object" ? datos : {};
}

export function estadoModelo(clave) {
  const datos = leerModelos();
  return datos[clave] && typeof datos[clave] === "object" ? datos[clave] : null;
}

export function guardarEstadoModelo(clave, estado) {
  const datos = leerModelos();
  datos[clave] = estado;
  escribirJson(CLAVE_MODELOS, datos);
}

export function ultimoModelo() {
  const datos = leerModelos();
  if (datos.__ultimo && datos[datos.__ultimo]) return datos.__ultimo;
  return "normal";
}

export function recordarModelo(clave) {
  const datos = leerModelos();
  datos.__ultimo = clave;
  escribirJson(CLAVE_MODELOS, datos);
}

/* ------------------------------------------------------------------ */
/* Preferencias de exportación y utilidades                            */
/* ------------------------------------------------------------------ */

export function resumenPrecision() {
  return {
    decimales: prefs.decimales,
    notacion: prefs.notacion,
  };
}

export function nombreArchivo(base) {
  const limpio = String(base)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return limpio || "ampu";
}
