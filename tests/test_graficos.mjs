// Regresión visual con un navegador real, sin depender de la API ni de datos externos.
// Opcional: npm install --no-save --package-lock=false playwright-core
//           npx playwright-core install chromium
//           node --test tests/test_graficos.mjs
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

const serie = (nombre, tipo = "linea", opciones = {}) => ({ nombre, tipo, x: [0, 1, 2, 3], y: [1, 3, 2, 4], ...opciones });
const casos = [
  ["distribuciones", { series: [serie("f(x)", "linea", { relleno: true })] }],
  ["distribución acumulada", { series: [serie("P(X ≤ x)", "linea", { escalon: true })] }],
  ["descriptiva", { series: [serie("Frecuencia", "barra")] }],
  ["inferencia", { series: [serie("Densidad t₉")], marcador: { x: 2, etiqueta: "Estadístico observado" } }],
  ["regresión", { series: [serie("Observado", "dispersion"), serie("Recta estimada")] }],
  ["muestreo", { categorias: ["A", "B", "C", "D"], series: [serie("Población", "barra"), serie("Muestra", "barra")] }],
  ["simulación", { series: [serie("Estimación"), serie("Valor exacto")] }],
  ["nombres largos y varias series", {
    series: [
      serie("Estimación de Monte Carlo con intervalo de confianza del modelo ajustado"),
      serie("Valor de referencia", "linea", { trazo: "7 4" }),
      serie("Cuantiles observados", "dispersion", { forma: "rombo" }),
      serie("Frecuencias relativas", "barra"),
      serie("Estimación".repeat(25)),
    ],
  }],
];

async function servidorPruebas() {
  const archivos = new Map(await Promise.all([
    "css/app.css", "js/chart.js", "js/ui.js", "js/entrada.js", "js/icons.js",
  ].map(async (ruta) => [`/static/${ruta}`, await readFile(new URL(`../frontend/static/${ruta}`, import.meta.url))])));
  const servidor = createServer((peticion, respuesta) => {
    const ruta = new URL(peticion.url, "http://localhost").pathname;
    if (ruta === "/") {
      respuesta.setHeader("Content-Type", "text/html; charset=utf-8");
      respuesta.end('<!doctype html><html lang="es"><meta charset="utf-8"><link rel="stylesheet" href="/static/css/app.css"><title>Prueba de gráficos</title><body><main style="padding:24px"><div id="grafico"></div></main></body></html>');
    } else if (archivos.has(ruta)) {
      respuesta.setHeader("Content-Type", ruta.endsWith(".css") ? "text/css" : "text/javascript");
      respuesta.end(archivos.get(ruta));
    } else {
      respuesta.writeHead(404).end();
    }
  });
  await new Promise((resolve) => servidor.listen(0, "0.0.0.0", resolve));
  return { servidor, url: `http://127.0.0.1:${servidor.address().port}/` };
}

