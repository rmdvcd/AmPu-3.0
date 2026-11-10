/**
 * Lectura única de números y series escritos por una persona.
 *
 * Es el espejo exacto de `engine/ampu/core/entrada.py`: los dos analizadores se
 * prueban contra los mismos vectores (`tests/vectores_entrada.json`), de modo
 * que la vista previa de la interfaz y el cálculo del motor leen lo mismo.
 *
 * Regla de AmPu:
 *  - Los valores se separan con espacios, saltos de línea o punto y coma.
 *    «coma + espacio» (1, 2, 3) también separa.
 *  - El separador decimal puede ser coma o punto: 3,14 = 3.14.
 *  - Lo ambiguo (1,2,3 · 1.234,5) no se interpreta en silencio: es un error
 *    con explicación y corrección sugerida.
 */

const AGRUPADOR = /(?<=\d)[\u202f\u00a0\u2009](?=\d{3}(?!\d))/g;
const NUMERO = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
const FRACCION = /^([+-]?\d+)\s*\/\s*(\d+)$/;
const MILES_PUNTO = /^[+-]?\d{1,3}(?:\.\d{3})+$/;
const NO_FINITOS = new Set(["nan", "inf", "+inf", "-inf", "infinity", "-infinity", "∞", "-∞"]);

function normalizar(texto) {
  return String(texto ?? "")
    .replace(/[−–—]/g, "-")
    .replace(/\ufeff/g, "")
    .replace(AGRUPADOR, "")
    .replace(/,(?=\s)/g, " ");
}

/** Divide el texto en tokens con su columna (base 1). */
export function trocear(texto) {
  const limpio = normalizar(texto);
  const tokens = [];
  const patron = /[^\s;]+/g;
  let m;
  while ((m = patron.exec(limpio)) !== null) tokens.push({ token: m[0], columna: m.index + 1 });
  return tokens;
}

