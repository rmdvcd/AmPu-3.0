// Shell real con una API mínima sustituible; no requiere arrancar Flask.
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";

export async function servidorFrontend({ meta = {}, api = () => undefined, matematicas = false, paginas = {} } = {}) {
  const base = new URL("../../frontend/", import.meta.url);
  const archivos = new Map([["/", await readFile(new URL("index.html", base))]]);
  for (const ruta of await readdir(new URL("static/", base), { recursive: true })) {
    if (/\.(js|css|png|svg|ico)$/.test(ruta)) archivos.set(`/static/${ruta}`, await readFile(new URL(`static/${ruta}`, base)));
  }
  if (matematicas) {
    const render = new URL("../../engine/ampu/docs/render/", import.meta.url);
    for (const ruta of await readdir(render, { recursive: true })) {
      if (/\.(js|css|woff2?|ttf|svg)$/.test(ruta)) archivos.set(`/vendor/katex/${ruta}`, await readFile(new URL(ruta, render)));
    }
  }
  for (const [ruta, contenido] of Object.entries(paginas)) archivos.set(ruta, Buffer.from(contenido));
  const catalogo = { distribuciones: [], pruebas: [], teoria: [], probabilidad: [], muestreo: [], simulacion: [], ...meta };
  const servidor = createServer(async (peticion, respuesta) => {
    const ruta = new URL(peticion.url, "http://localhost").pathname;
    if (ruta.startsWith("/api/")) {
      try {
        let cuerpo = "";
        for await (const parte of peticion) cuerpo += parte;
        const extra = await api(ruta, cuerpo ? JSON.parse(cuerpo) : null, peticion);
        const datos = extra ?? (ruta === "/api/meta" ? catalogo : ruta === "/api/teoria/lista" ? catalogo.teoria : {});
        respuesta.setHeader("Content-Type", "application/json");
        respuesta.end(JSON.stringify(datos));
      } catch (error) {
        respuesta.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error.message }));
      }
    } else if (ruta.startsWith("/vendor/katex/") && !matematicas) {
      respuesta.setHeader("Content-Type", ruta.endsWith(".css") ? "text/css" : "text/javascript");
      respuesta.end("");
    } else if (archivos.has(ruta)) {
      const extension = ruta.split(".").at(-1);
      const tipo = ruta === "/" || extension === "html" ? "text/html; charset=utf-8" : ({ js: "text/javascript", css: "text/css", png: "image/png", svg: "image/svg+xml", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf" }[extension] || "application/octet-stream");
      respuesta.setHeader("Content-Type", tipo);
      respuesta.end(archivos.get(ruta));
    } else if (/^\/favicon\.(ico|svg)$/.test(ruta)) {
      respuesta.writeHead(204).end();
    } else {
      respuesta.writeHead(404).end();
    }
  });
  await new Promise((resolve) => servidor.listen(0, "0.0.0.0", resolve));
  return { servidor, url: `http://127.0.0.1:${servidor.address().port}/` };
}
