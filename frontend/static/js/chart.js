/**
 * Gráficos SVG propios: sin dependencias, accesibles y adaptados al tema.
 * Tipos: líneas/áreas, escalón, barras, dispersión y caja. Incluye tooltip,
 * leyenda interactiva, navegación por teclado, zoom/desplazamiento y una tabla
 * de datos equivalente.
 *
 * Accesibilidad: cada serie se distingue por color **y** por trazo (continuo,
 * rayas, puntos…) o por forma del marcador, de modo que el gráfico se lee
 * igual en escala de grises o con daltonismo.
 */

import { el, fmtNum, fmtCompacto, debounce } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const COLORES = ["var(--grafico-1)", "var(--grafico-2)", "var(--grafico-3)", "var(--grafico-4)", "var(--grafico-5)"];
/** Trazos por orden de serie: continuo, rayas, puntos, raya-punto, rayas largas. */
const TRAZOS = ["", "7 4", "2 4", "9 3 2 3", "14 4"];
const FORMAS = ["circulo", "cuadrado", "triangulo", "rombo"];
let contadorClip = 0;

function minMax(valores) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : [0, 1];
}

function tipoDeSerie(serie, cfg = {}) {
  return serie.tipo || ({ barras: "barra", lineas: "linea", linea: "linea", dispersion: "dispersion" }[cfg.tipo] || cfg.tipo || "linea");
}

function marcador(forma, cx, cy, r, attrs = {}) {
  if (forma === "cuadrado") return svg("rect", { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, ...attrs });
  if (forma === "triangulo") {
    const h = r * 1.25;
    return svg("path", { d: `M${cx} ${cy - h} L${cx + h} ${cy + h * 0.8} L${cx - h} ${cy + h * 0.8} Z`, ...attrs });
  }
  if (forma === "rombo") {
    const h = r * 1.3;
    return svg("path", { d: `M${cx} ${cy - h} L${cx + h} ${cy} L${cx} ${cy + h} L${cx - h} ${cy} Z`, ...attrs });
  }
  return svg("circle", { cx, cy, r, ...attrs });
}

/** Ruta en escalón (continua por la derecha), propia de una CDF discreta. */
function rutaEscalon(puntos) {
  let d = "";
  let previo = null;
  for (const [x, y] of puntos) {
    if (x === null || y === null) {
      previo = null;
      continue;
    }
    if (previo === null) d += `M${x.toFixed(2)} ${y.toFixed(2)} `;
    else d += `L${x.toFixed(2)} ${previo.toFixed(2)} L${x.toFixed(2)} ${y.toFixed(2)} `;
    previo = y;
  }
  return d.trim();
}

function svg(tag, attrs = {}) {
  const nodo = document.createElementNS(NS, tag);
  for (const [clave, valor] of Object.entries(attrs)) {
    if (valor === null || valor === undefined) continue;
    nodo.setAttribute(clave, String(valor));
  }
  return nodo;
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "string" && (valor === "∞" || valor === "−∞" || valor === "-∞")) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function extension(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, paso: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  if (min === max) {
    const margen = Math.abs(min) > 1 ? Math.abs(min) * 0.12 : 1;
    min -= margen;
    max += margen;
  }
  const bruto = (max - min) / maxTicks;
  const magnitud = 10 ** Math.floor(Math.log10(Math.abs(bruto) || 1));
  const normalizado = bruto / magnitud;
  let paso;
  if (normalizado <= 1) paso = 1;
  else if (normalizado <= 2) paso = 2;
  else if (normalizado <= 2.5) paso = 2.5;
  else if (normalizado <= 5) paso = 5;
  else paso = 10;
  paso *= magnitud;
  if (!(paso > 0) || !Number.isFinite(paso)) {
    return { min: 0, max: 1, paso: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  }
  const bajo = Math.floor(min / paso) * paso;
  const alto = Math.ceil(max / paso) * paso;
  const ticks = [];
  for (let v = bajo; v <= alto + paso * 1e-9 && ticks.length < 64; v += paso) {
    ticks.push(Number(v.toFixed(12)));
  }
  return { min: bajo, max: alto, paso, ticks };
}

function formatearEje(valor, formato) {
  if (formato) return formato(valor);
  const abs = Math.abs(valor);
  if (abs !== 0 && (abs < 0.001 || abs >= 100000)) return fmtCompacto(valor);
  return fmtNum(valor, { decimales: 2 });
}

function rutaLinea(puntos) {
  let d = "";
  let abierto = false;
  for (const [x, y] of puntos) {
    if (x === null || y === null) {
      abierto = false;
      continue;
    }
    d += `${abierto ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `;
    abierto = true;
  }
  return d.trim();
}

function puntosOrdenadosParaFuncion(puntos) {
  if (puntos.length < 2) return puntos.slice();
  let creciente = true;
  let decreciente = true;
  for (let k = 1; k < puntos.length; k++) {
    if (puntos[k].x < puntos[k - 1].x) creciente = false;
    if (puntos[k].x > puntos[k - 1].x) decreciente = false;
    if (!creciente && !decreciente) return null;
  }
  if (creciente) return puntos;
  const rev = puntos.slice().reverse();
  return rev.map((p, idx) => ({
    ...p,
    salto: idx > 0 ? Boolean(rev[idx - 1].salto) : false,
  }));
}

export function prepararSeries(cfg = {}) {
  const esCategorica = Array.isArray(cfg.categorias);
  const series = (cfg.series || [])
    .map((serie, i) => {
      const xs = Array.isArray(serie.x) ? serie.x : [];
      const ys = Array.isArray(serie.y) ? serie.y : [];
      const n = Math.min(xs.length, ys.length);
      const puntos = [];
      const porIndice = new Map();
      let huboSalto = false;
      for (let j = 0; j < n; j++) {
        const y = numero(ys[j]);
        const xNum = esCategorica ? j : numero(xs[j]);
        if (y === null || xNum === null) {
          huboSalto = true;
          continue;
        }
        const punto = {
          x: esCategorica ? xs[j] ?? cfg.categorias[j] ?? j : xNum,
          y,
          i: j,
          salto: puntos.length > 0 && huboSalto,
        };
        puntos.push(punto);
        porIndice.set(j, punto);
        huboSalto = false;
      }
      const nombre = serie.nombre || `Serie ${i + 1}`;
      return {
        ...serie,
        _clave: `${i}:${nombre}`,
        nombre,
        color: serie.color || COLORES[i % COLORES.length],
        trazo: serie.trazo ?? TRAZOS[i % TRAZOS.length],
        forma: serie.forma || FORMAS[i % FORMAS.length],
        puntos,
        porIndice,
        puntosX: esCategorica ? null : puntosOrdenadosParaFuncion(puntos),
        orden: i,
      };
    })
    .filter((s) => s.puntos.length);
  return series;
}

export function valorSerieEnX(serie, cfg, xObjetivo, { categorias = null, indiceCat = -1, tolX = 0 } = {}) {
  if (!serie || !serie.puntos.length) return null;
  if (categorias) {
    const p = serie.porIndice?.get(indiceCat);
    return p ? { x: indiceCat, y: p.y, exacto: true } : null;
  }
  if (!Number.isFinite(xObjetivo)) return null;

  const tipo = tipoDeSerie(serie, cfg);
  const eps = Math.max(1e-12, Math.abs(xObjetivo) * 1e-12);

  // Coincidencia exacta o punto más cercano.
  let cercano = null;
  let minDist = Infinity;
  if (serie.puntosX) {
    const arr = serie.puntosX;
    let lo = 0;
    let hi = arr.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].x <= xObjetivo) lo = mid + 1;
      else hi = mid - 1;
    }
    for (const idx of [hi, lo]) {
      if (idx >= 0 && idx < arr.length) {
        const d = Math.abs(arr[idx].x - xObjetivo);
        if (d < minDist) {
          minDist = d;
          cercano = arr[idx];
        }
      }
    }
  } else {
    for (const p of serie.puntos) {
      const d = Math.abs(p.x - xObjetivo);
      if (d < minDist) {
        minDist = d;
        cercano = p;
      }
    }
  }

  if (cercano && minDist <= eps) {
    return { x: cercano.x, y: cercano.y, exacto: true };
  }

  if (tipo === "linea" && serie.puntosX && serie.puntosX.length >= 2) {
    const arr = serie.puntosX;
    if (xObjetivo >= arr[0].x - eps && xObjetivo <= arr[arr.length - 1].x + eps) {
      let lo = 0;
      let hi = arr.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].x <= xObjetivo) lo = mid + 1;
        else hi = mid - 1;
      }
      const izq = arr[Math.max(0, hi)];
      const der = arr[Math.min(arr.length - 1, lo)];
      if (izq && der && !der.salto) {
        if (der.x <= izq.x) return { x: xObjetivo, y: izq.y, exacto: false };
        if (serie.escalon) return { x: xObjetivo, y: izq.y, exacto: false };
        const t = (xObjetivo - izq.x) / (der.x - izq.x);
        return { x: xObjetivo, y: izq.y + t * (der.y - izq.y), exacto: false };
      }
    }
  }

  if (tipo === "barra" && Number.isFinite(serie.anchoDatos) && serie.anchoDatos > 0) {
    if (cercano && minDist <= serie.anchoDatos / 2 + 1e-9) {
      return { x: cercano.x, y: cercano.y, exacto: true };
    }
    return null;
  }

  if (cercano && minDist <= tolX) {
    return { x: cercano.x, y: cercano.y, exacto: true };
  }
  return null;
}