function aFlotante(token) {
  if (!NUMERO.test(token)) return null;
  const valor = Number(token.replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

function recortar(lista, maximo) {
  return lista.slice(0, maximo).join(" ") + (lista.length > maximo ? " …" : "");
}

function errorToken(token, indice, columna) {
  const donde = `valor ${indice} («${token.slice(0, 24)}»)`;
  const comas = (token.match(/,/g) || []).length;
  const puntos = (token.match(/\./g) || []).length;
  const base = { posicion: indice, columna, token };
  if (comas >= 1 && puntos >= 1) {
    const partes = token.split(",").filter(Boolean);
    return {
      ...base,
      tipo: "ambiguedad",
      mensaje: `El ${donde} mezcla puntos y comas y admite dos lecturas.`,
      sugerencia: `Si son varios valores, sepáralos con espacios: ${recortar(partes, 4)}. Si es un solo número, escríbelo sin separador de miles.`,
      separable: true,
    };
  }
  if (comas >= 2 || puntos >= 2) {
    const signo = comas >= 2 ? "," : ".";
    const partes = token.split(signo).filter(Boolean);
    return {
      ...base,
      tipo: "ambiguedad",
      mensaje: `El ${donde} tiene más de un separador decimal.`,
      sugerencia: `Si son varios valores, sepáralos con espacios o punto y coma: ${recortar(partes, 6)}.`,
      separable: comas >= 2,
    };
  }
  const minus = token.toLowerCase();
  let mensaje;
  let sugerencia;
  if (NO_FINITOS.has(minus)) {
    mensaje = `El ${donde} no es un número finito.`;
    sugerencia = "Elimina ese valor o sustitúyelo por un dato real.";
  } else if (/^0[xbo]/.test(minus) || token.includes("_")) {
    mensaje = `El ${donde} no está en notación decimal.`;
    sugerencia = "Escribe el número en base 10, sin prefijos ni guiones bajos.";
  } else if (token.includes("/")) {
    mensaje = `El ${donde} es una fracción y este campo solo admite decimales.`;
    sugerencia = "Escribe su valor decimal, por ejemplo 0,3333.";
  } else if (token.endsWith("%")) {
    mensaje = `El ${donde} lleva el símbolo %.`;
    sugerencia = "Escribe la proporción sin símbolo: 5 % → 0,05.";
  } else {
    mensaje = `El ${donde} no es un número.`;
    sugerencia = "Usa solo dígitos, signo y un separador decimal (coma o punto).";
  }
  return { ...base, tipo: "sintaxis", mensaje, sugerencia, separable: false };
}

/** Número en la notación de entrada de AmPu (coma decimal, sin agrupar). */
export function fmtEntrada(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return String(valor);
  return String(Number(valor.toPrecision(12))).replace(".", ",");
}

/**
 * Lee una serie de números.
 * @returns {{valores:number[], tokens:string[], avisos:string[], error:object|null}}
 */
export function leerSerie(texto, { fraccion = false } = {}) {
  const salida = { valores: [], tokens: [], avisos: [], error: null };
  const crudo = String(texto ?? "");
  if (!crudo.trim()) return salida;
  const tokens = trocear(crudo);
  for (let i = 0; i < tokens.length; i += 1) {
    const { token, columna } = tokens[i];
    const indice = i + 1;
    if (fraccion) {
      const m = FRACCION.exec(token);
      if (m) {
        if (Number(m[2]) === 0) {
          salida.error = {
            tipo: "sintaxis", posicion: indice, columna, token, separable: false,
            mensaje: `El valor ${indice} («${token}») tiene denominador cero.`, sugerencia: "",
          };
          return salida;
        }
        salida.valores.push(Number(m[1]) / Number(m[2]));
        salida.tokens.push(token);
        continue;
      }
    }
    const numero = aFlotante(token);
    if (numero === null) {
      salida.error = errorToken(token, indice, columna);
      return salida;
    }
    if (MILES_PUNTO.test(token)) {
      salida.avisos.push(
        `«${token}» se leyó como ${fmtEntrada(numero)} (el punto es decimal). Si querías ${token.replace(/\./g, "")}, escríbelo sin puntos.`
      );
    }
    salida.valores.push(numero);
    salida.tokens.push(token);
  }
  if (salida.tokens.length === 1 && salida.tokens[0].includes(",")) {
    const partes = salida.tokens[0].split(",");
    salida.avisos.push(
      `«${salida.tokens[0]}» se leyó como un solo valor (la coma es decimal). Si son dos valores, sepáralos con un espacio: ${partes[0]} ${partes[1]}.`
    );
  }
  return salida;
}

/**
 * Lee un único número.
 * @returns {{valor:number|null, error:object|null, vacio:boolean}}
 */
export function leerNumero(texto, { fraccion = false } = {}) {
  const crudo = String(texto ?? "").trim();
  if (!crudo) return { valor: null, error: null, vacio: true };
  if (fraccion) {
    const m = FRACCION.exec(crudo.replace(/[−–—]/g, "-"));
    if (m) {
      if (Number(m[2]) === 0) {
        return { valor: null, vacio: false, error: { tipo: "sintaxis", mensaje: "El denominador no puede ser cero.", sugerencia: "" } };
      }
      return { valor: Number(m[1]) / Number(m[2]), error: null, vacio: false, fraccion: [Number(m[1]), Number(m[2])] };
    }
  }
  const lectura = leerSerie(crudo, { fraccion });
  if (lectura.error) return { valor: null, error: lectura.error, vacio: false };
  if (lectura.valores.length !== 1) {
    return {
      valor: null, vacio: false,
      error: { tipo: "sintaxis", mensaje: "Este campo admite un solo número.", sugerencia: "Escribe un único valor, por ejemplo 0,05." },
    };
  }
  return { valor: lectura.valores[0], error: null, vacio: false };
}

/** Lee una matriz: una fila por línea. Devuelve filas y, si lo hay, el primer error con su fila. */
export function leerMatriz(texto) {
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const filas = [];
  const avisos = [];
  for (let i = 0; i < lineas.length; i += 1) {
    const lectura = leerSerie(lineas[i]);
    if (lectura.error) return { filas, avisos, error: { ...lectura.error, fila: i + 1, mensaje: `Fila ${i + 1}: ${lectura.error.mensaje}` } };
    filas.push(lectura.valores);
    avisos.push(...lectura.avisos.filter((a) => !a.includes("un solo valor")));
  }
  return { filas, avisos, error: null };
}

/** Convierte las comas pegadas entre dígitos en separadores (1,2,3 → 1 2 3). */
export function comasComoSeparadores(texto) {
  return String(texto ?? "").replace(/(?<=[\d.])\s*,\s*(?=[-+.\d])/g, " ");
}

/** ¿Hay comas entre dígitos que podrían ser separadores de lista? */
export function tieneComasDudosas(texto) {
  return /\d,\d/.test(String(texto ?? ""));
}

/** Resumen legible de lo que se ha leído: «4 valores: 12,4 · 11,8 · 13,1 · 12,9». */
export function resumenLectura(valores, maximo = 6) {
  const n = valores.length;
  if (!n) return "sin valores";
  const muestra = valores.slice(0, maximo).map(fmtEntrada).join(" · ");
  return `${n} ${n === 1 ? "valor" : "valores"}: ${muestra}${n > maximo ? ` · … (+${n - maximo})` : ""}`;
}
