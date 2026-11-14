// Centro de ayuda con Chromium opcional; shell real y API mínima, sin motor Python.
// Usa las mismas variables AMPU_CHROMIUM y AMPU_CHROMIUM_ARGS que gráficos/temas.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ATAJOS } from "../frontend/static/js/data.js";
import { servidorFrontend } from "./helpers/frontend.mjs";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

async function abrir(pagina) {
  await pagina.locator("#boton-ayuda").click();
  await pagina.locator("dialog.modal--ayuda[open]").waitFor();
}

async function comprobarLimites(pagina) {
  const medidas = await pagina.locator("dialog.modal--ayuda").evaluate((dialogo) => {
    const rect = (nodo) => {
      const { left, right, top, bottom } = nodo.getBoundingClientRect();
      return { left, right, top, bottom, desborde: nodo.scrollWidth - nodo.clientWidth };
    };
    return {
      ancho: window.innerWidth, alto: window.innerHeight, dialogo: rect(dialogo),
      controles: [...dialogo.querySelectorAll(".modal__cabecera, .ayuda__pestanas, .modal__pie")].map(rect),
      contenido: rect(dialogo.querySelector(".ayuda__panel")),
    };
  });
  assert.ok(medidas.dialogo.left >= 0 && medidas.dialogo.right <= medidas.ancho + 1, "el diálogo cabe en el ancho disponible");
  assert.ok(medidas.dialogo.top >= 0 && medidas.dialogo.bottom <= medidas.alto + 1, "el diálogo cabe en el alto disponible");
  assert.ok(medidas.contenido.bottom - medidas.contenido.top > 40, "el contenido conserva un área desplazable");
  for (const rect of [medidas.dialogo, medidas.contenido, ...medidas.controles]) {
    assert.ok(rect.desborde <= 1, "sin desbordamiento horizontal");
    assert.ok(rect.left >= medidas.dialogo.left && rect.right <= medidas.dialogo.right + 1, "controles dentro del diálogo");
    assert.ok(rect.top >= medidas.dialogo.top && rect.bottom <= medidas.dialogo.bottom + 1, "cabecera y cierre siempre visibles");
  }
}

