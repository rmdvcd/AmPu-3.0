/**
 * Gestor de ventanas emergentes arrastrables y redimensionables dentro del navegador.
 * Permite mostrar resultados, gráficos, tablas, fichas y lecciones de teoría
 * en paralelo, sin perder el cálculo activo ni bloquear los controles del formulario.
 */

import { el, agregar, renderMath, anunciar } from "./ui.js";
import { icono } from "./icons.js";

const TAMANOS_TIPO = {
  resultados: { ancho: 740, alto: 560 },
  grafico: { ancho: 780, alto: 540 },
  tabla: { ancho: 800, alto: 540 },
  teoria: { ancho: 840, alto: 620 },
  ficha: { ancho: 680, alto: 540 },
};

const BORDES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const Z_BASE = 62;

const registros = new Map();
let ordenZ = [];
let seq = 0;
let listenerResizeConectado = false;

function clamp(valor, minimo, maximo) {
  if (maximo < minimo) return minimo;
  return Math.max(minimo, Math.min(maximo, valor));
}

function capaVentanas() {
  let capa = document.getElementById("capa-ventanas");
  if (!capa) {
    capa = el("div", { id: "capa-ventanas", class: "capa-ventanas", "aria-live": "off" });
    document.body.append(capa);
  }
  return capa;
}

function barraDock() {
  let barra = document.getElementById("barra-ventanas");
  if (!barra) {
    barra = el("nav", { id: "barra-ventanas", class: "barra-ventanas", hidden: true, "aria-label": "Ventanas emergentes abiertas" });
    document.body.append(barra);
  }
  return barra;
}

function espacioSeguro() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const movil = vw <= 900;
  const sidebar = document.getElementById("sidebar");
  let xMin = 12;
  if (!movil && sidebar && !sidebar.inert) {
    const rect = sidebar.getBoundingClientRect();
    if (rect.width > 40 && rect.right < vw - 300) {
      xMin = Math.round(rect.right) + 12;
    }
  }
  const yMin = vh >= 500 ? 64 : 12;
  const availW = Math.max(280, vw - xMin - 12);
  const availH = Math.max(200, vh - yMin - 18);
  return { vw, vh, movil, xMin, yMin, availW, availH };
}

function calcularCajaInicial(tipo, { ancho, alto } = {}) {
  const { vw, vh, xMin, yMin, availW, availH } = espacioSeguro();
  const base = TAMANOS_TIPO[tipo] || TAMANOS_TIPO.resultados;
  const wPref = ancho || base.ancho;
  const hPref = alto || base.alto;

  if (vw <= 680) {
    const w = Math.max(280, vw - 16);
    const h = clamp(hPref, 240, vh - 76);
    const left = 8;
    const top = clamp(yMin, 8, vh - h - 8);
    return { left, top, width: w, height: h };
  }

  const width = clamp(wPref, Math.min(340, availW), availW);
  const height = clamp(hPref, Math.min(240, availH), availH);

  const visibles = ordenZ
    .map((id) => registros.get(id))
    .filter((r) => r && !r.minimizada);

  let left = xMin + Math.round((availW - width) / 2);
  let top = yMin + Math.round((availH - height) / 2);

  if (visibles.length > 0) {
    const paso = visibles.length % 5;
    const dx = paso * 34;
    const dy = paso * 28;
    left = clamp(left + dx, xMin, vw - width - 10);
    top = clamp(top + dy, yMin, vh - height - 14);
  }

  return { left, top, width, height };
}

function aplicarCaja(nodo, caja) {
  nodo.style.left = `${Math.round(caja.left)}px`;
  nodo.style.top = `${Math.round(caja.top)}px`;
  nodo.style.width = `${Math.round(caja.width)}px`;
  nodo.style.height = `${Math.round(caja.height)}px`;
}

function cajaMaximizada() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const barra = barraDock();
  const reservaInferior = barra && !barra.hidden ? 66 : 12;
  const top = vw <= 680 ? 8 : 10;
  const left = vw <= 680 ? 8 : 10;
  return {
    left,
    top,
    width: Math.max(280, vw - left * 2),
    height: Math.max(220, vh - top - reservaInferior),
  };
}

export function desconectarGraficos(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll(".grafico").forEach((nodo) => {
    nodo._observadorGrafico?.disconnect();
  });
}

