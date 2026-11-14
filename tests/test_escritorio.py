"""Contratos de escritorio con backend nativo simulado (no requiere Windows)."""

from __future__ import annotations

import contextlib
import ctypes
import io
import json
from pathlib import Path
import sys
import threading
import types
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import URLError

from PIL import Image  # importar antes de simular sys.platform

import escritorio
import main


class EscritorioTest(unittest.TestCase):
    def test_recursos_en_fuente_y_en_el_paquete_onefile(self):
        self.assertTrue(escritorio.ruta_icono().is_file())
        with patch.object(sys, "_MEIPASS", "/paquete/temporal", create=True):
            self.assertEqual(escritorio.ruta_icono(), Path("/paquete/temporal/frontend/static/img/icono_ampu.png"))

    def test_identidad_de_windows_antes_de_crear_ventanas(self):
        shell = MagicMock()
        shell.SetCurrentProcessExplicitAppUserModelID.return_value = 0
        with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", return_value=shell, create=True) as cargar:
            escritorio.identificar_aplicacion()
        cargar.assert_called_once_with("shell32", use_last_error=True)
        shell.SetCurrentProcessExplicitAppUserModelID.assert_called_once_with(escritorio.ID_APLICACION)
        self.assertEqual(shell.SetCurrentProcessExplicitAppUserModelID.argtypes, [ctypes.c_wchar_p])

    def test_identidad_no_impide_arranque_si_windows_la_rechaza(self):
        with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", side_effect=OSError("simulado"), create=True), self.assertLogs("ampu.escritorio", level="WARNING"):
            escritorio.identificar_aplicacion()
        shell = MagicMock()
        shell.SetCurrentProcessExplicitAppUserModelID.return_value = -1
        with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", return_value=shell, create=True), self.assertLogs("ampu.escritorio", level="WARNING"):
            escritorio.identificar_aplicacion()

    def test_no_importa_bandeja_fuera_de_windows_o_si_se_desactiva(self):
        for plataforma, desactivar in (("linux", "0"), ("win32", "1")):
            with self.subTest(plataforma=plataforma), patch.object(sys, "platform", plataforma), patch.dict("os.environ", {"AMPU_NO_TRAY": desactivar}), patch.dict(sys.modules, {"pystray": None}):
                self.assertFalse(escritorio.iniciar_bandeja("http://local", MagicMock(), threading.Event(), "3"))

    def simular_bandeja(self, modo, servidor_vivo=True):
        instancias = []
        detener = threading.Event()
        servidor = MagicMock()
        servidor.is_alive.return_value = servidor_vivo

        class Menu:
            SEPARATOR = object()

            def __init__(self, *items):
                self.items = items

        class Item:
            def __init__(self, texto, accion, default=False):
                self.texto, self.accion, self.default = texto, accion, default

        class Icon:
            def __init__(self, nombre, imagen, titulo, menu):
                self.nombre, self.imagen, self.titulo, self.menu = nombre, imagen, titulo, menu
                self.paradas = 0
                instancias.append(self)

            def __setattr__(self, nombre, valor):
                if modo == "fallo_visible" and nombre == "visible":
                    raise OSError("Explorer rechazó el icono")
                object.__setattr__(self, nombre, valor)

            def run(self, setup):
                self.hilo_daemon = threading.current_thread().daemon
                if modo == "fallo_run":
                    raise OSError("No hay bandeja")
                if modo == "menu":
                    self.menu.items[0].accion(self, None)
                    self.menu.items[-1].accion(self, None)
                setup(self)

            def stop(self):
                self.paradas += 1
                if modo == "fallo_run":
                    raise OSError("No se creó la ventana")

        fake = types.SimpleNamespace(Icon=Icon, Menu=Menu, MenuItem=Item)
        with patch.object(sys, "platform", "win32"), patch.dict("os.environ", {"AMPU_NO_TRAY": "0"}), patch.dict(sys.modules, {"pystray": fake}), patch.object(escritorio.webbrowser, "open") as abrir:
            resultado = escritorio.iniciar_bandeja("http://127.0.0.1:5000", servidor, detener, "3.2.0")
        return resultado, detener, instancias[0], abrir

    def test_menu_abre_el_navegador_y_salir_detiene_el_motor_y_retira_el_icono(self):
        resultado, detener, icono, abrir = self.simular_bandeja("menu")
        self.assertTrue(resultado)
        self.assertTrue(detener.is_set())
        self.assertGreater(icono.paradas, 0)
        self.assertTrue(icono.hilo_daemon, "los auxiliares de pystray también deben heredar daemon")
        self.assertEqual(icono.menu.items[0].texto, "Abrir AmPu")
        self.assertTrue(icono.menu.items[0].default)
        self.assertEqual(icono.menu.items[-1].texto, "Salir de AmPu")
        self.assertEqual(icono.imagen.size, (256, 256))
        abrir.assert_called_once_with("http://127.0.0.1:5000")

    def test_la_bandeja_no_queda_huerfana_si_muere_el_servidor(self):
        resultado, detener, icono, abrir = self.simular_bandeja("vigilar", servidor_vivo=False)
        self.assertTrue(resultado)
        self.assertTrue(detener.is_set())
        self.assertGreater(icono.paradas, 0)
        abrir.assert_not_called()

    def test_fallos_de_creacion_o_visibilidad_permiten_el_modo_de_consola(self):
        for modo in ("fallo_run", "fallo_visible"):
            with self.subTest(modo=modo), self.assertLogs("ampu.escritorio", level="WARNING"):
                resultado, detener, icono, abrir = self.simular_bandeja(modo)
                self.assertFalse(resultado)
                self.assertFalse(detener.is_set(), "un fallo de bandeja no debe apagar el respaldo")
                self.assertGreater(icono.paradas, 0)

    def test_ejecutable_sin_stdout_recupera_una_consola_al_fallar_la_bandeja(self):
        kernel = MagicMock()
        kernel.AllocConsole.return_value = 1
        abrir = MagicMock()
        with patch.object(sys, "platform", "win32"), patch.object(sys, "stdout", None), patch.object(sys, "stderr", None), patch.object(ctypes, "WinDLL", return_value=kernel, create=True), patch("escritorio.open", abrir):
            escritorio.activar_consola()
        kernel.AllocConsole.assert_called_once()
        self.assertEqual([c.args[0] for c in abrir.call_args_list], ["CONOUT$", "CONOUT$"])


