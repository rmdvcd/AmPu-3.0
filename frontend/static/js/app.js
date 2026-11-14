/**
 * Controlador de la aplicación: navegación por hash, barra lateral, tema,
 * paleta de comandos, ayuda y ciclo de vida de cada vista.
 */

import { el, toast, modal, boton, anunciar, renderMath, comportamientoScroll } from "./ui.js";
import { icono, hidratarIconos } from "./icons.js";
import { cancelarCalculos, hayCalculosEnCurso } from "./api.js";
import {
  cargarMeta,
  cicloTema,
  guardarPrefs,
  inicializarPreferencias,
  navegar,
  prefs,
  temaResuelto,
} from "./store.js";
import { NAV, ORDEN_VISTAS, VISTAS } from "./data.js";
import { accionAtajo } from "./atajos.js";

const MODULOS = {
  inicio: () => import("./views/inicio.js"),
  distribuciones: () => import("./views/distribuciones.js"),
  descriptiva: () => import("./views/descriptiva.js"),
  probabilidad: () => import("./views/probabilidad.js"),
  inferencia: () => import("./views/inferencia.js"),
  regresion: () => import("./views/regresion.js"),
  muestreo: () => import("./views/muestreo.js"),
  simulacion: () => import("./views/simulacion.js"),
  teoria: () => import("./views/teoria.js"),
  ajustes: () => import("./views/ajustes.js"),
};

const contenido = document.getElementById("contenido");
const aplicacion = document.getElementById("aplicacion");
const sidebar = document.getElementById("sidebar");
const velo = document.getElementById("velo-sidebar");
const botonSidebar = document.getElementById("alternar-sidebar");
const cerrarSidebar = document.getElementById("cerrar-sidebar");
const barraCarga = document.getElementById("barra-carga");
const migaActual = document.getElementById("miga-actual");
const iconoTema = document.getElementById("icono-tema");

let destruirVista = null;
let rutaRenderizada = "";
let tokenRuta = 0;
let indiceBusqueda = null;
let paletaAbierta = false;

/* ------------------------------------------------------------------ */
/* Utilidades de ruta                                                  */
/* ------------------------------------------------------------------ */

