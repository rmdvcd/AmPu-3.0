/**
 * Componentes y utilidades de interfaz de AmPu.
 * Sin framework: funciones pequeñas que devuelven nodos reales del DOM.
 */

import { comasComoSeparadores, fmtEntrada, leerMatriz, leerNumero, leerSerie, resumenLectura, tieneComasDudosas } from "./entrada.js";
import { icono, svgIcono } from "./icons.js";

/** Configuración viva que comparten formato y gráficos (la actualiza store.js). */
export const config = {
  decimales: 4,
  notacion: "auto",
  densidad: "comoda",
  calculoAutomatico: true,
};

let contadorId = 0;
const uid = (prefijo = "campo") => `${prefijo}-${++contadorId}`;

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

export function el(etiqueta, props = {}, ...hijos) {
  if (
    typeof props === "string" ||
    typeof props === "number" ||
    props instanceof Node ||
    Array.isArray(props)
  ) {
    hijos.unshift(props);
    props = {};
  }
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === "class" || clave === "clase") nodo.className = valor;
    else if (clave === "texto" || clave === "text") nodo.textContent = valor;
    else if (clave === "html") nodo.innerHTML = valor;
    else if (clave === "style" || clave === "estilo") {
      if (typeof valor === "string") nodo.setAttribute("style", valor);
      else Object.assign(nodo.style, valor);
    } else if (clave === "dataset") Object.assign(nodo.dataset, valor);
    else if (clave === "for") nodo.htmlFor = valor;
    else if (clave.startsWith("on") && typeof valor === "function") {
      nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave in nodo && !clave.includes("-") && clave !== "list" && clave !== "form") {
      try {
        nodo[clave] = valor;
      } catch {
        nodo.setAttribute(clave, valor === true ? "" : valor);
      }
    } else {
      nodo.setAttribute(clave, valor === true ? "" : valor);
    }
  }
  agregar(nodo, hijos);
  return nodo;
}

export function agregar(padre, hijos) {
  for (const hijo of hijos.flat(8)) {
    if (hijo === null || hijo === undefined || hijo === false || hijo === true) continue;
    padre.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return padre;
}

export function fragmento(...hijos) {
  return agregar(document.createDocumentFragment(), hijos);
}

export const qs = (selector, raiz = document) => raiz.querySelector(selector);
export const qsa = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

export function limpiar(nodo) {
  if (nodo) nodo.replaceChildren();
  return nodo;
}

export function iconoSvg(nombre, tamano) {
  return svgIcono(nombre, tamano);
}

/** «smooth» salvo que el sistema o las preferencias pidan reducir el movimiento. */
export function comportamientoScroll() {
  const reducido =
    document.documentElement.dataset.movimiento === "reducido" ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  return reducido ? "auto" : "smooth";
}

/* ------------------------------------------------------------------ */
/* Formato numérico                                                    */
/* ------------------------------------------------------------------ */

export function fmtNum(valor, opciones = {}) {
  if (valor === null || valor === undefined || valor === "") return "—";
  // Vectores (modelos multivariantes): «(1,6; 2,4; 4)», con «;» para no chocar con la coma decimal.
  if (Array.isArray(valor)) return `(${valor.map((v) => fmtNum(v, opciones)).join("; ")})`;
  if (typeof valor === "string") {
    if (valor === "∞" || valor === "−∞" || valor === "-∞" || valor === "+∞") return valor === "+∞" ? "∞" : valor;
    const limpio = valor.trim();
    if (limpio !== "" && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(limpio)) valor = Number(limpio);
    else return valor;
  }
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor !== "number" || Number.isNaN(valor)) return String(valor);
  if (!Number.isFinite(valor)) return valor > 0 ? "∞" : "−∞";

  const {
    decimales = config.decimales,
    notacion = config.notacion,
    compacto = false,
    entero = false,
    signo = false,
  } = opciones;
  const abs = Math.abs(valor);
  let opcionesIntl;

  if (entero && Number.isInteger(valor)) {
    opcionesIntl = { maximumFractionDigits: 0, useGrouping: true };
  } else if (compacto && abs >= 1e6) {
    opcionesIntl = { notation: "compact", maximumFractionDigits: 1 };
  } else if (notacion === "cientifica" || (notacion === "auto" && abs !== 0 && (abs < 1e-4 || abs >= 1e7))) {
    opcionesIntl = { notation: "scientific", maximumSignificantDigits: Math.max(3, decimales + 1) };
  } else if (notacion === "fija") {
    opcionesIntl = { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: true };
  } else {
    opcionesIntl = { minimumFractionDigits: 0, maximumFractionDigits: decimales, useGrouping: true };
  }
  let texto;
  try {
    texto = formatearEs(valor, opcionesIntl);
  } catch {
    texto = valor.toFixed(decimales).replace(".", ",");
  }
  return signo && valor > 0 ? `+${texto}` : texto;
}

const SUPERINDICES = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const superindice = (n) => String(n).replace(/[-\d]/g, (c) => SUPERINDICES[c]);

/**
 * Formato numérico en español con las convenciones de AmPu:
 *  - coma decimal;
 *  - miles agrupados con espacio fino (U+202F), nunca con punto, para que
 *    «1.234» no pueda leerse a la vez como mil doscientos y como uno coma dos;
 *  - notación científica como «1,23 × 10⁻⁵» en lugar de «1,23E-5».
 */
function formatearEs(valor, opcionesIntl) {
  const partes = new Intl.NumberFormat("es-ES", opcionesIntl).formatToParts(valor);
  let texto = "";
  let exponente = "";
  let enExponente = false;
  for (const parte of partes) {
    if (parte.type === "group") texto += "\u202f";
    else if (parte.type === "exponentSeparator") enExponente = true;
    else if (parte.type === "exponentMinusSign") exponente += "-";
    else if (parte.type === "exponentInteger") exponente += parte.value;
    else if (parte.type === "minusSign" && !enExponente) texto += "−";
    else texto += parte.value;
  }
  if (enExponente) {
    const n = Number(exponente);
    return n === 0 ? texto : `${texto} × 10${superindice(n)}`;
  }
  // Intl (es-ES) no agrupa los números de cuatro cifras; AmPu sí, por coherencia.
  return texto.replace(/^(−?)(\d)(\d{3})(?=,|$)/, "$1$2\u202f$3");
}

