"""Control del launcher sin pantalla: toda llamada a la vista debe ser en su hilo."""

import os
from queue import SimpleQueue
import threading
import unittest
from unittest.mock import patch

from arranque import Evento
from lanzador import ControladorLauncher


class Vista:
    def __init__(self):
        self.llamadas = []
        self.pregunta = False
        self.oculta = False

    def anotar(self, nombre, *args):
        self.llamadas.append((nombre, args, threading.current_thread().ident))

    def conectar(self, **acciones):
        self.acciones = acciones

    def estado(self, *args):
        self.anotar("estado", *args)

    def bandeja(self, *args):
        self.anotar("bandeja", *args)

    def programar(self, *args):
        self.anotar("programar", *args)

    def mostrar(self):
        self.oculta = False
        self.anotar("mostrar")

    def ocultar(self):
        self.oculta = True
        self.anotar("ocultar")

    def terminar(self):
        self.anotar("terminar")

    def confirmar_salida(self):
        self.anotar("confirmar")
        return self.pregunta

    def avisar(self, *args):
        self.anotar("avisar", *args)


class Motor:
    def __init__(self):
        self.eventos = SimpleQueue()
        self.disponible = threading.Event()
        self.terminado = threading.Event()
        self.url = "http://127.0.0.1:5000"
        self.inicios = self.paradas = 0

    def iniciar(self):
        self.inicios += 1

    def detener(self):
        self.paradas += 1
        self.disponible.clear()


class Bandeja:
    def __init__(self):
        self.lista = threading.Event()
        self.terminada = threading.Event()
        self.inicios = self.paradas = self.actualizaciones = 0

    def iniciar(self):
        self.inicios += 1

    def cerrar(self):
        self.paradas += 1
        self.lista.clear()
        self.terminada.set()

    def actualizar_menu(self):
        self.actualizaciones += 1


