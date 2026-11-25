// Pruebas de gráficos con múltiples funciones/series: alineación en x, tooltip,
// tabla equivalente, huecos, barras agrupadas, leyenda, marcador y zoom.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

function crearDomMinimo() {
  class FakeClassList {
    constructor(nodo) {
      this.nodo = nodo;
      this.set = new Set();
    }
    add(...clases) {
      clases.forEach((c) => {
        for (const p of String(c).split(/\s+/).filter(Boolean)) this.set.add(p);
      });
    }
    remove(...clases) { clases.forEach((c) => this.set.delete(c)); }
    contains(c) { return this.set.has(c); }
    toString() { return [...this.set].join(" "); }
  }

  class FakeNode {
    constructor(tagName, ns = null) {
      this.tagName = String(tagName);
      this.namespaceURI = ns;
      this.children = [];
      this.parentElement = null;
      this.attrs = {};
      this.style = {};
      this.dataset = {};
      this.listeners = new Map();
      this.classList = new FakeClassList(this);
      this._textContent = "";
      this.clientWidth = 700;
      this.offsetWidth = 180;
      this.offsetHeight = 70;
      this.isConnected = true;
    }
    set className(v) {
      this.classList = new FakeClassList(this);
      this.classList.add(v);
      this.attrs.class = v;
    }
    get className() { return this.attrs.class || this.classList.toString(); }
    set textContent(v) {
      this._textContent = v == null ? "" : String(v);
      this.children = [];
    }
    get textContent() {
      if (this.children.length) return this.children.map((c) => c.textContent).join("");
      return this._textContent;
    }
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === "class") this.className = v;
    }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...nodos) {
      for (const n of nodos) {
        if (n === null || n === undefined || n === false || n === true) continue;
        if (typeof n === "string" || typeof n === "number") {
          const t = new FakeNode("#text");
          t._textContent = String(n);
          this.children.push(t);
        } else {
          n.parentElement = this;
          this.children.push(n);
        }
      }
    }
    replaceChildren(...nodos) {
      this.children = [];
      this._textContent = "";
      this.append(...nodos);
    }
    addEventListener(tipo, fn) {
      if (!this.listeners.has(tipo)) this.listeners.set(tipo, []);
      this.listeners.get(tipo).push(fn);
    }
    dispatchEvent(evento) {
      const lista = this.listeners.get(evento.type) || [];
      for (const fn of lista) fn(evento);
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 700, height: 320, right: 700, bottom: 320 };
    }
    focus() {}
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const ramas = sel.split(",").map((s) => s.trim().split(/\s+/).filter(Boolean));
      const coincideSimple = (n, p) => {
        if (p.startsWith(".")) return n.classList.contains(p.slice(1)) || (n.attrs.class || "").split(/\s+/).includes(p.slice(1));
        if (p.startsWith("#")) return n.attrs.id === p.slice(1);
        return n.tagName.toLowerCase() === p.toLowerCase();
      };
      const buscarDesde = (nodo, selector) => {
        const out = [];
        const visitar = (n) => {
          for (const h of n.children) {
            if (coincideSimple(h, selector)) out.push(h);
            visitar(h);
          }
        };
        visitar(nodo);
        return out;
      };
      const encontrados = new Set();
      for (const cadena of ramas) {
        let candidatos = [this];
        for (const parte of cadena) {
          const siguientes = new Set();
          for (const base of candidatos) {
            for (const m of buscarDesde(base, parte)) siguientes.add(m);
          }
          candidatos = [...siguientes];
        }
        candidatos.forEach((c) => encontrados.add(c));
      }
      return [...encontrados];
    }
  }

  const previo = {
    document: globalThis.document,
    Node: globalThis.Node,
    window: globalThis.window,
  };
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (ns, tag) => new FakeNode(tag, ns),
    createTextNode: (t) => {
      const n = new FakeNode("#text");
      n._textContent = String(t);
      return n;
    },
    getElementById: () => null,
    documentElement: { dataset: {} },
  };
  if (!globalThis.window) globalThis.window = globalThis;
  return () => {
    globalThis.document = previo.document;
    globalThis.Node = previo.Node;
    if (previo.window !== globalThis.window) globalThis.window = previo.window;
  };
}

