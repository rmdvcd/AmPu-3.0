// Pruebas del recorrido inicial guiado (walkthrough) para cada componente de AmPu.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { VISTAS } from "../frontend/static/js/data.js";
import { servidorFrontend } from "./helpers/frontend.mjs";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

function instalarEntornoWalkthrough() {
  const memStorage = new Map();
  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    Node: globalThis.Node,
    localStorage: globalThis.localStorage,
    CustomEvent: globalThis.CustomEvent,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    location: globalThis.location,
  };

  class FakeNode {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.attrs = {};
      this.style = { removeProperty: (k) => { delete this.style[k]; } };
      this.dataset = {};
      this.listeners = new Map();
      this.className = "";
      this._textContent = "";
      this.hidden = false;
      this.disabled = false;
      this.offsetHeight = 240;
      this.isConnected = true;
    }
    set textContent(v) { this._textContent = v == null ? "" : String(v); this.children = []; }
    get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._textContent; }
    set innerHTML(v) { this._innerHTML = String(v); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
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
    replaceChildren(...nodos) { this.children = []; this._textContent = ""; this.append(...nodos); }
    remove() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      }
      this.isConnected = false;
    }
    contains(n) {
      if (n === this) return true;
      return this.children.some((c) => c.contains?.(n));
    }
    closest() { return null; }
    getBoundingClientRect() { return { left: 40, top: 80, width: 320, height: 120, right: 360, bottom: 200 }; }
    scrollIntoView() {}
    focus() { globalThis.document.activeElement = this; }
    addEventListener(t, fn) { if (!this.listeners.has(t)) this.listeners.set(t, []); this.listeners.get(t).push(fn); }
    removeEventListener(t, fn) {
      if (!this.listeners.has(t)) return;
      this.listeners.set(t, this.listeners.get(t).filter((f) => f !== fn));
    }
    dispatchEvent(ev) { (this.listeners.get(ev.type) || []).forEach((fn) => fn(ev)); }
    querySelectorAll(sel) {
      const out = [];
      const coinc = (n) => {
        if (sel.startsWith(".")) return n.className.split(/\s+/).includes(sel.slice(1));
        if (sel.startsWith("#")) return n.attrs.id === sel.slice(1);
        return n.tagName.toLowerCase() === sel.toLowerCase();
      };
      const walk = (n) => { for (const h of n.children) { if (coinc(h)) out.push(h); walk(h); } };
      walk(this);
      return out;
    }
  }

  const body = new FakeNode("body");
  const winListeners = new Map();
  const docListeners = new Map();
  const docEl = new FakeNode("html");
  const winObj = {
    innerWidth: 1280,
    innerHeight: 860,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener(t, fn) { if (!winListeners.has(t)) winListeners.set(t, []); winListeners.get(t).push(fn); },
    removeEventListener(t, fn) { if (winListeners.has(t)) winListeners.set(t, winListeners.get(t).filter((f) => f !== fn)); },
    dispatchEvent(ev) { (winListeners.get(ev.type) || []).forEach((fn) => fn(ev)); },
  };
  globalThis.Node = FakeNode;
  globalThis.localStorage = {
    getItem: (k) => (memStorage.has(k) ? memStorage.get(k) : null),
    setItem: (k, v) => memStorage.set(k, String(v)),
    removeItem: (k) => memStorage.delete(k),
    clear: () => memStorage.clear(),
  };
  globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.location = { hash: "#/inicio" };
  globalThis.window = winObj;
  globalThis.document = {
    body,
    documentElement: docEl,
    activeElement: null,
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => { const n = new FakeNode("#text"); n._textContent = String(t); return n; },
    getElementById: () => null,
    querySelector: () => null,
    addEventListener(t, fn) { if (!docListeners.has(t)) docListeners.set(t, []); docListeners.get(t).push(fn); },
    removeEventListener(t, fn) { if (docListeners.has(t)) docListeners.set(t, docListeners.get(t).filter((f) => f !== fn)); },
    dispatchEvent(ev) { (docListeners.get(ev.type) || []).forEach((fn) => fn(ev)); },
  };

  return {
    body,
    memStorage,
    restaurar: () => {
      Object.assign(globalThis, prev);
    },
  };
}

let env;
let walkthrough;
let store;

before(async () => {
  env = instalarEntornoWalkthrough();
  store = await import("../frontend/static/js/store.js");
  walkthrough = await import("../frontend/static/js/walkthrough.js");
});

after(() => {
  env?.restaurar();
});

test("el recorrido inicial cubre todos los componentes de la aplicación y tiene estilos e integración", async () => {
  const { PASOS_WALKTHROUGH } = walkthrough;
  const ids = PASOS_WALKTHROUGH.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const vista of Object.keys(VISTAS)) {
    const cubierto = PASOS_WALKTHROUGH.some(
      (p) => p.id === vista || p.ruta === vista || (vista === "inicio" && p.id === "bienvenida") || (vista === "ajustes" && p.ruta === "ajustes")
    );
    assert.ok(cubierto, `Falta paso del recorrido para la vista ${vista}`);
  }
  for (const requerido of ["menu", "buscador", "tema", "ayuda", "ventanas"]) {
    assert.ok(ids.includes(requerido), `Falta paso para el componente ${requerido}`);
  }
  for (const paso of PASOS_WALKTHROUGH) {
    assert.ok(paso.componente && paso.titulo && paso.texto && typeof paso.objetivo === "function");
  }

  const css = await readFile(new URL("../frontend/static/css/app.css", import.meta.url), "utf8");
  for (const selector of [".tour-capa", ".tour-resaltado", ".tour-tarjeta", ".tour-progreso", ".tour-puntos"]) {
    assert.ok(css.includes(selector), `Falta selector CSS ${selector}`);
  }

  const appJs = await readFile(new URL("../frontend/static/js/app.js", import.meta.url), "utf8");
  assert.ok(appJs.includes("walkthroughCompletado"));
  assert.ok(appJs.includes("walkthrough.js"));

  const ayudaJs = await readFile(new URL("../frontend/static/js/ayuda.js", import.meta.url), "utf8");
  assert.ok(ayudaJs.includes("abrirWalkthroughDesdeInicio"));

  const ajustesJs = await readFile(new URL("../frontend/static/js/views/ajustes.js", import.meta.url), "utf8");
  assert.ok(ajustesJs.includes("abrirWalkthroughDesdeInicio"));
});

