#!/usr/bin/env bash
# API, motor e icono (Python), entrada (Node), gráficos y temas con Chromium opcional.
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -W ignore -m unittest discover -s tests "$@"
if command -v node >/dev/null 2>&1; then
  node --test tests/test_*.mjs
else
  echo "Node no está instalado: se omiten las pruebas de entrada, gráficos y temas del navegador." >&2
fi