let restaurarDom;
let chart;

before(async () => {
  restaurarDom = crearDomMinimo();
  chart = await import("../frontend/static/js/chart.js");
});

after(() => {
  restaurarDom?.();
});

test("prepararSeries valida x numéricos, marca saltos en huecos y ordena puntosX sin dañar dispersión", () => {
  const series = chart.prepararSeries({
    series: [
      { nombre: "f(x)", x: [0, null, 2, 3, 4], y: [1, 5, 3, null, 8] },
      { nombre: "Desc", x: [3, 2, 1, 0], y: [9, null, 3, 1] },
      { nombre: "Nube", tipo: "dispersion", x: [3, 1, 4, 2], y: [6, 2, 8, 4] },
      { nombre: "Mismo", x: [0, 1], y: [1, 2] },
      { nombre: "Mismo", x: [0, 1], y: [3, 4] },
    ],
  });
  assert.equal(series.length, 5);
  // El segundo punto de f(x) tenía x=null: no se convierte en x=0, sino que deja salto en el siguiente punto.
  assert.deepEqual(series[0].puntos.map((p) => [p.x, p.y, p.salto]), [
    [0, 1, false],
    [2, 3, true],
    [4, 8, true],
  ]);
  // Desc invertido conserva el salto entre x=1 y x=3 (al quedar en orden ascendente 0,1,3).
  assert.deepEqual(series[1].puntosX.map((p) => [p.x, p.y, p.salto]), [
    [0, 1, false],
    [1, 3, false],
    [3, 9, true],
  ]);
  // La nube desordenada no se interpola como función.
  assert.equal(series[2].puntosX, null);
  // Claves únicas aunque compartan nombre.
  assert.notEqual(series[3]._clave, series[4]._clave);
});

test("valorSerieEnX alinea e interpola varias funciones en distinto soporte sin mezclar índices", () => {
  const cfg = {
    series: [
      { nombre: "Observaciones", tipo: "dispersion", x: [4, 1, 3, 2], y: [8, 2, 6, 4] },
      { nombre: "Recta ajustada", tipo: "linea", x: [0, 1, 2, 3, 4, 5], y: [0, 2, 4, 6, 8, 10] },
      { nombre: "Referencia", tipo: "linea", x: [0, 5], y: [5, 5] },
      { nombre: "Parcial", tipo: "linea", x: [2, null, 4, 5], y: [20, 99, 40, 50] },
    ],
  };
  const [obs, recta, ref, parcial] = chart.prepararSeries(cfg);

  // En x = 2.5: recta = 5, ref = 5 (aunque solo tenga 2 puntos), parcial está en un hueco -> null.
  assert.equal(chart.valorSerieEnX(recta, cfg, 2.5, { tolX: 0.1 })?.y, 5);
  assert.equal(chart.valorSerieEnX(ref, cfg, 2.5, { tolX: 0.1 })?.y, 5);
  assert.equal(chart.valorSerieEnX(parcial, cfg, 3.0, { tolX: 0.1 }), null);
  assert.equal(chart.valorSerieEnX(parcial, cfg, 4.5, { tolX: 0.1 })?.y, 45);
  assert.equal(chart.valorSerieEnX(obs, cfg, 3, { tolX: 0.1 })?.y, 6);
  // Fuera del dominio de parcial (x = 0.5) no extrapola ni fija al extremo.
  assert.equal(chart.valorSerieEnX(parcial, cfg, 0.5, { tolX: 0.1 }), null);
});

test("resumenTabla alinea varias funciones por x en vez de por índice de arreglo", () => {
  const cfg = {
    series: [
      { nombre: "Observaciones", tipo: "dispersion", x: [3, 1], y: [30, 10] },
      { nombre: "Recta", tipo: "linea", x: [0, 1, 2, 3, 4], y: [0, 10, 20, 30, 40] },
      { nombre: "Tope", tipo: "linea", x: [0, 4], y: [25, 25] },
    ],
  };
  const series = chart.prepararSeries(cfg);
  const tabla = chart.resumenTabla(series, null, cfg);
  assert.deepEqual(tabla.columnas, ["x", "Observaciones", "Recta", "Tope"]);
  assert.deepEqual(tabla.filas, [
    [0, null, 0, 25],
    [1, 10, 10, 25],
    [2, null, 20, 25],
    [3, 30, 30, 25],
    [4, null, 40, 25],
  ]);
});

