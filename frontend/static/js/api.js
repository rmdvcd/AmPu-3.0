/**
 * Cliente HTTP de AmPu. Normaliza los errores del motor para que las vistas
 * puedan mostrar un mensaje humano y, cuando existe, señalar el campo culpable.
 */

export class ErrorApi extends Error {
  constructor(mensaje, { estado = 0, campo = null, tipo = "desconocido", detalle = null } = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.campo = campo;
    this.tipo = tipo;
    this.detalle = detalle;
  }
}

export function esCancelacion(error) {
  return error && (error.name === "AbortError" || error.code === 20);
}

async function solicitar(ruta, { metodo = "GET", cuerpo = null, senal = null, bruto = false } = {}) {
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