function parsearHash() {
  const crudo = String(location.hash || "").replace(/^#\/?/, "").trim();
  if (!crudo) return { vista: "inicio", parametro: null };
  const partes = crudo.split("/").filter(Boolean);
  return { vista: partes[0] || "inicio", parametro: partes.slice(1).join("/") || null };
}

function rutaDe(vista, parametro = null) {
  return `#/${vista}${parametro ? `/${parametro}` : ""}`;
}

function vistaValida(vista) {
  return Boolean(VISTAS[vista] && MODULOS[vista]);
}

/* ------------------------------------------------------------------ */
/* Tema, densidad y movimiento                                         */
/* ------------------------------------------------------------------ */

function pintarIconoTema() {
  if (!iconoTema) return;
  const resuelto = temaResuelto();
  const nombre = prefs.tema === "sistema" ? "monitor" : resuelto === "oscuro" ? "luna" : "sol";
  iconoTema.replaceChildren(icono(nombre, { tamano: 18 }));
  const boton = document.getElementById("alternar-tema");
  if (boton) {
    const etiqueta = prefs.tema === "sistema" ? `Tema del sistema (${resuelto})` : `Tema ${resuelto}`;
    boton.setAttribute("aria-label", `${etiqueta}. Cambiar tema.`);
    boton.title = `${etiqueta}. Clic para cambiar.`;
  }
}

function aplicarMovimiento() {
  const reducido = Boolean(prefs.reducir_movimiento) || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  document.documentElement.dataset.movimiento = reducido ? "reducido" : "normal";
}

const principal = document.querySelector(".principal");
const pantallaMovil = window.matchMedia("(max-width: 900px)");
let sidebarMovilAbierta = false;
let eraMovil = pantallaMovil.matches;

function aplicarSidebar({ enfocar = false, restaurarFoco = false } = {}) {
  const movil = pantallaMovil.matches;
  // Al cruzar el breakpoint, nunca heredar una superposición móvil abierta.
  if (movil !== eraMovil) sidebarMovilAbierta = false;
  eraMovil = movil;
  const abierta = movil ? sidebarMovilAbierta : prefs.sidebar !== false;
  const superpuesta = movil && abierta;
  const focoEnSidebar = sidebar.contains(document.activeElement);
  const focoEnDisparo = document.activeElement === botonSidebar;

  aplicacion.classList.toggle("sidebar-abierta", superpuesta);
  aplicacion.classList.toggle("sidebar-plegada", !movil && !abierta);
  document.documentElement.classList.toggle("menu-superpuesto", superpuesta);
  velo.hidden = !superpuesta;
  botonSidebar.hidden = abierta;
  botonSidebar.setAttribute("aria-expanded", String(abierta));

  // Liberar el fondo antes de devolverle el foco al cerrar.
  if (!superpuesta) {
    principal.inert = false;
    principal.removeAttribute("aria-hidden");
  }
  if (abierta) {
    sidebar.inert = false;
    sidebar.removeAttribute("aria-hidden");
    if (enfocar || focoEnDisparo) {
      (sidebar.querySelector('[aria-current="page"]') || cerrarSidebar).focus({ preventScroll: true });
    }
  } else {
    if (focoEnSidebar || restaurarFoco) botonSidebar.focus({ preventScroll: true });
    sidebar.inert = true;
    sidebar.setAttribute("aria-hidden", "true");
  }
  if (superpuesta) {
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    principal.inert = true;
    principal.setAttribute("aria-hidden", "true");
  } else {
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
  }
}

function fijarSidebar(abierta) {
  if (pantallaMovil.matches) {
    sidebarMovilAbierta = abierta;
    aplicarSidebar({ enfocar: abierta, restaurarFoco: !abierta });
  } else {
    guardarPrefs({ sidebar: abierta });
    aplicarSidebar({ enfocar: abierta, restaurarFoco: !abierta });
  }
}

function cerrarSidebarMovil() {
  if (sidebarMovilAbierta) fijarSidebar(false);
}

function contenerFocoSidebar(evento) {
  if (evento.key !== "Tab" || evento.ctrlKey || evento.altKey || evento.metaKey) return;
  const enfocables = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')]
    .filter((nodo) => nodo.tabIndex >= 0 && nodo.getClientRects().length);
  const primero = enfocables[0];
  const ultimo = enfocables.at(-1);
  const activo = document.activeElement;
  if (!primero || (evento.shiftKey && (activo === primero || activo === sidebar)) ||
      (!evento.shiftKey && (activo === ultimo || activo === sidebar))) {
    evento.preventDefault();
    (evento.shiftKey ? ultimo : primero)?.focus();
  }
}

/* ------------------------------------------------------------------ */
/* Navegación                                                          */
/* ------------------------------------------------------------------ */

function construirNav() {
  const nav = document.getElementById("nav-principal");
  if (!nav) return;
  nav.replaceChildren();
  for (const grupo of NAV) {
    const bloque = el("div", { class: "nav-grupo" }, el("p", { class: "nav-grupo__titulo" }, grupo.grupo));
    for (const clave of grupo.items) {
      const vista = VISTAS[clave];
      if (!vista) continue;
      bloque.append(
        el(
          "a",
          {
            class: "nav-enlace",
            href: rutaDe(clave),
            "data-vista": clave,
            title: vista.descripcion,
          },
          el("span", { class: "nav-enlace__icono" }, icono(vista.icono, { tamano: 18 })),
          el("span", { class: "nav-enlace__texto" }, vista.titulo)
        )
      );
    }
    nav.append(bloque);
  }
  sidebar.addEventListener("click", (evento) => {
    if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey) return;
    if (evento.target.closest('a[href^="#/"]')) cerrarSidebarMovil();
  });
}

function marcarNav(vista) {
  for (const enlace of document.querySelectorAll("#nav-principal [data-vista]")) {
    const activa = enlace.dataset.vista === vista;
    if (activa) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  }
}

function actualizarMigas(vista) {
  const metaVista = VISTAS[vista];
  if (migaActual) migaActual.textContent = metaVista?.titulo || "Inicio";
  document.title = `${metaVista?.titulo || "AmPu"} · AmPu 3.2`;
}