function actualizarZ() {
  const activaId = [...ordenZ].reverse().find((id) => {
    const r = registros.get(id);
    return r && !r.minimizada;
  });
  ordenZ.forEach((id, idx) => {
    const r = registros.get(id);
    if (!r) return;
    r.nodo.style.zIndex = String(Z_BASE + idx);
    r.nodo.classList.toggle("ventana--activa", id === activaId);
  });
}

function actualizarDock() {
  const barra = barraDock();
  const abiertas = ordenZ.map((id) => registros.get(id)).filter(Boolean);
  const hayMinimizadas = abiertas.some((r) => r.minimizada);
  if (!hayMinimizadas && abiertas.length < 2) {
    barra.hidden = true;
    barra.replaceChildren();
    return;
  }
  const activaId = [...ordenZ].reverse().find((id) => {
    const r = registros.get(id);
    return r && !r.minimizada;
  });

  const botones = abiertas.map((r) =>
    el(
      "button",
      {
        type: "button",
        class: `barra-ventanas__item ${r.id === activaId ? "barra-ventanas__item--activa" : ""} ${r.minimizada ? "barra-ventanas__item--minimizada" : ""}`.trim(),
        "aria-pressed": String(!r.minimizada && r.id === activaId),
        title: r.minimizada ? `Restaurar «${r.titulo}»` : `Enfocar «${r.titulo}»`,
        onClick: () => {
          if (r.minimizada) restaurarVentana(r.id);
          else if (r.id === activaId && abiertas.length >= 1) minimizarVentana(r.id);
          else enfocarVentana(r.id);
        },
      },
      icono(r.icono || "ventanas", { tamano: 14 }),
      el("span", { class: "barra-ventanas__texto" }, r.tituloCorto || r.titulo)
    )
  );

  const visibles = abiertas.filter((r) => !r.minimizada);
  const acciones = [];
  if (visibles.length >= 2) {
    acciones.push(
      el(
        "button",
        {
          type: "button",
          class: "barra-ventanas__accion",
          title: "Organizar ventanas en cascada",
          onClick: () => organizarCascada(),
        },
        icono("ventanas", { tamano: 14 }),
        el("span", {}, "Cascada")
      )
    );
  }
  acciones.push(
    el(
      "button",
      {
        type: "button",
        class: "barra-ventanas__accion barra-ventanas__accion--cerrar",
        title: "Cerrar todas las ventanas",
        onClick: () => cerrarTodasVentanas(),
      },
      icono("cerrar", { tamano: 13 }),
      el("span", {}, "Cerrar todas")
    )
  );

  barra.replaceChildren(
    el("div", { class: "barra-ventanas__lista" }, botones),
    el("div", { class: "barra-ventanas__acciones" }, acciones)
  );
  barra.hidden = false;
}

function reajustarAlViewport() {
  const { vw, vh } = espacioSeguro();
  for (const r of registros.values()) {
    if (r.minimizada) continue;
    if (r.maximizada) {
      aplicarCaja(r.nodo, cajaMaximizada());
      continue;
    }
    const maxW = Math.max(280, vw - 16);
    const maxH = Math.max(200, vh - 20);
    const width = Math.min(r.cajaNormal.width, maxW);
    const height = Math.min(r.cajaNormal.height, maxH);
    const left = clamp(r.cajaNormal.left, -(width - 140), vw - 140);
    const top = clamp(r.cajaNormal.top, 8, vh - 52);
    r.cajaNormal = { left, top, width, height };
    aplicarCaja(r.nodo, r.cajaNormal);
  }
}

function asegurarListenerResize() {
  if (listenerResizeConectado) return;
  listenerResizeConectado = true;
  window.addEventListener("resize", reajustarAlViewport);
}

export function enfocarVentana(id) {
  const r = registros.get(id);
  if (!r) return false;
  if (r.minimizada) {
    r.minimizada = false;
    r.nodo.hidden = false;
  }
  ordenZ = ordenZ.filter((x) => x !== id);
  ordenZ.push(id);
  actualizarZ();
  actualizarDock();
  return true;
}

export function minimizarVentana(id) {
  const r = registros.get(id);
  if (!r || r.minimizada) return false;
  r.minimizada = true;
  r.nodo.hidden = true;
  actualizarZ();
  actualizarDock();
  anunciar(`Ventana «${r.titulo}» minimizada.`);
  return true;
}

