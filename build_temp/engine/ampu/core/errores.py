"""Excepciones de dominio que se traducen a mensajes amigables en la UI."""


class ErrorAmPu(ValueError):
    """Error recuperable de una operación estadística de AmPu."""


class ParametroInvalidoError(ErrorAmPu):
    """Un parámetro tiene tipo, rango o combinación incorrecta."""


class SoporteError(ErrorAmPu):
    """El evento no pertenece al espacio muestral de la distribución."""


class CalculoNoConvergenteError(ErrorAmPu):
    """No puede obtenerse un resultado numérico fiable con los datos dados."""
