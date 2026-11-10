/**
 * Formularios de parámetros generados desde los metadatos del motor.
 * Una sola definición (tipo, mínimo, máximo, descripción) alimenta
 * etiquetas, ayudas, validación en cliente y el payload de la API.
 */

import { el, campo, fmtNum } from "./ui.js";

export function rangoParametro(parametro) {
  const { minimo, maximo, tipo, incluir_minimo: incluyeMin = true, incluir_maximo: incluyeMax = true } = parametro;
  if (tipo && tipo.startsWith("vector")) return "Vector de al menos dos valores; sepáralos con comas.";
  const partes = [];
  if (minimo !== null && minimo !== undefined) partes.push(`${incluyeMin ? "≥" : ">"} ${fmtNum(minimo)}`);
  if (maximo !== null && maximo !== undefined) partes.push(`${incluyeMax ? "≤" : "<"} ${fmtNum(maximo)}`);
  if (!partes.length) return tipo === "entero" ? "Número entero, sin límite superior." : "Sin límite.";
  return `Rango: ${partes.join(" y ")}${tipo === "entero" ? " · entero" : ""}.`;
}

function valorInicial(parametro, valores) {
  const guardado = valores?.[parametro.nombre];
  const valor = guardado !== undefined && guardado !== null ? guardado : parametro.default;
  if (Array.isArray(valor)) return valor.join(", ");
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

/**
 * Crea los campos de un modelo.
 * @returns {{el: HTMLElement, campos: Record<string, object>, valores: Function, validar: Function, setValores: Function}}
 */
export function crearCamposParametros(modelo, { valores = {}, onInput = null } = {}) {
  const contenedor = el("div", { class: "columnas-formulario" });
  const campos = {};

  for (const parametro of modelo.parametros || []) {
    const esVector = parametro.tipo?.startsWith("vector");
    const esEntero = parametro.tipo === "entero";
    const c = campo({
      etiqueta: parametro.descripcion || parametro.nombre,
      codigo: parametro.nombre,
      tipo: esVector ? "texto" : "numero",
      valor: valorInicial(parametro, valores),
      ayuda: rangoParametro(parametro),
      requerido: true,
      placeholder: esVector ? "0.2, 0.3, 0.5" : (parametro.default ?? ""),
      claseControl: esVector ? "campo__control--mono" : "",
      onInput: onInput ? () => onInput() : null,
    });
    if (esEntero) c.control.inputMode = "numeric";
    c.parametro = parametro;
    campos[parametro.nombre] = c;
    contenedor.append(c.envoltura);
  }

  if (!modelo.parametros?.length) {
    contenedor.append(
      el("p", { class: "texto-tenue texto-pequeno", style: { gridColumn: "1 / -1" } },
        "Este modelo no necesita parámetros: usa la forma estándar.")
    );
  }

  const valoresActuales = () => {
    const salida = {};
    for (const [nombre, c] of Object.entries(campos)) {
      const p = c.parametro;
      if (p.tipo?.startsWith("vector")) {
        const partes = String(c.texto())
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((v) => Number(v.replace(",", ".")));
        salida[nombre] = partes;
      } else {
        const v = c.valor();
        salida[nombre] = v === "" ? null : v;
      }
    }
    return salida;
  };

  const validar = () => {
    const errores = {};
    const salida = {};
    for (const [nombre, c] of Object.entries(campos)) {
      const p = c.parametro;
      c.limpiarError();
      if (p.tipo?.startsWith("vector")) {
        const partes = String(c.texto())
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((v) => v.replace(",", "."));
        if (partes.length < 2) {
          errores[nombre] = "Introduce al menos dos valores separados por comas.";
        } else {
          const numeros = partes.map(Number);
          if (numeros.some((v) => !Number.isFinite(v))) {
            errores[nombre] = "Todos los elementos deben ser numéricos.";
          } else if (p.minimo !== null && p.minimo !== undefined && numeros.some((v) => (p.incluir_minimo === false ? v <= p.minimo : v < p.minimo))) {
            errores[nombre] = p.incluir_minimo === false ? `Cada valor debe ser mayor que ${fmtNum(p.minimo)}.` : `Cada valor debe ser al menos ${fmtNum(p.minimo)}.`;
          } else if (p.maximo !== null && p.maximo !== undefined && numeros.some((v) => (p.incluir_maximo === false ? v >= p.maximo : v > p.maximo))) {
            errores[nombre] = p.incluir_maximo === false ? `Cada valor debe ser menor que ${fmtNum(p.maximo)}.` : `Cada valor debe ser como máximo ${fmtNum(p.maximo)}.`;
          } else {
            salida[nombre] = numeros;
          }
        }
      } else {
        const v = c.valor();
        if (v === null || v === "" || v === undefined) {
          errores[nombre] = "Introduce un valor.";
        } else if (typeof v !== "number" || !Number.isFinite(v)) {
          errores[nombre] = "Debe ser un número válido.";
        } else if (p.tipo === "entero" && !Number.isInteger(v)) {
          errores[nombre] = "Debe ser un número entero.";
        } else if (p.minimo !== null && p.minimo !== undefined && (p.incluir_minimo === false ? v <= p.minimo : v < p.minimo)) {
          errores[nombre] = p.incluir_minimo === false
            ? `Debe ser mayor que ${fmtNum(p.minimo)}.`
            : `Debe ser mayor o igual que ${fmtNum(p.minimo)}.`;
        } else if (p.maximo !== null && p.maximo !== undefined && (p.incluir_maximo === false ? v >= p.maximo : v > p.maximo)) {
          errores[nombre] = p.incluir_maximo === false
            ? `Debe ser menor que ${fmtNum(p.maximo)}.`
            : `Debe ser menor o igual que ${fmtNum(p.maximo)}.`;
        } else {
          salida[nombre] = v;
        }
      }
    }
    let primero = null;
    for (const [nombre, mensaje] of Object.entries(errores)) {
      campos[nombre]?.setError(mensaje);
      if (!primero) primero = campos[nombre];
    }
    if (primero) primero.enfocar();
    return { ok: Object.keys(errores).length === 0, valores: salida, errores };
  };

  const setValores = (nuevos = {}) => {
    for (const [nombre, valor] of Object.entries(nuevos)) {
      const c = campos[nombre];
      if (!c) continue;
      c.setValor(Array.isArray(valor) ? valor.join(", ") : valor);
    }
  };

  const setError = (mensaje, nombre = null) => {
    if (nombre && campos[nombre]) {
      campos[nombre].setError(mensaje);
      campos[nombre].enfocar();
    }
  };

  return { el: contenedor, campos, valores: valoresActuales, validar, setValores, setError };
}

export function resumenParametros(modelo, valores) {
  const piezas = [];
  for (const p of modelo.parametros || []) {
    const valor = valores?.[p.nombre];
    if (valor === null || valor === undefined) continue;
    const texto = Array.isArray(valor) ? `(${valor.join(", ")})` : fmtNum(valor);
    piezas.push(`${p.nombre} = ${texto}`);
  }
  return piezas.join(" · ") || "sin parámetros";
}
