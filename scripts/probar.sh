#!/usr/bin/env bash
# API, motor e icono (Python), entrada/atajos (Node) e interfaz con Chromium opcional.
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -W ignore -m unittest discover -s tests "$@"
if command -v node >/dev/null 2>&1; then
  node --test --test-concurrency=1 tests/test_*.mjs
else
  echo "Node no está instalado: se omiten las pruebas de entrada, atajos e interfaz del navegador." >&2
fi