test("ayuda: carga diferida, accesibilidad, atajos, navegación y diseño responsivo", {
  skip: !chromium && "Prueba opcional: instala playwright-core y Chromium.",
}, async (t) => {
  const { servidor, url } = await servidorFrontend();
  let navegador;
  try {
    navegador = await chromium.launch({
      headless: true, executablePath: process.env.AMPU_CHROMIUM || undefined,
      args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")],
    });
    const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const errores = [];
    const peticiones = [];
    pagina.on("pageerror", (error) => errores.push(error.message));
    pagina.on("request", (peticion) => peticiones.push(peticion.url()));
    await pagina.goto(url);
    await pagina.locator("#contenido h1").waitFor();

    await t.test("solo carga la ayuda al abrirla y ofrece pestañas accesibles", async () => {
      assert.ok(!peticiones.some((ruta) => ruta.endsWith("/ayuda.js")));
      await abrir(pagina);
      const dialogo = pagina.getByRole("dialog", { name: "Ayuda y atajos", exact: true });
      assert.equal(await dialogo.count(), 1);
      assert.ok(await dialogo.getAttribute("aria-describedby"));
      assert.equal(await pagina.getByRole("tab", { name: "Guía rápida" }).getAttribute("aria-selected"), "true");
      assert.equal(await dialogo.locator(".ayuda-paso").count(), 3);
      await pagina.getByRole("tab", { name: "Guía rápida" }).focus();
      await pagina.keyboard.press("ArrowRight");
      assert.equal(await pagina.getByRole("tab", { name: "Atajos de teclado" }).getAttribute("aria-selected"), "true");
      assert.equal(await dialogo.locator(".atajo-fila").count(), ATAJOS.length);
      const panel = pagina.getByRole("tabpanel");
      assert.equal(await panel.getAttribute("aria-labelledby"), await pagina.getByRole("tab", { name: "Atajos de teclado" }).getAttribute("id"));
      await pagina.keyboard.press("Home");
      assert.equal(await pagina.getByRole("tab", { name: "Guía rápida" }).getAttribute("aria-selected"), "true");
      await pagina.keyboard.press("End");
    });

    await t.test("búsqueda inmediata, alternativas y estado vacío recuperable", async () => {
      const busqueda = pagina.getByRole("searchbox", { name: "Buscar atajos de teclado" });
      await busqueda.fill("GRAFICOS");
      assert.equal(await pagina.locator(".atajo-fila").count(), 6);
      await busqueda.fill("Ctrl+Enter");
      assert.equal(await pagina.locator(".atajo-fila").count(), 1);
      assert.equal(await pagina.locator(".atajo-fila").getAttribute("data-atajo"), "calcular");
      await busqueda.fill("inexistente");
      assert.equal(await pagina.locator(".atajo-fila").count(), 0);
      assert.equal(await pagina.locator(".ayuda__cuenta").textContent(), `0 de ${ATAJOS.length} atajos`);
      await pagina.locator(".ayuda__vacio button").click();
      assert.equal(await busqueda.inputValue(), "");
      assert.equal(await pagina.locator(".atajo-fila").count(), ATAJOS.length);
      assert.equal(await busqueda.evaluate((nodo) => nodo === document.activeElement), true);
      assert.equal(await pagina.locator('[data-atajo="ayuda"] .teclas__alternativa').textContent(), "o");
      await busqueda.fill("tema");
      await pagina.getByRole("tab", { name: "Guía rápida" }).click();
      await pagina.getByRole("tab", { name: "Atajos de teclado" }).click();
      assert.equal(await busqueda.inputValue(), "tema", "cambiar de pestaña conserva la búsqueda");
    });

    await t.test("el foco permanece dentro del diálogo al recorrer sus controles", async () => {
      await pagina.getByRole("button", { name: "Entendido", exact: true }).focus();
      for (let i = 0; i < 8; i++) {
        await pagina.keyboard.press("Tab");
        assert.equal(await pagina.evaluate(() => Boolean(document.activeElement.closest("dialog.modal--ayuda"))), true);
      }
      await pagina.keyboard.press("Shift+Tab");
      assert.equal(await pagina.evaluate(() => Boolean(document.activeElement.closest("dialog.modal--ayuda"))), true);
    });

    await t.test("no activa acciones detrás del diálogo ni duplica la ayuda", async () => {
      await pagina.evaluate(() => {
        window.calculosDePrueba = 0;
        const boton = document.createElement("button");
        boton.dataset.accionPrimaria = "true";
        boton.textContent = "Cálculo de prueba";
        boton.onclick = () => window.calculosDePrueba++;
        document.querySelector("main").prepend(boton);
      });
      await pagina.keyboard.press("Control+Enter");
      await pagina.keyboard.press("Control+k");
      await pagina.keyboard.press("Alt+g");
      assert.equal(await pagina.evaluate(() => window.calculosDePrueba), 0);
      await pagina.keyboard.press("F1");
      await pagina.keyboard.press("F1");
      assert.equal(await pagina.locator("dialog[open]").count(), 1);
      await pagina.keyboard.press("Escape");
      await pagina.locator("dialog[open]").waitFor({ state: "detached" });
      assert.equal(await pagina.locator("#boton-ayuda").evaluate((nodo) => nodo === document.activeElement), true);
      await pagina.keyboard.press("Control+Enter");
      assert.equal(await pagina.evaluate(() => window.calculosDePrueba), 1, "el atajo vuelve a funcionar fuera del diálogo");
      await pagina.keyboard.press("?");
      await pagina.locator("dialog.modal--ayuda[open]").waitFor();
      await pagina.keyboard.press("Escape");
      await pagina.locator("dialog[open]").waitFor({ state: "detached" });
    });

    await t.test("las acciones por teclado navegan sin temporizadores que roben el foco", async () => {
      await abrir(pagina);
      const ajustes = pagina.getByRole("button", { name: /Abrir ajustes/ });
      await ajustes.focus();
      await pagina.keyboard.press("Enter");
      await pagina.waitForFunction(() => location.hash === "#/ajustes" && document.activeElement?.matches("#contenido h1"));
      assert.equal(await pagina.locator("dialog[open]").count(), 0);
      assert.equal(await pagina.locator("#contenido .atajo-fila").count(), 0, "los atajos solo aparecen en Ayuda, no se duplican en Ajustes");
    });

    for (const tema of ["claro", "oscuro"]) {
      for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900], [844, 390]]) {
        await t.test(`${tema}: guía y atajos a ${width}×${height}`, async () => {
          await pagina.setViewportSize({ width, height });
          await pagina.evaluate((tema) => { document.documentElement.dataset.tema = tema; }, tema);
          await abrir(pagina);
          await comprobarLimites(pagina);
          await pagina.getByRole("tab", { name: "Atajos de teclado" }).click();
          await comprobarLimites(pagina);
          await pagina.keyboard.press("Escape");
          await pagina.locator("dialog[open]").waitFor({ state: "detached" });
        });
      }
    }

    await t.test("texto ampliado al 200 % sin recortar pestañas ni cierre", async () => {
      await pagina.setViewportSize({ width: 390, height: 844 });
      await pagina.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
      await abrir(pagina);
      await comprobarLimites(pagina);
      await pagina.getByRole("tab", { name: "Atajos de teclado" }).click();
      await comprobarLimites(pagina);
      await pagina.keyboard.press("Escape");
      await pagina.locator("dialog[open]").waitFor({ state: "detached" });
      await pagina.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
    });

    await t.test("Windows: etiquetas fijas y Meta no activa la aplicación", async () => {
      await pagina.addInitScript(() => {
        Object.defineProperty(navigator, "platform", { value: "MacIntel" });
        Object.defineProperty(navigator, "userAgentData", { value: { platform: "macOS" } });
      });
      await pagina.setViewportSize({ width: 1000, height: 900 });
      await pagina.goto(url);
      await pagina.locator("#contenido h1").waitFor();
      assert.equal(await pagina.locator('[data-atajo="buscar"]').textContent(), "Ctrl K");
      assert.equal(await pagina.locator("#abrir-buscador").getAttribute("aria-keyshortcuts"), "Control+K");
      await pagina.keyboard.press("Meta+k");
      assert.equal(await pagina.locator("dialog[open]").count(), 0);
      await pagina.keyboard.press("Control+k");
      await pagina.getByRole("dialog", { name: "Buscar en AmPu" }).waitFor();
      await pagina.keyboard.press("Escape");
      await pagina.locator("dialog[open]").waitFor({ state: "detached" });
      await abrir(pagina);
      await pagina.getByRole("tab", { name: "Atajos de teclado" }).click();
      assert.deepEqual(await pagina.locator('[data-atajo="buscar"] kbd').allTextContents(), ["Ctrl", "K"]);
      assert.equal(await pagina.locator('[data-atajo="buscar"] .teclas').getAttribute("aria-label"), "Control más K");
      assert.deepEqual(await pagina.locator('[data-atajo="grafico"] kbd').allTextContents(), ["Alt", "G"]);
      assert.match(await pagina.locator(".ayuda__plataforma").innerText(), /Windows/);
      await pagina.getByRole("searchbox").fill("control intro");
      assert.equal(await pagina.locator(".atajo-fila").getAttribute("data-atajo"), "calcular");
    });
    assert.deepEqual(errores, [], "sin errores de JavaScript en todo el recorrido");
  } finally {
    if (navegador) await navegador.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
