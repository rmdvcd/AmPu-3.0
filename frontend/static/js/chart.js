/**
 * Gráficos SVG propios: sin dependencias, accesibles y adaptados al tema.
 * Tipos: líneas/áreas, barras, dispersión y caja. Incluye tooltip, leyenda
 * interactiva, navegación por teclado y una tabla de datos equivalente.
 */

import { el, fmtNum, fmtCompacto, debounce } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const COLORES = ["var(--grafico-1)", "var(--grafico-2)", "var(--grafico-3)", "var(--grafico-4)", "var(--grafico-5)"];

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
  const bajo = Math.floor(min / paso) * paso;
  const alto = Math.ceil(max / paso) * paso;
  const ticks = [];
  for (let v = bajo; v <= alto + paso * 1e-9; v += paso) {
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

function prepararSeries(cfg) {
  const series = (cfg.series || [])
    .map((serie, i) => {
      const xs = Array.isArray(serie.x) ? serie.x : [];
      const ys = Array.isArray(serie.y) ? serie.y : [];
      const n = Math.min(xs.length, ys.length);
      const puntos = [];
      for (let j = 0; j < n; j++) {
        const y = numero(ys[j]);
        if (y === null) continue;
        puntos.push({ x: xs[j], y, i: j });
      }
      return {
        ...serie,
        nombre: serie.nombre || `Serie ${i + 1}`,
        color: serie.color || COLORES[i % COLORES.length],
        puntos,
        orden: i,
      };
    })
    .filter((s) => s.puntos.length);
  return series;
}

function resumenTabla(series, categorias) {
  if (!series.length) return null;
  const principal = series[0];
  const n = Math.min(principal.puntos.length, series.length > 3 ? 120 : 250);
  const columnas = ["x", ...series.map((s) => s.nombre)];
  const filas = [];
  const paso = Math.max(1, Math.floor(principal.puntos.length / n));
  for (let i = 0; i < principal.puntos.length; i += paso) {
    const base = principal.puntos[i];
    const fila = [categorias?.[i] ?? base.x];
    for (const s of series) {
      const p = s.puntos[i];
      fila.push(p ? p.y : null);
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

  const ocultas = host._seriesOcultas instanceof Set ? host._seriesOcultas : new Set();
  const visibles = seriesTodas.filter((s) => !ocultas.has(s.nombre));

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
    const valoresX = visibles.flatMap((s) => s.puntos.map((p) => numero(p.x))).filter((v) => v !== null);
    xMin = Math.min(...valoresX);
    xMax = Math.max(...valoresX);
  }
 	if (cfg.dominioX) {
    [xMin, xMax] = cfg.dominioX;
  }
  const xExt = extension(xMin, xMax, categorias ? Math.min(8, categorias.length) : 6);
  if (categorias) {
    xExt.min = -0.5;
    xExt.max = categorias.length - 0.5;
  }

  const valoresY = visibles.flatMap((s) => s.puntos.map((p) => p.y));
  let yMin = Math.min(...valoresY);
  let yMax = Math.max(...valoresY);
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
    const x = categorias ? escX(tick.valor) : escX(tick.valor);
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
      g.append(svg("path", { d, fill: cfg.banda.color || "var(--grafico-1)", opacity: "0.12" }));
    }
  }

  /* Series */
  const indiceActivo = { valor: -1 };
  for (const serie of visibles) {
    const tipo = serie.tipo || ({ barras: "barra", lineas: "linea", linea: "linea", dispersion: "dispersion" }[cfg.tipo] || cfg.tipo || "linea");
    if (tipo === "barra") {
      const anchoBase = categorias
        ? anchoPlot / Math.max(1, categorias.length)
        : Math.min(30, Math.max(2, anchoPlot / Math.max(1, serie.puntos.length) - 1.5));
      for (const p of serie.puntos) {
        const xVal = categorias ? p.i : numero(p.x);
        if (xVal === null) continue;
        const x = escX(xVal);
        const y = escY(p.y);
        const base = escY(Math.max(yExt.min, 0));
        const alto = base - y;
        const w = Math.max(1, anchoBase * (categorias ? 0.62 : 0.82));
        g.append(
          svg("rect", {
            x: x - w / 2,
            y: alto >= 0 ? y : base,
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
        const xVal = categorias ? p.i : numero(p.x);
        if (xVal === null) continue;
        g.append(
          svg("circle", {
            class: "serie-punto",
            cx: escX(xVal),
            cy: escY(p.y),
            r: serie.puntos.length > 500 ? 1.6 : serie.puntos.length > 120 ? 2.1 : 2.8,
            fill: p.color || serie.color,
            opacity: serie.opacidad ?? 0.72,
          })
        );
      }
    } else {
      const puntos = serie.puntos
        .map((p) => [escX(numero(p.x)), escY(p.y)])
        .filter(([x]) => Number.isFinite(x));
      if (serie.relleno) {
        const primero = puntos[0];
        const ultimo = puntos[puntos.length - 1];
        if (primero && ultimo) {
          const base = escY(Math.max(yExt.min, 0));
          const area =
            `M${primero[0].toFixed(2)} ${base.toFixed(2)} L` +
            puntos.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L") +
            ` L${ultimo[0].toFixed(2)} ${base.toFixed(2)} Z`;
          g.append(svg("path", { class: "serie-area", d: area, fill: serie.color }));
        }
      }
      g.append(svg("path", { class: "serie-linea", d: rutaLinea(puntos), stroke: serie.color }));
      if (serie.marcadores) {
        for (const [x, y] of puntos) {
          g.append(svg("circle", { cx: x, cy: y, r: 2.4, fill: serie.color, class: "serie-punto" }));
        }
      }
    }
  }

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
      const principal = visibles[0];
      if (principal) {
        let cercano = principal.puntos[0];
        for (const p of principal.puntos) {
          const valor = numero(p.x);
          if (valor === null) continue;
          if (!cercano || Math.abs(numero(p.x) - marcadorX) < Math.abs(numero(cercano.x) - marcadorX)) cercano = p;
        }
        if (cercano) {
          g.append(
            svg("circle", {
              class: "marcador-punto",
              cx: escX(marcadorX),
              cy: escY(cercano.y),
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

  const principal = visibles[0];
  const mostrarGlobo = (punto, indice) => {
    if (!punto) {
      globo.dataset.visible = "false";
      cruz.setAttribute("opacity", "0");
      return;
    }
    const filas = [];
    for (const serie of visibles) {
      const p = serie.puntos[indice];
      if (!p) continue;
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
          el("span", { class: "globo__valor" }, fmtNum(p.y, { decimales: 5 }))
        )
      );
    }
    globo.replaceChildren(
      el("div", { class: "globo__titulo" }, categorias?.[indice] ?? `x = ${fmtNum(punto.x, { decimales: 4 })}`),
      ...filas
    );
    const xPx = escX(categorias ? indice : numero(punto.x));
    globo.dataset.visible = "true";
    globo.style.left = `${Math.max(70, Math.min(ancho - 70, xPx))}px`;
    globo.style.top = `${Math.max(34, escY(punto.y))}px`;
    cruz.setAttribute("x1", xPx);
    cruz.setAttribute("x2", xPx);
    cruz.setAttribute("opacity", "1");
  };

  const alMover = (evento) => {
    if (!principal) return;
    const rect = nodoSvg.getBoundingClientRect();
    const px = ((evento.clientX - rect.left) / rect.width) * ancho;
    let indice = -1;
    if (categorias) {
      indice = Math.round(((px - margen.izquierda) / anchoPlot) * (xExt.max - xExt.min) + xExt.min);
      indice = Math.max(0, Math.min(principal.puntos.length - 1, indice));
    } else {
      const xValor = xExt.min + ((px - margen.izquierda) / anchoPlot) * (xExt.max - xExt.min);
      let menor = Infinity;
      principal.puntos.forEach((p, i) => {
        const valor = numero(p.x);
        if (valor === null) return;
        const distancia = Math.abs(valor - xValor);
        if (distancia < menor) {
          menor = distancia;
          indice = i;
        }
      });
    }
    const punto = principal.puntos[indice];
    if (punto) mostrarGlobo(punto, indice);
    indiceActivo.valor = indice;
  };

  capa.addEventListener("pointermove", alMover);
  capa.addEventListener("pointerleave", () => {
    globo.dataset.visible = "false";
    cruz.setAttribute("opacity", "0");
  });

  nodoSvg.addEventListener("keydown", (evento) => {
    if (!principal) return;
    let indice = indiceActivo.valor;
    if (evento.key === "ArrowRight") indice = Math.min(principal.puntos.length - 1, indice + 1);
    else if (evento.key === "ArrowLeft") indice = Math.max(0, indice - 1);
    else if (evento.key === "Home") indice = 0;
    else if (evento.key === "End") indice = principal.puntos.length - 1;
    else return;
    evento.preventDefault();
    indiceActivo.valor = indice;
    mostrarGlobo(principal.puntos[indice], indice);
  });

  /* Leyenda */
  if (seriesTodas.length > 1 || seriesTodas[0].nombre) {
    const leyenda = el("div", { class: "leyenda" });
    for (const serie of seriesTodas) {
      const activa = !ocultas.has(serie.nombre);
      const item = el(
        "button",
        {
          class: "leyenda__item",
          type: "button",
          "data-apagada": String(!activa),
          "aria-pressed": String(activa),
          onClick: () => {
            if (ocultas.has(serie.nombre)) ocultas.delete(serie.nombre);
            else if (visibles.length > 1) ocultas.add(serie.nombre);
            else return;
            host._seriesOcultas = ocultas;
            dibujar(host, cfg);
          },
        },
        el("span", { class: "leyenda__muestra", style: { background: serie.color } }),
        serie.nombre
      );
      leyenda.append(item);
    }
    const pie = el("div", { class: "grafico__pie" }, leyenda);
    if (cfg.acciones) pie.append(cfg.acciones);
    host.append(pie);
  } else if (cfg.acciones) {
    host.append(el("div", { class: "grafico__pie" }, el("span"), cfg.acciones));
  }

  /* Tabla de datos equivalente */
  if (cfg.tabla !== false) {
    const resumen = resumenTabla(seriesTodas, categorias);
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
  let min = Math.min(...valores);
  let max = Math.max(...valores);
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
  const etiquetas = [
    ["Máx.", datos.max],
    ["Q3", datos.q3],
    ["Mediana", datos.mediana],
    ["Q1", datos.q1],
    ["Mín.", datos.min],
  ];
  etiquetas.forEach(([etiqueta, valor], i) => {
    const t = svg("text", {
      class: "eje-texto",
      x: margen.izquierda + anchoPlot - 4,
      y: margen.arriba + 12 + i * 15,
      "text-anchor": "end",
      fill: "var(--texto-2)",
    });
    t.textContent = `${etiqueta}: ${fmtNum(valor, { decimales: 3 })}`;
    g.append(t);
  });
  g.append(svg("line", { class: "eje-linea", x1: margen.izquierda, x2: margen.izquierda + anchoPlot, y1: margen.arriba + altoPlot, y2: margen.arriba + altoPlot }));
  host.append(nodoSvg);
}

/* ------------------------------------------------------------------ */
/* Cálculos auxiliares para histogramas y ECDF                         */
/* ------------------------------------------------------------------ */

export function calcularHistograma(valores, bins = null) {
  const nums = (valores || []).map(numero).filter((v) => v !== null);
  if (!nums.length) return null;
  let min = Math.min(...nums);
  let max = Math.max(...nums);
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
