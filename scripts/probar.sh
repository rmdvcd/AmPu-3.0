#!/usr/bin/env bash
# API y motor (Python), entrada (Node) y gráficos en Chromium si Playwright está instalado.
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -W ignore -m unittest discover -s tests "$@"
if command -v node >/dev/null 2>&1; then
  node --test tests/test_*.mjs
else
  echo "Node no está instalado: se omiten las pruebas de entrada y gráficos del navegador." >&2
fi
