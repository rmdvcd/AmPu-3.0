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
import { ATAJOS, NAV, ORDEN_VISTAS, VISTAS } from "./data.js";

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

function aplicarSidebar() {
  if (!aplicacion) return;
  const escritorio = window.innerWidth > 900;
  if (escritorio) {
    aplicacion.classList.remove("sidebar-abierta");
    aplicacion.classList.toggle("sidebar-plegada", prefs.sidebar === false);
    if (velo) velo.hidden = true;
    botonSidebar?.setAttribute("aria-expanded", String(prefs.sidebar !== false));
  } else {
    aplicacion.classList.remove("sidebar-plegada");
    const abierta = aplicacion.classList.contains("sidebar-abierta");
    botonSidebar?.setAttribute("aria-expanded", String(abierta));
    if (velo) velo.hidden = !abierta;
  }
}

function abrirSidebarMovil(abrir) {
  if (!aplicacion) return;
  aplicacion.classList.toggle("sidebar-abierta", abrir);
  if (velo) velo.hidden = !abrir;
  botonSidebar?.setAttribute("aria-expanded", String(abrir));
  if (abrir) {
    setTimeout(() => sidebar?.querySelector(".nav-enlace")?.focus(), 60);
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
  nav.addEventListener("click", (evento) => {
    if (evento.target.closest(".nav-enlace") && window.innerWidth <= 900) abrirSidebarMovil(false);
  });
  const pie = el(
    "div",
    { class: "nav-grupo" },
    el("p", { class: "nav-grupo__titulo" }, "Sistema"),
    el(
      "a",
      { class: "nav-enlace", href: "#/ajustes", "data-vista": "ajustes", title: "Apariencia, formato y datos" },
      el("span", { class: "nav-enlace__icono" }, icono("ajustes", { tamano: 18 })),
      el("span", { class: "nav-enlace__texto" }, "Ajustes")
    )
  );
  nav.append(pie);
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
  for (const clave of [...ORDEN_VISTAS, "ajustes"]) {
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
      descripcion: `${d.discreta ? "Discreta" : "Continua"} · ${d.categoria}`,
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
    { tipo: "Acción", titulo: "Abrir preferencias", descripcion: "Formato, datos y privacidad", ruta: "ajustes", icono: "ajustes", palabras: "ajustes preferencias formato decimales" },
    { tipo: "Acción", titulo: "Ver atajos y ayuda", descripcion: "Cómo funciona AmPu", accion: "ayuda", icono: "ayuda", palabras: "ayuda atajos teclado" }
  );
  return items;
}

async function abrirPaleta() {
  if (paletaAbierta || document.querySelector("#raiz-modal dialog[open]")) return;
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

function abrirAyuda() {
  if (document.querySelector("#raiz-modal dialog[open]")) return;
  const atajos = el(
    "div",
    { class: "lista-atajos" },
    ATAJOS.map((atajo) =>
      el(
        "div",
        { class: "atajo-fila" },
        el("span", {}, atajo.texto),
        el("span", { class: "teclas" }, atajo.teclas.map((t) => el("kbd", {}, t)))
      )
    )
  );
  modal({
    titulo: "Ayuda y atajos",
    subtitulo: "AmPu funciona sin conexión y no envía tus datos a ningún servidor externo.",
    contenido: el(
      "div",
      { class: "pila" },
      el(
        "div",
        { class: "rejilla rejilla--2" },
        el(
          "section",
          { class: "pila pila--sm" },
          el("h3", { class: "ayuda__titulo" }, "Cómo funciona"),
          el("p", { class: "texto-articulo" }, "1. Elige una sección en el menú o con Ctrl K. 2. Ajusta los parámetros y ejecuta el cálculo. 3. Lee el resultado, sus supuestos y los enlaces a la teoría."),
          el("p", { class: "texto-articulo" }, "El botón de tema cambia entre claro, oscuro y sistema. Las preferencias se guardan en este navegador y puedes exportarlas desde Ajustes.")
        ),
        el("section", { class: "pila pila--sm" }, el("h3", { class: "ayuda__titulo" }, "Atajos"), atajos)
      ),
      el("p", { class: "texto-tenue texto-pequeno" }, "Los cálculos se ejecutan en el servidor local de Python que acompaña a esta interfaz. Ninguna muestra ni preferencia sale de tu equipo.")
    ),
    acciones: [
      { texto: "Abrir preferencias", variante: "secundario", onClick: () => setTimeout(() => navegar("ajustes"), 80) },
      { texto: "Explorar la teoría", variante: "secundario", onClick: () => setTimeout(() => navegar("teoria"), 80) },
      { texto: "Entendido", variante: "primario" },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Eventos globales                                                    */
/* ------------------------------------------------------------------ */

function conectarEventos() {
  botonSidebar?.addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      abrirSidebarMovil(!aplicacion.classList.contains("sidebar-abierta"));
    } else {
      const plegada = aplicacion.classList.toggle("sidebar-plegada");
      botonSidebar.setAttribute("aria-expanded", String(!plegada));
      guardarPrefs({ sidebar: !plegada }, { silencioso: true });
    }
  });

  cerrarSidebar?.addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      abrirSidebarMovil(false);
    } else {
      aplicacion.classList.add("sidebar-plegada");
      botonSidebar?.setAttribute("aria-expanded", "false");
      guardarPrefs({ sidebar: false }, { silencioso: true });
    }
  });
  velo?.addEventListener("click", () => abrirSidebarMovil(false));

  document.getElementById("alternar-tema")?.addEventListener("click", () => {
    const siguiente = cicloTema();
    pintarIconoTema();
    anunciar(`Tema ${siguiente === "sistema" ? "del sistema" : siguiente}.`);
  });

  document.getElementById("abrir-buscador")?.addEventListener("click", abrirPaleta);

  for (const id of ["boton-ayuda", "pie-ayuda"]) {
    document.getElementById(id)?.addEventListener("click", abrirAyuda);
  }
  document.getElementById("pie-preferencias")?.addEventListener("click", () => navegar("ajustes"));
  window.addEventListener("ampu:ayuda", abrirAyuda);

  document.addEventListener("keydown", (evento) => {
    const objetivo = evento.target;
    const escribiendo = objetivo instanceof HTMLElement && (objetivo.matches("input, textarea, select") || objetivo.isContentEditable);
    const conModificador = evento.ctrlKey || evento.metaKey;

    if (conModificador && evento.key.toLocaleLowerCase("es") === "k") {
      evento.preventDefault();
      abrirPaleta();
      return;
    }
    if (conModificador && evento.key === "Enter") {
      const primario = [...document.querySelectorAll('[data-accion-primaria="true"]')].find((n) => n.offsetParent !== null && !n.disabled);
      if (primario) {
        evento.preventDefault();
        primario.click();
      }
      return;
    }
    if (conModificador && evento.shiftKey && evento.key.toLocaleLowerCase("es") === "l") {
      evento.preventDefault();
      const siguiente = cicloTema();
      pintarIconoTema();
      anunciar(`Tema ${siguiente === "sistema" ? "del sistema" : siguiente}.`);
      return;
    }
    if ((evento.key === "?" && !escribiendo && !conModificador) || evento.key === "F1") {
      evento.preventDefault();
      abrirAyuda();
      return;
    }
    // Esc cancela el cálculo en curso (si no hay un diálogo abierto, que tiene prioridad).
    if (evento.key === "Escape" && hayCalculosEnCurso() && !document.querySelector("dialog[open]")) {
      const cancelados = cancelarCalculos();
      if (cancelados) {
        evento.preventDefault();
        toast("Cálculo cancelado.", { tipo: "info" });
        anunciar("Cálculo cancelado.");
        return;
      }
    }
    // Alt+G lleva el foco al primer gráfico visible (desde ahí: flechas, +, −, 0).
    if (evento.altKey && !conModificador && evento.key.toLocaleLowerCase("es") === "g") {
      const grafico = [...document.querySelectorAll(".grafico svg[tabindex]")].find((n) => n.getBoundingClientRect().width > 0);
      if (grafico) {
        evento.preventDefault();
        grafico.focus();
        grafico.scrollIntoView({ behavior: comportamientoScroll(), block: "center" });
        anunciar("Gráfico. Flechas para recorrer los valores; más y menos para el zoom; cero para restablecer.");
      }
      return;
    }
    if (evento.key === "Escape" && aplicacion?.classList.contains("sidebar-abierta")) {
      abrirSidebarMovil(false);
    }
  });

  window.addEventListener("hashchange", () => renderRuta());
  window.addEventListener("resize", () => aplicarSidebar());

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
  await inicializarPreferencias();
  pintarIconoTema();
  aplicarMovimiento();
  construirNav();
  aplicarSidebar();
  conectarEventos();

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
