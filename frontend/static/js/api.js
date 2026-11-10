/**
 * Cliente HTTP de AmPu. Normaliza los errores del motor para que las vistas
 * puedan mostrar un mensaje humano y, cuando existe, señalar el campo culpable.
 */

/**
 * Error del motor. `tipo` distingue la causa para que la interfaz pueda
 * reaccionar: "sintaxis", "dominio", "ambiguedad", "timeout",
 * "fuera_de_alcance", "seguridad", "no_encontrado", "interno", "red".
 * `campo` es el control culpable; `sugerencia`, la forma de recuperarse.
 */
export class ErrorApi extends Error {
  constructor(mensaje, { estado = 0, campo = null, tipo = "desconocido", detalle = null, sugerencia = null, posicion = null } = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.campo = campo;
    this.tipo = tipo;
    this.detalle = detalle;
    this.sugerencia = sugerencia || (detalle && detalle.sugerencia) || null;
    this.posicion = posicion ?? (detalle && detalle.posicion) ?? null;
  }

  /** Mensaje completo: qué pasó y cómo arreglarlo. */
  get textoCompleto() {
    return this.sugerencia ? `${this.message} ${this.sugerencia}` : this.message;
  }
}

/** Plazo máximo de una petición en el cliente (ms). El servidor tiene su propio límite. */
export const PLAZO_MS = 30000;

export function esCancelacion(error) {
  return Boolean(error) && !(error instanceof ErrorApi) && (error.name === "AbortError" || error.code === 20);
}

/* Peticiones de cálculo en curso: Esc las cancela todas. */
const enCurso = new Set();

/** Cancela los cálculos en curso. Devuelve cuántos había. */
export function cancelarCalculos() {
  const n = enCurso.size;
  for (const control of [...enCurso]) control.abort();
  return n;
}

export function hayCalculosEnCurso() {
  return enCurso.size > 0;
}

async function solicitar(ruta, { metodo = "GET", cuerpo = null, senal = null, bruto = false, plazo = PLAZO_MS } = {}) {
  // Un controlador propio une tres causas de aborto: la vista (senal), Esc y el plazo.
  const control = new AbortController();
  let vencido = false;
  const alAbortar = () => control.abort();
  if (senal) {
    if (senal.aborted) control.abort();
    else senal.addEventListener("abort", alAbortar, { once: true });
  }
  const temporizador = plazo > 0 ? setTimeout(() => { vencido = true; control.abort(); }, plazo) : null;
  const esCalculo = metodo !== "GET";
  if (esCalculo) enCurso.add(control);
  try {
    return await solicitarInterno(ruta, { metodo, cuerpo, senal: control.signal, bruto });
  } catch (error) {
    if (vencido && !(error instanceof ErrorApi)) {
      throw new ErrorApi(`El cálculo superó el límite de ${Math.round(plazo / 1000)} s y se canceló.`, {
        tipo: "timeout",
        sugerencia: "Reduce el tamaño de la muestra, el número de simulaciones o el rango, y vuelve a intentarlo.",
      });
    }
    throw error;
  } finally {
    if (temporizador) clearTimeout(temporizador);
    if (senal) senal.removeEventListener("abort", alAbortar);
    enCurso.delete(control);
  }
}

async function solicitarInterno(ruta, { metodo, cuerpo, senal, bruto }) {
  const opciones = {
    method: metodo,
    headers: { Accept: "application/json" },
    signal: senal,
    cache: "no-store",
  };
  if (cuerpo !== null) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch (error) {
    if (esCancelacion(error)) throw error;
    throw new ErrorApi(
      "No se pudo contactar con el motor local. Comprueba que el servidor de AmPu siga abierto.",
      { tipo: "red" }
    );
  }
  if (!respuesta.ok) {
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch {
      /* respuesta no JSON */
    }
    const mensaje =
      (datos && (datos.error || datos.message)) ||
      (respuesta.status === 404
        ? "No se encontró el recurso solicitado."
        : respuesta.status >= 500
          ? "El motor encontró un problema interno. Revisa los datos e inténtalo de nuevo."
          : `La petición falló (HTTP ${respuesta.status}).`);
    throw new ErrorApi(mensaje, {
      estado: respuesta.status,
      campo: datos?.campo || null,
      tipo: datos?.tipo || "http",
      sugerencia: datos?.sugerencia || null,
      posicion: datos?.posicion ?? null,
      detalle: datos,
    });
  }
  if (bruto) return respuesta;
  if (respuesta.status === 204) return null;
  try {
    return await respuesta.json();
  } catch {
    throw new ErrorApi("La respuesta del motor no es JSON válido.", { tipo: "formato" });
  }
}

function nombreDesdeCabecera(respuesta, respaldo) {
  const cabecera = respuesta.headers.get("Content-Disposition") || "";
  const coincidencia = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cabecera);
  if (!coincidencia) return respaldo;
  try {
    return decodeURIComponent(coincidencia[1].replace(/"/g, ""));
  } catch {
    return coincidencia[1].replace(/"/g, "");
  }
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre || "ampu-descarga";
  enlace.rel = "noopener";
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const api = {
  get: (ruta, opciones = {}) => solicitar(ruta, { ...opciones }),
  post: (ruta, cuerpo, opciones = {}) => solicitar(ruta, { ...opciones, metodo: "POST", cuerpo }),

  /**
   * Envía un informe al motor y devuelve el archivo al navegador.
   * @returns {Promise<{nombre: string, tamano: number}>}
   */
  async exportar(payload, { senal = null } = {}) {
    const respuesta = await solicitar("/api/exportar", { metodo: "POST", cuerpo: payload, senal, bruto: true });
    const blob = await respuesta.blob();
    if (!blob.size) throw new ErrorApi("El archivo generado está vacío.", { tipo: "exportacion" });
    const nombre = nombreDesdeCabecera(respuesta, `ampu.${payload.formato || "pdf"}`);
    descargarBlob(blob, nombre);
    return { nombre, tamano: blob.size };
  },
};