async function comprobarLeyenda(pagina) {
  const medidas = await pagina.locator("#grafico").evaluate((host) => {
    const rect = (nodo) => nodo.getBoundingClientRect().toJSON();
    return {
      host: rect(host),
      anchoContenido: host.scrollWidth,
      dibujo: rect(host.querySelector(":scope > svg")),
      pie: rect(host.querySelector(".grafico__pie")),
      leyenda: rect(host.querySelector(".leyenda")),
      zoom: host.querySelector(".grafico__zoom") ? rect(host.querySelector(".grafico__zoom")) : null,
      tabla: rect(host.querySelector(".chart-datos")),
      items: [...host.querySelectorAll(".leyenda__item")].map((item) => {
        const rango = document.createRange();
        rango.selectNodeContents(item.lastChild);
        return {
          nombre: item.textContent,
          boton: rect(item),
          muestra: rect(item.querySelector("svg")),
          textos: [...rango.getClientRects()].map((r) => r.toJSON()),
        };
      }),
    };
  });
  const dentro = (interior, exterior) => interior.left >= exterior.left - 1 && interior.right <= exterior.right + 1 &&
    interior.top >= exterior.top - 1 && interior.bottom <= exterior.bottom + 1;
  const solapan = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

  assert.ok(Math.abs(medidas.dibujo.width - medidas.host.width) < 1, "el dibujo conserva el ancho responsivo");
  assert.ok(medidas.anchoContenido <= medidas.host.width + 1, "no hay desbordamiento horizontal");
  assert.ok(medidas.pie.top >= medidas.dibujo.bottom + 7, "la leyenda tiene espacio propio bajo los ejes");
  assert.ok(medidas.tabla.top >= medidas.pie.bottom + 3, "la tabla no invade el pie");
  assert.ok(dentro(medidas.leyenda, medidas.pie), "la leyenda cabe en el pie");
  for (const [i, item] of medidas.items.entries()) {
    assert.ok(Math.abs(item.muestra.width - 26) < 0.5, `${item.nombre}: símbolo de 26 px, no del ancho del gráfico`);
    assert.ok(Math.abs(item.muestra.height - 10) < 0.5, `${item.nombre}: símbolo de 10 px de alto`);
    assert.ok(dentro(item.boton, medidas.leyenda), `${item.nombre}: botón dentro de la leyenda`);
    assert.ok(dentro(item.muestra, item.boton), `${item.nombre}: símbolo dentro de su botón`);
    for (const texto of item.textos) {
      assert.ok(dentro(texto, item.boton), `${item.nombre}: el texto no sale de su botón`);
      assert.ok(!solapan(texto, item.muestra), `${item.nombre}: texto separado del símbolo`);
    }
    if (medidas.zoom) assert.ok(!solapan(item.boton, medidas.zoom), "leyenda y zoom separados");
    for (const otro of medidas.items.slice(i + 1)) assert.ok(!solapan(item.boton, otro.boton), "las series no se solapan");
  }
}