function esqueletoVista() {
  return el(
    "div",
    { class: "esqueleto-vista", "aria-hidden": "true" },
    el("div", { class: "esqueleto esqueleto--titulo" }),
    el("div", { class: "esqueleto esqueleto--texto" }),
    el(
      "div",
      { class: "rejilla rejilla--2" },
      el("div", { class: "esqueleto esqueleto--panel" }),
      el("div", { class: "esqueleto esqueleto--panel" })
    )
  );
}

function mostrarCarga(activa) {
  if (!barraCarga) return;
  barraCarga.dataset.activa = String(activa);
  barraCarga.setAttribute("aria-hidden", String(!activa));
}

function panelError(error, vista) {
  return el(
    "div",
    { class: "vista" },
    el(
      "div",
      { class: "panel" },
      el(
        "div",
        { class: "panel__cuerpo" },
        el(
          "div",
          { class: "estado-vacio" },
          el("span", { class: "estado-vacio__icono" }, icono("alerta", { tamano: 26 })),
          el("h2", { class: "estado-vacio__titulo" }, "No se pudo abrir esta sección"),
          el("p", { class: "estado-vacio__texto" }, error?.message || "Error inesperado al cargar la vista."),
          el(
            "div",
            { class: "fila", style: { justifyContent: "center" } },
            boton("Reintentar", { icono: "actualizar", onClick: () => renderRuta(true) }),
            boton("Volver al inicio", { variante: "secundario", icono: "inicio", onClick: () => navegar("inicio") })
          )
        )
      )
    )
  );
}

async function renderRuta(forzar = false) {
  cerrarSidebarMovil();
  let { vista, parametro } = parsearHash();
  if (!vistaValida(vista)) {
    history.replaceState(null, "", "#/inicio");
    vista = "inicio";
    parametro = null;
  }
  const firma = `${vista}/${parametro || ""}`;
  if (!forzar && firma === rutaRenderizada) return;
  rutaRenderizada = firma;
  const miToken = ++tokenRuta;

  if (typeof destruirVista === "function") {
    try {
      destruirVista();
    } catch {
      /* una vista no debe bloquear la navegación */
    }
    destruirVista = null;
  }

  marcarNav(vista);
  actualizarMigas(vista);
  mostrarCarga(true);
  contenido.replaceChildren(esqueletoVista());
  window.scrollTo({ top: 0, behavior: comportamientoScroll() });

  try {
    const modulo = await MODULOS[vista]();
    if (miToken !== tokenRuta) return;
    contenido.replaceChildren();
    const host = el("div", { class: "vista-host" });
    contenido.append(host);
    const resultado = await modulo.montar(host, parametro);
    if (miToken !== tokenRuta) {
      if (typeof resultado === "function") resultado();
      return;
    }
    if (typeof resultado === "function") destruirVista = resultado;
    renderMath(contenido);
    const titulo = contenido.querySelector("h1");
    if (titulo) {
      titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
    } else {
      contenido.focus({ preventScroll: true });
    }
    anunciar(`${VISTAS[vista]?.titulo || vista} cargado.`);
  } catch (error) {
    if (miToken !== tokenRuta) return;
    console.error("Error al montar la vista", vista, error);
    contenido.replaceChildren(panelError(error, vista));
    toast("No se pudo cargar la sección", { tipo: "error" });
  } finally {
    if (miToken === tokenRuta) mostrarCarga(false);
  }
}

/* ------------------------------------------------------------------ */
/* Paleta de comandos                                                  */
/* ------------------------------------------------------------------ */

function normalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function construirIndice() {
  const items = [];
  for (const clave of ORDEN_VISTAS) {
    const vista = VISTAS[clave];
    if (!vista) continue;
    items.push({ tipo: "Sección", titulo: vista.titulo, descripcion: vista.descripcion, ruta: clave, icono: vista.icono, palabras: vista.palabras });
  }
  let metaDatos = null;
  try {
    metaDatos = await cargarMeta();
  } catch {
    return items;
  }
  for (const d of metaDatos.distribuciones || []) {
    items.push({
      tipo: "Distribución",
      titulo: d.nombre,
      descripcion: `${d.discreta ? "Discreta" : "Continua"}${d.dimensionalidad && d.dimensionalidad !== "univariante" ? " · multivariante" : ""}`,
      ruta: `distribuciones/${d.clave}`,
      icono: "distribuciones",
      palabras: `${d.clave} ${d.nombre} ${d.categoria} distribucion modelo`,
    });
  }
  for (const t of metaDatos.teoria || []) {
    items.push({
      tipo: "Lección",
      titulo: t.titulo,
      descripcion: `${t.minutos} min · teoría`,
      ruta: `teoria/${t.clave}`,
      icono: "teoria",
      palabras: `teoria leccion ${t.clave} ${t.titulo}`,
    });
  }
  for (const p of metaDatos.probabilidad || []) {
    items.push({ tipo: "Probabilidad", titulo: p.nombre, descripcion: p.descripcion, ruta: `probabilidad/${p.clave}`, icono: "probabilidad", palabras: `probabilidad ${p.clave} ${p.nombre}` });
  }
  for (const p of metaDatos.pruebas || []) {
    items.push({ tipo: "Prueba", titulo: p.nombre, descripcion: p.descripcion, ruta: `inferencia/${p.clave}`, icono: "inferencia", palabras: `inferencia prueba ${p.clave} ${p.nombre} ${p.grupo}` });
  }
  for (const m of metaDatos.muestreo || []) {
    items.push({ tipo: "Muestreo", titulo: m.nombre, descripcion: m.descripcion, ruta: `muestreo/${m.clave}`, icono: "muestreo", palabras: `muestreo diseno ${m.clave} ${m.nombre}` });
  }
  for (const s of metaDatos.simulacion || []) {
    items.push({ tipo: "Simulación", titulo: s.nombre, descripcion: s.descripcion, ruta: `simulacion/${s.clave}`, icono: "simulacion", palabras: `simulacion monte carlo ${s.clave} ${s.nombre}` });
  }
  items.push(
    { tipo: "Acción", titulo: "Cambiar tema", descripcion: "Claro, oscuro o sistema", accion: "tema", icono: "sol", palabras: "tema oscuro claro apariencia" },
    { tipo: "Acción", titulo: "Ver atajos y ayuda", descripcion: "Cómo funciona AmPu", accion: "ayuda", icono: "ayuda", palabras: "ayuda atajos teclado" }
  );
  return items;
}

