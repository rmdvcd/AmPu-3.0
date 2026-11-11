// Contraste calculado con estilos reales del navegador, incluidas opacidad y transiciones.
// Mismo Chromium opcional que tests/test_graficos.mjs; no necesita arrancar la API.
// El fixture usa superficies sólidas; los degradados de las vistas requieren revisión aparte.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

async function servidorPruebas() {
  const archivos = new Map(await Promise.all([
    "css/app.css", "js/ui.js", "js/icons.js", "js/entrada.js", "js/store.js", "js/api.js", "js/prepintado.js", "js/chart.js",
  ].map(async (ruta) => [`/static/${ruta}`, await readFile(new URL(`../frontend/static/${ruta}`, import.meta.url))])));
  const servidor = createServer((peticion, respuesta) => {
    const ruta = new URL(peticion.url, "http://localhost").pathname;
    if (ruta === "/") {
      respuesta.setHeader("Content-Type", "text/html; charset=utf-8");
      respuesta.end('<!doctype html><html lang="es" data-tema="claro"><meta charset="utf-8"><meta name="theme-color" content="#f4f8fa"><link rel="stylesheet" href="/static/css/app.css"><script src="/static/js/prepintado.js"></script><title>Contraste de AmPu</title><body style="padding:24px"><a id="saltar" class="skip-link" href="#fixture">Saltar al contenido</a><main id="fixture" class="pila" style="padding:20px;background:var(--superficie)"></main></body></html>');
    } else if (archivos.has(ruta)) {
      respuesta.setHeader("Content-Type", ruta.endsWith(".css") ? "text/css" : "text/javascript");
      respuesta.end(archivos.get(ruta));
    } else respuesta.writeHead(404).end();
  });
  await new Promise((resolve) => servidor.listen(0, "0.0.0.0", resolve));
  return { servidor, url: `http://127.0.0.1:${servidor.address().port}/` };
}

async function prepararPagina(pagina, url) {
  await pagina.goto(url);
  await pagina.evaluate(async () => {
    const { el, boton, campo } = await import("/static/js/ui.js");
    const host = document.querySelector("#fixture");
    for (const variante of ["primario", "secundario", "fantasma", "peligro"]) {
      const nodo = boton(`Acción ${variante}`, { variante });
      nodo.id = variante;
      host.append(nodo);
    }
    const entrada = campo({ etiqueta: "Datos", placeholder: "Introduce valores", ayuda: "Coma o punto decimal" });
    entrada.control.id = "entrada";
    host.append(entrada.envoltura,
      el("div", { class: "lista-busqueda" }, el("input", { id: "busqueda", placeholder: "Buscar modelos" })),
      el("button", { class: "modelo-item", "aria-pressed": "true" }, el("span", { class: "modelo-item__tipo", id: "tipo-modelo" }, "Continua")),
      el("button", { class: "leyenda__item", "data-apagada": "true", "aria-pressed": "false", id: "serie-oculta" }, "Serie oculta"),
      el("div", { class: "bloque-codigo" }, el("pre", {}, "x = 1"), boton("Copiar", { variante: "fantasma", clase: "bloque-codigo__copiar", dataset: { contraste: "copiar" } })),
      el("div", { class: "veredicto veredicto--rechaza" }, el("span", { class: "veredicto__icono", id: "veredicto-icono" }, "✓")));
    for (let i = 1; i <= 4; i++) {
      host.append(el("p", { id: `tenue-${i}`, class: "texto-tenue", style: { background: `var(--superficie${i === 1 ? "" : `-${i}`})` } }, "Texto secundario y etiquetas"));
    }
    for (const clase of ["fila-datos", "fila-hipotesis", "fila-estrato"]) {
      host.append(el("div", { class: clase }, el("input", { placeholder: "Valor", "aria-label": clase })));
    }
    host.append(el("button", { class: "grafico__zoom-boton", id: "zoom" }, "+"));

    const contexto = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      contexto.clearRect(0, 0, 1, 1);
      contexto.fillStyle = color;
      contexto.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = contexto.getImageData(0, 0, 1, 1).data;
      return [r / 255, g / 255, b / 255, a / 255];
    };
    const sobre = (a, b) => {
      const alfa = a[3] + b[3] * (1 - a[3]);
      return alfa ? [...a.slice(0, 3).map((v, i) => (v * a[3] + b[i] * b[3] * (1 - a[3])) / alfa), alfa] : [0, 0, 0, 0];
    };
    const luminancia = (color) => color.slice(0, 3).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
    window.contraste = (selector, pseudo = null, propiedad = "color") => {
      const nodo = document.querySelector(selector);
      const estilo = getComputedStyle(nodo, pseudo);
      let tinta = rgba(estilo[propiedad]);
      if (pseudo) tinta[3] *= Number(estilo.opacity);
      let fondo = [0, 0, 0, 0];
      for (let actual = nodo; actual; actual = actual.parentElement) {
        const css = getComputedStyle(actual);
        const capa = rgba(css.backgroundColor);
        tinta = sobre(tinta, capa);
        fondo = sobre(fondo, capa);
        tinta[3] *= Number(css.opacity);
        fondo[3] *= Number(css.opacity);
      }
      const luces = [luminancia(sobre(tinta, [1, 1, 1, 1])), luminancia(sobre(fondo, [1, 1, 1, 1]))].sort((a, b) => a - b);
      return (luces[1] + 0.05) / (luces[0] + 0.05);
    };
  });
}

