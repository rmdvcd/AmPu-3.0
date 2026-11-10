#!/usr/bin/env bash
# Ejecuta toda la batería: API y motor (Python) y analizador de entrada del navegador (Node).
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -W ignore -m unittest discover -s tests "$@"
if command -v node >/dev/null 2>&1; then
  node --test tests/test_entrada.mjs
else
  echo "Node no está instalado: se omiten las pruebas del analizador del navegador." >&2
fi