async function abrirPaleta() {
  if (paletaAbierta || document.querySelector("#raiz-modal dialog[open]")) return;
  cerrarSidebarMovil();
  paletaAbierta = true;
  const entrada = el("input", {
    type: "search",
    class: "paleta-entrada",
    placeholder: "Busca una herramienta, distribución o lección…",
    "aria-label": "Buscar en AmPu",
    autocomplete: "off",
    spellcheck: "false",
  });
  const lista = el("div", { class: "paleta-lista", role: "listbox", "aria-label": "Resultados" });
  const ayuda = el("p", { class: "paleta-pie" }, el("kbd", {}, "↑"), el("kbd", {}, "↓"), " para moverte · ", el("kbd", {}, "Enter"), " para abrir · ", el("kbd", {}, "Esc"), " para cerrar");
  const dialogo = modal({
    titulo: "Buscar en AmPu",
    subtitulo: "Herramientas, distribuciones, pruebas y lecciones. También acciones rápidas.",
    contenido: el(
      "div",
      { class: "paleta" },
      el("div", { class: "paleta-buscador" }, el("div", { class: "paleta-buscador__campo" }, icono("buscar", { tamano: 17 }), entrada)),
      lista,
      ayuda
    ),
    ancho: true,
    posicionArriba: true,
    alCerrar: () => {
      paletaAbierta = false;
    },
  });

  lista.append(el("div", { class: "paleta-grupo" }, "Cargando índice…"));
  const indice = indiceBusqueda || (indiceBusqueda = await construirIndice());
  if (!paletaAbierta) return;
  let visibles = [];
  let activo = 0;

  function pintar() {
    const consulta = normalizar(entrada.value.trim());
    visibles = indice
      .map((item) => {
        if (!consulta) return { item, puntos: 0 };
        const titulo = normalizar(item.titulo);
        const tipo = normalizar(item.tipo);
        const resto = normalizar(`${item.descripcion} ${item.palabras || ""}`);
        let puntos = 0;
        if (titulo === consulta) puntos += 100;
        else if (titulo.startsWith(consulta)) puntos += 60;
        else if (titulo.includes(consulta)) puntos += 40;
        if (tipo.includes(consulta)) puntos += 12;
        if (resto.includes(consulta)) puntos += 8;
        const peso = { "Sección": 5, "Distribución": 4, "Prueba": 4, "Probabilidad": 4, "Muestreo": 4, "Simulación": 4, "Lección": 2, "Acción": 6 }[item.tipo] || 0;
        if (puntos > 0) puntos += peso;
        return { item, puntos };
      })
      .filter((x) => x.puntos > 0 || !consulta)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 40)
      .map((x) => x.item);
    activo = Math.min(activo, Math.max(0, visibles.length - 1));
    lista.replaceChildren();
    if (!visibles.length) {
      lista.append(el("div", { class: "paleta-grupo" }, "Sin resultados. Prueba con «normal», «bayes» o «regresión»."));
      return;
    }
    visibles.forEach((item, i) => {
      lista.append(
        el(
          "button",
          {
            type: "button",
            class: "paleta-item",
            role: "option",
            "aria-selected": String(i === activo),
            onMouseEnter: () => {
              activo = i;
              marcarActivo();
            },
            onClick: () => ejecutar(item),
          },
          el("span", { class: "paleta-item__icono" }, icono(item.icono || "buscar", { tamano: 16 })),
          el(
            "span",
            { class: "paleta-item__cuerpo" },
            el("span", { class: "paleta-item__titulo" }, item.titulo),
            item.descripcion ? el("span", { class: "paleta-item__meta" }, item.descripcion) : null
          ),
          el("span", { class: "paleta-item__tecla" }, item.tipo)
        )
      );
    });
    marcarActivo();
  }

  function marcarActivo() {
    [...lista.children].forEach((nodo, i) => {
      nodo.removeAttribute("id");
      nodo.setAttribute("aria-selected", String(i === activo));
      if (i === activo) nodo.id = "paleta-opcion-activa";
    });
    const actual = lista.children[activo];
    if (actual) {
      entrada.setAttribute("aria-activedescendant", actual.id || "");
      actual.scrollIntoView({ block: "nearest" });
    }
  }

  function ejecutar(item) {
    if (!item) return;
    dialogo.cerrar();
    if (item.accion === "tema") {
      cicloTema();
      pintarIconoTema();
      toast("Tema cambiado", { tipo: "ok", duracion: 1800 });
      return;
    }
    if (item.accion === "ayuda") {
      abrirAyuda();
      return;
    }
    navegar(item.ruta);
  }

  entrada.addEventListener("input", () => {
    activo = 0;
    pintar();
  });
  entrada.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      activo = Math.min(activo + 1, visibles.length - 1);
      marcarActivo();
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      activo = Math.max(0, activo - 1);
      marcarActivo();
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      ejecutar(visibles[activo]);
    }
  });
  pintar();
}

/* ------------------------------------------------------------------ */
/* Ayuda                                                               */
/* ------------------------------------------------------------------ */

async function abrirAyuda() {
  if (document.querySelector("dialog[open]")) return;
  cerrarSidebarMovil();
  try {
    const { abrirAyuda: mostrarAyuda } = await import("./ayuda.js");
    mostrarAyuda();
  } catch (error) {
    console.error("No se pudo abrir la ayuda", error);
    toast("No se pudo abrir la ayuda. Inténtalo de nuevo.", { tipo: "error" });
  }
}

/* ------------------------------------------------------------------ */
/* Eventos globales                                                    */
/* ------------------------------------------------------------------ */