async function fijarTema(pagina, tema) {
  await pagina.evaluate(async (tema) => {
    const { guardarPrefs } = await import("/static/js/store.js");
    guardarPrefs({ tema }, { servidor: false });
  }, tema);
  await pagina.waitForFunction(() => !document.getAnimations().some((a) => a.constructor.name === "CSSTransition"));
}

async function comprobar(pagina, selector, minimo = 4.5, pseudo = null, propiedad = "color") {
  const ratio = await pagina.evaluate(({ selector, pseudo, propiedad }) => window.contraste(selector, pseudo, propiedad), { selector, pseudo, propiedad });
  assert.ok(ratio >= minimo, `${selector}${pseudo || ""}: contraste ${ratio.toFixed(2)}:1; mínimo ${minimo}:1`);
}

test("contraste y cambio de tema sin colores ilegibles", {
  skip: !chromium && "Prueba opcional: instala playwright-core y Chromium.",
}, async (t) => {
  const { servidor, url } = await servidorPruebas();
  let navegador;
  try {
    navegador = await chromium.launch({ headless: true, executablePath: process.env.AMPU_CHROMIUM || undefined,
      args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")] });
    const pagina = await navegador.newPage({ viewport: { width: 1000, height: 1100 } });
    for (const tema of ["claro", "oscuro"]) {
      for (const variante of ["primario", "secundario", "fantasma", "peligro"]) {
        await t.test(`${tema}: botón ${variante} normal, hover, foco y carga`, async () => {
          await prepararPagina(pagina, url);
          await fijarTema(pagina, tema);
          const selector = `#${variante}`;
          await comprobar(pagina, selector);
          await pagina.locator(selector).hover();
          await pagina.waitForFunction((selector) => !document.querySelector(selector).getAnimations().length, selector);
          await comprobar(pagina, selector);
          await pagina.mouse.move(0, 0);
          await pagina.locator(selector).focus();
          await pagina.waitForFunction((selector) => !document.querySelector(selector).getAnimations().length, selector);
          await comprobar(pagina, selector);
          await pagina.locator(selector).evaluate((nodo) => nodo.cargando(true));
          await comprobar(pagina, selector, 3, "::after", "borderTopColor");
        });
      }
      await t.test(`${tema}: ayudas, etiquetas, placeholders y series ocultas`, async () => {
        await prepararPagina(pagina, url);
        await fijarTema(pagina, tema);
        for (const selector of [".campo__ayuda", "#tipo-modelo", "#serie-oculta", "[data-contraste='copiar']", "#tenue-1", "#tenue-2", "#tenue-3", "#tenue-4"]) await comprobar(pagina, selector);
        for (const selector of ["#entrada", "#busqueda"]) await comprobar(pagina, selector, 4.5, "::placeholder");
        await comprobar(pagina, "#veredicto-icono", 3);
        await pagina.locator("#saltar").focus();
        await comprobar(pagina, "#saltar");
      });
      await t.test(`${tema}: bordes de controles identificables`, async () => {
        await prepararPagina(pagina, url);
        await fijarTema(pagina, tema);
        for (const selector of ["#secundario", "#entrada", "#busqueda", "#zoom", ".fila-datos input", ".fila-hipotesis input", ".fila-estrato input"]) await comprobar(pagina, selector, 3, null, "borderTopColor");
      });
      await t.test(`${tema}: avisos y etiquetas de estado`, async () => {
        await prepararPagina(pagina, url);
        await fijarTema(pagina, tema);
        await pagina.evaluate(async () => {
          const { alerta, badge } = await import("/static/js/ui.js");
          const host = document.querySelector("#fixture");
          for (const tipo of ["info", "ok", "aviso", "error"]) host.append(alerta({ tipo, titulo: "Estado del cálculo", texto: "Información sobre los datos." }));
          for (const tono of ["discreta", "continua", "multivariante", "marca", "ok", "error", "aviso"]) host.append(badge("Etiqueta", tono));
        });
        for (const tipo of ["info", "ok", "aviso", "error"]) await comprobar(pagina, `.alerta--${tipo} .alerta__titulo`);
        for (const tono of ["discreta", "continua", "multivariante", "marca", "ok", "error", "aviso"]) await comprobar(pagina, `.badge--${tono}`);
      });
      await t.test(`${tema}: colores, ejes y texto de gráficos sin redibujar al cambiar tema`, async () => {
        await prepararPagina(pagina, url);
        await fijarTema(pagina, tema);
        await pagina.evaluate(async () => {
          const { dibujar } = await import("/static/js/chart.js");
          const host = document.createElement("div");
          host.id = "grafico";
          document.querySelector("#fixture").append(host);
          dibujar(host, { series: Array.from({ length: 5 }, (_, i) => ({ nombre: `Serie ${i + 1}`, tipo: "dispersion", opacidad: 0.7, x: [0, 1], y: [i, i + 1] })) });
          host.querySelectorAll(".serie-punto").forEach((nodo, i) => { nodo.id = `punto-${i}`; });
        });
        const comprobarGrafico = async () => {
          await comprobar(pagina, ".eje-texto", 4.5, null, "fill");
          await comprobar(pagina, ".eje-linea", 3, null, "stroke");
          for (let i = 0; i < 10; i++) await comprobar(pagina, `#punto-${i}`, 3, null, "fill");
        };
        await comprobarGrafico();
        const colorAntes = await pagina.locator("#punto-0").evaluate((nodo) => getComputedStyle(nodo).fill);
        await fijarTema(pagina, tema === "claro" ? "oscuro" : "claro");
        assert.notEqual(await pagina.locator("#punto-0").evaluate((nodo) => getComputedStyle(nodo).fill), colorAntes);
        await comprobarGrafico();
      });
    }
    await t.test("el contraste se conserva en cada fotograma al alternar temas", async () => {
      await prepararPagina(pagina, url);
      await fijarTema(pagina, "claro");
      const peores = await pagina.evaluate(async () => {
        const { guardarPrefs } = await import("/static/js/store.js");
        const resultados = [];
        for (const tema of ["oscuro", "claro", "oscuro", "claro"]) {
          guardarPrefs({ tema }, { servidor: false });
          for (let fotograma = 0; fotograma < 14; fotograma++) {
            await new Promise(requestAnimationFrame);
            for (const selector of ["#primario", "#secundario", "#fantasma", "#peligro", "#entrada", "#busqueda", "#tipo-modelo"]) {
              const ratio = window.contraste(selector);
              if (ratio < 4.5) resultados.push({ tema, fotograma, selector, ratio });
            }
          }
        }
        return resultados;
      });
      assert.deepEqual(peores, [], "no deben mezclarse la tinta del tema nuevo y el fondo del anterior");
    });
    await t.test("sistema, cambios rápidos y preferencias persistentes", async () => {
      await prepararPagina(pagina, url);
      await pagina.emulateMedia({ colorScheme: "light" });
      await fijarTema(pagina, "sistema");
      assert.equal(await pagina.locator("html").getAttribute("data-tema"), "claro");
      await pagina.emulateMedia({ colorScheme: "dark" });
      await pagina.waitForFunction(() => document.documentElement.dataset.tema === "oscuro");
      assert.equal(await pagina.locator("html").evaluate((nodo) => getComputedStyle(nodo).colorScheme), "dark");
      assert.equal(await pagina.locator('meta[name="theme-color"]').getAttribute("content"), "#0a151d");
      await comprobar(pagina, "#secundario");
      await fijarTema(pagina, "claro");
      await pagina.emulateMedia({ colorScheme: "light" });
      await pagina.emulateMedia({ colorScheme: "dark" });
      assert.equal(await pagina.locator("html").getAttribute("data-tema"), "claro", "un tema explícito no sigue al sistema");
      await pagina.evaluate(async () => {
        const { guardarPrefs } = await import("/static/js/store.js");
        for (const tema of ["oscuro", "claro", "oscuro"]) guardarPrefs({ tema }, { servidor: false });
      });
      await pagina.waitForFunction(() => !document.documentElement.hasAttribute("data-cambiando-tema"));
      await comprobar(pagina, "#secundario");
      await pagina.reload();
      assert.equal(await pagina.locator("html").getAttribute("data-tema"), "oscuro", "el prepintado recupera el tema antes de cargar la app");
      assert.equal(await pagina.locator('meta[name="theme-color"]').getAttribute("content"), "#0a151d");
    });
  } finally {
    await navegador?.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
