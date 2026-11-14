// Regresiones de la auditoría de interfaz: shell real y API mínima, sin Flask.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LECCIONES_MUESTREO, NAV, ORDEN_VISTAS, VISTAS, herramientaDeLeccion } from "../frontend/static/js/data.js";
import { servidorFrontend } from "./helpers/frontend.mjs";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

test("cada sección tiene un destino único y una descripción breve", () => {
  assert.equal(new Set(ORDEN_VISTAS).size, ORDEN_VISTAS.length);
  assert.deepEqual(new Set(ORDEN_VISTAS), new Set(Object.keys(VISTAS)));
  for (const grupo of NAV) {
    for (const clave of grupo.items) {
      if (VISTAS[clave].subtitulo) assert.ok(VISTAS[clave].subtitulo.length <= 100, clave);
    }
  }
  for (const [metodo, leccion] of Object.entries(LECCIONES_MUESTREO)) {
    assert.equal(herramientaDeLeccion(leccion).ruta, `muestreo/${metodo}`);
  }
});

const metodos = [
  ["finito", "Aleatorio simple · población finita"], ["infinito", "Aleatorio simple · población grande"],
  ["sistematico", "Sistemático"], ["proporcional", "Estratificado proporcional"],
  ["neyman", "Asignación de Neyman"], ["optimo", "Asignación óptima con costes"], ["conglomerados", "Por conglomerados"],
].map(([clave, nombre]) => ({ clave, nombre, descripcion: "Diseño de prueba", campo_n: "Unidades a extraer" }));

const esFoco = (pagina, selector) => pagina.locator(selector).evaluate((nodo) => nodo === document.activeElement);