test("ciclo de vida del walkthrough: avance por todos los pasos, persistencia y cierre automático al abrir diálogo", () => {
  const { PASOS_WALKTHROUGH, iniciarWalkthrough, walkthroughAbierto, cerrarWalkthrough } = walkthrough;
  env.memStorage.clear();
  assert.equal(store.almacenamientoDisponible(), true);
  assert.equal(store.walkthroughCompletado(), false);

  iniciarWalkthrough({ automatico: true, enfocar: false });
  assert.equal(walkthroughAbierto(), true);
  const tarjeta = env.body.querySelectorAll(".tour-tarjeta")[0];
  assert.ok(tarjeta);
  assert.match(tarjeta.textContent, new RegExp(`Paso 1 de ${PASOS_WALKTHROUGH.length}`));

  // Avanza hasta el último paso y pulsa Finalizar.
  for (let i = 0; i < PASOS_WALKTHROUGH.length - 1; i++) {
    const botones = tarjeta.querySelectorAll("button");
    const sig = botones.find((b) => b.textContent.includes("Siguiente"));
    assert.ok(sig, `Debe existir botón Siguiente en paso ${i + 1}`);
    sig.dispatchEvent({ type: "click" });
  }
  assert.match(tarjeta.textContent, new RegExp(`Paso ${PASOS_WALKTHROUGH.length} de ${PASOS_WALKTHROUGH.length}`));
  const btnFin = tarjeta.querySelectorAll("button").find((b) => b.textContent.includes("Finalizar"));
  assert.ok(btnFin);
  btnFin.dispatchEvent({ type: "click" });
  assert.equal(walkthroughAbierto(), false);
  assert.equal(store.walkthroughCompletado(), true);

  // Al volver a abrirlo manualmente y abrir un diálogo modal, se cierra limpiamente.
  iniciarWalkthrough({ automatico: false, enfocar: true });
  assert.equal(walkthroughAbierto(), true);
  globalThis.window.dispatchEvent(new CustomEvent("ampu:dialogo"));
  assert.equal(walkthroughAbierto(), false);

  // Pulsar Escape también lo cierra incluso antes de mover el foco a la tarjeta.
  iniciarWalkthrough({ automatico: true, enfocar: false });
  assert.equal(walkthroughAbierto(), true);
  globalThis.document.dispatchEvent({
    type: "keydown",
    key: "Escape",
    defaultPrevented: false,
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(walkthroughAbierto(), false);
  cerrarWalkthrough({ marcarVisto: false });
});

test("walkthrough automático al abrir por primera vez y replay desde Ayuda/Ajustes en Chromium", {
  skip: !chromium && "Prueba opcional: instala playwright-core y Chromium.",
}, async (t) => {
  const { PASOS_WALKTHROUGH } = walkthrough;
  const { servidor, url } = await servidorFrontend();
  let navegador;
  try {
    navegador = await chromium.launch({
      headless: true,
      executablePath: process.env.AMPU_CHROMIUM || undefined,
      args: ["--no-sandbox", ...JSON.parse(process.env.AMPU_CHROMIUM_ARGS || "[]")],
    });
    const pagina = await navegador.newPage({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
    await pagina.goto(url);
    await pagina.locator("#contenido h1").waitFor();

    await t.test("se abre automáticamente en la primera visita y recorre todos los componentes", async () => {
      const tarjeta = pagina.locator(".tour-tarjeta");
      await tarjeta.waitFor();
      assert.match(await tarjeta.textContent(), /Paso 1 de/);

      for (let i = 0; i < PASOS_WALKTHROUGH.length - 1; i++) {
        await tarjeta.getByRole("button", { name: "Siguiente", exact: true }).click();
      }
      assert.match(await tarjeta.textContent(), new RegExp(`Paso ${PASOS_WALKTHROUGH.length} de ${PASOS_WALKTHROUGH.length}`));
      await tarjeta.getByRole("button", { name: "Finalizar", exact: true }).click();
      await tarjeta.waitFor({ state: "detached" });
      assert.ok(await pagina.evaluate(() => Boolean(localStorage.getItem("ampu.walkthrough.v1"))));
    });

    await t.test("no vuelve a abrirse automáticamente al recargar y puede repetirse desde Ayuda", async () => {
      await pagina.reload();
      await pagina.locator("#contenido h1").waitFor();
      await pagina.waitForTimeout(100);
      assert.equal(await pagina.locator(".tour-tarjeta").count(), 0);

      await pagina.locator("#boton-ayuda").click();
      await pagina.getByRole("button", { name: /Recorrido guiado/ }).click();
      await pagina.locator(".tour-tarjeta").waitFor();
      await pagina.getByRole("button", { name: "Omitir", exact: true }).click();
      await pagina.locator(".tour-tarjeta").waitFor({ state: "detached" });
    });
  } finally {
    await navegador?.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
