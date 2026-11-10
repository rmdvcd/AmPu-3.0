"""Permite ejecutar ``python -m ampu`` desde cualquier SO soportado."""

from .app import main

raise SystemExit(main())