/**
 * p-valor legible. Nunca muestra «0» ni oculta el orden de magnitud: un
 * p = 4,8 × 10⁻³² se enseña así, no como «< 0,0001».
 */
export function fmtP(p) {
  if (p === null || p === undefined || p === "") return "—";
  if (typeof p === "string") {
    const numero = Number(p);
    if (!Number.isFinite(numero)) return p;
    p = numero;
  }
  if (!Number.isFinite(p)) return "—";
  if (p === 0) return "< 10⁻³⁰⁰";
  if (p < 0.0001) return formatearEs(p, { notation: "scientific", maximumSignificantDigits: 3 });
  if (p > 0.9999 && p < 1) return "> 0,9999";
  return formatearEs(p, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/** Valor con toda su precisión útil (12 cifras significativas), para «copiar» y detalles. */
export function fmtPreciso(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return fmtNum(valor);
  const abs = Math.abs(valor);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
    return formatearEs(valor, { notation: "scientific", maximumSignificantDigits: 12 });
  }
  return formatearEs(valor, { maximumSignificantDigits: 12, useGrouping: true });
}

/** Intervalo «[a; b]» que respeta las cotas infinitas de los intervalos unilaterales. */
export function fmtIntervalo(intervalo, opciones = {}) {
  if (!Array.isArray(intervalo) || intervalo.length !== 2) return "—";
  const [a, b] = intervalo;
  const infinito = (v) => typeof v === "string" && v.includes("∞");
  const izq = infinito(a) ? "(−∞" : `[${fmtNum(a, opciones)}`;
  const der = infinito(b) ? "+∞)" : `${fmtNum(b, opciones)}]`;
  return `${izq}; ${der}`;
}

export function fmtPorcentaje(valor, decimales = 1) {
  if (valor === null || valor === undefined || typeof valor !== "number" || !Number.isFinite(valor)) return "—";
  const cien = valor * 100;
  const umbral = 10 ** -decimales;
  const minimo = new Intl.NumberFormat("es-ES", { maximumFractionDigits: decimales }).format(umbral);
  // Un porcentaje distinto de 0 (o de 100) nunca se muestra como «0 %» (o «100 %»).
  if (cien > 0 && cien < umbral / 2) return `< ${minimo} %`;
  if (cien < 100 && cien > 100 - umbral / 2) return `> ${new Intl.NumberFormat("es-ES", { maximumFractionDigits: decimales }).format(100 - umbral)} %`;
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: decimales }).format(cien).replace("-", "−")} %`;
}

export function fmtEnteroGrande(texto) {
  const crudo = String(texto ?? "");
  if (!/^-?\d+$/.test(crudo)) return crudo || "—";
  const signo = crudo.startsWith("-") ? "−" : "";
  const digitos = crudo.replace("-", "");
  return signo + digitos.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

export function fmtCompacto(valor) {
  return fmtNum(valor, { compacto: true, decimales: 2 });
}

export function plural(n, singular, plural_) {
  return `${n} ${n === 1 ? singular : plural_ || `${singular}s`}`;
}

export function fechaRelativa(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const segundos = Math.round((Date.now() - fecha.getTime()) / 1000);
  if (segundos < 45) return "ahora mismo";
  if (segundos < 3600) return `hace ${plural(Math.max(1, Math.round(segundos / 60)), "minuto")}`;
  if (segundos < 86400) return `hace ${plural(Math.round(segundos / 3600), "hora")}`;
  if (segundos < 604800) return `hace ${plural(Math.round(segundos / 86400), "día")}`;
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ------------------------------------------------------------------ */
/* Matemáticas                                                         */
/* ------------------------------------------------------------------ */

export function latex(host, expresion, { display = true } = {}) {
  if (!host) return;
  host.replaceChildren();
  host.classList.add("no-math");
  if (!expresion) {
    host.textContent = "—";
    return;
  }
  if (window.katex && typeof window.katex.render === "function") {
    try {
      window.katex.render(String(expresion), host, {
        displayMode: display,
        output: "htmlAndMathml",
        throwOnError: false,
        trust: false,
        strict: "ignore",
        errorColor: "var(--error)",
      });
      return;
    } catch {
      /* se muestra el código como texto */
    }
  }
  host.textContent = String(expresion);
  host.classList.add("formula-vacia");
}

export function renderMath(raiz) {
  if (!raiz || typeof window.renderMathInElement !== "function") return;
  try {
    window.renderMathInElement(raiz, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      strict: "ignore",
      trust: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      ignoredClasses: ["no-math"],
    });
  } catch {
    /* KaTeX es opcional: el contenido sigue legible como texto */
  }
}

/* ------------------------------------------------------------------ */
/* Botones, badges, KPIs                                               */
/* ------------------------------------------------------------------ */

export function boton(texto, opciones = {}) {
  const {
    icono: nombreIcono = null,
    variante = "primario",
    onClick = null,
    tipo = "button",
    titulo = null,
    clase = "",
    pequeno = false,
    ancho = false,
    deshabilitado = false,
    ariaLabel = null,
    dataset = {},
  } = opciones;
  const clases = [
    "boton",
    variante === "secundario" ? "boton--secundario" : "",
    variante === "fantasma" ? "boton--fantasma" : "",
    variante === "peligro" ? "boton--peligro" : "",
    pequeno ? "boton--pequeno" : "",
    ancho ? "boton--ancho" : "",
    clase,
  ]
    .filter(Boolean)
    .join(" ");
  const nodo = el(
    "button",
    {
      class: clases,
      type: tipo,
      title: titulo,
      "aria-label": ariaLabel,
      disabled: deshabilitado,
      dataset,
    },
    nombreIcono ? icono(nombreIcono, { tamano: pequeno ? 14 : 16 }) : null,
    el("span", { class: "boton__texto" }, texto)
  );
  if (onClick) nodo.addEventListener("click", onClick);
  nodo.cargando = (activo) => {
    nodo.classList.toggle("boton--cargando", Boolean(activo));
    nodo.disabled = Boolean(activo);
    if (activo) nodo.setAttribute("aria-busy", "true");
    else nodo.removeAttribute("aria-busy");
  };
  return nodo;
}

/* ------------------------------------------------------------------ */
/* Exportación                                                         */
/* ------------------------------------------------------------------ */

/** Etiqueta e icono de cada formato que acepta `/api/exportar`. */
export const FORMATOS_EXPORTACION = {
  pdf: { texto: "PDF", icono: "documento", descripcion: "Informe completo con tablas y gráfico" },
  xlsx: { texto: "Excel", icono: "tabla", descripcion: "Tablas en un libro de cálculo" },
  png: { texto: "PNG", icono: "grafico", descripcion: "Solo el gráfico como imagen" },
  csv: { texto: "CSV", icono: "tabla", descripcion: "La primera tabla como texto separado por comas" },
};

/**
 * Crea el grupo de botones de exportación de una vista.
 *
 * @param {string[]} formatos Formatos disponibles, en el orden en que se pintan.
 * @param {(formato: string, boton: HTMLButtonElement) => void} alExportar Acción.
 */
export function botonesExportar(formatos, alExportar, { variante = "secundario", pequeno = true } = {}) {
  return formatos
    .filter((formato) => FORMATOS_EXPORTACION[formato])
    .map((formato) => {
      const { texto, icono: nombreIcono, descripcion } = FORMATOS_EXPORTACION[formato];
      return boton(texto, {
        variante,
        pequeno,
        icono: nombreIcono,
        titulo: `Exportar ${descripcion.toLowerCase()}`,
        onClick: (evento) => alExportar(formato, evento.currentTarget),
      });
    });
}

export function iconoBoton(nombre, { etiqueta, onClick, titulo, clase = "", deshabilitado = false } = {}) {
  const nodo = el("button", {
    class: `icono-boton ${clase}`.trim(),
    type: "button",
    "aria-label": etiqueta || titulo || nombre,
    title: titulo || etiqueta || null,
    disabled: deshabilitado,
  });
  nodo.append(icono(nombre, { tamano: 18 }));
  if (onClick) nodo.addEventListener("click", onClick);
  return nodo;
}

export function badge(texto, tono = "", { punto = false } = {}) {
  return el(
    "span",
    { class: `badge ${tono ? `badge--${tono}` : ""} ${punto ? "badge--punto" : ""}`.trim() },
    texto
  );
}

export function kpi({ etiqueta, valor, detalle, tono = "", icono: nombreIcono = null, titulo }) {
  const nodo = el("div", { class: `kpi ${tono ? `kpi--${tono}` : ""}`.trim(), title: titulo || null });
  nodo.append(
    el(
      "div",
      { class: "kpi__etiqueta" },
      nombreIcono ? icono(nombreIcono, { tamano: 12 }) : null,
      el("span", {}, etiqueta)
    ),
    el("div", { class: "kpi__valor" }, valor instanceof Node ? valor : String(valor ?? "—"))
  );
  if (detalle) nodo.append(el("div", { class: "kpi__detalle" }, detalle));
  return nodo;
}

export function panel({
  titulo = null,
  subtitulo = null,
  icono: nombreIcono = null,
  acciones = null,
  contenido = null,
  pie = null,
  clase = "",
  sinCabecera = false,
  sinRelleno = false,
  destacado = false,
} = {}) {
  const nodo = el("section", {
    class: `panel ${destacado ? "panel--destacado" : ""} ${clase}`.trim(),
  });
  if (!sinCabecera && (titulo || acciones)) {
    nodo.append(
      el(
        "header",
        { class: "panel__cabecera" },
        el(
          "div",
          {},
          el(
            "h2",
            { class: "panel__titulo" },
            nombreIcono ? icono(nombreIcono, { tamano: 16 }) : null,
            el("span", {}, titulo || "")
          ),
          subtitulo ? el("p", { class: "panel__subtitulo" }, subtitulo) : null
        ),
        acciones ? el("div", { class: "panel__acciones" }, acciones) : null
      )
    );
  }
  const cuerpo = el("div", { class: `panel__cuerpo ${sinRelleno ? "panel__cuerpo--sin-relleno" : ""}`.trim() });
  if (contenido) agregar(cuerpo, [contenido]);
  nodo.append(cuerpo);
  if (pie) nodo.append(el("footer", { class: "panel__pie" }, pie));
  nodo.cuerpo = cuerpo;
  return nodo;
}

export function cabeceraVista(titulo, { subtitulo, ceja, acciones, icono: nombreIcono } = {}) {
  return el(
    "header",
    { class: "vista__cabecera" },
    el(
      "div",
      {},
      ceja ? el("span", { class: "ceja" }, ceja) : null,
      el(
        "div",
        { class: "vista__titulo" },
        nombreIcono ? icono(nombreIcono, { tamano: 26 }) : null,
        el("h1", { tabindex: "-1" }, titulo)
      ),
      subtitulo ? el("p", { class: "vista__subtitulo" }, subtitulo) : null
    ),
    acciones ? el("div", { class: "vista__acciones" }, acciones) : null
  );
}

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */

export function campo(opciones = {}) {
  const {
    etiqueta,
    tipo = "texto",
    valor = "",
    ayuda = "",
    error = "",
    min = null,
    max = null,
    step = null,
    opciones: listaOpciones = [],
    requerido = false,
    id = uid("campo"),
    placeholder = "",
    sufijo = null,
    filas = null,
    codigo = null,
    opcional = false,
    onInput = null,
    onCambio = null,
    deshabilitado = false,
    autofoco = false,
    claseControl = "",
    fraccion = false,
    nombre = null,
  } = opciones;

  const envoltura = el("div", { class: "campo" });
  const filaEtiqueta = el("div", { class: "campo__fila" });
  const etiquetaNodo = el(
    "label",
    { class: "campo__etiqueta", for: id },
    el("span", {}, etiqueta || codigo || "Campo"),
    codigo && etiqueta ? el("code", { class: "campo__codigo" }, codigo) : null,
    opcional ? el("span", { class: "campo__opcional" }, "opcional") : null
  );
  if (tipo !== "checkbox") {
    filaEtiqueta.append(etiquetaNodo);
    envoltura.append(filaEtiqueta);
  }

  let control;
  let envolturaControl = null;

  if (tipo === "select") {
    control = el("select", { class: `campo__control ${claseControl}`.trim(), id, deshabilitado });
    for (const opcion of listaOpciones) {
      const [v, t] = Array.isArray(opcion) ? opcion : [opcion.valor, opcion.texto];
      control.append(el("option", { value: v }, t));
    }
    if (valor !== null && valor !== undefined) {
      control.value = String(valor);
      if (control.value !== String(valor) && control.options.length) control.selectedIndex = 0;
    }
    envolturaControl = control;
  } else if (tipo === "checkbox") {
    const casilla = el("input", { type: "checkbox", id, checked: Boolean(valor), deshabilitado });
    control = casilla;
    envoltura.append(
      el(
        "label",
        { class: "casilla", for: id },
        casilla,
        el("span", {}, ayuda || etiqueta || "")
      )
    );
  } else if (tipo === "textarea" || tipo === "serie" || tipo === "matriz") {
    control = el("textarea", {
      class: `campo__control campo__control--mono ${claseControl}`.trim(),
      id,
      rows: filas || (tipo === "matriz" ? 6 : 5),
      placeholder,
      spellcheck: "false",
      deshabilitado,
      autocapitalize: "off",
    });
    control.value = valor ?? "";
    envolturaControl = control;
  } else {
    const esNumero = tipo === "numero" || tipo === "entero";
    control = el("input", {
      class: `campo__control ${claseControl}`.trim(),
      id,
      type: "text",
      inputMode: esNumero ? (tipo === "entero" ? "numeric" : "decimal") : "text",
      autocomplete: "off",
      spellcheck: "false",
      placeholder,
      deshabilitado,
      "aria-required": requerido ? "true" : null,
    });
    // Los números se muestran con coma decimal, como los escribe el usuario.
    if (valor !== null && valor !== undefined) control.value = esNumero && typeof valor === "number" ? fmtEntrada(valor) : String(valor);
    if (sufijo) {
      envolturaControl = el("div", { class: "campo__control-envoltura" }, control, el("span", { class: "campo__sufijo" }, sufijo));
    } else {
      envolturaControl = control;
    }
  }

  if (control !== envoltura) {
    if (tipo !== "checkbox") {
      if (envolturaControl !== control) envoltura.append(envolturaControl);
      else envoltura.append(control);
    }
  }

  const ayudaNodo = ayuda && tipo !== "checkbox" ? el("p", { class: "campo__ayuda", id: `${id}-ayuda` }, ayuda) : null;
  // Vista previa de interpretación: enseña, mientras se escribe, qué números ha leído AmPu.
  const contador = tipo === "serie" || tipo === "matriz"
    ? el("div", { class: "campo__lectura", id: `${id}-lectura`, "aria-live": "polite" })
    : null;
  if (contador) envoltura.append(contador);
  if (nombre) envoltura.dataset.campo = nombre;

  const errorNodo = el("p", { class: "campo__error", id: `${id}-error`, role: "alert" });
  if (error) errorNodo.textContent = error;
  envoltura.append(errorNodo);
  if (ayudaNodo) {
    if (!ayudaNodo.isConnected) envoltura.insertBefore(ayudaNodo, errorNodo);
    control.setAttribute("aria-describedby", [ayudaNodo.id, contador ? contador.id : null, `${id}-error`].filter(Boolean).join(" "));
  } else {
    control.setAttribute("aria-describedby", [contador ? contador.id : null, `${id}-error`].filter(Boolean).join(" "));
  }

  const leerLectura = () => (tipo === "matriz" ? leerMatriz(control.value || "") : leerSerie(control.value || "", { fraccion }));

  const actualizarContador = () => {
    if (!contador) return;
    const texto = control.value || "";
    const lectura = leerLectura();
    contador.replaceChildren();
    contador.classList.remove("campo__lectura--error", "campo__lectura--aviso");
    const convertir = () =>
      el("button", {
        type: "button",
        class: "campo__lectura-accion",
        onClick: () => {
          control.value = comasComoSeparadores(control.value);
          control.dispatchEvent(new Event("input", { bubbles: true }));
          control.focus();
        },
      }, "Usar las comas como separadores");
    if (!texto.trim()) {
      contador.append(el("span", {}, "Separa los valores con espacios, punto y coma o líneas. Decimales con coma o punto."));
      return;
    }
    if (lectura.error) {
      contador.classList.add("campo__lectura--error");
      contador.append(
        el("span", { class: "campo__lectura-texto" }, lectura.error.mensaje, lectura.error.sugerencia ? ` ${lectura.error.sugerencia}` : ""),
        lectura.error.separable ? convertir() : null
      );
      return;
    }
    if (tipo === "matriz") {
      const filas = lectura.filas;
      const anchos = new Set(filas.map((f) => f.length));
      const forma = anchos.size === 1 ? `${filas.length} × ${filas[0]?.length ?? 0}` : `${filas.length} filas de distinta longitud`;
      contador.append(el("span", { class: "campo__lectura-texto" }, `Leído: tabla ${forma}`, filas[0] ? ` · primera fila: ${resumenLectura(filas[0], 5).replace(/^\d+ valor(es)?: /, "")}` : ""));
    } else {
      contador.append(el("span", { class: "campo__lectura-texto" }, `Leído: ${resumenLectura(lectura.valores)}`));
    }
    if (lectura.avisos.length) {
      contador.classList.add("campo__lectura--aviso");
      for (const aviso of lectura.avisos.slice(0, 2)) contador.append(el("span", { class: "campo__lectura-aviso" }, aviso));
      if (tieneComasDudosas(texto) && lectura.avisos.some((a) => a.includes("un solo valor"))) contador.append(convertir());
    }
  };
  if (contador) actualizarContador();

  const leerValor = () => {
    if (tipo === "checkbox") return control.checked;
    const texto = control.value.trim();
    if (tipo === "numero" || tipo === "entero") {
      if (texto === "") return null;
      // Con fracciones (1/3) se envía el texto: el motor conserva la forma exacta.
      if (fraccion && texto.includes("/")) return texto;
      const lectura = leerNumero(texto);
      return lectura.error ? texto : lectura.valor;
    }
    return texto;
  };

  const setError = (mensaje) => {
    errorNodo.textContent = mensaje || "";
    control.classList.toggle("campo__control--error", Boolean(mensaje));
    if (mensaje) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
  };

  control.addEventListener("input", () => {
    if (contador) actualizarContador();
    if (errorNodo.textContent) setError("");
    if (onInput) onInput(leerValor(), control);
  });
  control.addEventListener("change", () => {
    if (onCambio) onCambio(leerValor(), control);
  });

  const objeto = {
    envoltura,
    control,
    id,
    tipo,
    valor: leerValor,
    texto: () => (tipo === "checkbox" ? (control.checked ? "sí" : "no") : control.value.trim()),
    setValor: (v) => {
      if (tipo === "checkbox") control.checked = Boolean(v);
      else {
        control.value = (tipo === "numero" || tipo === "entero") && typeof v === "number" ? fmtEntrada(v) : v ?? "";
        if (tipo === "select" && v !== null && v !== undefined && control.value !== String(v) && control.options.length) {
          control.selectedIndex = 0;
        }
      }
      if (contador) actualizarContador();
    },
    setError,
    limpiarError: () => setError(""),
    nombre,
    lectura: () => (contador ? leerLectura() : null),
    enfocar: () => {
      control.focus();
      if (typeof control.select === "function" && tipo !== "checkbox") control.select();
    },
    actualizarContador,
    validar: () => {
      if (requerido && (tipo === "checkbox" ? !control.checked : !control.value.trim())) {
        setError("Este campo es obligatorio.");
        return false;
      }
      if (contador && control.value.trim()) {
        const lectura = leerLectura();
        if (lectura.error) {
          setError(lectura.error.mensaje);
          return false;
        }
      }
      const numero = leerValor();
      if ((tipo === "numero" || tipo === "entero") && control.value.trim()) {
        const lectura = leerNumero(control.value, { fraccion });
        if (lectura.error) {
          setError(`${lectura.error.mensaje}${lectura.error.sugerencia ? ` ${lectura.error.sugerencia}` : ""}`);
          return false;
        }
      }
      if ((tipo === "numero" || tipo === "entero") && typeof numero === "number") {
        if (tipo === "entero" && !Number.isInteger(numero)) {
          setError("Debe ser un número entero.");
          return false;
        }
        if (min !== null && numero < Number(min)) {
          setError(`Debe ser mayor o igual que ${fmtNum(min)}.`);
          return false;
        }
        if (max !== null && numero > Number(max)) {
          setError(`Debe ser menor o igual que ${fmtNum(max)}.`);
          return false;
        }
      }
      if (requerido && textoVacio(control.value)) {
        setError("Este campo es obligatorio.");
        return false;
      }
      return true;
    },
  };
  if (autofoco) setTimeout(() => control.focus(), 30);
  return objeto;
}

/**
 * Coloca un error del motor junto al campo que lo causó (y lo enfoca).
 * `campos` es un objeto { idDelMotor: campo } o una lista de campos con `nombre`.
 * Devuelve true si encontró el campo; si no, la vista debe mostrar el error de forma general.
 */
export function errorEnCampo(error, campos) {
  const clave = error && error.campo;
  if (!clave || !campos) return false;
  let destino = null;
  if (Array.isArray(campos)) destino = campos.find((c) => c && c.nombre === clave) || null;
  else destino = campos[clave] || campos[String(clave).split(".")[0]] || null;
  if (!destino || typeof destino.setError !== "function") return false;
  const sugerencia = error.detalle && error.detalle.sugerencia ? ` ${error.detalle.sugerencia}` : "";
  destino.setError(`${error.message}${sugerencia}`);
  if (typeof destino.enfocar === "function") destino.control.focus({ preventScroll: false });
  return true;
}

/** Texto completo de un error del motor: mensaje + sugerencia de recuperación. */
export function textoError(error) {
  const sugerencia = error && error.detalle && error.detalle.sugerencia;
  return sugerencia ? `${error.message} ${sugerencia}` : (error && error.message) || "Error desconocido.";
}

/** Lista de avisos del motor (supuestos dudosos, lecturas a revisar) como alerta. */
export function avisosMotor(avisos, titulo = "Conviene revisar") {
  const lista = (avisos || []).filter(Boolean);
  if (!lista.length) return null;
  const nodo = alerta({
    tipo: "aviso",
    titulo,
    texto: lista.length === 1 ? lista[0] : el("ul", { class: "avisos-motor__lista" }, lista.map((a) => el("li", {}, a))),
  });
  nodo.classList.add("avisos-motor");
  nodo.setAttribute("role", "note");
  return nodo;
}

function textoVacio(valor) {
  return !valor || !String(valor).trim();
}

export function segmentado({ opciones, valor, onCambio, etiqueta = null, clase = "" }) {
  const nodo = el("div", {
    class: `segmentado ${clase}`.trim(),
    role: "group",
    "aria-label": etiqueta || "Opciones",
  });
  const botones = new Map();
  const definir = (nuevo, emitir = false) => {
    botones.forEach((b, v) => b.setAttribute("aria-pressed", String(v === nuevo)));
    if (emitir && onCambio) onCambio(nuevo);
  };
  for (const opcion of opciones) {
    const [v, texto] = Array.isArray(opcion) ? opcion : [opcion.valor, opcion.texto];
    const b = el("button", {
      class: "segmentado__opcion",
      type: "button",
      "aria-pressed": String(v === valor),
      onClick: () => definir(v, true),
    }, texto);
    botones.set(v, b);
    nodo.append(b);
  }
  nodo.definir = definir;
  return nodo;
}

export function pestanas({ opciones, valor, onCambio, etiqueta = "Secciones", panel = null }) {
  const nodo = el("div", { class: "pestanas", role: "tablist", "aria-label": etiqueta });
  const botones = new Map();
  const base = uid("pestana");
  const definir = (nuevo, emitir = false) => {
    botones.forEach((b, v) => {
      const activa = v === nuevo;
      b.setAttribute("aria-selected", String(activa));
      b.tabIndex = activa ? 0 : -1; // foco itinerante: Tab entra en la pestaña activa
      if (activa && panel) panel.setAttribute("aria-labelledby", b.id);
    });
    if (emitir && onCambio) onCambio(nuevo);
  };
  if (panel) {
    if (!panel.id) panel.id = `${base}-panel`;
    panel.setAttribute("role", "tabpanel");
    if (!panel.hasAttribute("tabindex")) panel.tabIndex = 0;
  }
  for (const [v, texto] of opciones) {
    const b = el(
      "button",
      {
        class: "pestana",
        type: "button",
        role: "tab",
        id: `${base}-${botones.size}`,
        "aria-selected": String(v === valor),
        "aria-controls": panel ? panel.id : null,
        onClick: () => definir(v, true),
      },
      texto
    );
    botones.set(v, b);
    nodo.append(b);
  }
  // Patrón de pestañas WAI-ARIA: flechas, Inicio y Fin mueven y activan.
  nodo.addEventListener("keydown", (evento) => {
    const claves = [...botones.keys()];
    const actual = claves.findIndex((v) => botones.get(v) === document.activeElement);
    if (actual < 0) return;
    let destino = actual;
    if (evento.key === "ArrowRight" || evento.key === "ArrowDown") destino = (actual + 1) % claves.length;
    else if (evento.key === "ArrowLeft" || evento.key === "ArrowUp") destino = (actual - 1 + claves.length) % claves.length;
    else if (evento.key === "Home") destino = 0;
    else if (evento.key === "End") destino = claves.length - 1;
    else return;
    evento.preventDefault();
    definir(claves[destino], true);
    botones.get(claves[destino]).focus();
  });
  definir(valor);
  nodo.definir = definir;
  return nodo;
}

export function chips(items, { onClick = null, tono = "" } = {}) {
  return el(
    "div",
    { class: "chips" },
    items.map((item) => {
      const [texto, valor] = Array.isArray(item) ? item : [item, item];
      const nodo = el(
        onClick ? "button" : "span",
        {
          class: `chip ${tono ? `chip--${tono}` : ""}`.trim(),
          type: onClick ? "button" : null,
          onClick: onClick ? () => onClick(valor, texto) : null,
        },
        texto
      );
      return nodo;
    })
  );
}

/* ------------------------------------------------------------------ */
/* Tablas                                                              */
/* ------------------------------------------------------------------ */

function esNumerico(valor) {
  return typeof valor === "number" || (typeof valor === "string" && /^-?\d+([.,]\d+)?([eE][+-]?\d+)?$/.test(valor.trim()));
}

function formatoCelda(valor, columna, formatos) {
  if (formatos[columna]) return formatos[columna](valor);
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (/^p([\s_-]|$)|p[-_ ]?valor|p-value/i.test(columna)) return fmtP(valor);
  if (esNumerico(valor)) return fmtNum(valor);
  return String(valor);
}

export function tabla({
  columnas = [],
  filas = [],
  total = null,
  truncada = false,
  titulo = null,
  nota = null,
  formatos = {},
  maximo = 400,
  altura = null,
  acciones = null,
  numericas = null,
  clase = "",
} = {}) {
  const bloque = el("div", { class: `tabla-bloque ${clase}`.trim() });
  const filasVista = filas.slice(0, maximo);
  const totalReal = total ?? filas.length;
  const columnasNum = new Set();
  if (numericas) {
    numericas.forEach((c) => columnasNum.add(c));
  } else {
    columnas.forEach((col, i) => {
      const muestra = filasVista.slice(0, 18).map((f) => f[i]).filter((v) => v !== null && v !== undefined && v !== "");
      if (muestra.length && muestra.every(esNumerico) && !/^p([\s_-]|$)|p[-_ ]?valor/i.test(col)) {
        columnasNum.add(col);
      }
    });
  }

  const cabecera = el("div", { class: "tabla-cabecera" });
  if (titulo || totalReal || acciones) {
    cabecera.append(
      el(
        "div",
        { class: "fila", style: { gap: "8px" } },
        titulo ? el("span", { class: "tabla-titulo" }, titulo) : null,
        el("span", { class: "chip" }, `${fmtNum(totalReal, { entero: true })} fila${totalReal === 1 ? "" : "s"}`),
        truncada || totalReal > filasVista.length
          ? el("span", { class: "chip chip--aviso" }, `vista de ${filasVista.length}`)
          : null
      )
    );
  }
  if (acciones || filasVista.length) {
    const grupo = el("div", { class: "fila", style: { gap: "6px" } });
    if (acciones) agregar(grupo, [acciones]);
    if (filasVista.length) {
      grupo.append(
        boton("Copiar", {
          variante: "fantasma",
          pequeno: true,
          icono: "copiar",
          onClick: () => {
            const texto = [columnas, ...filasVista]
              .map((fila) => fila.map((c) => (c === null || c === undefined ? "" : String(c))).join("\t"))
              .join("\n");
            copiar(texto);
          },
        })
      );
    }
    cabecera.append(grupo);
  }
  if (cabecera.childElementCount) bloque.append(cabecera);

  if (!columnas.length || !filasVista.length) {
    bloque.append(el("div", { class: "tabla-vacia" }, "No hay filas para mostrar con los parámetros actuales."));
    return bloque;
  }

  const scroll = el("div", { class: `tabla-scroll ${altura === "alta" ? "tabla-scroll--alta" : ""}`.trim() });
  const tablaNodo = el("table");
  const thead = el("thead");
  const filaCabecera = el("tr");
  columnas.forEach((col) => {
    filaCabecera.append(el("th", { class: columnasNum.has(col) ? "num" : "", scope: "col" }, String(col)));
  });
  thead.append(filaCabecera);
  const tbody = el("tbody");
  for (const fila of filasVista) {
    const tr = el("tr");
    columnas.forEach((col, i) => {
      const valor = fila[i];
      const td = el(
        "td",
        { class: columnasNum.has(col) ? "num" : "" },
        formatoCelda(valor, col, formatos)
      );
      if (typeof valor === "string" && valor === "∞") td.title = "Valor infinito";
      tr.append(td);
    });
    tbody.append(tr);
  }
  tablaNodo.append(thead, tbody);
  scroll.append(tablaNodo);
  bloque.append(scroll);
  if (nota || totalReal > filasVista.length) {
    bloque.append(
      el(
        "p",
        { class: "tabla-nota" },
        nota || `Se muestran las primeras ${filasVista.length} de ${fmtNum(totalReal, { entero: true })} filas. Exporta a Excel o CSV para ver todas.`
      )
    );
  }
  return bloque;
}

/* ------------------------------------------------------------------ */
/* Estados, alertas, esqueletos                                        */
/* ------------------------------------------------------------------ */

export function alerta({ tipo = "info", titulo = null, texto = null, acciones = null, icono: nombreIcono = null } = {}) {
  const iconos = { error: "alerta", aviso: "alerta", ok: "circulo-check", info: "info" };
  return el(
    "div",
    { class: `alerta alerta--${tipo}`, role: tipo === "error" ? "alert" : "status" },
    el("span", { class: "alerta__icono" }, icono(nombreIcono || iconos[tipo] || "info", { tamano: 16 })),
    el(
      "div",
      { class: "crecer" },
      titulo ? el("strong", { class: "alerta__titulo" }, titulo) : null,
      texto ? el("div", {}, texto) : null,
      acciones ? el("div", { class: "alerta__acciones" }, acciones) : null
    )
  );
}

export function estadoVacio({ titulo, texto, icono: nombreIcono = "chispa", acciones = null } = {}) {
  return el(
    "div",
    { class: "estado-vacio" },
    el("div", { class: "estado-vacio__icono" }, icono(nombreIcono, { tamano: 24 })),
    el("p", { class: "estado-vacio__titulo" }, titulo || "Aún no hay resultados"),
    texto ? el("p", { class: "estado-vacio__texto" }, texto) : null,
    acciones ? el("div", { class: "estado-vacio__acciones" }, acciones) : null
  );
}

export function esqueletoPanel(host, filas = 1) {
  limpiar(host);
  for (let i = 0; i < filas; i++) host.append(el("div", { class: "esqueleto esqueleto--panel" }));
  return host;
}

export function pliegue({ titulo, contenido, abierto = false, icono: nombreIcono = null }) {
  const details = el("details", { class: "pliegue", open: abierto });
  details.append(
    el(
      "summary",
      { class: "pliegue__resumen" },
      nombreIcono ? icono(nombreIcono, { tamano: 15 }) : null,
      el("span", {}, titulo)
    ),
    el("div", { class: "pliegue__cuerpo" }, contenido)
  );
  return details;
}

/* ------------------------------------------------------------------ */
/* Avisos flotantes                                                    */
/* ------------------------------------------------------------------ */

const ICONOS_TOAST = { ok: "circulo-check", error: "alerta", aviso: "alerta", info: "info" };

export function toast(mensaje, { tipo = "info", duracion = 4600, acciones = null } = {}) {
  const raiz = document.getElementById("avisos");
  if (!raiz) return;
  while (raiz.childElementCount >= 4) raiz.firstElementChild.remove();
  const nodo = el(
    "div",
    { class: "toast", "data-tipo": tipo, role: tipo === "error" ? "alert" : "status" },
    el("span", { class: "toast__icono" }, icono(ICONOS_TOAST[tipo] || "info", { tamano: 16 })),
    el(
      "div",
      { class: "toast__texto" },
      el("div", {}, mensaje),
      acciones ? el("div", { class: "fila", style: { marginTop: "6px", gap: "6px" } }, acciones) : null
    ),
    el(
      "button",
      {
        class: "toast__cerrar",
        type: "button",
        "aria-label": "Cerrar aviso",
        onClick: () => cerrar(),
      },
      "×"
    )
  );
  let temporizador = null;
  const cerrar = () => {
    if (!nodo.isConnected) return;
    clearTimeout(temporizador);
    nodo.dataset.saliendo = "true";
    setTimeout(() => nodo.remove(), 180);
  };
  nodo.addEventListener("mouseenter", () => clearTimeout(temporizador));
  nodo.addEventListener("mouseleave", () => {
    temporizador = setTimeout(cerrar, 1600);
  });
  raiz.append(nodo);
  temporizador = setTimeout(cerrar, duracion);
  return { cerrar };
}

export function anunciar(texto) {
  const region = document.getElementById("anuncio");
  if (region) {
    region.textContent = "";
    setTimeout(() => {
      region.textContent = texto;
    }, 30);
  }
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

export function modal({
  titulo,
  subtitulo = null,
  contenido,
  acciones = [],
  ancho = false,
  clase = "",
  alCerrar = null,
  posicionArriba = false,
} = {}) {
  const previo = document.activeElement;
  const dialogo = el("dialog", {
    class: `modal ${ancho ? "modal--ancho" : ""} ${posicionArriba ? "modal--paleta" : ""} ${clase}`.trim(),
    "aria-labelledby": `modal-titulo-${++contadorId}`,
  });
  const idTitulo = dialogo.getAttribute("aria-labelledby");
  const cabecera = el(
    "header",
    { class: "modal__cabecera" },
    el(
      "div",
      {},
      el("h2", { class: "modal__titulo", id: idTitulo }, titulo || "Diálogo"),
      subtitulo ? el("p", { class: "modal__subtitulo" }, subtitulo) : null
    ),
    iconoBoton("cerrar", { etiqueta: "Cerrar", onClick: () => cerrar() })
  );
  const cuerpo = el("div", { class: "modal__cuerpo" }, contenido);
  dialogo.append(cabecera, cuerpo);
  if (acciones && acciones.length) {
    const pie = el("footer", { class: "modal__pie" });
    for (const accion of acciones) {
      const b = boton(accion.texto, {
        variante: accion.variante || "secundario",
        icono: accion.icono || null,
        onClick: async () => {
          if (accion.onClick) {
            const resultado = await accion.onClick({ dialogo, cerrar });
            if (resultado === false) return;
          }
          if (accion.cerrar !== false) cerrar();
        },
      });
      pie.append(b);
    }
    dialogo.append(pie);
  }
  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    if (dialogo.open) dialogo.close();
    dialogo.remove();
    if (previo && previo.isConnected && typeof previo.focus === "function") {
      setTimeout(() => previo.focus(), 30);
    }
    if (alCerrar) alCerrar();
  };
  dialogo.addEventListener("close", () => {
    if (!cerrado) {
      cerrado = true;
      dialogo.remove();
      if (previo && previo.isConnected) setTimeout(() => previo.focus(), 30);
      if (alCerrar) alCerrar();
    }
  });
  dialogo.addEventListener("click", (evento) => {
    const rect = dialogo.getBoundingClientRect();
    const fuera =
      evento.clientX < rect.left ||
      evento.clientX > rect.right ||
      evento.clientY < rect.top ||
      evento.clientY > rect.bottom;
    if (fuera) cerrar();
  });
  (document.getElementById("raiz-modal") || document.body).append(dialogo);
  dialogo.showModal();
  setTimeout(() => {
    const enfocable = cuerpo.querySelector("input:not([type=hidden]), textarea, select, button");
    (enfocable || cabecera.querySelector("button"))?.focus();
  }, 40);
  return { dialogo, cuerpo, cerrar };
}

export function confirmar({ titulo = "¿Confirmar acción?", texto = "", confirmar: textoBoton = "Confirmar", peligro = false } = {}) {
  return new Promise((resolver) => {
    let decidido = false;
    const d = modal({
      titulo,
      contenido: el("p", { style: { fontSize: "0.86rem", lineHeight: "1.55" } }, texto),
      acciones: [
        { texto: "Cancelar", variante: "secundario", onClick: () => resolver(false) },
        {
          texto: textoBoton,
          variante: peligro ? "peligro" : "primario",
          onClick: () => {
            decidido = true;
            resolver(true);
          },
        },
      ],
      alCerrar: () => {
        if (!decidido) resolver(false);
      },
    });
    return d;
  });
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

export async function copiar(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
    } else {
      const area = el("textarea", { style: { position: "fixed", opacity: "0" } });
      area.value = texto;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast("Copiado al portapapeles", { tipo: "ok", duracion: 2200 });
    return true;
  } catch {
    toast("No se pudo copiar. Selecciona el texto manualmente.", { tipo: "error" });
    return false;
  }
}

export function debounce(fn, ms = 300) {
  let t = null;
  const envuelta = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  envuelta.cancelar = () => clearTimeout(t);
  return envuelta;
}

export function throttle(fn, ms = 120) {
  let ultimo = 0;
  let temporizador = null;
  return (...args) => {
    const ahora = Date.now();
    const restante = ms - (ahora - ultimo);
    if (restante <= 0) {
      clearTimeout(temporizador);
      ultimo = ahora;
      fn(...args);
    } else if (!temporizador) {
      temporizador = setTimeout(() => {
        ultimo = Date.now();
        temporizador = null;
        fn(...args);
      }, restante);
    }
  };
}

export function descargarTexto(nombre, contenido, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = el("a", { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function resaltar(texto, consulta) {
  const frag = document.createDocumentFragment();
  if (!consulta) {
    frag.append(texto);
    return frag;
  }
  const normalizado = (s) => s.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = normalizado(texto);
  const busca = normalizado(consulta);
  let indice = 0;
  let pos = base.indexOf(busca);
  while (pos !== -1 && busca.length) {
    if (pos > indice) frag.append(texto.slice(indice, pos));
    const marca = el("mark", {}, texto.slice(pos, pos + busca.length));
    frag.append(marca);
    indice = pos + busca.length;
    pos = base.indexOf(busca, indice);
  }
  frag.append(texto.slice(indice));
  return frag;
}

export function bytesLegibles(bytes) {
  if (!bytes) return "0 B";
  const unidades = ["B", "KB", "MB", "GB"];
  const i = Math.min(unidades.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${unidades[i]}`;
}

export async function conCarga(botonNodo, tarea) {
  botonNodo.cargando?.(true);
  try {
    return await tarea();
  } finally {
    botonNodo.cargando?.(false);
  }
}

export function csrfNoAplica() {
  return true;
}

/**
 * Convierte texto con marcas mínimas (negritas, código, $matemáticas$) en un
 * nodo seguro. El HTML se escapa antes de aplicar el formato permitido.
 */
export function textoMatematico(texto) {
  const nodo = el("div");
  const seguro = escaparHtml(texto || "")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  nodo.innerHTML = seguro;
  renderMath(nodo);
  return nodo;
}