test("dibujar agrupa barras múltiples lado a lado, respeta capas, marcador y tooltip multi-función", () => {
  const host = document.createElement("div");

  // 1) Barras agrupadas en muestreo: Población vs Selección no se pisan en la misma x.
  chart.dibujar(host, {
    tipo: "barras",
    categorias: ["Estrato A", "Estrato B"],
    series: [
      { nombre: "Población", x: [0, 1], y: [100, 80], tipo: "barra" },
      { nombre: "Selección", x: [0, 1], y: [20, 20], tipo: "barra" },
    ],
  });
  const svgBarras = host.children[0];
  const barras = svgBarras
    .querySelectorAll("rect")
    .filter((r) => r.parentElement?.tagName !== "clipPath" && !r.classList.contains("interactivo"));
  assert.equal(barras.length, 4);
  assert.notEqual(barras[0].getAttribute("x"), barras[2].getAttribute("x"), "las barras de Población y Selección deben quedar lado a lado");

  // 2) Múltiples funciones con marcador, huecos y tooltip alineado por x.
  const hostFunc = document.createElement("div");
  chart.dibujar(hostFunc, {
    series: [
      { nombre: "f(x)", x: [0, 1, 2, null, 4], y: [0, 2, 4, 99, 8], relleno: true },
      { nombre: "g(x)", x: [0, 4], y: [6, 6] },
    ],
    marcador: { x: 2, etiqueta: "x = 2" },
  });
  const pathsLinea = hostFunc.querySelectorAll(".serie-linea");
  assert.equal(pathsLinea.length, 2);
  // f(x) tiene un salto tras x=2: debe contener dos comandos M (no conectar 2 -> 4).
  assert.equal((pathsLinea[0].getAttribute("d").match(/\bM/g) || []).length, 2);
  // Hay 2 áreas separadas para f(x) al partirse en el hueco.
  assert.equal(hostFunc.querySelectorAll(".serie-area").length, 2);
  // El marcador vertical dibuja puntos en ambas funciones visibles.
  assert.equal(hostFunc.querySelectorAll(".marcador-punto").length, 2);

  // Al navegar con teclado hacia x = 4, ambas series aparecen en el tooltip con su valor real.
  const svg = hostFunc.querySelector("svg");
  svg.dispatchEvent({ type: "keydown", key: "End", preventDefault() {} });
  const globo = hostFunc.querySelector(".globo");
  assert.equal(globo.dataset.visible, "true");
  assert.match(globo.textContent, /x = 4/);
  assert.match(globo.textContent, /f\(x\)8/);
  assert.match(globo.textContent, /g\(x\)6/);

  // Al ocultar una serie en la leyenda, se conserva el zoom y nunca quedan 0 visibles al cambiar datos.
  hostFunc._vista = [1, 3];
  const btnOcultar = hostFunc.querySelectorAll(".leyenda__item")[1];
  btnOcultar.dispatchEvent({ type: "click" });
  assert.deepEqual(hostFunc._vista, [1, 3], "ocultar una serie conserva el zoom");

  // Si se redibuja el mismo contenedor con una sola serie que estaba oculta antes, no queda vacío.
  chart.dibujar(hostFunc, {
    series: [{ nombre: "g(x)", x: [0, 4], y: [6, 6] }],
  });
  assert.equal(hostFunc.querySelectorAll(".serie-linea").length, 1);
});

test("series enormes (> 65 000 puntos) no producen desbordamiento de pila", () => {
  const n = 70000;
  const x = Array.from({ length: n }, (_, i) => i);
  const y1 = Array.from({ length: n }, (_, i) => Math.sin(i / 100));
  const y2 = Array.from({ length: n }, (_, i) => Math.cos(i / 100));
  const host = document.createElement("div");
  assert.doesNotThrow(() => {
    chart.dibujar(host, {
      series: [
        { nombre: "seno", x, y: y1 },
        { nombre: "coseno", x, y: y2 },
      ],
    });
  });
});