test("navegación y formularios: menú, redundancias y controles completos", {
  skip: !chromium && "Prueba opcional: instala playwright-core y Chromium.",
}, async (t) => {
  let preferenciasPendientes = null;
  const { servidor, url } = await servidorFrontend({
    meta: {
      muestreo: metodos,
      pruebas: [{
        clave: "t_una", nombre: "Prueba t de una media", descripcion: "Una muestra", grupo: "Medias",
        h0: "μ = μ₀", h1: "μ ≠ μ₀", teoria: "prueba_t_una",
        campos: [{ id: "datos", etiqueta: "Muestra", tipo: "serie" }, { id: "mu0", etiqueta: "Media de referencia", tipo: "numero", default: 0 }],
      }, {
        clave: "prop_una", nombre: "Una proporción", grupo: "Proporciones", h0: "p = p₀", h1: "p ≠ p₀",
        campos: [
          { id: "exitos", etiqueta: "Éxitos observados", tipo: "entero", default: 48, min: 0 },
          { id: "n", etiqueta: "Tamaño de muestra n", tipo: "entero", default: 100, min: 1 },
          { id: "p0", etiqueta: "Proporción nula p₀", tipo: "numero", default: 0.4, min: 0, max: 1, incluir_minimo: false, incluir_maximo: false, ayuda: "Usa 0 < p₀ < 1; no se admiten los extremos 0 y 1." },
        ],
      }],
    },
    api: (ruta, cuerpo) => {
      if (ruta === "/api/preferences" && cuerpo === null && preferenciasPendientes) return preferenciasPendientes;
      if (ruta === "/api/inferencia") return { estadistico: 0, p_valor: 1, alfa: .05, metodo: "Resultado simulado", conclusion: "Sin evidencia suficiente.", rechaza: false, curva: null, gl: null, extras: {} };
      if (ruta === "/api/muestreo/tamano") return { n: 73, formula: "n", ...cuerpo };
      if (ruta === "/api/muestreo") {
        const n = cuerpo.auto ? 279 : cuerpo.n;
        return {
          semilla: cuerpo.semilla, total_poblacion: cuerpo.N, total_muestra: n,
          etiquetas: ["Total"], poblacion: [cuerpo.N], seleccion: [n], resumen: "Muestra de prueba",
          tablas: { Selección: { columnas: ["Unidad"], filas: [[1]], total: 1 } },
        };
      }
    },
  });
  let navegador;
  const errores = [];
  try {
    navegador = await chromium.launch({
      headless: true, executablePath: process.env.AMPU_CHROMIUM || undefined,
      args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")],
    });
    const contexto = await navegador.newContext({ reducedMotion: "reduce" });
    let sesion = 0;
    async function paginaPara(t, { ruta = "inicio", width = 1440, height = 900, prefs = {}, actividad = [], almacenamiento = true } = {}) {
      const pagina = await contexto.newPage();
      await pagina.setViewportSize({ width, height });
      pagina.setDefaultTimeout(5000);
      t.after(() => pagina.close());
      pagina.on("pageerror", (error) => errores.push(error.message));
      await pagina.addInitScript(({ prefs, actividad, almacenamiento, sesion }) => {
        if (!almacenamiento) {
          Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Almacenamiento bloqueado", "SecurityError"); } });
          return;
        }
        if (localStorage.getItem("ampu.test.navegacion") !== sesion) {
          localStorage.clear();
          localStorage.setItem("ampu.test.navegacion", sesion);
          localStorage.setItem("ampu.prefs.v1", JSON.stringify({ tema: "claro", sidebar: true, ...prefs }));
          localStorage.setItem("ampu.historial.v1", JSON.stringify(actividad));
        }
      }, { prefs, actividad, almacenamiento, sesion: String(++sesion) });
      await pagina.goto(`${url}#/${ruta}`);
      await pagina.locator("#contenido h1").waitFor();
      return pagina;
    }

    for (const tema of ["claro", "oscuro"]) {
      await t.test(`${tema}: abrir a la izquierda, cerrar con X o Esc y recordar el escritorio`, async (t) => {
        const pagina = await paginaPara(t, { prefs: { tema, sidebar: false } });
        assert.equal(await pagina.locator(".barra-superior__izq #alternar-sidebar").count(), 1);
        assert.equal(await pagina.locator(".barra-superior__der #alternar-sidebar").count(), 0);
        assert.ok((await pagina.locator("#alternar-sidebar").boundingBox()).x < 100);
        assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
        assert.equal(await pagina.locator("#sidebar").getAttribute("aria-hidden"), "true");
        await pagina.locator("#alternar-sidebar").focus();
        await pagina.keyboard.press("Tab");
        assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.contains(document.activeElement)), false, "Tab no entra en enlaces fuera de pantalla");
        assert.equal(await esFoco(pagina, ".migas a"), true);
        await pagina.keyboard.press("Tab");
        assert.equal(await esFoco(pagina, "#abrir-buscador"), true);
        await pagina.locator("#alternar-sidebar").click();
        assert.equal(await pagina.locator("#alternar-sidebar").isVisible(), false);
        assert.equal(await pagina.locator("#alternar-sidebar").getAttribute("aria-expanded"), "true");
        assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), false);
        assert.equal(await pagina.locator(".principal").evaluate((n) => n.inert), false, "el menú de escritorio no bloquea el trabajo");
        assert.equal(await pagina.locator("#cerrar-sidebar").isVisible(), true);
        assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.contains(document.activeElement)), true);
        await pagina.locator("#cerrar-sidebar").click();
        assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
        await pagina.reload();
        await pagina.locator("#contenido h1").waitFor();
        assert.equal(await pagina.locator("#alternar-sidebar").isVisible(), true);
        await pagina.locator("#alternar-sidebar").click();
        await pagina.keyboard.press("Escape");
        assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
        assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
        assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem("ampu.prefs.v1")).sidebar), false);
        // Apertura y cierre en el mismo tick: no queda un temporizador de foco pendiente.
        await pagina.evaluate(() => {
          document.querySelector("#alternar-sidebar").click();
          document.querySelector("#cerrar-sidebar").click();
          document.querySelector("#abrir-buscador").focus();
        });
        await pagina.waitForTimeout(100);
        assert.equal(await esFoco(pagina, "#abrir-buscador"), true);
        const destinos = await pagina.locator("#nav-principal a").evaluateAll((nodos) => nodos.map((n) => n.getAttribute("href")));
        assert.equal(destinos.length, ORDEN_VISTAS.length);
        assert.equal(new Set(destinos).size, destinos.length);
        await pagina.keyboard.press("Control+k");
        await pagina.getByRole("searchbox", { name: "Buscar en AmPu" }).fill("ajustes");
        assert.equal(await pagina.getByRole("option").count(), 1, "el buscador no duplica Ajustes");
      });

      for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
        await t.test(`${tema}: menú móvil modal a ${width}×${height}`, async (t) => {
          const pagina = await paginaPara(t, { width, height, prefs: { tema } });
          assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
          await pagina.locator("#alternar-sidebar").click();
          assert.equal(await pagina.locator("#alternar-sidebar").isVisible(), false);
          assert.equal(await pagina.locator("#sidebar").getAttribute("aria-modal"), "true");
          assert.equal(await pagina.locator("#sidebar").getAttribute("role"), "dialog");
          assert.equal(await pagina.locator(".principal").evaluate((n) => n.inert), true);
          assert.equal(await pagina.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
          await pagina.locator('#nav-principal a[href="#/ajustes"]').focus();
          await pagina.keyboard.press("Tab");
          assert.equal(await esFoco(pagina, ".marca"), true);
          await pagina.keyboard.press("Shift+Tab");
          assert.equal(await esFoco(pagina, '#nav-principal a[href="#/ajustes"]'), true);
          await pagina.keyboard.press("Escape");
          assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
          assert.equal(await pagina.locator(".principal").evaluate((n) => n.inert), false);
          assert.equal(await pagina.locator(".principal").getAttribute("aria-hidden"), null);
          await pagina.locator("#alternar-sidebar").click();
          await pagina.locator("#velo-sidebar").click({ position: { x: width - 8, y: 100 } });
          assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
          assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem("ampu.prefs.v1")).sidebar), true, "el móvil no cambia la preferencia de escritorio");
          await pagina.locator("#alternar-sidebar").click();
          await pagina.locator('#nav-principal a[href="#/ajustes"]').click();
          await pagina.waitForFunction(() => location.hash === "#/ajustes" && document.activeElement.matches("#contenido h1"));
          assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
          assert.equal(await pagina.locator("#velo-sidebar").isVisible(), false);
          // Pulsar el destino que ya está activo también cierra el menú.
          await pagina.locator("#alternar-sidebar").click();
          await pagina.locator('#nav-principal a[href="#/ajustes"]').click();
          assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
          assert.equal(await pagina.locator(".principal").evaluate((n) => n.inert), false);
        });
      }
    }

    await t.test("cambiar de breakpoint, navegar con historial y abrir Ayuda no deja bloqueos", async (t) => {
      const pagina = await paginaPara(t, { width: 390, height: 844, prefs: { sidebar: false } });
      await pagina.locator("#alternar-sidebar").click();
      await pagina.setViewportSize({ width: 1440, height: 900 });
      await pagina.waitForFunction(() => document.querySelector("#sidebar").inert);
      assert.equal(await pagina.locator("#velo-sidebar").isVisible(), false);
      assert.equal(await pagina.locator(".principal").evaluate((n) => n.inert), false);
      await pagina.locator("#alternar-sidebar").click();
      await pagina.setViewportSize({ width: 390, height: 844 });
      await pagina.waitForFunction(() => document.querySelector("#sidebar").inert);
      await pagina.locator("#alternar-sidebar").click();
      await pagina.keyboard.press("Control+Shift+L");
      assert.equal(await pagina.locator("#sidebar").getAttribute("aria-modal"), "true");
      await pagina.keyboard.press("Control+Enter");
      assert.equal(await pagina.locator("dialog[open]").count(), 0);
      await pagina.keyboard.press("F1");
      await pagina.locator("dialog.modal--ayuda[open]").waitFor();
      assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
      assert.equal(await pagina.locator(".principal").evaluate((n) => n.inert), false);
      await pagina.keyboard.press("Escape");
      await pagina.locator("dialog[open]").waitFor({ state: "detached" });
      assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
      await pagina.locator("#alternar-sidebar").click();
      await pagina.locator('#nav-principal a[href="#/ajustes"]').click();
      await pagina.locator("#contenido h1").filter({ hasText: "Ajustes" }).waitFor();
      await pagina.locator("#alternar-sidebar").click();
      await pagina.goBack();
      await pagina.locator("#contenido h1").filter({ hasText: "Probabilidad" }).waitFor();
      assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
      assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains("menu-superpuesto")), false);
    });

    await t.test("Inicio ofrece cada herramienta una vez y limpiar actividad no duplica la vista", async (t) => {
      const pagina = await paginaPara(t, { actividad: [{ titulo: "Un ajuste reciente", ruta: "regresion", fecha: new Date().toISOString() }] });
      const destinos = await pagina.locator("#contenido .tarjeta-herramienta").evaluateAll((nodos) => nodos.map((n) => n.getAttribute("href")));
      assert.equal(destinos.length, 8);
      assert.equal(new Set(destinos).size, 8);
      assert.equal(await pagina.locator(".hero button, .pasos, #contenido .ruta-card").count(), 0);
      assert.equal(await pagina.locator(".actividad__item").count(), 1);
      await pagina.getByRole("button", { name: "Limpiar actividad", exact: true }).click();
      await pagina.getByRole("button", { name: "Limpiar", exact: true }).click();
      await pagina.locator("dialog[open]").waitFor({ state: "detached" });
      assert.equal(await pagina.locator(".actividad__item").count(), 0);
      assert.equal(await pagina.locator("#contenido h1").count(), 1);
      assert.equal(await pagina.locator(".vista-host > .vista").count(), 1);
      assert.equal(await pagina.getByRole("button", { name: "Limpiar actividad", exact: true }).isDisabled(), true);
      assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem("ampu.historial.v1")).length), 0);
    });

    await t.test("Ajustes no duplica Ayuda y sincroniza preferencias, importación y foco", async (t) => {
      const pagina = await paginaPara(t, { ruta: "ajustes" });
      const peticiones = await pagina.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name));
      assert.equal(await pagina.locator("#contenido .atajo-fila, #contenido .vista__acciones").count(), 0);
      const lateral = pagina.getByRole("checkbox", { name: "Mantener el menú visible en escritorio", exact: true });
      assert.equal(await lateral.isChecked(), true);
      await pagina.locator("#cerrar-sidebar").click();
      assert.equal(await lateral.isChecked(), false);
      await pagina.locator("#alternar-sidebar").click();
      assert.equal(await lateral.isChecked(), true);
      const oscuro = pagina.locator(".tema-opcion").filter({ hasText: "Oscuro" });
      await oscuro.focus();
      await pagina.keyboard.press("Enter");
      assert.equal(await oscuro.getAttribute("aria-pressed"), "true");
      assert.equal(await oscuro.evaluate((n) => n === document.activeElement), true);
      await pagina.keyboard.press("Control+Shift+L");
      assert.match(await pagina.locator('.tema-opcion[aria-pressed="true"]').innerText(), /Sistema/);
      await pagina.locator('input[type="file"]').setInputFiles({
        name: "preferencias.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ prefs: { tema: "oscuro", sidebar: false, decimales: 6, reducir_movimiento: true } })),
      });
      await pagina.waitForFunction(() => document.documentElement.dataset.tema === "oscuro");
      assert.equal(await lateral.isChecked(), false);
      assert.equal(await pagina.getByRole("checkbox", { name: "Reducir animaciones", exact: true }).isChecked(), true);
      assert.equal(await pagina.getByRole("textbox", { name: "Decimales al mostrar resultados", exact: true }).inputValue(), "6");
      assert.ok(!peticiones.some((ruta) => ruta.endsWith("/ayuda.js")), "Ajustes no carga el módulo de ayuda");
    });

    await t.test("los campos respetan disabled y separan el nombre de la casilla de su ayuda", async (t) => {
      const pagina = await paginaPara(t);
      const tipos = ["numero", "entero", "serie", "matriz", "select", "checkbox"];
      await pagina.evaluate(async (tipos) => {
        const { campo } = await import("/static/js/ui.js");
        for (const tipo of tipos) {
          const entrada = campo({ etiqueta: `Campo ${tipo}`, tipo, ayuda: `Ayuda de ${tipo}`, valor: tipo === "checkbox" ? true : "1", opciones: [["1", "Uno"]], deshabilitado: true });
          document.querySelector("main").append(entrada.envoltura);
        }
      }, tipos);
      for (const tipo of tipos) {
        assert.equal(await pagina.getByLabel(`Campo ${tipo}`, { exact: true }).isDisabled(), true, tipo);
      }
      assert.equal(await pagina.getByRole("checkbox", { name: "Campo checkbox", exact: true }).count(), 1);
      assert.equal(await pagina.locator("[deshabilitado]").count(), 0);
      const idAyuda = (await pagina.getByLabel("Campo checkbox", { exact: true }).getAttribute("aria-describedby")).split(" ")[0];
      assert.equal(await pagina.locator(`#${idAyuda}`).innerText(), "Ayuda de checkbox");
    });

    await t.test("la aplicación sigue operativa cuando el navegador bloquea el almacenamiento", async (t) => {
      const pagina = await paginaPara(t, { almacenamiento: false });
      await pagina.locator("#cerrar-sidebar").click();
      assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
      await pagina.keyboard.press("F1");
      await pagina.locator("dialog.modal--ayuda[open]").waitFor();
      assert.equal(await pagina.locator(".ayuda-paso").count(), 3);
    });

    await t.test("la copia remota no sobrescribe el menú si el usuario ya lo cambió al arrancar", async (t) => {
      let liberar;
      preferenciasPendientes = new Promise((resolve) => { liberar = resolve; });
      const pagina = await contexto.newPage();
      t.after(() => pagina.close());
      pagina.on("pageerror", (error) => errores.push(error.message));
      try {
        await pagina.addInitScript(() => localStorage.clear());
        await pagina.goto(url, { waitUntil: "domcontentloaded" });
        await pagina.locator("#nav-principal a").last().waitFor();
        await pagina.locator("#cerrar-sidebar").click();
        liberar({ tema: "oscuro", sidebar: true });
        await pagina.locator("#contenido h1").waitFor();
        assert.equal(await pagina.locator("#sidebar").evaluate((n) => n.inert), true);
        assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem("ampu.prefs.v1")).sidebar), false);
      } finally {
        liberar({});
        preferenciasPendientes = null;
      }
    });

    await t.test("el menú conserva el cierre y no desborda con texto al 200 %", async (t) => {
      const pagina = await paginaPara(t, { width: 320, height: 568 });
      await pagina.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
      await pagina.locator("#alternar-sidebar").click();
      const medidas = await pagina.locator("#cerrar-sidebar").boundingBox();
      assert.ok(medidas.x >= 0 && medidas.x + medidas.width <= 320 && medidas.y + medidas.height <= 568);
      await pagina.locator("#cerrar-sidebar").click();
      assert.equal(await esFoco(pagina, "#alternar-sidebar"), true);
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });

    await t.test("Limpiar en inferencia conserva los campos y un único estado de resultado", async (t) => {
      const pagina = await paginaPara(t, { ruta: "inferencia/t_una" });
      const muestra = pagina.getByRole("textbox", { name: /^Muestra/ });
      await muestra.fill("1 2 3 4");
      await pagina.getByRole("button", { name: "Limpiar", exact: true }).click();
      assert.equal(await muestra.inputValue(), "");
      assert.equal(await pagina.getByRole("button", { name: "Ejecutar prueba", exact: true }).isVisible(), true);
      assert.equal(await pagina.locator(".resultado-prueba").count(), 1);
      await pagina.getByRole("button", { name: "Cargar ejemplo", exact: true }).click();
      assert.notEqual(await muestra.inputValue(), "");
      await pagina.getByRole("button", { name: "Limpiar", exact: true }).click();
      assert.equal(await pagina.locator(".resultado-prueba").count(), 1);
      assert.equal(await pagina.getByRole("button", { name: "Ejecutar con el ejemplo", exact: true }).count(), 0);
    });

    await t.test("la proporción nula excluye 0 y 1 sin imponer un mínimo artificial", async (t) => {
      const pagina = await paginaPara(t, { ruta: "inferencia/prop_una" });
      const p0 = pagina.getByRole("textbox", { name: /^Proporción nula/ });
      const peticiones = [];
      pagina.on("request", (r) => { if (r.url().endsWith("/api/inferencia")) peticiones.push(r.postDataJSON()); });
      for (const [valor, error] of [["0", "Debe ser mayor que 0."], ["1", "Debe ser menor que 1."]]) {
        await p0.fill(valor);
        await pagina.getByRole("button", { name: "Ejecutar prueba", exact: true }).click();
        assert.equal(await p0.getAttribute("aria-invalid"), "true");
        assert.equal(await p0.locator("..").locator(".campo__error").textContent(), error);
      }
      assert.deepEqual(peticiones, [], "los extremos no se envían al motor");
      await p0.fill("0,000001");
      await pagina.getByRole("button", { name: "Ejecutar prueba", exact: true }).click();
      await pagina.getByRole("heading", { name: "Resultado", exact: true }).waitFor();
      assert.equal(await p0.getAttribute("aria-invalid"), null);
      assert.equal(peticiones.length, 1);
      assert.equal(peticiones[0].p0, .000001);
    });

    await t.test("Usar este n desactiva el tamaño automático y Ctrl+Enter usa el formulario activo", async (t) => {
      const pagina = await paginaPara(t, { ruta: "muestreo/finito" });
      const automatico = pagina.getByRole("checkbox", { name: "Calcular n automáticamente", exact: true });
      const muestraN = pagina.getByRole("textbox", { name: /^Unidades a extraer/ });
      await automatico.check();
      assert.equal(await muestraN.isDisabled(), true);
      await pagina.getByRole("textbox", { name: /^Tamaño de la población N/ }).fill("500");
      await pagina.getByRole("textbox", { name: /^Semilla aleatoria/ }).fill("0");
      await pagina.getByRole("button", { name: "Calcular n", exact: true }).click();
      await pagina.getByRole("button", { name: "Usar este n", exact: true }).click();
      assert.equal(await automatico.isChecked(), false);
      assert.equal(await muestraN.isDisabled(), false);
      assert.equal(await muestraN.inputValue(), "73");
      assert.equal(await muestraN.getAttribute("aria-required"), "true");
      assert.equal(await pagina.getByRole("textbox", { name: /^Población N/ }).inputValue(), "500");
      await muestraN.focus();
      const peticion = pagina.waitForRequest((p) => p.url().endsWith("/api/muestreo") && p.method() === "POST");
      await pagina.keyboard.press("Control+Enter");
      const datos = (await peticion).postDataJSON();
      assert.deepEqual({ auto: datos.auto, n: datos.n, N: datos.N, semilla: datos.semilla }, { auto: false, n: 73, N: 500, semilla: 0 });
      await pagina.getByRole("heading", { name: "Diseño ejecutado", exact: true }).waitFor();
    });

    await t.test("semilla cero y todos los parámetros de estratos siguen disponibles en móvil", async (t) => {
      const pagina = await paginaPara(t, { width: 390, height: 844 });
      await pagina.evaluate(async () => {
        const { transito, navegar } = await import("/static/js/store.js");
        transito.muestreo = { semilla: 0 };
        navegar("muestreo/neyman");
      });
      await pagina.getByRole("textbox", { name: /^Semilla aleatoria/ }).waitFor();
      assert.equal(await pagina.getByRole("textbox", { name: /^Semilla aleatoria/ }).inputValue(), "0");
      assert.equal(await pagina.getByRole("textbox", { name: /^Población N/ }).isDisabled(), true);
      for (const nombre of ["Desviación del grupo 1", "Coste del grupo 1"]) {
        assert.equal(await pagina.getByRole("textbox", { name: nombre, exact: true }).isVisible(), true);
        await pagina.getByRole("textbox", { name: nombre, exact: true }).fill("2");
      }
      await pagina.getByRole("button", { name: /^Asignación óptima con costes/ }).click();
      assert.equal(await pagina.getByRole("textbox", { name: /^Semilla aleatoria/ }).inputValue(), "0");
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin desbordamiento horizontal");
    });

    await t.test("trasladar unidades desde conglomerados elige un diseño compatible", async (t) => {
      const pagina = await paginaPara(t, { ruta: "muestreo/conglomerados" });
      await pagina.getByRole("button", { name: "Calcular n", exact: true }).click();
      await pagina.getByRole("button", { name: "Usar este n", exact: true }).click();
      assert.equal(await pagina.evaluate(() => location.hash), "#/muestreo/finito");
      assert.equal(await pagina.getByRole("textbox", { name: /^Unidades a extraer/ }).inputValue(), "73");
      assert.equal(await pagina.getByRole("checkbox", { name: "Calcular n automáticamente", exact: true }).isChecked(), false);
    });

    await t.test("el margen para medias admite unidades mayores que uno y distingue tamaños por grupo", async (t) => {
      const pagina = await paginaPara(t, { ruta: "muestreo/finito" });
      await pagina.getByRole("button", { name: /^Una media/ }).click();
      const margen = pagina.getByRole("textbox", { name: /^Margen de error absoluto/ });
      await margen.fill("2");
      await margen.focus();
      let peticion = pagina.waitForRequest((p) => p.url().endsWith("/api/muestreo/tamano"));
      await pagina.keyboard.press("Control+Enter");
      assert.equal((await peticion).postDataJSON().error, 2);
      await pagina.getByRole("button", { name: "Usar este n", exact: true }).waitFor();
      assert.equal(await margen.getAttribute("aria-invalid"), null);
      await pagina.getByRole("button", { name: /^Diferencia de medias/ }).click();
      assert.equal(await pagina.getByRole("textbox", { name: /^Tamaño de la población N/ }).isVisible(), false);
      peticion = pagina.waitForRequest((p) => p.url().endsWith("/api/muestreo/tamano"));
      await pagina.getByRole("button", { name: "Calcular n", exact: true }).click();
      assert.equal((await peticion).postDataJSON().N, null);
      await pagina.getByText("Tamaño por grupo para dos muestras independientes.", { exact: true }).waitFor();
    });

    await t.test("el muestreo con reemplazo permite n mayor que N", async (t) => {
      const pagina = await paginaPara(t, { ruta: "muestreo/infinito" });
      await pagina.getByRole("textbox", { name: /^Población N/ }).fill("2");
      await pagina.getByRole("textbox", { name: /^Unidades a extraer/ }).fill("5");
      const peticion = pagina.waitForRequest((p) => p.url().endsWith("/api/muestreo"));
      await pagina.getByRole("button", { name: "Sortear muestra", exact: true }).click();
      assert.equal((await peticion).postDataJSON().n, 5);
      await pagina.getByRole("heading", { name: "Diseño ejecutado", exact: true }).waitFor();
    });
    assert.deepEqual(errores, [], "sin excepciones de JavaScript durante la auditoría");
  } finally {
    if (navegador) await navegador.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
