"""Punto único de acceso de la UI a todas las exportaciones."""

from .excel import exportar_csv, exportar_excel
from .pdf import exportar_pdf
from .png import exportar_png
from .sesion import cargar_sesion, guardar_sesion


class ServicioExportacion:
    """Fachada estable para tablas, gráficas, informes y sesiones."""

    excel = staticmethod(exportar_excel)
    csv = staticmethod(exportar_csv)
    png = staticmethod(exportar_png)
    pdf = staticmethod(exportar_pdf)
    guardar = staticmethod(guardar_sesion)
    cargar = staticmethod(cargar_sesion)
