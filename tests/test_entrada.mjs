// Pruebas del analizador de entrada del navegador contra los vectores compartidos.
// Ejecutar:  node --test tests/test_entrada.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { comasComoSeparadores, fmtEntrada, leerMatriz, leerNumero, leerSerie, resumenLectura } from "../frontend/static/js/entrada.js";

const vectores = JSON.parse(readFileSync(new URL("./vectores_entrada.json", import.meta.url), "utf-8"));

for (const caso of vectores.series) {
  test(`serie ${JSON.stringify(caso.entrada)}`, () => {
    const lectura = leerSerie(caso.entrada, { fraccion: Boolean(caso.fraccion) });
    if (caso.error) {
      assert.ok(lectura.error, "se esperaba un error");
      assert.equal(lectura.error.tipo, caso.error);
      if (caso.posicion) assert.equal(lectura.error.posicion, caso.posicion);
      assert.ok(lectura.error.mensaje.length > 0);
    } else {
      assert.equal(lectura.error, null, lectura.error?.mensaje);
      assert.equal(lectura.valores.length, caso.valores.length);
      lectura.valores.forEach((v, i) => assert.ok(Math.abs(v - caso.valores[i]) <= 1e-12 * Math.max(1, Math.abs(v))));
      assert.equal(lectura.avisos.length, caso.avisos || 0);
    }
  });
}

for (const caso of vectores.comas_como_separadores) {
  test(`comas → separadores ${JSON.stringify(caso.entrada)}`, () => {
    assert.equal(comasComoSeparadores(caso.entrada), caso.salida);
    assert.equal(leerSerie(comasComoSeparadores(caso.entrada)).error, null);
  });
}

test("número único", () => {
  assert.equal(leerNumero("0,05").valor, 0.05);
  assert.equal(leerNumero("0.05").valor, 0.05);
  assert.equal(leerNumero("").vacio, true);
  assert.ok(leerNumero("1 2").error);
  assert.ok(leerNumero("1,2,3").error);
  assert.equal(leerNumero("1/4", { fraccion: true }).valor, 0.25);
  assert.ok(leerNumero("1/4").error);
});

test("matriz y formato", () => {
  assert.deepEqual(leerMatriz("30,5 20\n15 35").filas, [[30.5, 20], [15, 35]]);
  assert.equal(leerMatriz("1 2\n3 x").error.fila, 2);
  assert.equal(fmtEntrada(12.4), "12,4");
  assert.equal(resumenLectura([12.4, 11.8]), "2 valores: 12,4 · 11,8");
});
