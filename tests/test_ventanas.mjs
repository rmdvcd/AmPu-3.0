// Pruebas del gestor de ventanas emergentes arrastrables/redimensionables y flujos en diálogos.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { NOMBRES_ICONOS } from "../frontend/static/js/icons.js";
import { servidorFrontend } from "./helpers/frontend.mjs";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

test("estructura HTML, CSS e iconos del gestor de ventanas emergentes", async () => {
  const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
  assert.match(html, /id="capa-ventanas"/);
  assert.match(html, /id="barra-ventanas"/);

  const css = await readFile(new URL("../frontend/static/css/app.css", import.meta.url), "utf8");
  for (const selector of [".capa-ventanas", ".ventana", ".ventana__barra", ".ventana__borde--se", ".barra-ventanas", ".barra-resultados", ".teoria-catalogo"]) {
    assert.ok(css.includes(selector), `Falta el selector CSS ${selector}`);
  }

  for (const iconoReq of ["minimizar", "maximizar", "restaurar", "ventanas"]) {
    assert.ok(NOMBRES_ICONOS.includes(iconoReq), `Falta el icono ${iconoReq}`);
  }
});

test("todas las vistas principales integran ventanas emergentes y diálogo de teoría", async () => {
  const vistasVentanas = [
    ["distribuciones.js", "abrirFichaModeloVentana"],
    ["descriptiva.js", "barraResultados"],
    ["probabilidad.js", "barraResultados"],
    ["inferencia.js", "barraResultados"],
    ["regresion.js", "barraResultados"],
    ["muestreo.js", "barraResultados"],
    ["simulacion.js", "barraResultados"],
    ["teoria.js", "abrirTeoriaVentana"],
  ];
  for (const [archivo, token] of vistasVentanas) {
    const codigo = await readFile(new URL(`../frontend/static/js/views/${archivo}`, import.meta.url), "utf8");
    assert.ok(codigo.includes(token), `${archivo} debe usar ${token}`);
    assert.ok(codigo.includes("abrirTeoriaVentana"), `${archivo} debe abrir teoría en ventana emergente`);
  }
});

