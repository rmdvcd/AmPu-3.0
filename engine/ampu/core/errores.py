"""Excepciones de dominio que se traducen a mensajes amigables en la UI.

Cada error lleva un ``tipo`` estable que la interfaz usa para decidir cómo
comunicarlo (sintaxis, dominio, ambigüedad, tiempo límite, fuera de alcance):

* ``campo``: identificador del control de formulario culpable, si se conoce.
* ``posicion``: índice (base 1) del elemento o carácter problemático.
* ``sugerencia``: acción concreta de recuperación.
"""

from __future__ import annotations


class ErrorAmPu(ValueError):
    """Error recuperable de una operación estadística de AmPu."""

    tipo = "dominio"

    def __init__(self, mensaje: str = "", *, campo: str | None = None,
                 posicion: int | None = None, sugerencia: str | None = None,
                 detalle: dict | None = None):
        super().__init__(mensaje)
        self.campo = campo
        self.posicion = posicion
        self.sugerencia = sugerencia
        self.detalle = detalle or {}

    def con_campo(self, campo: str) -> "ErrorAmPu":
        """Asocia el error a un campo si todavía no tenía uno."""
        if self.campo is None:
            self.campo = campo
        return self


class ParametroInvalidoError(ErrorAmPu):
    """Un parámetro tiene tipo, rango o combinación incorrecta."""

    tipo = "dominio"


class SoporteError(ErrorAmPu):
    """El evento no pertenece al espacio muestral de la distribución."""

    tipo = "dominio"


class CalculoNoConvergenteError(ErrorAmPu):
    """No puede obtenerse un resultado numérico fiable con los datos dados."""

    tipo = "dominio"


class EntradaInvalidaError(ErrorAmPu):
    """El texto introducido no puede leerse como números (error de sintaxis)."""

    tipo = "sintaxis"


class EntradaAmbiguaError(ErrorAmPu):
    """El texto admite más de una lectura y AmPu no elige en silencio."""

    tipo = "ambiguedad"


class TiempoExcedidoError(ErrorAmPu):
    """El cálculo superó el tiempo límite configurado."""

    tipo = "timeout"


class FueraDeAlcanceError(ErrorAmPu):
    """La operación pedida no está soportada o supera los límites del motor."""

    tipo = "fuera_de_alcance"
