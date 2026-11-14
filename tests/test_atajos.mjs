// Definición, búsqueda y resolución de los atajos de Windows, sin navegador.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ATAJOS, GRUPOS_ATAJOS } from "../frontend/static/js/data.js";
import { accionAtajo, buscarAtajos, etiquetaAtajo } from "../frontend/static/js/atajos.js";

const evento = (key, opciones = {}) => ({ key, ...opciones });
const ids = (lista) => lista.map((atajo) => atajo.id);

test("atajos únicos, agrupados y con alternativas explícitas de Windows", () => {
  assert.equal(new Set(ids(ATAJOS)).size, ATAJOS.length);
  for (const atajo of ATAJOS) {
    assert.ok(GRUPOS_ATAJOS.some((grupo) => grupo.id === atajo.grupo));
    assert.ok(atajo.texto && atajo.combinaciones.length);
    for (const combinacion of atajo.combinaciones) {
      assert.ok(combinacion.every(Boolean));
      assert.ok(!combinacion.some((tecla) => ["Mod", "Meta", "⌘", "⌥"].includes(tecla)));
    }
  }
  assert.deepEqual(ATAJOS.find((atajo) => atajo.id === "zoom").combinaciones, [["+"], ["−"]]);
});

test("cada combinación global documentada activa su acción con Ctrl, nunca con Meta", () => {
  for (const atajo of ATAJOS.filter((atajo) => atajo.accion)) {
    for (const combinacion of atajo.combinaciones) {
      const tecla = combinacion.at(-1);
      const e = evento(tecla === "Esc" ? "Escape" : tecla, {
        ctrlKey: combinacion.includes("Ctrl"),
        shiftKey: combinacion.includes("Shift"),
        altKey: combinacion.includes("Alt"),
      });
      assert.equal(accionAtajo(e), atajo.accion, `${atajo.id}: ${combinacion.join("+")}`);
      assert.equal(accionAtajo({ ...e, metaKey: true }), null, "no acepta Meta ni Ctrl+Meta");
      if (e.ctrlKey) assert.equal(accionAtajo({ ...e, ctrlKey: false, metaKey: true }), null);
    }
  }
});

test("búsqueda por acción, grupo, varias palabras y teclas sin distinguir tildes", () => {
  assert.deepEqual(buscarAtajos("   "), ATAJOS);
  assert.deepEqual(ids(buscarAtajos("GRAFICOS")), ids(ATAJOS.filter((atajo) => atajo.grupo === "graficos")));
  for (const consulta of ["ctrl enter", "Ctrl+Enter", "control intro"]) {
    assert.deepEqual(ids(buscarAtajos(consulta)), ["calcular"]);
  }
  assert.deepEqual(ids(buscarAtajos("Ctrl + K")), ["buscar"]);
  assert.deepEqual(ids(buscarAtajos("+")), ["zoom"]);
  assert.deepEqual(ids(buscarAtajos("alejar")), ["zoom"]);
  for (const consulta of ["comando intro", "⌘ K", "opción", "ningun-atajo-existe"]) assert.deepEqual(buscarAtajos(consulta), []);
});

test("etiquetas de Windows legibles para lectores de pantalla", () => {
  assert.equal(etiquetaAtajo(ATAJOS.find((atajo) => atajo.id === "buscar")), "Control más K");
  assert.equal(etiquetaAtajo(ATAJOS.find((atajo) => atajo.id === "ayuda")), "F1 o ?");
  assert.equal(etiquetaAtajo(ATAJOS.find((atajo) => atajo.id === "grafico")), "Alt más G");
});

test("un diálogo bloquea cálculos, buscador, gráficos y la cancelación global", () => {
  const contexto = { dialogoAbierto: true };
  for (const e of [evento("Enter", { ctrlKey: true }), evento("k", { ctrlKey: true }), evento("g", { altKey: true }), evento("Escape")]) {
    assert.equal(accionAtajo(e, contexto), null);
  }
  assert.equal(accionAtajo(evento("L", { ctrlKey: true, shiftKey: true }), contexto), "tema");
  assert.equal(accionAtajo(evento("F1"), contexto), "ayuda");
});

test("Alt más G solo fuera de los campos y sin remapeos de otros sistemas", () => {
  assert.equal(accionAtajo(evento("g", { altKey: true })), "grafico");
  assert.equal(accionAtajo(evento("g", { altKey: true }), { escribiendo: true }), null);
  assert.equal(accionAtajo(evento("©", { altKey: true, code: "KeyG" })), null);
});

test("el signo de interrogación no interrumpe la escritura", () => {
  assert.equal(accionAtajo(evento("?", { shiftKey: true })), "ayuda");
  assert.equal(accionAtajo(evento("?"), { escribiendo: true }), null);
  assert.equal(accionAtajo(evento("F1"), { escribiendo: true }), "ayuda");
  assert.equal(accionAtajo(evento("?", { altKey: true })), null);
});

test("no repetir acciones ni interferir con composición, AltGr o controles locales", () => {
  for (const opciones of [
    { defaultPrevented: true }, { isComposing: true }, { repeat: true },
    { getModifierState: (nombre) => nombre === "AltGraph" },
  ]) {
    assert.equal(accionAtajo(evento("k", { ctrlKey: true, ...opciones })), null);
  }
  assert.equal(accionAtajo(evento("Escape", { defaultPrevented: true })), null, "el gráfico puede consumir Esc");
  assert.equal(accionAtajo(evento("k", { ctrlKey: true, altKey: true })), null);
  assert.equal(accionAtajo(evento("k", { ctrlKey: true, shiftKey: true })), null);
  assert.equal(accionAtajo(evento("F1", { shiftKey: true })), null);
});