export function restaurarVentana(id) {
  const r = registros.get(id);
  if (!r) return false;
  r.minimizada = false;
  r.nodo.hidden = false;
  enfocarVentana(id);
  r.nodo.focus({ preventScroll: true });
  anunciar(`Ventana «${r.titulo}» restaurada.`);
  return true;
}

export function alternarMaximizarVentana(id) {
  const r = registros.get(id);
  if (!r) return false;
  if (r.minimizada) restaurarVentana(id);
  r.maximizada = !r.maximizada;
  r.nodo.dataset.maximizada = String(r.maximizada);
  if (r.maximizada) {
    aplicarCaja(r.nodo, cajaMaximizada());
    r.btnMax.setAttribute("aria-label", "Restaurar tamaño");
    r.btnMax.title = "Restaurar tamaño";
    r.btnMax.replaceChildren(icono("restaurar", { tamano: 14 }));
  } else {
    aplicarCaja(r.nodo, r.cajaNormal);
    reajustarAlViewport();
    r.btnMax.setAttribute("aria-label", "Maximizar ventana");
    r.btnMax.title = "Maximizar ventana";
    r.btnMax.replaceChildren(icono("maximizar", { tamano: 14 }));
  }
  return true;
}

export function organizarCascada() {
  const { vw, vh, xMin, yMin, availW, availH } = espacioSeguro();
  const lista = ordenZ.map((id) => registros.get(id)).filter((r) => r && !r.minimizada);
  lista.forEach((r, idx) => {
    if (r.maximizada) alternarMaximizarVentana(r.id);
    const width = clamp(r.cajaNormal.width, Math.min(340, availW), availW);
    const height = clamp(r.cajaNormal.height, Math.min(240, availH), availH);
    const baseLeft = xMin + Math.round(Math.max(0, (availW - width) / 2 - 48));
    const baseTop = yMin + Math.round(Math.max(0, (availH - height) / 2 - 36));
    const paso = idx % 5;
    const left = clamp(baseLeft + paso * 32, xMin, vw - width - 10);
    const top = clamp(baseTop + paso * 28, yMin, vh - height - 20);
    r.cajaNormal = { left, top, width, height };
    aplicarCaja(r.nodo, r.cajaNormal);
  });
}

export function cerrarVentana(id, { silencioso = false } = {}) {
  const r = registros.get(id);
  if (!r) return false;
  const teniaFoco = r.nodo.contains(document.activeElement);
  desconectarGraficos(r.cuerpo);
  registros.delete(id);
  ordenZ = ordenZ.filter((x) => x !== id);
  r.nodo.remove();
  actualizarZ();
  actualizarDock();
  if (teniaFoco) {
    const siguienteId = [...ordenZ].reverse().find((x) => !registros.get(x)?.minimizada);
    if (siguienteId) {
      registros.get(siguienteId).nodo.focus({ preventScroll: true });
    } else if (r.previo?.isConnected && typeof r.previo.focus === "function") {
      r.previo.focus({ preventScroll: true });
    }
  }
  if (typeof r.alCerrar === "function") {
    try {
      r.alCerrar();
    } catch {
      /* el cierre no debe romper el gestor */
    }
  }
  if (!silencioso) anunciar(`Ventana «${r.titulo}» cerrada.`);
  return true;
}

export function cerrarVentanaSuperior() {
  const activaId = [...ordenZ].reverse().find((id) => {
    const r = registros.get(id);
    return r && !r.minimizada;
  });
  if (!activaId) return false;
  return cerrarVentana(activaId);
}

export function cerrarVentanasPorAlcance(alcance = "vista") {
  for (const [id, r] of [...registros.entries()]) {
    if (r.alcance === alcance) cerrarVentana(id, { silencioso: true });
  }
}

export function cerrarTodasVentanas() {
  for (const id of [...registros.keys()]) {
    cerrarVentana(id, { silencioso: true });
  }
  anunciar("Todas las ventanas emergentes cerradas.");
}

export function ventanasAbiertas() {
  return ordenZ.map((id) => registros.get(id)).filter(Boolean);
}

/**
 * Abre una ventana emergente arrastrable y redimensionable (o actualiza la existente con el mismo `id`).
 */