test("ventanas emergentes: arrastrar, redimensionar, minimizar, maximizar, dock y teoría en Chromium", {
  skip: !chromium && "Prueba opcional: instala playwright-core y Chromium.",
}, async (t) => {
  const modeloNormal = {
    clave: "normal",
    nombre: "Normal general",
    resumen: "Distribución normal.",
    discreta: false,
    dimensionalidad: "univariante",
    teoria: "normal",
    parametros: [
      { id: "mu", simbolo: "μ", etiqueta: "Media", tipo: "float", default: 0 },
      { id: "sigma", simbolo: "σ", etiqueta: "Desviación", tipo: "float", default: 1, min: 0.0001 },
    ],
    formula: "f(x)=\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}",
    ejemplo: "Ejemplo",
    ejemplo_html: "<ol><li>Datos</li><li>Cálculo</li><li>Resultado</li><li>Interpretación</li></ol>",
    propiedades: "Simétrica",
    propiedades_html: "<p>Simétrica respecto a μ.</p>",
    soporte_sugerido: ["−∞", "∞"],
    x_sugerido: 1,
  };
  const leccionNormal = {
    clave: "normal",
    titulo: "Distribución normal",
    categoria: "distribuciones",
    minutos: 4,
    html: '<h1 id="normal">Normal</h1><h2 id="def">Definición</h2><p>Campana de Gauss.</p>',
    formula: "f(x)=\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}",
    toc: [{ id: "def", nivel: 2, texto: "Definición" }],
    relacionados: [],
    navegacion: {},
  };

  const { servidor, url } = await servidorFrontend({
    meta: {
      distribuciones: [modeloNormal],
      teoria: [{ clave: "normal", titulo: "Distribución normal", categoria: "distribuciones", resumen: "Campana de Gauss.", minutos: 4 }],
    },
    api: (ruta) => {
      if (ruta === "/api/teoria/normal") return leccionNormal;
      if (ruta === "/api/distribuciones/calcular") {
        return {
          modelo: "normal",
          resumen: "Cálculo normal",
          media: 0,
          varianza: 1,
          desviacion: 1,
          mediana: 0,
          asimetria: 0,
          curtosis: 0,
          discreta: false,
          punto: { x: 1, pdf: 0.24197, cdf: 0.841345, sf: 0.158655, cuantil: 0, masa_en_punto: null },
          curva: { x: [-3, -1, 0, 1, 3], pdf: [0.004, 0.24, 0.399, 0.24, 0.004], cdf: [0.001, 0.159, 0.5, 0.841, 0.999] },
          tabla: [{ x: -1, p: 0.24, F: 0.159 }, { x: 0, p: 0.399, F: 0.5 }, { x: 1, p: 0.24, F: 0.841 }],
          avisos: [],
        };
      }
    },
  });

  let navegador;
  try {
    navegador = await chromium.launch({
      headless: true,
      executablePath: process.env.AMPU_CHROMIUM || undefined,
      args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")],
    });
    const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await pagina.goto(`${url}#/distribuciones/normal`);
    await pagina.locator("#contenido h1").waitFor();

    await t.test("abre Resultados, Gráfico, Tabla y Teoría en paralelo sin perder el formulario", async () => {
      await pagina.getByRole("button", { name: "Calcular", exact: true }).click();
      const vResultados = pagina.locator('.ventana[data-ventana-id="dist-resultados"]');
      await vResultados.waitFor();
      assert.equal(await vResultados.getAttribute("aria-modal"), "false");

      await vResultados.getByRole("button", { name: "Ver gráfico", exact: true }).click();
      const vGrafico = pagina.locator('.ventana[data-ventana-id="dist-grafico"]');
      await vGrafico.waitFor();

      await vResultados.getByRole("button", { name: "Ver tabla", exact: true }).click();
      const vTabla = pagina.locator('.ventana[data-ventana-id="dist-tabla"]');
      await vTabla.waitFor();

      assert.equal(await pagina.locator("#capa-ventanas .ventana").count(), 3);
      assert.equal(await pagina.locator("#barra-ventanas").isVisible(), true);
      assert.equal(await pagina.locator(".barra-resultados").isVisible(), true);
    });

    await t.test("arrastrar, redimensionar, minimizar, maximizar y cerrar con Esc", async () => {
      const vTabla = pagina.locator('.ventana[data-ventana-id="dist-tabla"]');
      const cajaAntes = await vTabla.boundingBox();
      const barra = vTabla.locator(".ventana__barra");
      const cajaBarra = await barra.boundingBox();

      await pagina.mouse.move(cajaBarra.x + 80, cajaBarra.y + 15);
      await pagina.mouse.down();
      await pagina.mouse.move(cajaBarra.x + 140, cajaBarra.y + 55);
      await pagina.mouse.up();
      const cajaMovida = await vTabla.boundingBox();
      assert.ok(cajaMovida.x > cajaAntes.x + 30 && cajaMovida.y > cajaAntes.y + 20);

      const bordeSE = vTabla.locator(".ventana__borde--se");
      const boxSE = await bordeSE.boundingBox();
      await pagina.mouse.move(boxSE.x + boxSE.width / 2, boxSE.y + boxSE.height / 2);
      await pagina.mouse.down();
      await pagina.mouse.move(boxSE.x + 60, boxSE.y + 40);
      await pagina.mouse.up();
      const cajaRedim = await vTabla.boundingBox();
      assert.ok(cajaRedim.width > cajaMovida.width + 30 && cajaRedim.height > cajaMovida.height + 20);

      await vTabla.locator('button[aria-label="Minimizar ventana"]').click();
      assert.equal(await vTabla.isVisible(), false);
      assert.equal(await pagina.locator("#barra-ventanas .barra-ventanas__item--minimizada").count(), 1);

      await pagina.locator("#barra-ventanas .barra-ventanas__item--minimizada").click();
      assert.equal(await vTabla.isVisible(), true);

      await pagina.keyboard.press("Escape");
      assert.equal(await pagina.locator("#capa-ventanas .ventana").count(), 2);
    });

    await t.test("catálogo de teoría abre la lección en ventana emergente", async () => {
      await pagina.goto(`${url}#/teoria`);
      await pagina.locator("#capa-ventanas .ventana").waitFor({ state: "detached" });
      await pagina.locator(".teoria-catalogo .modelo-item").first().click();
      const vTeoria = pagina.locator('.ventana[data-ventana-id="ventana-teoria"]');
      await vTeoria.waitFor();
      assert.match(await vTeoria.textContent(), /Campana de Gauss/);
    });
  } finally {
    await navegador?.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