class ArranqueTest(unittest.TestCase):
    @staticmethod
    def respuesta(datos, estado=200):
        respuesta = io.BytesIO(json.dumps(datos).encode())
        respuesta.status = estado
        return respuesta

    def test_espera_una_respuesta_de_ampu_no_cualquier_pagina_200(self):
        vivo = MagicMock()
        vivo.is_alive.return_value = True
        respuestas = [URLError("todavía no"), self.respuesta({"otra": "app"}), self.respuesta({"estado": "ok", "version": main.ampu_app.VERSION_APP})]
        with patch.object(main.urllib.request, "urlopen", side_effect=respuestas) as abrir, patch.object(main.time, "sleep") as dormir:
            self.assertTrue(main._esperar_servidor("http://local", intentos=3, servidor=vivo))
        self.assertEqual(abrir.call_count, 3)
        self.assertEqual(dormir.call_count, 2)

    def test_lectura_invalida_y_servidor_caido_no_abren_el_navegador(self):
        muerto = MagicMock()
        muerto.is_alive.return_value = False
        with patch.object(main.urllib.request, "urlopen") as abrir:
            self.assertFalse(main._esperar_servidor("http://local", servidor=muerto))
        abrir.assert_not_called()
        for cuerpo in (b"no JSON", b"[]"):
            respuesta = io.BytesIO(cuerpo)
            respuesta.status = 200
            with patch.object(main.urllib.request, "urlopen", return_value=respuesta), patch.object(main.time, "sleep"):
                self.assertFalse(main._esperar_servidor("http://local", intentos=1))

    def test_bandeja_se_inicia_solo_despues_de_la_salud_y_no_deja_hilos_no_daemon(self):
        hilo = MagicMock()
        orden = []
        with patch.dict("os.environ", {"AMPU_HOST": "0.0.0.0", "PORT": "5432", "AMPU_NO_BROWSER": "0"}), patch.object(main, "identificar_aplicacion", side_effect=lambda: orden.append("identidad")), patch.object(main.threading, "Thread", return_value=hilo) as crear, patch.object(main, "_esperar_servidor", side_effect=lambda *a, **k: orden.append("salud") or True), patch.object(main.webbrowser, "open", side_effect=lambda *a: orden.append("navegador")) as abrir, patch.object(main, "iniciar_bandeja", side_effect=lambda *a: orden.append("bandeja") or True) as bandeja, patch.object(main, "activar_consola") as consola:
            main.main()
        self.assertEqual(orden, ["identidad", "salud", "navegador", "bandeja"])
        self.assertTrue(crear.call_args.kwargs["daemon"])
        self.assertEqual(crear.call_args.kwargs["name"], "AmPu-servidor")
        abrir.assert_called_once_with("http://127.0.0.1:5432")
        self.assertTrue(bandeja.call_args.args[2].is_set())
        consola.assert_not_called()

    def test_error_de_arranque_y_modo_sin_navegador(self):
        with patch.object(main.threading, "Thread") as crear, patch.object(main, "identificar_aplicacion"), patch.object(main, "activar_consola") as consola, patch.object(main, "_esperar_servidor", return_value=False), patch.object(main.webbrowser, "open") as abrir, patch.object(main, "iniciar_bandeja") as bandeja:
            with self.assertRaisesRegex(SystemExit, "puerto"):
                main.main()
        abrir.assert_not_called()
        bandeja.assert_not_called()
        consola.assert_called_once()
        crear.return_value.is_alive.return_value = False
        with patch.dict("os.environ", {"AMPU_NO_BROWSER": "1"}), patch.object(main.threading, "Thread", return_value=crear.return_value), patch.object(main, "identificar_aplicacion"), patch.object(main, "activar_consola") as consola, patch.object(main, "_esperar_servidor", return_value=True), patch.object(main.webbrowser, "open") as abrir, patch.object(main, "iniciar_bandeja", return_value=False), contextlib.redirect_stdout(io.StringIO()):
            main.main()
        abrir.assert_not_called()
        consola.assert_called_once()


if __name__ == "__main__":
    unittest.main()
