/**
 * Recorrido inicial guiado por cada componente de AmPu.
 * Se muestra automáticamente la primera vez que se abre la aplicación y puede
 * volver a lanzarse en cualquier momento desde Ayuda o Ajustes.
 */

import { el, boton, anunciar, comportamientoScroll } from "./ui.js";
import { icono } from "./icons.js";
import { navegar, marcarWalkthroughCompletado } from "./store.js";

function elementoVisible(selector) {
  const nodo = document.querySelector(selector);
  if (!nodo) return null;
  if (nodo.closest('[aria-hidden="true"]') || nodo.closest("[inert]")) return null;
  const rect = nodo.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return nodo;
}

export const PASOS_WALKTHROUGH = [
  {
    id: "bienvenida",
    componente: "Inicio",
    titulo: "Bienvenido a AmPu 3.2",
    texto: "Tu laboratorio local de probabilidad y estadística. Todos los cálculos, simulaciones y gráficos se ejecutan en tu equipo, sin conexión ni envío de datos.",
    objetivo: () => elementoVisible("#contenido .hero"),
  },
  {
    id: "menu",
    componente: "Menú lateral",
    titulo: "Navegación por propósito",
    texto: "Las 10 secciones se organizan según lo que necesitas: Explorar (distribuciones, descriptiva y probabilidad), Inferir (pruebas y regresión), Diseñar (muestreo y simulación), Aprender (teoría) y Ajustes.",
    objetivo: () => elementoVisible("#nav-principal") || elementoVisible("#alternar-sidebar"),
  },
  {
    id: "buscador",
    componente: "Buscador rápido",
    titulo: "Encuentra cualquier herramienta o lección",
    texto: "Abre el buscador universal desde cualquier vista para saltar directo a una distribución, prueba de hipótesis, lección teórica o acción rápida.",
    atajo: ["Ctrl", "K"],
    objetivo: () => elementoVisible("#abrir-buscador"),
  },
  {
    id: "tema",
    componente: "Tema visual",
    titulo: "Modo claro, oscuro o sistema",
    texto: "Alterna entre tema claro, oscuro o automático del sistema. Las fórmulas matemáticas, tablas y gráficos adaptan su contraste al instante.",
    atajo: ["Ctrl", "Shift", "L"],
    objetivo: () => elementoVisible("#alternar-tema"),
  },
  {
    id: "ayuda",
    componente: "Ayuda y atajos",
    titulo: "Guía de entrada de datos y atajos",
    texto: "Consulta en cualquier momento cómo escribir decimales (12,5 o 12.5), series y matrices, además de todos los atajos de teclado disponibles.",
    atajo: ["F1"],
    objetivo: () => elementoVisible("#boton-ayuda"),
  },
  {
    id: "distribuciones",
    componente: "Distribuciones",
    titulo: "26 distribuciones de probabilidad",
    texto: "Evalúa funciones de masa o densidad, probabilidad acumulada, supervivencia, cuantiles e intervalos en modelos discretos, continuos y multivariantes.",
    ruta: "distribuciones",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/distribuciones"]') || elementoVisible('#nav-principal [data-vista="distribuciones"]'),
  },
  {
    id: "descriptiva",
    componente: "Describir datos",
    titulo: "Estadística descriptiva",
    texto: "Resume una muestra con estadísticos, percentiles y detección de atípicos; explora histograma ajustable, diagrama de caja y ECDF desde texto o CSV.",
    ruta: "descriptiva",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/descriptiva"]') || elementoVisible('#nav-principal [data-vista="descriptiva"]'),
  },
  {
    id: "probabilidad",
    componente: "Probabilidad",
    titulo: "Combinatoria, Bayes y variables discretas",
    texto: "Calcula variaciones, permutaciones, combinaciones, probabilidad condicional y teorema de Bayes con aritmética exacta de fracciones.",
    ruta: "probabilidad",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/probabilidad"]') || elementoVisible('#nav-principal [data-vista="probabilidad"]'),
  },
  {
    id: "inferencia",
    componente: "Inferencia",
    titulo: "13 pruebas de hipótesis",
    texto: "Contrasta hipótesis paramétricas y no paramétricas con comprobación de supuestos, intervalos de confianza, tamaño del efecto y región de rechazo.",
    ruta: "inferencia",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/inferencia"]') || elementoVisible('#nav-principal [data-vista="inferencia"]'),
  },
  {
    id: "regresion",
    componente: "Regresión",
    titulo: "Modelos lineales y diagnóstico",
    texto: "Ajusta regresión simple y múltiple (OLS), interpreta coeficientes y R², inspecciona residuos frente a valores ajustados y calcula predicciones.",
    ruta: "regresion",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/regresion"]') || elementoVisible('#nav-principal [data-vista="regresion"]'),
  },
  {
    id: "muestreo",
    componente: "Diseño muestral",
    titulo: "Tamaño muestral y selección reproducible",
    texto: "Determina el tamaño de muestra y extrae muestras con semilla fija en 7 diseños: simple, sistemático, estratificado, Neyman, óptimo y conglomerados.",
    ruta: "muestreo",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/muestreo"]') || elementoVisible('#nav-principal [data-vista="muestreo"]'),
  },
  {
    id: "simulacion",
    componente: "Simulación",
    titulo: "Monte Carlo, ajuste y QQ-plot",
    texto: "Estima π e integrales definidas, simula muestras aleatorias, ajusta distribuciones a tus datos y compara cuantiles con gráficos QQ-plot.",
    ruta: "simulacion",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/simulacion"]') || elementoVisible('#nav-principal [data-vista="simulacion"]'),
  },
  {
    id: "teoria",
    componente: "Teoría",
    titulo: "57 lecciones conectadas",
    texto: "Cada módulo enlaza con su lección teórica en ventana emergente: definiciones, fórmulas matemáticas, ejemplos resueltos paso a paso y acceso directo al cálculo.",
    ruta: "teoria",
    objetivo: () => elementoVisible('#contenido a.tarjeta-herramienta[href="#/teoria"]') || elementoVisible('#nav-principal [data-vista="teoria"]'),
  },
  {
    id: "ventanas",
    componente: "Ventanas, gráficos y exportación",
    titulo: "Espacio de resultados en paralelo",
    texto: "Los resultados, gráficos interactivos (con zoom, varias funciones simultáneas, leyenda conmutable y tabla de datos) y tablas se abren en ventanas arrastrables, redimensionables y minimizables. Exporta a PNG, PDF, Excel o CSV.",
    objetivo: () => elementoVisible("#contenido .hero__datos") || elementoVisible("#contenido .panel"),
  },
  {
    id: "actividad_ajustes",
    componente: "Actividad y Ajustes",
    titulo: "Historial local y preferencias",
    texto: "En Inicio conservas tu actividad reciente y modelos destacados. En Ajustes configuras decimales, notación, densidad y copias de preferencias. Puedes repetir este recorrido desde Ayuda o Ajustes.",
    ruta: "ajustes",
    objetivo: () => elementoVisible('#nav-principal [data-vista="ajustes"]') || elementoVisible("#contenido .actividad") || elementoVisible("#alternar-sidebar"),
  },
];