/** Muestra de leyenda que reproduce el trazo o el marcador de la serie, no solo su color. */
function muestraLeyenda(serie, cfg) {
  const tipo = tipoDeSerie(serie, cfg);
  const nodo = svg("svg", { class: "leyenda__trazo", viewBox: "0 0 26 10", width: 26, height: 10, "aria-hidden": "true" });
  if (tipo === "barra") nodo.append(svg("rect", { x: 7, y: 1, width: 12, height: 8, rx: 1.5, fill: serie.color, opacity: 0.85 }));
  else if (tipo === "dispersion") nodo.append(marcador(serie.forma, 13, 5, 3.2, { fill: serie.color }));
  else nodo.append(svg("line", { x1: 1, x2: 25, y1: 5, y2: 5, stroke: serie.color, "stroke-width": 2.2, "stroke-dasharray": serie.trazo || null, "stroke-linecap": "round" }));
  return nodo;
}

export function resumenTabla(series, categorias = null, cfg = {}) {
  if (!series.length) return null;
  const columnas = ["x", ...series.map((s) => s.nombre)];
  const filas = [];
  const maxFilas = series.length > 3 ? 120 : 250;

  if (categorias) {
    const paso = Math.max(1, Math.floor(categorias.length / maxFilas));
    for (let i = 0; i < categorias.length; i += paso) {
      const fila = [categorias[i]];
      for (const s of series) {
        const p = s.porIndice?.get(i);
        fila.push(p ? p.y : null);
      }
      filas.push(fila);
    }
    return { columnas, filas };
  }

  const todosX = [];
  for (const s of series) {
    for (const p of s.puntos) todosX.push(p.x);
  }
  if (!todosX.length) return null;
  todosX.sort((a, b) => a - b);
  const [xMin, xMax] = [todosX[0], todosX[todosX.length - 1]];
  const eps = Math.max(1e-12, (xMax - xMin) * 1e-12);
  const unicos = [];
  for (const x of todosX) {
    if (!unicos.length || x - unicos[unicos.length - 1] > eps) unicos.push(x);
  }

  let xsTabla = unicos;
  if (unicos.length > maxFilas) {
    xsTabla = [];
    const paso = (unicos.length - 1) / (maxFilas - 1);
    for (let k = 0; k < maxFilas; k++) {
      xsTabla.push(unicos[Math.round(k * paso)]);
    }
  }

  for (const xVal of xsTabla) {
    const fila = [xVal];
    for (const s of series) {
      const res = valorSerieEnX(s, cfg, xVal, { tolX: eps });
      fila.push(res ? res.y : null);
    }
    filas.push(fila);
  }
  return { columnas, filas };
}

/**
 * Dibuja un gráfico.
 * @param {HTMLElement} host contenedor vacío
 * @param {object} cfg configuración
 */
