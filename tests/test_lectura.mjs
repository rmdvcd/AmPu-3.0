// LaTeX real y prosa segura, con la misma UI que usa la biblioteca.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { NOMBRES_ICONOS, svgIcono, ICONO_APP } from "../frontend/static/js/icons.js";
import { servidorFrontend } from "./helpers/frontend.mjs";

const require = createRequire(import.meta.url);
const katex = require("../engine/ampu/docs/render/katex.min.js");
let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

test("todas las fórmulas de las 57 lecciones son LaTeX válido, sin tokens de conversión", async () => {
  const directorio = new URL("../engine/ampu/docs/teoria/", import.meta.url);
  let formulas = 0;
  const archivos = (await readdir(directorio)).filter((a) => a.endsWith(".md"));
  assert.equal(archivos.length, 57);
  for (const archivo of archivos) {
    const texto = await readFile(new URL(archivo, directorio), "utf8");
    for (const formula of texto.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)) {
      assert.doesNotThrow(() => katex.renderToString(formula[1] || formula[2], { throwOnError: true, strict: "ignore", trust: false }), `${archivo}: ${formula[0]}`);
      formulas++;
    }
  }
  assert.ok(formulas > 500);
});

test("cada icono declarado en opciones, botones y HTML existe y es local", async () => {
  const nombres = new Set(NOMBRES_ICONOS);
  assert.equal(nombres.size, NOMBRES_ICONOS.length);
  for (const nombre of NOMBRES_ICONOS) {
    const svg = svgIcono(nombre);
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /focusable="false"/);
    assert.doesNotMatch(svg, /<text|<script|<image|href=|NaN/);
    if (nombre !== "punto") assert.notEqual(svg, svgIcono("no-existe"), `${nombre} no cae al punto genérico`);
  }
  const base = new URL("../frontend/static/js/", import.meta.url);
  for (const archivo of await readdir(base, { recursive: true })) {
    if (!archivo.endsWith(".js")) continue;
    const texto = await readFile(new URL(archivo, base), "utf8");
    for (const m of texto.matchAll(/(?:\bicono(?:Boton|Svg)?\(\s*|\bicono:\s*)["']([^"']+)["']/g)) {
      assert.ok(nombres.has(m[1]), `${archivo}: ${m[1]}`);
    }
  }
  const index = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
  for (const m of index.matchAll(/data-icono="([^"]+)"/g)) assert.ok(nombres.has(m[1]), m[1]);
  assert.ok(index.includes(ICONO_APP));
});

const formulaLarga = Array.from({ length: 25 }, (_, i) => `x_{${i + 1}}^2`).join("+");
const htmlLeccion = `<h1 id="normal">Normal general</h1>
<h2 id="definicion">Definición formal</h2><p>Media <span class="formula-linea">$\\mu_x=0$</span> y <code>mu_x</code>.</p>
<h2 id="parametros">Parámetros y rango</h2><div class="tabla-scroll"><table><thead><tr><th>Parámetro</th><th>Significado</th></tr></thead><tbody><tr><td><code>mu_x</code></td><td>Media real</td></tr></tbody></table></div>
<div class="formula-bloque">$$f(x)=\\frac{e^{-x^2/2}}{\\sqrt{2\\pi}}$$</div>
<p><img src="/media/teoria/normal.png" alt="Densidad normal"></p><p><em>Figura 1. Curva ilustrativa.</em></p>
<h2 id="ejemplo">Ejemplo resuelto, paso a paso</h2><ol><li><strong>Datos.</strong> Media 0.</li><li><strong>Cálculo.</strong> <span class="formula-linea">$x_1=1$</span>.</li><li><strong>Resultado.</strong> 0,841345.</li><li><strong>Interpretación.</strong> Probabilidad acumulada.</li></ol>
<div class="formula-bloque">$$S=${formulaLarga}$$</div>
<h2 id="referencias">Referencias</h2><ul><li><a href="https://doi.org/10.1038/s41592-019-0686-2">Referencia</a></li></ul>`;
const ejemploHtml = '<ol><li><strong>Datos.</strong> Usa <span class="formula-linea">$\\mu_x=0$</span>.</li><li>Evalúa 1.</li><li><strong>Resultado.</strong> 0,841345.</li><li>Interpreta la acumulada.</li></ol>';
const modelo = { clave: "normal", nombre: "Normal general", resumen: "Modelo normal.", discreta: false, dimensionalidad: "univariante", parametros: [], formula: "f(x)=1", ejemplo: "Ejemplo completo", ejemplo_html: ejemploHtml, propiedades: "Propiedades", propiedades_html: "<p><strong>Densidad</strong>, no probabilidad puntual.</p>", soporte_sugerido: ["−∞", "∞"], x_sugerido: 1 };

