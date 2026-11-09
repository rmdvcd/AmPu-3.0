"""Convierte lecciones Markdown a HTML local, preservando LaTeX para KaTeX."""

import re
from html import escape
from pathlib import Path

import markdown

DOCUMENTOS = Path(__file__).resolve().parent / "teoria"
PLANTILLA = Path(__file__).resolve().parent / "render" / "plantilla.html"


def listar_teoria() -> list[tuple[str, str]]:
    """Lista (clave, título) de las lecciones incluidas en el paquete."""
    return [(archivo.stem, archivo.read_text(encoding="utf-8").splitlines()[0].lstrip("# "))
            for archivo in sorted(DOCUMENTOS.glob("*.md"))]


def leer_teoria(clave: str) -> str:
    """Lee un documento con clave segura, sin aceptar rutas arbitrarias."""
    if not re.fullmatch(r"[a-z0-9_]+", clave):
        raise ValueError("Clave de teoría inválida.")
    return (DOCUMENTOS / f"{clave}.md").read_text(encoding="utf-8")


def extraer_formula(clave: str) -> str | None:
    """Obtiene la primera fórmula de bloque para el informe PDF."""
    hallada = re.search(r"^\$\$\s*\n(.*?)\n\$\$", leer_teoria(clave), re.M | re.S)
    return hallada.group(1).strip() if hallada else None


def _preservar_matematicas(texto: str) -> tuple[str, dict[str, str]]:
    """Aparta fórmulas antes de interpretar Markdown, conservando barras y _.

    KaTeX recibe delimitadores originales $$...$$ y $...$ después de la
    conversión. No dependemos de servicios externos ni de MathJax remoto.
    """
    tokens: dict[str, str] = {}

    def bloque(m):
        clave = f"AMPUBLOCKTOKEN{len(tokens)}END"
        tokens[clave] = '<div class="formula-bloque">$$' + escape(m.group(1)) + '$$</div>'
        return f"\n\n{clave}\n\n"

    texto = re.sub(r"^\$\$\s*\n(.*?)\n\$\$\s*$", bloque, texto, flags=re.M | re.S)

    def linea(m):
        clave = f"AMPUINLINETOKEN{len(tokens)}END"
        tokens[clave] = '<span class="formula-linea">$' + escape(m.group(1)) + '$</span>'
        return clave

    texto = re.sub(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", linea, texto)
    return texto, tokens


def renderizar(clave: str, tema: str = "claro") -> str:
    """Genera página completa con índice, estilos accesibles y tema sin CDN.

    Args:
        clave: Nombre base de uno de los Markdown empaquetados.
        tema: ``claro`` u ``oscuro``.
    """
    if tema not in ("claro", "oscuro"):
        raise ValueError("Tema no reconocido.")
    texto = leer_teoria(clave)
    titulo = texto.splitlines()[0].lstrip("# ")
    texto, tokens = _preservar_matematicas(texto)
    conversor = markdown.Markdown(extensions=["tables", "fenced_code", "toc"], output_format="html5")
    articulo = conversor.convert(texto)
    for token, html in tokens.items():
        articulo = articulo.replace(f"<p>{token}</p>", html).replace(token, html)
    indice = conversor.toc
    pagina = PLANTILLA.read_text(encoding="utf-8")
    return (pagina.replace("{{TITULO}}", escape(titulo)).replace("{{TEMA}}", tema)
            .replace("{{ARTICULO}}", articulo).replace("{{INDICE}}", indice))