test("leyendas de todos los gráficos: tamaño, ajuste e interacción", {
  skip: !chromium && "Prueba opcional: instala playwright-core para comprobar el diseño en Chromium.",
}, async (t) => {
  const { servidor, url } = await servidorPruebas();
  let navegador;
  try {
    navegador = await chromium.launch({
      headless: true,
      executablePath: process.env.AMPU_CHROMIUM || undefined,
      args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")],
    });
    const pagina = await navegador.newPage({ viewport: { width: 1000, height: 900 } });
    for (const tema of ["claro", "oscuro"]) {
      for (const ancho of [180, 240, 360, 760]) {
        for (const [nombre, cfg] of casos) {
          await t.test(`${nombre} · ${ancho}px · ${tema}`, async () => {
            await pagina.goto(url);
            await pagina.evaluate(async ({ cfg, ancho, tema }) => {
              const { dibujar } = await import("/static/js/chart.js");
              document.documentElement.dataset.tema = tema;
              document.documentElement.dataset.densidad = tema === "oscuro" ? "compacta" : "comoda";
              const host = document.querySelector("#grafico");
              host.style.width = `${ancho}px`;
              dibujar(host, { xlabel: "Observaciones", ylabel: "Valor", ...cfg });
            }, { cfg, ancho, tema });
            await comprobarLeyenda(pagina);
          });
        }
      }
    }
    await t.test("ocultar, restaurar, ampliar y redimensionar conserva la leyenda", async () => {
      await pagina.goto(url);
      await pagina.evaluate(async () => {
        const { dibujar } = await import("/static/js/chart.js");
        const host = document.querySelector("#grafico");
        host.style.width = "760px";
        dibujar(host, { series: [
          { nombre: "Observado", tipo: "dispersion", forma: "rombo", x: [0, 1, 2], y: [1, 3, 2] },
          { nombre: "Recta estimada", trazo: "7 4", x: [0, 1, 2], y: [1, 2, 3] },
        ] });
      });
      assert.equal(await pagina.locator(".leyenda__trazo line").getAttribute("stroke-dasharray"), "7 4");
      assert.equal(await pagina.locator(".leyenda__trazo path").count(), 1, "se conserva el marcador de rombo");
      await pagina.getByRole("button", { name: "Observado", exact: true }).click();
      assert.equal(await pagina.getByRole("button", { name: "Observado", exact: true }).getAttribute("aria-pressed"), "false");
      assert.equal(await pagina.locator(".serie-punto").count(), 0);
      await comprobarLeyenda(pagina);
      await pagina.getByRole("button", { name: "Recta estimada", exact: true }).click();
      assert.equal(await pagina.getByRole("button", { name: "Recta estimada", exact: true }).getAttribute("aria-pressed"), "true", "no se oculta la última serie visible");
      await pagina.getByRole("button", { name: "Observado", exact: true }).focus();
      await pagina.keyboard.press("Enter");
      assert.equal(await pagina.getByRole("button", { name: "Observado", exact: true }).getAttribute("aria-pressed"), "true");
      await pagina.getByRole("button", { name: "Acercar (tecla +)", exact: true }).click();
      assert.ok(await pagina.locator("#grafico").evaluate((host) => Array.isArray(host._vista)));
      await comprobarLeyenda(pagina);
      await pagina.locator("#grafico").evaluate((host) => { host.style.width = "240px"; });
      await pagina.waitForFunction(() => document.querySelector("#grafico > svg").viewBox.baseVal.width === 300);
      await comprobarLeyenda(pagina);
    });
    for (const ancho of [180, 240, 360, 760]) {
      for (const factor of [1, 1e12]) {
        await t.test(`caja con etiquetas fuera del trazado · ${ancho}px · escala ${factor}`, async () => {
          await pagina.goto(url);
          await pagina.evaluate(async ({ ancho, factor }) => {
            const { graficoCaja } = await import("/static/js/chart.js");
            const { config } = await import("/static/js/ui.js");
            config.notacion = factor > 1 ? "fija" : "auto";
            document.documentElement.dataset.tema = factor > 1 ? "oscuro" : "claro";
            const host = document.querySelector("#grafico");
            host.style.width = `${ancho}px`;
            graficoCaja(host, {
              min: factor, bigote_inf: factor, q1: 800 * factor, mediana: 850 * factor,
              q3: 900 * factor, bigote_sup: 1000 * factor, max: 1000 * factor, atipicos: [],
            });
          }, { ancho, factor });
          const medidas = await pagina.locator("#grafico").evaluate((host) => {
            const rect = (nodo) => nodo.getBoundingClientRect().toJSON();
            const dibujo = host.querySelector(":scope > svg");
            const resumen = host.querySelector(".grafico__resumen");
            return {
              ancho: rect(dibujo).width, dibujo: rect(dibujo),
              resumen: resumen ? rect(resumen) : null,
              etiquetas: resumen ? [...resumen.querySelectorAll("dt")].map((nodo) => nodo.textContent) : [],
              valores: resumen ? [...resumen.querySelectorAll("dd")].map(rect) : [],
              leyendasDentro: [...dibujo.querySelectorAll("text")].filter((nodo) => /Mediana:|Q[13]:|Máx\.:|Mín\.:/.test(nodo.textContent)).length,
              tabla: rect(host.querySelector(".chart-datos")),
              desborde: host.scrollWidth - host.clientWidth,
            };
          });
          assert.equal(medidas.ancho, ancho, "el dibujo conserva el ancho responsivo");
          assert.ok(medidas.resumen, "los estadísticos tienen un resumen fuera del SVG");
          assert.ok(medidas.resumen.top >= medidas.dibujo.bottom + 7, "el resumen no pisa la caja ni los bigotes");
          assert.equal(medidas.leyendasDentro, 0);
          assert.deepEqual(medidas.etiquetas, ["Máximo", "Q3", "Mediana", "Q1", "Mínimo"]);
          assert.equal(medidas.valores.length, 5);
          assert.ok(medidas.valores.every((valor) => valor.left >= medidas.resumen.left - 1 && valor.right <= medidas.resumen.right + 1));
          assert.ok(medidas.tabla.top >= medidas.resumen.bottom + 3, "la tabla tampoco se solapa");
          assert.ok(medidas.desborde <= 1, "los valores grandes no desbordan el contenedor");
        });
      }
    }
    await pagina.close();
  } finally {
    await navegador?.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