test("lectura e identidad: estructura, accesibilidad, seguridad y diseño en Chromium", {
  skip: !chromium && "Prueba opcional: instala playwright-core y Chromium.",
}, async (t) => {
  const teoria = [{ clave: "normal", titulo: "Normal general", categoria: "distribuciones", resumen: "Modelo normal.", minutos: 2 }];
  const plantilla = await readFile(new URL("../engine/ampu/docs/render/plantilla.html", import.meta.url), "utf8");
  const paginas = Object.fromEntries(["claro", "oscuro"].map((tema) => [`/independiente/${tema}.html`, plantilla
    .replaceAll("../render/", "/vendor/katex/").replace("{{TEMA}}", tema).replace("{{TITULO}}", "Lección independiente")
    .replace("{{INDICE}}", '<ul><li><a href="#ejemplo">Ejemplo resuelto</a></li></ul>')
    .replace("{{ARTICULO}}", () => htmlLeccion.replace('<h2 id="ejemplo">', '<p><span class="formula-linea">$n_0=z^2(0{,}5)(1-0{,}5)/(0{,}05)^2\\approx384{,}1459$</span></p><h2 id="ejemplo">'))]));
  const { servidor, url } = await servidorFrontend({
    matematicas: true, paginas,
    meta: { distribuciones: [modelo], teoria },
    api: (ruta) => ruta === "/api/teoria/normal" ? {
      ...teoria[0], html: htmlLeccion, formula: modelo.formula,
      toc: ["definicion", "parametros", "ejemplo", "referencias"].map((id) => ({ id, nivel: 2, texto: id === "ejemplo" ? "Ejemplo resuelto" : id })),
    } : undefined,
  });
  let navegador;
  try {
    navegador = await chromium.launch({ headless: true, executablePath: process.env.AMPU_CHROMIUM || undefined, args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")] });
    const contexto = await navegador.newContext({ reducedMotion: "reduce" });
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on("pageerror", (e) => errores.push(e.message));
    await pagina.route("**/media/teoria/normal.png", (ruta) => ruta.fulfill({ path: new URL("../engine/ampu/docs/imagenes/normal.png", import.meta.url).pathname, contentType: "image/png" }));
    await pagina.addInitScript(() => localStorage.setItem("ampu.prefs.v1", JSON.stringify({ tema: "claro", calculo_automatico: false, reducir_movimiento: true })));

    for (const tema of ["claro", "oscuro"]) {
      for (const ancho of [1440, 390]) {
        await t.test(`artículo legible y sin desbordes a ${ancho}px, tema ${tema}`, async () => {
          await pagina.setViewportSize({ width: ancho, height: 920 });
          await pagina.goto(`${url}#/teoria/normal`);
          await pagina.locator(".ejemplo-resuelto").waitFor();
          await pagina.evaluate(async (tema) => (await import("/static/js/store.js")).guardarPrefs({ tema }, { servidor: false }), tema);
          await pagina.locator(".lectura .katex").first().waitFor();
          assert.equal(await pagina.locator("#contenido h1").count(), 1);
          assert.equal(await pagina.locator("article h1").count(), 0);
          assert.equal(await pagina.locator("article > header h2").textContent(), "Normal general");
          const residuos = await pagina.locator("article").evaluate((n) => [...n.childNodes].filter((h) => h.nodeType === Node.TEXT_NODE && h.textContent.trim()).map((h) => h.textContent.trim()));
          assert.deepEqual(residuos, [], "los bloques opcionales ausentes no imprimen null/undefined");
          assert.equal(await pagina.locator(".ejemplo-resuelto > h3").count(), 1);
          assert.equal(await pagina.locator(".pasos-resueltos > li").count(), 4);
          assert.equal(await pagina.locator(".lectura code").first().textContent(), "mu_x");
          assert.equal(await pagina.locator(".lectura figure figcaption").textContent(), "Figura 1. Curva ilustrativa.");
          assert.equal(await pagina.locator(".lectura .katex-error").count(), 0);
          assert.equal(await pagina.locator(".lectura .tabla-scroll[tabindex='0'] th[scope='col']").count(), 2);
          const medidas = await pagina.locator(".lectura").evaluate((n) => ({ fuente: parseFloat(getComputedStyle(n).fontSize), linea: parseFloat(getComputedStyle(n).lineHeight), ancho: innerWidth, scroll: document.documentElement.scrollWidth }));
          assert.ok(medidas.fuente >= 16 && medidas.linea >= medidas.fuente * 1.6);
          assert.ok(medidas.scroll <= medidas.ancho + 1, JSON.stringify(medidas));
          await pagina.locator(".indice-leccion").evaluate((n) => { n.open = false; });
          await pagina.locator(".indice-leccion summary").click();
          await pagina.getByRole("button", { name: "Ejemplo resuelto", exact: true }).click();
          assert.equal(await pagina.locator("#ejemplo").evaluate((n) => n === document.activeElement), true);
          const formula = pagina.locator(".lectura .formula-bloque").last();
          assert.equal(await formula.getAttribute("tabindex"), "0");
          await formula.focus();
          const desborde = await formula.evaluate((n) => n.scrollWidth - n.clientWidth);
          assert.ok(desborde > 50, "la fórmula larga se desplaza dentro de su contenedor");
          await pagina.keyboard.press("ArrowRight");
          await pagina.waitForFunction(() => [...document.querySelectorAll(".formula-bloque")].at(-1).scrollLeft > 0);
        });
      }
    }

    await t.test("el saneador retira HTML activo, URLs inseguras y recursos externos", async () => {
      const resultado = await pagina.evaluate(async () => {
        const { contenidoLectura } = await import("/static/js/lectura.js");
        const n = contenidoLectura(`<script>window.intrusion=true</script><style>body{display:none}</style><iframe src="https://evil.invalid"></iframe><form><input autofocus></form><svg onload="window.intrusion=true"></svg><p onclick="window.intrusion=true" style="position:fixed">Texto <strong>seguro</strong></p><a href="jav&#x61;script:alert(1)">No</a><a href="data:text/html,x">No</a><a href="https://example.org">Referencia segura</a><img src="https://evil.invalid/a.png" onerror="window.intrusion=true"><img src="/media/teoria/normal.png" srcset="https://evil.invalid/a.png 2x" onerror="window.intrusion=true">`);
        document.querySelector("#contenido").append(n);
        return { activo: n.querySelectorAll("script,style,iframe,form,input,svg,[onclick],[onerror],[style],[srcset]").length, imagenes: [...n.querySelectorAll("img")].map((i) => i.getAttribute("src")), enlaces: [...n.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), target: a.target, rel: a.rel })), intrusion: Boolean(window.intrusion) };
      });
      assert.equal(resultado.activo, 0);
      assert.equal(resultado.intrusion, false);
      assert.deepEqual(resultado.imagenes, ["/media/teoria/normal.png"]);
      assert.deepEqual(resultado.enlaces.map((a) => a.href), [null, null, "https://example.org"]);
      assert.equal(resultado.enlaces[2].target, "_blank");
      assert.equal(resultado.enlaces[2].rel, "noopener noreferrer");
    });

    await t.test("los desplegables de distribución conservan los cuatro pasos y las matemáticas", async () => {
      await pagina.goto(`${url}#/distribuciones/normal`);
      await pagina.getByText("Ejemplo resuelto", { exact: true }).click();
      const ejemplo = pagina.locator(".lectura--compacta").first();
      assert.equal(await ejemplo.locator(".pasos-resueltos > li").count(), 4);
      assert.ok(await ejemplo.locator(".katex").count() > 0);
      assert.ok((await ejemplo.textContent()).includes("0,841345"));
      assert.equal(await pagina.locator('summary:has-text("Ejemplo resuelto") [data-icono="ejemplo"]').count(), 1);
    });

    await t.test("el buscador separa el título y la descripción, sin etiquetas redundantes", async () => {
      await pagina.setViewportSize({ width: 390, height: 844 });
      await pagina.keyboard.press("Control+k");
      await pagina.getByRole("searchbox", { name: "Buscar en AmPu", exact: true }).fill("normal");
      const opcion = pagina.getByRole("option").filter({ hasText: "Distribución" }).first();
      assert.equal(await opcion.locator(".paleta-item__meta").textContent(), "Continua");
      const rects = await opcion.evaluate((n) => {
        const titulo = n.querySelector(".paleta-item__titulo").getBoundingClientRect();
        const descripcion = n.querySelector(".paleta-item__meta").getBoundingClientRect();
        return { finTitulo: titulo.bottom, inicioDescripcion: descripcion.top, ancho: innerWidth, scroll: document.documentElement.scrollWidth };
      });
      assert.ok(rects.inicioDescripcion >= rects.finTitulo + 1, JSON.stringify(rects));
      assert.ok(rects.scroll <= rects.ancho + 1);
      await pagina.keyboard.press("Escape");
      await pagina.locator("dialog.modal--paleta").waitFor({ state: "detached" });
    });

    await t.test("ayuda, búsqueda y confirmación usan el mismo icono de app, sin cambiar el nombre accesible", async () => {
      for (const abrir of [
        async () => pagina.locator("#boton-ayuda").click(),
        async () => pagina.keyboard.press("Control+k"),
        async () => pagina.evaluate(async () => { const { modal, el } = await import("/static/js/ui.js"); modal({ titulo: "Confirmar acción", contenido: el("p", {}, "Revisa antes de continuar."), acciones: [{ texto: "Cancelar" }] }); }),
      ]) {
        await abrir();
        const dialogo = pagina.locator("dialog[open]");
        await dialogo.waitFor();
        const marca = dialogo.locator(".modal__cabecera .icono-app");
        assert.equal(await marca.count(), 1);
        assert.equal(await marca.getAttribute("src"), ICONO_APP);
        assert.equal(await marca.getAttribute("alt"), "");
        assert.equal(await marca.evaluate((n) => n.complete && n.naturalWidth > 0), true);
        assert.ok(await dialogo.getAttribute("aria-labelledby"));
        assert.ok((await dialogo.locator(".modal__titulo").textContent()).trim());
        await pagina.keyboard.press("Escape");
        await dialogo.waitFor({ state: "detached" });
      }
    });
    for (const tema of ["claro", "oscuro"]) {
      for (const ancho of [1440, 390]) {
        await t.test(`página independiente a ${ancho}px, tema ${tema}: fórmulas, icono y zoom Windows`, async () => {
          await pagina.setViewportSize({ width: ancho, height: 920 });
          await pagina.goto(`${url}independiente/${tema}.html`);
          await pagina.locator(".katex").first().waitFor();
          assert.equal(await pagina.locator(".katex-error").count(), 0);
          assert.equal(await pagina.locator(".ejemplo-resuelto li").count(), 4);
          assert.equal(await pagina.locator(".barra .identidad img").evaluate((n) => n.complete && n.naturalWidth > 0), true);
          const medidas = await pagina.evaluate(() => ({ ancho: innerWidth, scroll: document.documentElement.scrollWidth }));
          assert.ok(medidas.scroll <= medidas.ancho + 1, JSON.stringify(medidas));
          const formula = pagina.locator(".formula-bloque").last();
          assert.equal(await formula.getAttribute("tabindex"), "0");
          assert.ok(await formula.evaluate((n) => n.scrollWidth > n.clientWidth + 50));
          await formula.focus();
          await pagina.keyboard.press("ArrowRight");
          await pagina.waitForFunction(() => [...document.querySelectorAll(".formula-bloque")].at(-1).scrollLeft > 0);
          const fuente = () => pagina.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
          const inicial = await fuente();
          await pagina.keyboard.press("Meta+=");
          assert.equal(await fuente(), inicial);
          await pagina.keyboard.press("Control+=");
          assert.ok(await fuente() > inicial);
          await pagina.keyboard.press("Control+-");
          assert.equal(await fuente(), inicial);
        });
      }
    }
    assert.deepEqual(errores, []);
  } finally {
    await navegador?.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
