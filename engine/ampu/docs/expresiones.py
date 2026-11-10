"""Vista previa accesible y offline de LaTeX; no evalúa el texto como cálculo."""

from html import escape
from pathlib import Path
import math

from ampu.core.errores import ParametroInvalidoError

RECURSOS = Path(__file__).resolve().parent / "render"


def previsualizar_latex(latex: str, tema: str = "claro", escala: float = 1.0) -> str:
    """HTML aislado con KaTeX ``htmlAndMathml`` y alternativa lineal visible.

    La entrada es texto: se escapa tanto en el DOM como en los mensajes. KaTeX
    se ejecuta únicamente con los recursos del paquete y ``trust: false``.
    No se deduce un resultado matemático a partir de LaTeX arbitrario.
    """
    if not isinstance(latex, str) or len(latex) > 2_000:
        raise ParametroInvalidoError("La fórmula LaTeX debe tener hasta 2000 caracteres.")
    if tema not in ("claro", "oscuro"):
        raise ParametroInvalidoError("Tema de fórmula desconocido.")
    if not isinstance(escala, (int, float)) or not math.isfinite(escala) or not .9 <= escala <= 2.0:
        raise ParametroInvalidoError("La escala de fórmula debe estar entre 90 % y 200 %.")
    texto = escape(latex)
    tamano = round(16 * escala)
    return f'''<!doctype html>
<html lang="es" data-tema="{tema}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="katex.min.css">
  <style>
    :root {{color-scheme:light;--fondo:#fff;--texto:#172b45;--error:#a32727;--borde:#c9d5e0}}
    :root[data-tema="oscuro"] {{color-scheme:dark;--fondo:#19283b;--texto:#f2f5f9;--error:#ffaaaa;--borde:#40516a}}
    body {{margin:0;padding:16px;background:var(--fondo);color:var(--texto);font:{tamano}px/1.5 system-ui,sans-serif}}
    #formula {{min-height:55px;overflow:auto;padding:16px 8px;border:1px solid var(--borde);text-align:center}}
    #estado {{color:var(--error);min-height:1.6em}}
    #alternativa {{overflow-wrap:anywhere}}
    code {{white-space:pre-wrap;user-select:text}}
  </style>
</head>
<body>
  <section role="group" aria-label="Expresión matemática">
    <div id="formula"></div>
    <p id="estado" role="status" aria-live="polite"></p>
    <p id="alternativa">Código LaTeX editable: <code id="fuente">{texto}</code></p>
  </section>
  <script src="katex.min.js"></script>
  <script>
    (function() {{
      'use strict';
      const fuente = document.getElementById('fuente').textContent;
      if (!fuente.trim()) return;
      try {{
        katex.render(fuente, document.getElementById('formula'), {{
          displayMode: true, output: 'htmlAndMathml', trust: false, throwOnError: true
        }});
      }} catch (error) {{
        document.getElementById('estado').textContent = 'LaTeX no válido: ' + error.message;
      }}
    }})();
  </script>
</body>
</html>'''