let instanciaActiva = null;

export function cerrarWalkthrough({ marcarVisto = true } = {}) {
  if (!instanciaActiva) return;
  instanciaActiva.cerrar({ marcarVisto });
}

export function walkthroughAbierto() {
  return Boolean(instanciaActiva);
}

export async function abrirWalkthroughDesdeInicio({ enfocar = true } = {}) {
  const ruta = String(location.hash || "#/inicio").replace(/^#\/?/, "");
  if (!ruta.startsWith("inicio")) {
    navegar("inicio");
    await new Promise((resolve) => {
      let intentos = 0;
      const esperar = () => {
        if (elementoVisible("#contenido .hero") || intentos++ >= 40) {
          resolve();
        } else {
          requestAnimationFrame(esperar);
        }
      };
      requestAnimationFrame(esperar);
    });
  }
  return iniciarWalkthrough({ automatico: false, enfocar });
}

export function iniciarWalkthrough({ automatico = false, pasoInicial = 0, enfocar = !automatico } = {}) {
  cerrarWalkthrough({ marcarVisto: false });

  const capa = el("div", { id: "capa-tour", class: "tour-capa", "aria-live": "off" });
  const resaltado = el("div", { class: "tour-resaltado", "aria-hidden": "true", hidden: true });
  const tarjeta = el("aside", {
    class: "tour-tarjeta",
    role: "region",
    "aria-label": "Recorrido guiado por AmPu",
    tabindex: "-1",
  });

  capa.append(resaltado, tarjeta);
  document.body.append(capa);

  let indice = Math.max(0, Math.min(PASOS_WALKTHROUGH.length - 1, pasoInicial));
  let rafReposicionar = null;
  let cerrado = false;
  const focoPrevio = document.activeElement;

  function limpiarPosicion() {
    resaltado.hidden = true;
  }

  function posicionar({ hacerScroll = false } = {}) {
    if (cerrado) return;
    const paso = PASOS_WALKTHROUGH[indice];
    const objetivo = paso.objetivo?.() || null;

    if (objetivo && hacerScroll) {
      const r = objetivo.getBoundingClientRect();
      const fuera = r.top < 56 || r.bottom > window.innerHeight - 24;
      if (fuera) {
        objetivo.scrollIntoView({ block: "nearest", inline: "nearest", behavior: comportamientoScroll() });
      }
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const movil = vw <= 640;

    if (objetivo) {
      const r = objetivo.getBoundingClientRect();
      const pad = 6;
      const left = Math.max(4, r.left - pad);
      const top = Math.max(4, r.top - pad);
      const width = Math.min(vw - left - 4, r.width + pad * 2);
      const height = Math.min(vh - top - 4, r.height + pad * 2);
      if (width > 4 && height > 4) {
        resaltado.hidden = false;
        resaltado.style.left = `${Math.round(left)}px`;
        resaltado.style.top = `${Math.round(top)}px`;
        resaltado.style.width = `${Math.round(width)}px`;
        resaltado.style.height = `${Math.round(height)}px`;
      } else {
        limpiarPosicion();
      }
    } else {
      limpiarPosicion();
    }

    if (movil) {
      tarjeta.dataset.movil = "true";
      tarjeta.style.removeProperty("left");
      tarjeta.style.removeProperty("top");
      return;
    }

    delete tarjeta.dataset.movil;
    const cardW = Math.min(390, vw - 24);
    tarjeta.style.width = `${cardW}px`;
    const cardH = tarjeta.offsetHeight || 260;

    if (!objetivo) {
      tarjeta.style.left = `${Math.max(12, Math.round((vw - cardW) / 2))}px`;
      tarjeta.style.top = `${Math.max(12, Math.round(vh - cardH - 20))}px`;
      return;
    }

    const r = objetivo.getBoundingClientRect();
    const margen = 14;
    let x = Math.max(12, Math.min(vw - cardW - 12, r.left));
    let y;

    if (r.bottom + margen + cardH <= vh - 12) {
      y = r.bottom + margen;
    } else if (r.top - margen - cardH >= 12) {
      y = r.top - margen - cardH;
    } else if (r.right + margen + cardW <= vw - 12) {
      x = r.right + margen;
      y = Math.max(12, Math.min(vh - cardH - 12, r.top));
    } else if (r.left - margen - cardW >= 12) {
      x = r.left - margen - cardW;
      y = Math.max(12, Math.min(vh - cardH - 12, r.top));
    } else {
      x = Math.max(12, vw - cardW - 16);
      y = Math.max(12, vh - cardH - 16);
    }

    tarjeta.style.left = `${Math.round(x)}px`;
    tarjeta.style.top = `${Math.round(y)}px`;
  }

  function programarReposicionar() {
    if (rafReposicionar !== null) cancelAnimationFrame(rafReposicionar);
    rafReposicionar = requestAnimationFrame(() => {
      rafReposicionar = null;
      posicionar({ hacerScroll: false });
    });
  }

  function render({ moverFoco = false, hacerScroll = false } = {}) {
    if (cerrado) return;
    const paso = PASOS_WALKTHROUGH[indice];
    const total = PASOS_WALKTHROUGH.length;
    const esUltimo = indice === total - 1;
    const porcentaje = Math.round(((indice + 1) / total) * 100);

    const botonCerrar = el(
      "button",
      {
        type: "button",
        class: "icono-boton tour-tarjeta__cerrar",
        "aria-label": "Cerrar recorrido",
        title: "Cerrar recorrido (Esc)",
        onClick: () => cerrar({ marcarVisto: true, restaurarFoco: true }),
      },
      icono("cerrar", { tamano: 16 })
    );

    const cabecera = el(
      "header",
      { class: "tour-tarjeta__cabecera" },
      el(
        "div",
        { class: "tour-tarjeta__meta" },
        el("span", { class: "tour-tarjeta__ceja" }, icono("chispa", { tamano: 13 }), `Paso ${indice + 1} de ${total}`),
        el("span", { class: "chip" }, paso.componente)
      ),
      botonCerrar
    );

    const barraProgreso = el(
      "div",
      { class: "tour-progreso", role: "progressbar", "aria-valuemin": "1", "aria-valuemax": String(total), "aria-valuenow": String(indice + 1), "aria-label": "Progreso del recorrido" },
      el("span", { style: { width: `${porcentaje}%` } })
    );

    const puntos = el(
      "div",
      { class: "tour-puntos", role: "group", "aria-label": "Saltar a un paso" },
      PASOS_WALKTHROUGH.map((p, i) =>
        el("button", {
          type: "button",
          class: `tour-punto ${i === indice ? "tour-punto--activo" : ""}`.trim(),
          "aria-label": `Paso ${i + 1}: ${p.componente}`,
          "aria-current": i === indice ? "step" : null,
          title: p.componente,
          onClick: () => {
            indice = i;
            render({ moverFoco: true, hacerScroll: true });
          },
        })
      )
    );

    const pistaAtajo = paso.atajo
      ? el(
          "div",
          { class: "tour-tarjeta__atajo" },
          el("span", { class: "texto-tenue texto-pequeno" }, "Atajo: "),
          paso.atajo.map((tecla, i) => [i ? el("span", { class: "teclas__mas" }, "+") : null, el("kbd", {}, tecla)])
        )
      : null;

    const cuerpo = el(
      "div",
      { class: "tour-tarjeta__cuerpo" },
      el("h3", { class: "tour-tarjeta__titulo" }, paso.titulo),
      el("p", { class: "tour-tarjeta__texto" }, paso.texto),
      pistaAtajo
    );

    const accionesIzq = el(
      "div",
      { class: "fila", style: { gap: "6px", flexWrap: "wrap" } },
      boton("Omitir", {
        variante: "fantasma",
        pequeno: true,
        onClick: () => cerrar({ marcarVisto: true, restaurarFoco: true }),
      }),
      paso.ruta
        ? boton("Abrir", {
            variante: "fantasma",
            pequeno: true,
            icono: "externo",
            onClick: () => {
              const destino = paso.ruta;
              cerrar({ marcarVisto: true });
              navegar(destino);
            },
          })
        : null
    );

    const btnAnterior = boton("Anterior", {
      variante: "secundario",
      pequeno: true,
      icono: "flecha-izquierda",
      deshabilitado: indice === 0,
      onClick: () => {
        if (indice > 0) {
          indice -= 1;
          render({ moverFoco: true, hacerScroll: true });
        }
      },
    });

    const btnSiguiente = boton(esUltimo ? "Finalizar" : "Siguiente", {
      variante: "primario",
      pequeno: true,
      icono: esUltimo ? "comprobar" : "flecha-derecha",
      onClick: () => {
        if (!esUltimo) {
          indice += 1;
          render({ moverFoco: true, hacerScroll: true });
        } else {
          cerrar({ marcarVisto: true, restaurarFoco: true });
          anunciar("Recorrido inicial completado.");
        }
      },
    });

    const pie = el(
      "footer",
      { class: "tour-tarjeta__pie" },
      accionesIzq,
      el("div", { class: "fila", style: { gap: "6px" } }, btnAnterior, btnSiguiente)
    );

    tarjeta.replaceChildren(cabecera, barraProgreso, cuerpo, puntos, pie);
    posicionar({ hacerScroll });

    if (moverFoco) {
      btnSiguiente.focus({ preventScroll: true });
    }
    anunciar(`Recorrido paso ${indice + 1} de ${total}: ${paso.titulo}`);
  }

  function alTeclado(evento) {
    if (cerrado || evento.defaultPrevented || evento.isComposing || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.key === "Escape" && !evento.shiftKey) {
      if (document.querySelector("dialog[open]")) return;
      const objetivo = evento.target;
      if (typeof Element !== "undefined" && objetivo instanceof Element && objetivo.closest?.(".grafico svg")) return;
      if (typeof HTMLInputElement !== "undefined" && objetivo instanceof HTMLInputElement && objetivo.type === "search" && objetivo.value) return;
      evento.preventDefault();
      evento.stopPropagation();
      cerrar({ marcarVisto: true, restaurarFoco: tarjeta.contains(document.activeElement) });
      return;
    }
    if (!tarjeta.contains(document.activeElement)) return;
    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      if (indice < PASOS_WALKTHROUGH.length - 1) {
        indice += 1;
        render({ moverFoco: true, hacerScroll: true });
      }
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      if (indice > 0) {
        indice -= 1;
        render({ moverFoco: true, hacerScroll: true });
      }
    }
  }

  function alDialogo() {
    cerrar({ marcarVisto: true });
  }

  function alCambioRuta() {
    const hash = String(location.hash || "#/inicio").replace(/^#\/?/, "");
    if (hash && !hash.startsWith("inicio")) {
      cerrar({ marcarVisto: true });
    } else {
      programarReposicionar();
    }
  }

  function cerrar({ marcarVisto = true, restaurarFoco = false } = {}) {
    if (cerrado) return;
    cerrado = true;
    if (rafReposicionar !== null) cancelAnimationFrame(rafReposicionar);
    window.removeEventListener("resize", programarReposicionar);
    window.removeEventListener("scroll", programarReposicionar, true);
    window.removeEventListener("hashchange", alCambioRuta);
    window.removeEventListener("ampu:dialogo", alDialogo);
    document.removeEventListener("keydown", alTeclado);
    capa.remove();
    if (instanciaActiva?.cerrar === cerrar) instanciaActiva = null;
    if (marcarVisto) marcarWalkthroughCompletado({ ultimoPaso: indice + 1 });
    if (restaurarFoco && focoPrevio?.isConnected && typeof focoPrevio.focus === "function") {
      focoPrevio.focus({ preventScroll: true });
    }
  }

  window.addEventListener("resize", programarReposicionar);
  window.addEventListener("scroll", programarReposicionar, true);
  window.addEventListener("hashchange", alCambioRuta);
  window.addEventListener("ampu:dialogo", alDialogo);
  document.addEventListener("keydown", alTeclado);

  instanciaActiva = { cerrar };
  render({ moverFoco: enfocar, hacerScroll: false });
  return instanciaActiva;
}