class LauncherTest(unittest.TestCase):
    def setUp(self):
        self.vista, self.motor, self.bandeja = Vista(), Motor(), Bandeja()
        self.control = ControladorLauncher(self.vista, self.motor, self.bandeja)
        self.entorno = patch.dict(os.environ, {"AMPU_NO_BROWSER": "1"})
        self.entorno.start()
        self.addCleanup(self.entorno.stop)

    def evento(self, tipo, detalle="", version=""):
        self.motor.eventos.put(Evento(tipo, detalle, version))
        self.control._procesar()

    def veces(self, nombre):
        return sum(n == nombre for n, _, __ in self.vista.llamadas)

    def test_ventana_operativa_antes_de_que_el_motor_este_listo(self):
        with patch("lanzador.webbrowser.open") as abrir:
            self.control.iniciar()
            self.control.abrir()
        self.assertEqual(self.motor.inicios, 1)
        self.assertEqual(self.bandeja.inicios, 1)
        self.assertEqual(self.vista.llamadas[0][0:2], ("estado", ("iniciando", "Cargando el motor estadístico…")))
        self.assertEqual(self.veces("programar"), 1)
        self.assertEqual(set(self.vista.acciones), {"abrir", "minimizar", "cerrar", "salir"})
        abrir.assert_not_called()

    def test_abrir_se_habilita_con_salud_y_no_browser_suprime_solo_el_autoarranque(self):
        llamado = threading.Event()
        with patch("lanzador.webbrowser.open", side_effect=lambda _: llamado.set() or True) as abrir:
            self.motor.disponible.set()
            self.evento("listo", "Disponible", "3.2.0")
            abrir.assert_not_called()
            self.control.abrir()
            self.assertTrue(llamado.wait(1))
            abrir.assert_called_once_with(self.motor.url)
        self.assertEqual(self.bandeja.actualizaciones, 1)

    def test_autoabre_una_sola_vez_despues_de_listo(self):
        llamado = threading.Event()

        def abrir(_):
            llamado.set()
            return True

        with patch.dict(os.environ, {"AMPU_NO_BROWSER": "0"}), patch("lanzador.webbrowser.open", side_effect=abrir) as navegador:
            self.control.iniciar()
            self.assertFalse(llamado.is_set())
            self.motor.disponible.set()
            self.evento("listo")
            self.assertTrue(llamado.wait(1))
            self.evento("listo")
            self.assertEqual(navegador.call_count, 1)

    def test_cerrar_y_minimizar_ocultan_solo_con_bandeja_confirmada(self):
        self.control.minimizar()
        self.assertFalse(self.vista.oculta)
        self.bandeja.lista.set()
        self.evento("bandeja_lista")
        self.control.minimizar()
        self.assertTrue(self.vista.oculta)
        self.evento("mostrar")
        self.assertFalse(self.vista.oculta)
        self.control.cerrar_ventana()
        self.assertTrue(self.vista.oculta)
        self.assertEqual(self.motor.paradas, 0)
        self.assertEqual(self.veces("confirmar"), 0)

    def test_sin_bandeja_cerrar_pide_confirmacion_y_nunca_esconde_la_ventana(self):
        self.evento("bandeja_no", "Bandeja desactivada")
        self.control.cerrar_ventana()
        self.assertFalse(self.control.cerrando)
        self.assertFalse(self.vista.oculta)
        self.vista.pregunta = True
        self.control.cerrar_ventana()
        self.assertTrue(self.control.cerrando)
        self.assertEqual(self.motor.paradas, 1)
        self.assertEqual(self.veces("terminar"), 0)
        self.motor.terminado.set()
        self.control._procesar()
        self.assertEqual(self.veces("terminar"), 1)
        self.assertEqual(self.veces("ocultar"), 0)

    def test_fallo_de_bandeja_recupera_ventana_sin_detener_motor_ni_abrir_consola(self):
        self.motor.disponible.set()
        self.bandeja.lista.set()
        self.control.minimizar()
        self.bandeja.lista.clear()
        self.evento("bandeja_error", "No se pudo mostrar el icono")
        self.assertFalse(self.vista.oculta)
        self.assertTrue(self.motor.disponible.is_set())
        self.assertFalse(self.control.cerrando)
        self.assertEqual(self.motor.paradas, 0)
        self.assertIn(("bandeja", (False, "No se pudo mostrar el icono"), threading.current_thread().ident), self.vista.llamadas)

    def test_fallo_del_motor_recupera_ventana_y_deshabilita_abrir(self):
        self.bandeja.lista.set()
        self.control.minimizar()
        self.motor.disponible.clear()
        self.evento("error", "El puerto está ocupado")
        self.assertFalse(self.vista.oculta)
        self.assertFalse(self.control.cerrando)
        with patch("lanzador.webbrowser.open") as abrir:
            self.control.abrir()
        abrir.assert_not_called()
        self.assertEqual(self.bandeja.actualizaciones, 1)

    def test_salir_del_menu_o_boton_detiene_y_no_resucita_la_ventana(self):
        self.evento("salir")
        self.control.salir()
        self.assertEqual(self.motor.paradas, 1)
        self.assertEqual(self.bandeja.paradas, 1)
        self.evento("mostrar")
        self.evento("listo")
        self.assertEqual(self.veces("mostrar"), 0)
        self.motor.terminado.set()
        self.control._procesar()
        self.control._procesar()
        self.assertEqual(self.veces("terminar"), 1)

    def test_espera_a_que_el_icono_se_retire_antes_de_cerrar_la_ventana(self):
        self.control.salir()
        self.motor.terminado.set()
        self.bandeja.terminada.clear()
        self.control._procesar()
        self.assertEqual(self.veces("terminar"), 0)
        self.bandeja.terminada.set()
        self.control._procesar()
        self.assertEqual(self.veces("terminar"), 1)

    def test_salida_acotada_aunque_el_motor_tarde_en_importar(self):
        with patch("lanzador.time.monotonic", return_value=10):
            self.control.salir()
        with patch("lanzador.time.monotonic", return_value=14):
            self.control._procesar()
        self.assertEqual(self.veces("terminar"), 1)
        self.assertFalse(self.motor.terminado.is_set())

    def test_navegador_falla_en_worker_pero_los_avisos_solo_tocan_vista_en_hilo_principal(self):
        self.motor.disponible.set()
        with patch("lanzador.webbrowser.open", return_value=False):
            self.control.abrir()
            aviso = self.motor.eventos.get(timeout=1)
        self.assertEqual(aviso.tipo, "navegador_error")
        self.motor.eventos.put(aviso)
        self.assertEqual(self.veces("avisar"), 0)
        self.control._procesar()
        self.assertEqual(self.veces("avisar"), 1)
        self.assertTrue(self.motor.disponible.is_set())
        self.assertTrue(all(hilo == threading.current_thread().ident for _, __, hilo in self.vista.llamadas))

    def test_doble_click_en_abrir_no_crea_dos_navegadores_a_la_vez(self):
        entro, salir = threading.Event(), threading.Event()

        def abrir(_):
            entro.set()
            salir.wait(2)
            return True

        self.motor.disponible.set()
        with patch("lanzador.webbrowser.open", side_effect=abrir) as navegador:
            try:
                self.control.abrir()
                self.assertTrue(entro.wait(1))
                self.control.abrir()
                self.assertEqual(navegador.call_count, 1)
            finally:
                salir.set()

    def test_limpieza_si_la_ventana_termina_por_otra_causa(self):
        self.control.limpiar()
        self.assertEqual(self.motor.paradas, 1)
        self.assertEqual(self.bandeja.paradas, 1)


if __name__ == "__main__":
    unittest.main()