export function dibujar(host, cfg = {}) {
  if (!host) return;
  host.replaceChildren();
  host.classList.add("grafico");
  const seriesTodas = prepararSeries(cfg);
  if (!seriesTodas.length) {
    host.append(
      el("div", { class: "estado-vacio", style: { padding: "28px 14px" } },
        el("p", { class: "estado-vacio__titulo" }, "Sin datos para dibujar"),
        el("p", { class: "estado-vacio__texto" }, "Ajusta los parámetros y vuelve a calcular."))
    );
    return;
  }

  const clavesValidas = new Set(seriesTodas.map((s) => s._clave));
  const firmaSeries = seriesTodas.map((s) => s._clave).join("|");
  let ocultas = host._seriesOcultas instanceof Set ? host._seriesOcultas : new Set();
  if (host._firmaSeries !== firmaSeries) {
    ocultas = new Set([...ocultas].filter((c) => clavesValidas.has(c)));
    host._firmaSeries = firmaSeries;
  }
  let visibles = seriesTodas.filter((s) => !ocultas.has(s._clave));
  if (!visibles.length) {
    ocultas = new Set();
    visibles = seriesTodas;
  }
  host._seriesOcultas = ocultas;

  const ancho = Math.max(300, Math.round(host.clientWidth || host.parentElement?.clientWidth || 680));
  const altura = Math.max(170, Number(cfg.altura) || 300);
  const margen = {
    arriba: cfg.titulo ? 26 : 16,
    derecha: 16,
    abajo: cfg.xlabel || cfg.categorias ? 44 : 30,
    izquierda: 58,
  };
  const anchoPlot = ancho - margen.izquierda - margen.derecha;
  const altoPlot = altura - margen.arriba - margen.abajo;

  const categorias = Array.isArray(cfg.categorias) ? cfg.categorias : null;
  let xMin;
  let xMax;
  if (categorias) {
    xMin = -0.5;
    xMax = Math.max(0.5, categorias.length - 0.5);
  } else {
    /* Las barras con anchura en unidades del eje (histogramas) ocupan medio ancho a cada lado. */
    const valoresX = [];
    for (const s of seriesTodas) {
      const medio = Number.isFinite(s.anchoDatos) && s.anchoDatos > 0 ? s.anchoDatos / 2 : 0;
      for (const p of s.puntos) {
        if (medio) {
          valoresX.push(p.x - medio, p.x + medio);
        } else {
          valoresX.push(p.x);
        }
      }
    }
    [xMin, xMax] = minMax(valoresX);
  }
  if (cfg.dominioX) {
    [xMin, xMax] = cfg.dominioX;
  }
  /* Zoom y desplazamiento: se conservan al conmutar la leyenda y se reinician si cambian los datos. */
  const xTotal = [xMin, xMax];
  const firmaDatos = `${xMin}|${xMax}|${seriesTodas.map((s) => `${s._clave}:${s.puntos.length}:${s.puntos[0]?.x}:${s.puntos.at(-1)?.x}`).join(",")}`;
  if (host._firmaVista !== firmaDatos) {
    host._vista = null;
    host._firmaVista = firmaDatos;
  }
  const conZoom = !categorias && cfg.zoom !== false && xMax > xMin;
  const ampliado = conZoom && Array.isArray(host._vista);
  if (ampliado) [xMin, xMax] = host._vista;
  const xExt = extension(xMin, xMax, categorias ? Math.min(8, categorias.length) : 6);
  if (categorias) {
    xExt.min = -0.5;
    xExt.max = categorias.length - 0.5;
  }
  if (ampliado) {
    xExt.min = xMin;
    xExt.max = xMax;
    xExt.ticks = xExt.ticks.filter((t) => t >= xMin && t <= xMax);
  }

  let valoresY = [];
  if (ampliado) {
    for (const s of visibles) {
      for (const p of s.puntos) {
        if (p.x >= xMin && p.x <= xMax) valoresY.push(p.y);
      }
      if (tipoDeSerie(s, cfg) === "linea" && s.puntosX) {
        const yIzq = valorSerieEnX(s, cfg, xMin, { tolX: 0 });
        const yDer = valorSerieEnX(s, cfg, xMax, { tolX: 0 });
        if (yIzq) valoresY.push(yIzq.y);
        if (yDer) valoresY.push(yDer.y);
      }
    }
  }
  if (!valoresY.length) {
    for (const s of visibles) {
      for (const p of s.puntos) valoresY.push(p.y);
    }
  }
  let [yMin, yMax] = minMax(valoresY);
  if (cfg.yCero) {
    yMin = Math.min(0, yMin);
    yMax = Math.max(0, yMax);
  }
  if (cfg.dominioY) [yMin, yMax] = cfg.dominioY;
  const yExt = extension(yMin, yMax, 5);

  const escX = (x) => margen.izquierda + ((x - xExt.min) / (xExt.max - xExt.min || 1)) * anchoPlot;
  const escY = (y) => margen.arriba + altoPlot - ((y - yExt.min) / (yExt.max - yExt.min || 1)) * altoPlot;

  const nodoSvg = svg("svg", {
    viewBox: `0 0 ${ancho} ${altura}`,
    role: "img",
    "aria-label": cfg.ariaLabel || cfg.titulo || "Gráfico de datos",
    tabindex: "0",
  });
  nodoSvg.append(svg("title", {}, cfg.titulo || "Gráfico de datos"));
  nodoSvg.append(svg("desc", {}, cfg.descripcion || "Gráfico generado con los datos del cálculo actual."));
  const g = svg("g");
  nodoSvg.append(g);
  const idClip = `ampu-clip-${++contadorClip}`;
  const clip = svg("clipPath", { id: idClip });
  clip.append(svg("rect", { x: margen.izquierda, y: margen.arriba - 2, width: anchoPlot, height: altoPlot + 4 }));
  nodoSvg.append(clip);
  /* Las series se recortan al área de dibujo (necesario al ampliar). */
  const gSeries = svg("g", { "clip-path": `url(#${idClip})` });
  const gFondos = svg("g");
  const gLineas = svg("g");
  const gPuntos = svg("g");
  gSeries.append(gFondos, gLineas, gPuntos);

  /* Regiones de rechazo o bandas destacadas */
  for (const region of cfg.regiones || []) {
    const desde = Math.max(xExt.min, region.desde ?? xExt.min);
    const hasta = Math.min(xExt.max, region.hasta ?? xExt.max);
    if (!(hasta > desde)) continue;
    const x = escX(desde);
    const w = Math.max(0, escX(hasta) - x);
    g.append(
      svg("rect", {
        class: "region",
        x,
        y: margen.arriba,
        width: w,
        height: altoPlot,
        fill: region.color || "var(--grafico-region)",
      })
    );
    if (region.etiqueta && w > 34) {
      const t = svg("text", {
        x: x + w / 2,
        y: margen.arriba + 12,
        "text-anchor": "middle",
        fill: region.colorTexto || "var(--grafico-5)",
        "font-size": "9.5",
        "font-weight": "600",
        opacity: "0.85",
      });
      t.textContent = region.etiqueta;
      g.append(t);
    }
  }

  /* Rejilla y eje Y */
  for (const tick of yExt.ticks) {
    const y = escY(tick);
    if (y < margen.arriba - 1 || y > margen.arriba + altoPlot + 1) continue;
    g.append(
      svg("line", {
        class: "rejilla-linea",
        x1: margen.izquierda,
        x2: margen.izquierda + anchoPlot,
        y1: y,
        y2: y,
      })
    );
    const texto = svg("text", {
      class: "eje-texto",
      x: margen.izquierda - 8,
      y: y + 3.5,
      "text-anchor": "end",
    });
    texto.textContent = formatearEje(tick, cfg.formatoY);
    g.append(texto);
  }

  /* Eje X */
  let ticksX;
  if (categorias) {
    const salto = Math.max(1, Math.ceil(categorias.length / 12));
    ticksX = categorias.map((c, i) => ({ valor: i, etiqueta: c })).filter((_, i) => i % salto === 0);
  } else {
    ticksX = xExt.ticks.map((v) => ({ valor: v, etiqueta: formatearEje(v, cfg.formatoX) }));
  }
  for (const tick of ticksX) {
    const x = escX(tick.valor);
    const texto = svg("text", {
      class: "eje-texto",
      x,
      y: margen.arriba + altoPlot + 16,
      "text-anchor": "middle",
    });
    texto.textContent = tick.etiqueta;
    g.append(texto);
  }
  g.append(
    svg("line", {
      class: "eje-linea",
      x1: margen.izquierda,
      x2: margen.izquierda + anchoPlot,
      y1: margen.arriba + altoPlot,
      y2: margen.arriba + altoPlot,
    })
  );

  if (cfg.xlabel) {
    const texto = svg("text", {
      class: "eje-titulo",
      x: margen.izquierda + anchoPlot / 2,
      y: altura - 6,
      "text-anchor": "middle",
    });
    texto.textContent = cfg.xlabel;
    g.append(texto);
  }
  if (cfg.ylabel) {
    const texto = svg("text", {
      class: "eje-titulo",
      x: 12,
      y: margen.arriba + altoPlot / 2,
      "text-anchor": "middle",
      transform: `rotate(-90 12 ${margen.arriba + altoPlot / 2})`,
    });
    texto.textContent = cfg.ylabel;
    g.append(texto);
  }

  /* Banda de confianza */
  if (cfg.banda && cfg.banda.x) {
    const puntosSup = [];
    const puntosInf = [];
    for (let i = 0; i < cfg.banda.x.length; i++) {
      const x = numero(cfg.banda.x[i]);
      const sup = numero(cfg.banda.superior?.[i]);
      const inf = numero(cfg.banda.inferior?.[i]);
      if (x === null || sup === null || inf === null) continue;
      puntosSup.push([escX(x), escY(sup)]);
      puntosInf.push([escX(x), escY(inf)]);
    }
    if (puntosSup.length) {
      const d =
        rutaLinea(puntosSup) +
        " " +
        puntosInf
          .slice()
          .reverse()
          .map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`)
          .join(" ") +
        " Z";
      gFondos.append(svg("path", { d, fill: cfg.banda.color || "var(--grafico-1)", opacity: "0.12" }));
    }
  }

  /* Series agrupadas por capas: fondos/barras -> líneas -> puntos */
  const barrasAgrupables = visibles.filter(
    (s) => tipoDeSerie(s, cfg) === "barra" && !(Number.isFinite(s.anchoDatos) && s.anchoDatos > 0)
  );
  const totalBarrasGrupo = barrasAgrupables.length;
  const yBaseVal = Math.max(yExt.min, Math.min(yExt.max, 0));
  const yBasePx = escY(yBaseVal);

  for (const serie of visibles) {
    const tipo = tipoDeSerie(serie, cfg);
    if (tipo === "barra") {
      const anchoBase = categorias
        ? anchoPlot / Math.max(1, categorias.length)
        : Math.min(30, Math.max(2, anchoPlot / Math.max(1, serie.puntos.length) - 1.5));
      const idxGrupo = barrasAgrupables.indexOf(serie);
      const enDatos = !categorias && Number.isFinite(serie.anchoDatos) && serie.anchoDatos > 0;
      for (const p of serie.puntos) {
        const xVal = categorias ? p.i : p.x;
        const xCentro = escX(xVal);
        const y = escY(p.y);
        const alto = yBasePx - y;
        let w;
        let xRect;
        if (enDatos) {
          w = Math.max(1, escX(xVal + serie.anchoDatos / 2) - escX(xVal - serie.anchoDatos / 2) - 1);
          xRect = xCentro - w / 2;
        } else if (totalBarrasGrupo > 1 && idxGrupo >= 0) {
          const anchoGrupo = Math.max(4, anchoBase * (categorias ? 0.76 : 0.84));
          const sep = anchoGrupo / totalBarrasGrupo > 5 ? 2 : 1;
          w = Math.max(1.2, (anchoGrupo - sep * (totalBarrasGrupo - 1)) / totalBarrasGrupo);
          const desplazamiento = (idxGrupo - (totalBarrasGrupo - 1) / 2) * (w + sep);
          xRect = xCentro + desplazamiento - w / 2;
        } else {
          w = Math.max(1, anchoBase * (categorias ? 0.62 : 0.82));
          xRect = xCentro - w / 2;
        }
        gFondos.append(
          svg("rect", {
            x: xRect,
            y: alto >= 0 ? y : yBasePx,
            width: w,
            height: Math.max(0.8, Math.abs(alto)),
            fill: serie.color,
            opacity: p.desvanecido ? 0.35 : 0.82,
            rx: Math.min(2, w / 3),
          })
        );
      }
    } else if (tipo === "dispersion") {
      for (const p of serie.puntos) {
        const xVal = categorias ? p.i : p.x;
        gPuntos.append(
          marcador(
            serie.puntos.length > 500 ? "circulo" : serie.forma,
            escX(xVal),
            escY(p.y),
            serie.puntos.length > 500 ? 1.6 : serie.puntos.length > 120 ? 2.1 : 2.8,
            { class: "serie-punto", fill: p.color || serie.color, opacity: serie.opacidad ?? 0.72 }
          )
        );
      }
    } else {
      const paresConHuecos = [];
      const segmentos = [];
      let segmentoActual = [];
      for (const p of serie.puntos) {
        const xVal = categorias ? p.i : p.x;
        const px = escX(xVal);
        const py = escY(p.y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
        if (p.salto && segmentoActual.length) {
          paresConHuecos.push([null, null]);
          segmentos.push(segmentoActual);
          segmentoActual = [];
        }
        const par = [px, py];
        paresConHuecos.push(par);
        segmentoActual.push(par);
      }
      if (segmentoActual.length) segmentos.push(segmentoActual);

      if (serie.relleno) {
        for (const seg of segmentos) {
          const primero = seg[0];
          const ultimo = seg[seg.length - 1];
          if (primero && ultimo) {
            const area =
              `M${primero[0].toFixed(2)} ${yBasePx.toFixed(2)} L` +
              seg.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L") +
              ` L${ultimo[0].toFixed(2)} ${yBasePx.toFixed(2)} Z`;
            gFondos.append(svg("path", { class: "serie-area", d: area, fill: serie.color }));
          }
        }
      }
      gLineas.append(
        svg("path", {
          class: "serie-linea",
          d: serie.escalon ? rutaEscalon(paresConHuecos) : rutaLinea(paresConHuecos),
          stroke: serie.color,
          "stroke-dasharray": serie.trazo || null,
          "stroke-linejoin": serie.escalon ? "miter" : null,
        })
      );
      if (serie.marcadores || (serie.escalon && paresConHuecos.length <= 60)) {
        for (const [x, y] of paresConHuecos) {
          if (x === null || y === null) continue;
          gPuntos.append(svg("circle", { cx: x, cy: y, r: 2.4, fill: serie.color, class: "serie-punto" }));
        }
      }
    }
  }

  g.append(gSeries);

  /* Marcador vertical */
  let marcadorX = null;
  if (cfg.marcador !== null && cfg.marcador !== undefined) {
    marcadorX = typeof cfg.marcador === "object" ? numero(cfg.marcador.x) : numero(cfg.marcador);
    if (marcadorX !== null && marcadorX >= xExt.min && marcadorX <= xExt.max) {
      const x = escX(marcadorX);
      g.append(
        svg("line", {
          class: "marcador-linea",
          x1: x,
          x2: x,
          y1: margen.arriba,
          y2: margen.arriba + altoPlot,
        })
      );
      const tolMarcador = (xExt.max - xExt.min) * 0.04;
      for (const serie of visibles) {
        const res = valorSerieEnX(serie, cfg, marcadorX, { tolX: tolMarcador });
        if (res) {
          g.append(
            svg("circle", {
              class: "marcador-punto",
              cx: escX(marcadorX),
              cy: escY(res.y),
              r: 4,
            })
          );
        }
      }
      const etiqueta = cfg.marcador?.etiqueta;
      if (etiqueta) {
        const texto = svg("text", {
          x: Math.min(ancho - 4, x + 6),
          y: margen.arriba + 12,
          fill: "var(--grafico-marcador)",
          "font-size": "9.5",
          "font-weight": "600",
          "text-anchor": x > ancho - 90 ? "end" : "start",
        });
        texto.textContent = etiqueta;
        g.append(texto);
      }
    }
  }

  /* Cruz y zona interactiva */
  const cruz = svg("line", { class: "cruz", x1: 0, x2: 0, y1: margen.arriba, y2: margen.arriba + altoPlot, opacity: 0 });
  g.append(cruz);
  const capa = svg("rect", {
    class: "interactivo",
    x: margen.izquierda,
    y: margen.arriba,
    width: anchoPlot,
    height: altoPlot,
    tabindex: "-1",
  });
  g.append(capa);

  host.append(nodoSvg);

  /* Tooltip */
  const globo = el("div", { class: "globo", role: "status", "aria-live": "off" });
  host.append(globo);

  let paradas;
  if (categorias) {
    paradas = categorias.map((_, i) => i);
  } else {
    const xsTodos = [];
    for (const serie of visibles) {
      for (const p of serie.puntos) {
        if (p.x >= xExt.min - 1e-12 && p.x <= xExt.max + 1e-12) xsTodos.push(p.x);
      }
    }
    xsTodos.sort((a, b) => a - b);
    const epsParada = Math.max(1e-12, (xExt.max - xExt.min) * 1e-9);
    paradas = [];
    for (const x of xsTodos) {
      if (!paradas.length || x - paradas[paradas.length - 1] > epsParada) paradas.push(x);
    }
  }
  const indiceActivo = { valor: -1 };
  const tolPxX = ((xExt.max - xExt.min) / Math.max(1, anchoPlot)) * 14;

  const mostrarGloboEn = (xObjetivo, { pyCursor = null, indiceCat = -1 } = {}) => {
    const filas = [];
    let yRefPx = null;
    let mejorDistY = Infinity;
    for (const serie of visibles) {
      const valor = valorSerieEnX(serie, cfg, xObjetivo, {
        categorias,
        indiceCat,
        tolX: tolPxX,
      });
      if (!valor) continue;
      const yPx = escY(valor.y);
      if (pyCursor !== null) {
        const d = Math.abs(yPx - pyCursor);
        if (d < mejorDistY) {
          mejorDistY = d;
          yRefPx = yPx;
        }
      } else if (yRefPx === null) {
        yRefPx = yPx;
      }
      filas.push(
        el(
          "div",
          { class: "globo__fila" },
          el(
            "span",
            { class: "globo__clave" },
            el("span", { class: "globo__color", style: { background: serie.color } }),
            serie.nombre
          ),
          el("span", { class: "globo__valor" }, fmtNum(valor.y, { decimales: 5 }))
        )
      );
    }
    if (!filas.length) {
      globo.dataset.visible = "false";
      cruz.setAttribute("opacity", "0");
      return;
    }
    const titulo = categorias ? categorias[indiceCat] : `x = ${fmtNum(xObjetivo, { decimales: 4 })}`;
    globo.replaceChildren(el("div", { class: "globo__titulo" }, titulo), ...filas);
    const xPx = escX(categorias ? indiceCat : xObjetivo);
    globo.dataset.visible = "true";
    const anchoGlobo = globo.offsetWidth || 160;
    const altoGlobo = globo.offsetHeight || 64;
    const mitad = anchoGlobo / 2;
    globo.style.left = `${Math.max(mitad + 4, Math.min(ancho - mitad - 4, xPx))}px`;
    const baseY = yRefPx ?? margen.arriba + altoPlot / 2;
    if (baseY - altoGlobo - 10 < 4) {
      globo.style.top = `${Math.min(altura - 8, baseY + altoGlobo + 14)}px`;
    } else {
      globo.style.top = `${Math.max(altoGlobo + 4, baseY - 6)}px`;
    }
    cruz.setAttribute("x1", xPx);
    cruz.setAttribute("x2", xPx);
    cruz.setAttribute("opacity", "1");
  };

  const alMover = (evento) => {
    if (!visibles.length) return;
    const rect = nodoSvg.getBoundingClientRect();
    const px = ((evento.clientX - rect.left) / rect.width) * ancho;
    const py = ((evento.clientY - rect.top) / rect.height) * altura;
    if (categorias) {
      const indice = Math.max(0, Math.min(categorias.length - 1, Math.round(((px - margen.izquierda) / anchoPlot) * (xExt.max - xExt.min) + xExt.min)));
      mostrarGloboEn(indice, { pyCursor: py, indiceCat: indice });
      indiceActivo.valor = indice;
      return;
    }

    const xCursor = xExt.min + ((px - margen.izquierda) / anchoPlot) * (xExt.max - xExt.min);
    let mejorPunto = null;
    let mejorDist2 = Infinity;
    let puntoMasCercanoX = null;
    let menorDx = Infinity;

    for (const serie of visibles) {
      for (const p of serie.puntos) {
        if (p.x < xExt.min || p.x > xExt.max) continue;
        const pPx = escX(p.x);
        const pPy = escY(p.y);
        const dx = Math.abs(pPx - px);
        const dy = Math.abs(pPy - py);
        if (dx < menorDx) {
          menorDx = dx;
          puntoMasCercanoX = p;
        }
        const d2 = dx * dx + dy * dy;
        if (dx <= 14 && d2 < mejorDist2) {
          mejorDist2 = d2;
          mejorPunto = p;
        }
      }
    }

    let xObjetivo = null;
    if (mejorPunto && Math.abs(escX(mejorPunto.x) - px) <= 9) {
      xObjetivo = mejorPunto.x;
    } else {
      const hayLineaEnCursor = visibles.some(
        (s) => tipoDeSerie(s, cfg) === "linea" && valorSerieEnX(s, cfg, xCursor, { tolX: 0 }) !== null
      );
      if (hayLineaEnCursor) xObjetivo = xCursor;
      else if (puntoMasCercanoX) xObjetivo = puntoMasCercanoX.x;
    }

    if (xObjetivo === null) {
      globo.dataset.visible = "false";
      cruz.setAttribute("opacity", "0");
      return;
    }
    mostrarGloboEn(xObjetivo, { pyCursor: py });
    if (paradas.length) {
      let idx = 0;
      let dMin = Infinity;
      for (let i = 0; i < paradas.length; i++) {
        const d = Math.abs(paradas[i] - xObjetivo);
        if (d < dMin) {
          dMin = d;
          idx = i;
        }
      }
      indiceActivo.valor = idx;
    }
  };

  capa.addEventListener("pointermove", alMover);
  capa.addEventListener("pointerleave", () => {
    globo.dataset.visible = "false";
    cruz.setAttribute("opacity", "0");
  });

  /* Zoom y desplazamiento horizontal */
  const fijarVista = (min, max, { foco = false } = {}) => {
    const total = xTotal[1] - xTotal[0];
    let ancho_ = max - min;
    if (!(ancho_ > 0) || ancho_ >= total * 0.999) {
      host._vista = null;
    } else {
      ancho_ = Math.max(ancho_, total / 400);
      min = Math.max(xTotal[0], Math.min(min, xTotal[1] - ancho_));
      host._vista = [min, min + ancho_];
    }
    dibujar(host, cfg);
    if (foco) host.querySelector("svg")?.focus({ preventScroll: true });
  };
  const hacerZoom = (factor, centro = (xExt.min + xExt.max) / 2, opciones = {}) => {
    const izq = centro - (centro - xExt.min) * factor;
    const der = centro + (xExt.max - centro) * factor;
    fijarVista(izq, der, opciones);
  };
  const desplazar = (fraccion, opciones = {}) => {
    if (!ampliado) return;
    const paso = (xExt.max - xExt.min) * fraccion;
    fijarVista(xExt.min + paso, xExt.max + paso, opciones);
  };
  if (conZoom) {
    nodoSvg.addEventListener("wheel", (evento) => {
      if (!evento.ctrlKey || evento.metaKey) return; // sin Ctrl, la rueda sigue desplazando la página
      evento.preventDefault();
      const rect = nodoSvg.getBoundingClientRect();
      const px = ((evento.clientX - rect.left) / rect.width) * ancho;
      const centro = xExt.min + ((px - margen.izquierda) / anchoPlot) * (xExt.max - xExt.min);
      hacerZoom(evento.deltaY < 0 ? 0.7 : 1 / 0.7, centro);
    }, { passive: false });
    let arrastre = null;
    capa.addEventListener("pointerdown", (evento) => {
      if (!ampliado || evento.button !== 0) return;
      arrastre = evento.clientX;
      capa.setPointerCapture?.(evento.pointerId);
    });
    capa.addEventListener("pointerup", (evento) => {
      if (arrastre === null) return;
      const rect = nodoSvg.getBoundingClientRect();
      const dx = ((evento.clientX - arrastre) / rect.width) * ancho;
      arrastre = null;
      if (Math.abs(dx) > 4) desplazar(-dx / anchoPlot);
    });
    capa.addEventListener("dblclick", () => fijarVista(0, 0));
    if (ampliado) capa.style.cursor = "grab";
  }

  nodoSvg.addEventListener("keydown", (evento) => {
    if (evento.defaultPrevented || evento.isComposing || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (conZoom) {
      if (evento.key === "+" || evento.key === "=") { evento.preventDefault(); hacerZoom(0.6, undefined, { foco: true }); return; }
      if (evento.key === "-" || evento.key === "_") { evento.preventDefault(); hacerZoom(1 / 0.6, undefined, { foco: true }); return; }
      if (evento.key === "0" || evento.key === "Escape") {
        if (ampliado) { evento.preventDefault(); fijarVista(0, 0, { foco: true }); }
        return;
      }
      if (evento.shiftKey && (evento.key === "ArrowLeft" || evento.key === "ArrowRight")) {
        evento.preventDefault();
        desplazar(evento.key === "ArrowLeft" ? -0.2 : 0.2, { foco: true });
        return;
      }
    }
    if (!paradas.length) return;
    let indice = indiceActivo.valor;
    if (evento.key === "ArrowRight") indice = Math.min(paradas.length - 1, indice + 1);
    else if (evento.key === "ArrowLeft") indice = Math.max(0, indice <= 0 ? 0 : indice - 1);
    else if (evento.key === "Home") indice = 0;
    else if (evento.key === "End") indice = paradas.length - 1;
    else return;
    evento.preventDefault();
    indiceActivo.valor = indice;
    // Solo con teclado se anuncia el valor: con el ratón sería un torrente de lecturas.
    globo.setAttribute("aria-live", "polite");
    mostrarGloboEn(paradas[indice], { indiceCat: categorias ? indice : -1 });
  });
  capa.addEventListener("pointerenter", () => globo.setAttribute("aria-live", "off"));

  /* Leyenda */
  if (seriesTodas.length > 1 || seriesTodas[0].nombre) {
    const leyenda = el("div", { class: "leyenda" });
    for (const serie of seriesTodas) {
      const activa = !ocultas.has(serie._clave);
      const item = el(
        "button",
        {
          class: "leyenda__item",
          type: "button",
          "data-apagada": String(!activa),
          "aria-pressed": String(activa),
          onClick: () => {
            if (ocultas.has(serie._clave)) ocultas.delete(serie._clave);
            else if (visibles.length > 1) ocultas.add(serie._clave);
            else return;
            host._seriesOcultas = ocultas;
            dibujar(host, cfg);
          },
        },
        muestraLeyenda(serie, cfg),
        el("span", { class: "leyenda__texto" }, serie.nombre)
      );
      leyenda.append(item);
    }
    const pie = el("div", { class: "grafico__pie" }, leyenda);
    if (conZoom) pie.append(controlesZoom());
    if (cfg.acciones) pie.append(cfg.acciones);
    host.append(pie);
  } else if (cfg.acciones || conZoom) {
    host.append(el("div", { class: "grafico__pie" }, el("span"), conZoom ? controlesZoom() : null, cfg.acciones || null));
  }

  function controlesZoom() {
    const botonZoom = (texto, etiqueta, accion, deshabilitado = false) =>
      el("button", { type: "button", class: "grafico__zoom-boton", "aria-label": etiqueta, title: etiqueta, disabled: deshabilitado, onClick: accion }, texto);
    return el(
      "div",
      { class: "grafico__zoom", role: "group", "aria-label": "Zoom del gráfico" },
      botonZoom("−", "Alejar (tecla −)", () => hacerZoom(1 / 0.6), !ampliado),
      botonZoom("+", "Acercar (tecla +)", () => hacerZoom(0.6)),
      botonZoom("⟲", "Restablecer la vista (tecla 0)", () => fijarVista(0, 0), !ampliado)
    );
  }

  /* Tabla de datos equivalente */
  if (cfg.tabla !== false) {
    const resumen = resumenTabla(seriesTodas, categorias, cfg);
    if (resumen) {
      const details = el("details", { class: "chart-datos" });
      details.append(el("summary", {}, "Ver datos del gráfico"));
      const scroll = el("div", { class: "tabla-scroll" });
      const t = el("table");
      const thead = el("thead");
      const trh = el("tr");
      resumen.columnas.forEach((c) => trh.append(el("th", { scope: "col" }, c)));
      thead.append(trh);
      const tbody = el("tbody");
      for (const fila of resumen.filas) {
        const tr = el("tr");
        for (const valor of fila) tr.append(el("td", {}, typeof valor === "number" ? fmtNum(valor, { decimales: 4 }) : valor ?? "—"));
        tbody.append(tr);
      }
      t.append(thead, tbody);
      scroll.append(t);
      details.append(scroll);
      host.append(details);
    }
  }

  /* Redibujado al cambiar el ancho */
  if (typeof ResizeObserver !== "undefined") {
    if (host._observadorGrafico) host._observadorGrafico.disconnect();
    let ultimoAncho = ancho;
    const observador = new ResizeObserver(
      debounce(() => {
        const nuevo = Math.round(host.clientWidth || 0);
        if (nuevo && Math.abs(nuevo - ultimoAncho) > 10) {
          ultimoAncho = nuevo;
          dibujar(host, cfg);
        }
      }, 180)
    );
    observador.observe(host);
    host._observadorGrafico = observador;
  }
}

export function graficoLineas(host, cfg) {
  dibujar(host, { ...cfg, tipo: "linea" });
}

export function graficoBarras(host, cfg) {
  dibujar(host, { ...cfg, tipo: "barras" });
}

export function graficoDispersion(host, cfg) {
  dibujar(host, { ...cfg, tipo: "dispersion" });
}

/**
 * Diagrama de caja vertical con bigotes y valores atípicos.
 */
export function graficoCaja(host, datos) {
  if (!host) return;
  host.replaceChildren();
  host.classList.add("grafico");
  const ancho = Math.max(300, Math.round(host.clientWidth || 680));
  const altura = 240;
  const margen = { arriba: 18, derecha: 24, abajo: 26, izquierda: 58 };
  const anchoPlot = ancho - margen.izquierda - margen.derecha;
  const altoPlot = altura - margen.arriba - margen.abajo;
  const valores = [
    datos.min,
    datos.bigote_inf,
    datos.q1,
    datos.mediana,
    datos.q3,
    datos.bigote_sup,
    datos.max,
    ...(datos.atipicos || []),
  ].map(numero).filter((v) => v !== null);
  if (!valores.length) return;
  let [min, max] = minMax(valores);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const ext = extension(min, max, 5);
  const escY = (v) => margen.arriba + altoPlot - ((v - ext.min) / (ext.max - ext.min)) * altoPlot;
  const centro = margen.izquierda + anchoPlot / 2;
  const anchoCaja = Math.min(74, anchoPlot * 0.26);
  const nodoSvg = svg("svg", {
    viewBox: `0 0 ${ancho} ${altura}`,
    role: "img",
    "aria-label": "Diagrama de caja y bigotes de la muestra",
  });
  nodoSvg.append(svg("title", {}, "Diagrama de caja"));
  const g = svg("g");
  nodoSvg.append(g);
  for (const tick of ext.ticks) {
    const y = escY(tick);
    g.append(svg("line", { class: "rejilla-linea", x1: margen.izquierda, x2: margen.izquierda + anchoPlot, y1: y, y2: y }));
    const t = svg("text", { class: "eje-texto", x: margen.izquierda - 8, y: y + 3.5, "text-anchor": "end" });
    t.textContent = formatearEje(tick);
    g.append(t);
  }
  const linea = (x1, y1, x2, y2, color, anchoTrazo = 1.6) =>
    g.append(svg("line", { x1, x2, y1, y2, stroke: color || "var(--grafico-1)", "stroke-width": anchoTrazo, "stroke-linecap": "round" }));
  const color = "var(--grafico-1)";
  linea(centro, escY(datos.min), centro, escY(datos.max), "var(--linea-fuerte)", 1);
  linea(centro, escY(datos.bigote_sup), centro, escY(datos.q3), color);
  linea(centro, escY(datos.bigote_inf), centro, escY(datos.q1), color);
  linea(centro - anchoCaja / 3, escY(datos.bigote_sup), centro + anchoCaja / 3, escY(datos.bigote_sup), color);
  linea(centro - anchoCaja / 3, escY(datos.bigote_inf), centro + anchoCaja / 3, escY(datos.bigote_inf), color);
  const yCaja = escY(datos.q3);
  const altoCaja = Math.max(1, escY(datos.q1) - yCaja);
  g.append(
    svg("rect", {
      x: centro - anchoCaja / 2,
      y: yCaja,
      width: anchoCaja,
      height: altoCaja,
      fill: "var(--grafico-1)",
      opacity: "0.18",
      stroke: "var(--grafico-1)",
      "stroke-width": "1.4",
      rx: "4",
    })
  );
  linea(centro - anchoCaja / 2, escY(datos.mediana), centro + anchoCaja / 2, escY(datos.mediana), "var(--grafico-3)", 3);
  for (const atipico of datos.atipicos || []) {
    const v = numero(atipico);
    if (v === null) continue;
    g.append(svg("circle", { cx: centro, cy: escY(v), r: 3.2, fill: "none", stroke: "var(--grafico-5)", "stroke-width": "1.4" }));
  }
  g.append(svg("line", { class: "eje-linea", x1: margen.izquierda, x2: margen.izquierda + anchoPlot, y1: margen.arriba + altoPlot, y2: margen.arriba + altoPlot }));
  const atipicos = (datos.atipicos || []).map(numero).filter((v) => v !== null);
  nodoSvg.append(
    svg("desc", {}),
  );
  nodoSvg.querySelector("desc").textContent =
    `Mínimo ${fmtNum(datos.min)}, primer cuartil ${fmtNum(datos.q1)}, mediana ${fmtNum(datos.mediana)}, ` +
    `tercer cuartil ${fmtNum(datos.q3)}, máximo ${fmtNum(datos.max)}. Bigotes de ${fmtNum(datos.bigote_inf)} a ${fmtNum(datos.bigote_sup)}. ` +
    `${atipicos.length} valores atípicos.`;
  host.append(nodoSvg);

  /* Los estadísticos quedan fuera del trazado, incluso con cajas altas o valores largos. */
  const etiquetas = [
    ["Máximo", datos.max],
    ["Q3", datos.q3],
    ["Mediana", datos.mediana],
    ["Q1", datos.q1],
    ["Mínimo", datos.min],
  ];
  host.append(el("dl", { class: "grafico__resumen", "aria-label": "Resumen del diagrama de caja" },
    etiquetas.map(([etiqueta, valor]) => el("div", {},
      el("dt", {}, etiqueta), el("dd", {}, fmtNum(valor, { decimales: 3 }))))));

  /* Tabla de datos equivalente: lo mismo que el dibujo, en texto. */
  const filas = [
    ["Mínimo", datos.min],
    ["Bigote inferior (dato más bajo dentro de la valla)", datos.bigote_inf],
    ["Primer cuartil (Q1)", datos.q1],
    ["Mediana", datos.mediana],
    ["Tercer cuartil (Q3)", datos.q3],
    ["Bigote superior (dato más alto dentro de la valla)", datos.bigote_sup],
    ["Máximo", datos.max],
    ["Valla inferior (Q1 − 1,5·IQR)", datos.valla_inf],
    ["Valla superior (Q3 + 1,5·IQR)", datos.valla_sup],
  ].filter(([, v]) => v !== undefined && v !== null);
  const details = el("details", { class: "chart-datos" });
  details.append(el("summary", {}, "Ver datos del diagrama"));
  const cuerpo = el("tbody");
  for (const [etiqueta, valor] of filas) cuerpo.append(el("tr", {}, el("th", { scope: "row" }, etiqueta), el("td", {}, fmtNum(valor, { decimales: 4 }))));
  cuerpo.append(
    el("tr", {}, el("th", { scope: "row" }, `Valores atípicos (${atipicos.length})`),
      el("td", {}, atipicos.length ? atipicos.map((v) => fmtNum(v, { decimales: 4 })).join(" · ") : "ninguno"))
  );
  details.append(el("div", { class: "tabla-scroll" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Elemento"), el("th", { scope: "col" }, "Valor"))), cuerpo)));
  host.append(details);

  if (typeof ResizeObserver !== "undefined") {
    if (host._observadorGrafico) host._observadorGrafico.disconnect();
    let ultimoAncho = ancho;
    const observador = new ResizeObserver(
      debounce(() => {
        const nuevo = Math.round(host.clientWidth || 0);
        if (nuevo && Math.abs(nuevo - ultimoAncho) > 10) {
          ultimoAncho = nuevo;
          graficoCaja(host, datos);
        }
      }, 180)
    );
    observador.observe(host);
    host._observadorGrafico = observador;
  }
}

/* ------------------------------------------------------------------ */
/* Cálculos auxiliares para histogramas y ECDF                         */
/* ------------------------------------------------------------------ */

export function calcularHistograma(valores, bins = null) {
  const nums = (valores || []).map(numero).filter((v) => v !== null);
  if (!nums.length) return null;
  let [min, max] = minMax(nums);
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const n = bins || Math.max(5, Math.min(24, Math.ceil(Math.sqrt(nums.length))));
  const ancho = (max - min) / n;
  const bordes = Array.from({ length: n + 1 }, (_, i) => min + i * ancho);
  const conteos = new Array(n).fill(0);
  for (const v of nums) {
    let i = Math.floor((v - min) / ancho);
    if (i >= n) i = n - 1;
    if (i < 0) i = 0;
    conteos[i] += 1;
  }
  const centros = conteos.map((_, i) => (bordes[i] + bordes[i + 1]) / 2);
  return { bordes, centros, conteos, ancho, n: nums.length, min, max };
}

export function calcularECDF(valores) {
  const nums = (valores || []).map(numero).filter((v) => v !== null).sort((a, b) => a - b);
  if (!nums.length) return null;
  const x = [];
  const y = [];
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[i]) j++;
    x.push(nums[i]);
    y.push((j + 1) / nums.length);
    i = j + 1;
  }
  return { x, y, n: nums.length };
}

export { COLORES as COLORES_GRAFICO };