function conectarEventos() {
  botonSidebar.addEventListener("click", () => fijarSidebar(true));
  cerrarSidebar.addEventListener("click", () => fijarSidebar(false));
  velo.addEventListener("click", cerrarSidebarMovil);

  document.getElementById("alternar-tema")?.addEventListener("click", () => {
    const siguiente = cicloTema();
    pintarIconoTema();
    anunciar(`Tema ${siguiente === "sistema" ? "del sistema" : siguiente}.`);
  });

  document.getElementById("abrir-buscador")?.addEventListener("click", abrirPaleta);

  document.getElementById("boton-ayuda")?.addEventListener("click", abrirAyuda);
  window.addEventListener("ampu:ayuda", abrirAyuda);

  document.addEventListener("keydown", (evento) => {
    const objetivo = evento.target;
    const dialogoAbierto = Boolean(document.querySelector("dialog[open]"));
    if (!dialogoAbierto && !evento.defaultPrevented && !evento.isComposing && !evento.repeat) {
      if (sidebarMovilAbierta) contenerFocoSidebar(evento);
      if (evento.key === "Escape" && !evento.ctrlKey && !evento.metaKey && !evento.altKey && !evento.shiftKey &&
          (sidebarMovilAbierta || sidebar.contains(objetivo))) {
        evento.preventDefault();
        fijarSidebar(false);
        return;
      }
    }
    const escribiendo = objetivo instanceof HTMLElement && (objetivo.matches("input, textarea, select") || objetivo.isContentEditable || Boolean(objetivo.closest('[role="textbox"]')));
    const accion = accionAtajo(evento, {
      escribiendo,
      dialogoAbierto: dialogoAbierto || sidebarMovilAbierta,
    });

    if (accion === "buscar") {
      evento.preventDefault();
      abrirPaleta();
    } else if (accion === "calcular") {
      const disponibles = [...contenido.querySelectorAll('[data-accion-primaria="true"]')]
        .filter((n) => n.offsetParent !== null && !n.disabled);
      const formulario = objetivo instanceof Element ? objetivo.closest("form, .panel") : null;
      const primario = disponibles.find((n) => formulario?.contains(n)) || disponibles[0];
      if (primario) {
        evento.preventDefault();
        primario.click();
      }
    } else if (accion === "tema") {
      evento.preventDefault();
      const siguiente = cicloTema();
      pintarIconoTema();
      anunciar(`Tema ${siguiente === "sistema" ? "del sistema" : siguiente}.`);
    } else if (accion === "ayuda") {
      evento.preventDefault();
      abrirAyuda();
    } else if (accion === "escape") {
      // El diálogo nativo y los gráficos tienen prioridad sobre los atajos globales.
      if (hayCalculosEnCurso() && cancelarCalculos()) {
        evento.preventDefault();
        toast("Cálculo cancelado.", { tipo: "info" });
        anunciar("Cálculo cancelado.");
      }
    } else if (accion === "grafico") {
      const grafico = [...document.querySelectorAll(".grafico svg[tabindex]")].find((n) => n.getBoundingClientRect().width > 0);
      if (grafico) {
        evento.preventDefault();
        grafico.focus();
        grafico.scrollIntoView({ behavior: comportamientoScroll(), block: "center" });
        anunciar("Gráfico. Flechas para recorrer los valores; más y menos para el zoom; cero para restablecer.");
      }
    }
  });

  window.addEventListener("hashchange", () => renderRuta());
  pantallaMovil.addEventListener("change", () => aplicarSidebar());

  window.addEventListener("ampu:prefs", () => {
    pintarIconoTema();
    aplicarMovimiento();
    aplicarSidebar();
  });

  if (window.matchMedia) {
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      if (prefs.tema === "sistema") pintarIconoTema();
    };
    if (consulta.addEventListener) consulta.addEventListener("change", alCambiar);
    else if (consulta.addListener) consulta.addListener(alCambiar);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.addEventListener) motion.addEventListener("change", aplicarMovimiento);
  }
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

async function iniciar() {
  hidratarIconos();
  construirNav();
  aplicarSidebar();
  conectarEventos();
  await inicializarPreferencias();
  pintarIconoTema();
  aplicarMovimiento();
  aplicarSidebar();

  const { vista, parametro } = parsearHash();
  if (!vistaValida(vista)) {
    history.replaceState(null, "", rutaDe("inicio"));
  } else if (location.hash !== rutaDe(vista, parametro)) {
    history.replaceState(null, "", rutaDe(vista, parametro));
  }
  await renderRuta(true);

  // Calienta metadatos para la paleta y las vistas sin bloquear el primer pintado.
  setTimeout(() => {
    cargarMeta().catch(() => {});
  }, 400);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
  iniciar();
}