export function abrirVentana({
  id = null,
  titulo = "Ventana",
  tituloCorto = null,
  subtitulo = null,
  icono: nombreIcono = "ventanas",
  tipo = "resultados",
  alcance = "vista",
  contenido = null,
  pie = null,
  accionesCabecera = null,
  ancho = null,
  alto = null,
  minAncho = 340,
  minAlto = 220,
  alCerrar = null,
  enfocar = true,
} = {}) {
  asegurarListenerResize();
  const idFinal = id || `ventana-${++seq}`;
  const previo = document.activeElement;

  const existente = registros.get(idFinal);
  if (existente) {
    existente.titulo = titulo;
    existente.tituloCorto = tituloCorto || titulo;
    existente.alCerrar = alCerrar;
    existente.alcance = alcance;
    existente.tituloNodo.textContent = titulo;
    if (subtitulo) {
      existente.subtituloNodo.textContent = subtitulo;
      existente.subtituloNodo.hidden = false;
    } else {
      existente.subtituloNodo.textContent = "";
      existente.subtituloNodo.hidden = true;
    }
    if (nombreIcono) {
      existente.icono = nombreIcono;
      existente.iconoNodo.replaceChildren(icono(nombreIcono, { tamano: 16 }));
    }
    existente.accionesCabecera.replaceChildren();
    if (accionesCabecera) agregar(existente.accionesCabecera, Array.isArray(accionesCabecera) ? accionesCabecera : [accionesCabecera]);
    desconectarGraficos(existente.cuerpo);
    existente.cuerpo.replaceChildren();
    if (contenido) agregar(existente.cuerpo, Array.isArray(contenido) ? contenido : [contenido]);
    existente.cuerpo.scrollTop = 0;
    existente.pie.replaceChildren();
    if (pie && (!Array.isArray(pie) || pie.length)) {
      agregar(existente.pie, Array.isArray(pie) ? pie : [pie]);
      existente.pie.hidden = false;
    } else {
      existente.pie.hidden = true;
    }
    renderMath(existente.cuerpo);
    if (enfocar) {
      enfocarVentana(idFinal);
      existente.nodo.focus({ preventScroll: true });
    } else {
      actualizarDock();
    }
    return existente.api;
  }

  const uidTitulo = `ventana-titulo-${++seq}`;
  const uidSubtitulo = `ventana-sub-${seq}`;
  const iconoNodo = el("span", { class: "ventana__icono" }, icono(nombreIcono, { tamano: 16 }));
  const tituloNodo = el("h2", { class: "ventana__titulo", id: uidTitulo }, titulo);
  const subtituloNodo = el("p", { class: "ventana__subtitulo", id: uidSubtitulo, hidden: !subtitulo }, subtitulo || "");
  const accionesCabeceraNodo = el("div", { class: "ventana__cabecera-acciones", "data-no-arrastre": "true" });
  if (accionesCabecera) agregar(accionesCabeceraNodo, Array.isArray(accionesCabecera) ? accionesCabecera : [accionesCabecera]);

  const btnMin = el("button", {
    type: "button",
    class: "ventana__btn",
    "aria-label": "Minimizar ventana",
    title: "Minimizar",
    onClick: () => minimizarVentana(idFinal),
  }, icono("minimizar", { tamano: 14 }));

  const btnMax = el("button", {
    type: "button",
    class: "ventana__btn",
    "aria-label": "Maximizar ventana",
    title: "Maximizar",
    onClick: () => alternarMaximizarVentana(idFinal),
  }, icono("maximizar", { tamano: 14 }));

  const btnCerrar = el("button", {
    type: "button",
    class: "ventana__btn ventana__btn--cerrar",
    "aria-label": "Cerrar ventana",
    title: "Cerrar (Esc)",
    onClick: () => cerrarVentana(idFinal),
  }, icono("cerrar", { tamano: 14 }));

  const barra = el(
    "header",
    { class: "ventana__barra" },
    el(
      "div",
      { class: "ventana__identidad" },
      iconoNodo,
      el("div", { class: "ventana__titulos" }, tituloNodo, subtituloNodo)
    ),
    el("div", { class: "ventana__controles", "data-no-arrastre": "true" }, accionesCabeceraNodo, btnMin, btnMax, btnCerrar)
  );

  const cuerpo = el("div", { class: "ventana__cuerpo" });
  if (contenido) agregar(cuerpo, Array.isArray(contenido) ? contenido : [contenido]);

  const pieNodo = el("div", { class: "ventana__pie", hidden: !pie || (Array.isArray(pie) && !pie.length) });
  if (pie && (!Array.isArray(pie) || pie.length)) {
    agregar(pieNodo, Array.isArray(pie) ? pie : [pie]);
  }

  const bordes = BORDES.map((dir) =>
    el("div", {
      class: `ventana__borde ventana__borde--${dir}`,
      "data-borde": dir,
      "aria-hidden": "true",
    }, dir === "se" ? el("span", { class: "ventana__agarre" }) : null)
  );

  const nodo = el(
    "section",
    {
      class: `ventana ventana--${tipo}`,
      role: "dialog",
      "aria-modal": "false",
      "aria-labelledby": uidTitulo,
      "aria-describedby": subtitulo ? uidSubtitulo : null,
      tabindex: "-1",
      dataset: { ventanaId: idFinal, tipo, maximizada: "false" },
    },
    barra,
    cuerpo,
    pieNodo,
    bordes
  );

  const cajaInicial = calcularCajaInicial(tipo, { ancho, alto });
  aplicarCaja(nodo, cajaInicial);

  const registro = {
    id: idFinal,
    titulo,
    tituloCorto: tituloCorto || titulo,
    icono: nombreIcono,
    tipo,
    alcance,
    nodo,
    barra,
    cuerpo,
    pie: pieNodo,
    iconoNodo,
    tituloNodo,
    subtituloNodo,
    accionesCabecera: accionesCabeceraNodo,
    btnMax,
    cajaNormal: { ...cajaInicial },
    maximizada: false,
    minimizada: false,
    alCerrar,
    previo,
    minAncho,
    minAlto,
    api: null,
  };

  registro.api = {
    id: idFinal,
    nodo,
    cuerpo,
    pie: pieNodo,
    cerrar: () => cerrarVentana(idFinal),
    enfocar: () => enfocarVentana(idFinal),
    minimizar: () => minimizarVentana(idFinal),
    restaurar: () => restaurarVentana(idFinal),
    alternarMaximizar: () => alternarMaximizarVentana(idFinal),
    actualizar: (nuevasOpts = {}) => abrirVentana({ ...nuevasOpts, id: idFinal }),
  };

  /* -------------------- Interacción: enfocar -------------------- */
  nodo.addEventListener("pointerdown", () => {
    if (ordenZ.at(-1) !== idFinal) enfocarVentana(idFinal);
  }, { capture: true });
  nodo.addEventListener("focusin", () => {
    if (ordenZ.at(-1) !== idFinal) enfocarVentana(idFinal);
  });

  /* -------------------- Interacción: arrastrar ------------------ */
  barra.addEventListener("dblclick", (evento) => {
    if (evento.target.closest("button, a, input, select, textarea, [data-no-arrastre]")) return;
    alternarMaximizarVentana(idFinal);
  });

  barra.addEventListener("pointerdown", (evento) => {
    if (evento.button !== 0) return;
    if (evento.target.closest("button, a, input, select, textarea, [data-no-arrastre]")) return;
    evento.preventDefault();
    enfocarVentana(idFinal);
    const startX = evento.clientX;
    const startY = evento.clientY;
    let origLeft = registro.cajaNormal.left;
    let origTop = registro.cajaNormal.top;
    let eraMax = registro.maximizada;
    let movida = false;
    let baseX = startX;
    let baseY = startY;

    barra.setPointerCapture?.(evento.pointerId);
    document.documentElement.classList.add("arrastrando-ventana");

    const alMover = (ev) => {
      const dx = ev.clientX - baseX;
      const dy = ev.clientY - baseY;
      if (!movida && Math.hypot(dx, dy) < 3) return;
      movida = true;
      const { vw, vh } = espacioSeguro();
      if (eraMax) {
        eraMax = false;
        registro.maximizada = false;
        nodo.dataset.maximizada = "false";
        btnMax.setAttribute("aria-label", "Maximizar ventana");
        btnMax.title = "Maximizar";
        btnMax.replaceChildren(icono("maximizar", { tamano: 14 }));
        const wRest = Math.min(registro.cajaNormal.width, vw - 16);
        const hRest = Math.min(registro.cajaNormal.height, vh - 24);
        origLeft = clamp(ev.clientX - Math.round(wRest / 2), 8, vw - wRest - 8);
        origTop = clamp(ev.clientY - 22, 8, vh - 56);
        registro.cajaNormal = { left: origLeft, top: origTop, width: wRest, height: hRest };
        baseX = ev.clientX;
        baseY = ev.clientY;
        aplicarCaja(nodo, registro.cajaNormal);
        return;
      }
      const w = registro.cajaNormal.width;
      const newLeft = clamp(origLeft + (ev.clientX - baseX), -(w - 140), vw - 140);
      const newTop = clamp(origTop + (ev.clientY - baseY), 8, vh - 52);
      registro.cajaNormal.left = newLeft;
      registro.cajaNormal.top = newTop;
      aplicarCaja(nodo, registro.cajaNormal);
    };

    const terminar = (ev) => {
      document.documentElement.classList.remove("arrastrando-ventana");
      barra.releasePointerCapture?.(ev.pointerId);
      barra.removeEventListener("pointermove", alMover);
      barra.removeEventListener("pointerup", terminar);
      barra.removeEventListener("pointercancel", terminar);
    };

    barra.addEventListener("pointermove", alMover);
    barra.addEventListener("pointerup", terminar);
    barra.addEventListener("pointercancel", terminar);
  });

  /* -------------------- Interacción: redimensionar -------------- */
  for (const borde of bordes) {
    borde.addEventListener("pointerdown", (evento) => {
      if (evento.button !== 0 || registro.maximizada) return;
      evento.preventDefault();
      evento.stopPropagation();
      enfocarVentana(idFinal);
      const dir = borde.dataset.borde;
      const startX = evento.clientX;
      const startY = evento.clientY;
      const start = { ...registro.cajaNormal };
      borde.setPointerCapture?.(evento.pointerId);
      document.documentElement.classList.add("redimensionando-ventana");

      const alMover = (ev) => {
        const { vw, vh } = espacioSeguro();
        const minW = Math.min(registro.minAncho, vw - 16);
        const minH = Math.min(registro.minAlto, vh - 16);
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let { left, top, width, height } = start;

        if (dir.includes("e")) {
          width = clamp(start.width + dx, minW, vw - start.left - 6);
        }
        if (dir.includes("s")) {
          height = clamp(start.height + dy, minH, vh - start.top - 6);
        }
        if (dir.includes("w")) {
          const maxLeft = start.left + start.width - minW;
          left = clamp(start.left + dx, 6, maxLeft);
          width = start.left + start.width - left;
        }
        if (dir.includes("n")) {
          const maxTop = start.top + start.height - minH;
          top = clamp(start.top + dy, 6, maxTop);
          height = start.top + start.height - top;
        }

        registro.cajaNormal = { left, top, width, height };
        aplicarCaja(nodo, registro.cajaNormal);
      };

      const terminar = (ev) => {
        document.documentElement.classList.remove("redimensionando-ventana");
        borde.releasePointerCapture?.(ev.pointerId);
        borde.removeEventListener("pointermove", alMover);
        borde.removeEventListener("pointerup", terminar);
        borde.removeEventListener("pointercancel", terminar);
      };

      borde.addEventListener("pointermove", alMover);
      borde.addEventListener("pointerup", terminar);
      borde.addEventListener("pointercancel", terminar);
    });
  }

  registros.set(idFinal, registro);
  ordenZ.push(idFinal);
  capaVentanas().append(nodo);
  renderMath(cuerpo);
  actualizarZ();
  actualizarDock();
  if (enfocar) nodo.focus({ preventScroll: true });
  anunciar(`Ventana «${titulo}» abierta.`);
  return registro.api;
}

/**
 * Barra compacta reutilizable dentro de las vistas principales para reabrir o enfocar
 * las ventanas emergentes del último cálculo sin tener que recalcular.
 */
export function barraResultados({ resumen, icono: nombreIcono = "objetivo", botones = [] } = {}) {
  return el(
    "div",
    { class: "barra-resultados" },
    el(
      "div",
      { class: "barra-resultados__estado" },
      icono(nombreIcono, { tamano: 15 }),
      el("span", {}, resumen || "Resultado listo en ventana emergente")
    ),
    el("div", { class: "barra-resultados__acciones" }, botones.filter(Boolean))
  );
}
