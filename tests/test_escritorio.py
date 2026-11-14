"""Arranque real local y contratos Win32 simulados; no certifica Explorer nativo."""

from __future__ import annotations

import contextlib
import ctypes
import errno
import io
import json
import logging
import os
from pathlib import Path
from queue import Empty, SimpleQueue
import runpy
import socket
import subprocess
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import URLError
import urllib.request

from PIL import Image  # antes de simular sys.platform=win32

import arranque
from arranque import Evento, MotorLocal
import escritorio
import main

RAIZ = Path(__file__).resolve().parents[1]


def vaciar(cola):
    eventos = []
    while True:
        try:
            eventos.append(cola.get_nowait())
        except Empty:
            return eventos


def esperar_evento(motor, tipo, plazo=10):
    import time
    limite = time.monotonic() + plazo
    recibidos = []
    while time.monotonic() < limite:
        try:
            evento = motor.eventos.get(timeout=0.2)
        except Empty:
            continue
        recibidos.append(evento)
        if evento.tipo == tipo:
            return evento
        if evento.tipo == "error" and tipo != "error":
            raise AssertionError(evento.detalle)
    raise AssertionError(f"No llegó {tipo}: {recibidos}")


class ArranqueTest(unittest.TestCase):
    @staticmethod
    def respuesta(datos, estado=200):
        respuesta = io.BytesIO(json.dumps(datos).encode())
        respuesta.status = estado
        return respuesta

    def test_direccion_local_y_limites_de_puerto(self):
        for host, destino in (("0.0.0.0", "127.0.0.1"), ("::", "[::1]"), ("::1", "[::1]"), ("[::1]", "[::1]"), ("localhost", "localhost")):
            self.assertEqual(arranque.url_local(host, 5000), f"http://{destino}:5000")
        for puerto in (-1, 0, 65536):
            with self.assertRaises(ValueError):
                MotorLocal(puerto=puerto)

    def test_salud_exige_estado_version_hilo_y_no_usa_proxy(self):
        hilo = MagicMock()
        hilo.is_alive.return_value = True
        detener = threading.Event()
        abrir = MagicMock()
        abrir.open.side_effect = [URLError("todavía no"), self.respuesta({"otra": "app"}), self.respuesta({"estado": "ok", "version": "antigua"}), self.respuesta({"estado": "ok", "version": "actual"})]
        with patch.object(arranque.urllib.request, "build_opener", return_value=abrir) as crear, patch.object(detener, "wait", return_value=False):
            self.assertTrue(arranque.esperar_servidor("http://local", "actual", hilo, detener))
        self.assertEqual(abrir.open.call_count, 4)
        self.assertEqual(crear.call_args.args[0].proxies, {})

    def test_cancelacion_hilo_muerto_o_plazo_agotado_no_sondean(self):
        hilo = MagicMock()
        hilo.is_alive.return_value = False
        detener = threading.Event()
        with patch.object(arranque.urllib.request, "build_opener") as crear:
            self.assertFalse(arranque.esperar_servidor("http://local", "v", hilo, detener))
            hilo.is_alive.return_value = True
            self.assertFalse(arranque.esperar_servidor("http://local", "v", hilo, detener, plazo=0))
            detener.set()
            self.assertFalse(arranque.esperar_servidor("http://local", "v", hilo, detener))
        crear.return_value.open.assert_not_called()

    def test_importacion_del_motor_no_bloquea_y_salir_durante_carga_no_arranca_servidor(self):
        motor = MotorLocal()
        entro, continuar = threading.Event(), threading.Event()

        def importar(_):
            entro.set()
            continuar.wait(3)
            return types.SimpleNamespace(VERSION_APP="v")

        with patch.object(arranque.importlib, "import_module", side_effect=importar), patch.object(arranque, "crear_servidor") as crear:
            try:
                motor.iniciar()
                self.assertTrue(entro.wait(1))
                self.assertFalse(motor.disponible.is_set())
                self.assertTrue(motor._hilo.daemon)
                motor.iniciar()  # idempotente
                motor.detener()
            finally:
                continuar.set()
            self.assertTrue(motor.terminado.wait(3))
        crear.assert_not_called()
        self.assertNotIn("listo", [e.tipo for e in vaciar(motor.eventos)])

    def test_detener_antes_de_iniciar_no_importa_ni_crea_hilos(self):
        motor = MotorLocal()
        motor.detener()
        with patch.object(arranque.importlib, "import_module") as cargar:
            motor.iniciar()
        cargar.assert_not_called()
        self.assertTrue(motor.terminado.is_set())

    def test_dependencia_ausente_se_notifica_sin_rastro_de_consola(self):
        motor = MotorLocal()
        with patch.object(arranque.importlib, "import_module", side_effect=ModuleNotFoundError("biblioteca")), self.assertLogs("ampu.arranque", level="ERROR"):
            motor.iniciar()
            self.assertTrue(motor.terminado.wait(3))
        error = next(e for e in vaciar(motor.eventos) if e.tipo == "error")
        self.assertIn("dependencia", error.detalle)
        self.assertFalse(motor.disponible.is_set())

    def test_fallo_de_bind_libera_workers_y_no_consulta_otra_instancia(self):
        from waitress import task
        dispatcher = MagicMock()
        modulo = types.SimpleNamespace(app=types.SimpleNamespace(config={"MAX_CONTENT_LENGTH": 123}))
        with patch.object(task, "ThreadedTaskDispatcher", return_value=dispatcher), patch("waitress.create_server", side_effect=OSError(errno.EADDRINUSE, "ocupado")):
            with self.assertRaises(OSError):
                arranque.crear_servidor(modulo, "127.0.0.1", 5000)
        dispatcher.shutdown.assert_called_once_with(timeout=1)

    def test_fallo_al_crear_workers_tambien_los_limpia(self):
        from waitress import task
        dispatcher = MagicMock()
        dispatcher.set_thread_count.side_effect = RuntimeError("Sin recursos")
        with patch.object(task, "ThreadedTaskDispatcher", return_value=dispatcher), patch("waitress.create_server") as crear:
            with self.assertRaisesRegex(RuntimeError, "Sin recursos"):
                arranque.crear_servidor(None, "127.0.0.1", 5000)
        crear.assert_not_called()
        dispatcher.shutdown.assert_called_once_with(timeout=1)

    def test_cierre_rechaza_conexiones_y_espera_workers_antes_de_cerrar_triggers(self):
        from waitress import task, wasyncore
        orden = []
        mapa_propio = {}
        listener = types.SimpleNamespace(accepting=True)
        trigger = types.SimpleNamespace(accepting=False, close=lambda: orden.append("trigger"))
        canal = types.SimpleNamespace(accepting=False, close=lambda: orden.append("canal"))
        dispatcher = MagicMock()
        dispatcher.shutdown.side_effect = lambda **_: orden.append("workers")
        modulo = types.SimpleNamespace(app=types.SimpleNamespace(config={"MAX_CONTENT_LENGTH": 123}))

        def crear(*args, **kw):
            nonlocal mapa_propio
            mapa_propio = kw["map"]
            mapa_propio.update({1: listener, 2: trigger, 3: canal})
            return object()

        def cerrar_listener(objeto):
            self.assertIs(objeto, listener)
            orden.append("listener")
            mapa_propio.pop(1)

        with patch.object(task, "ThreadedTaskDispatcher", return_value=dispatcher), patch("waitress.create_server", side_effect=crear), patch.object(wasyncore.dispatcher, "close", side_effect=cerrar_listener):
            _, cerrar = arranque.crear_servidor(modulo, "127.0.0.1", 5000)
            cerrar()
        self.assertEqual(orden, ["listener", "workers", "trigger", "canal"])
        self.assertFalse(mapa_propio)

    def test_servidor_real_y_puerto_ocupado_no_se_confunden_y_se_libera_al_salir(self):
        with socket.socket() as reserva:
            reserva.bind(("127.0.0.1", 0))
            puerto = reserva.getsockname()[1]
        motor = MotorLocal(puerto=puerto)
        otro = MotorLocal(puerto=puerto)
        try:
            motor.iniciar()
            listo = esperar_evento(motor, "listo")
            self.assertEqual(listo.version, "3.2.0")
            self.assertTrue(motor.disponible.is_set())
            with patch.object(arranque, "esperar_servidor") as sondear, self.assertLogs("ampu.arranque", level="ERROR"):
                otro.iniciar()
                error = esperar_evento(otro, "error")
                self.assertTrue(otro.terminado.wait(3))
            self.assertIn("ya está en uso", error.detalle)
            sondear.assert_not_called()
            with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(motor.url + "/api/salud", timeout=2) as r:
                self.assertEqual(json.load(r)["estado"], "ok")
        finally:
            otro.detener()
            motor.detener()
            self.assertTrue(motor.terminado.wait(4))
        self.assertFalse(motor.disponible.is_set())
        with socket.socket() as s:
            self.assertNotEqual(s.connect_ex(("127.0.0.1", puerto)), 0)

    def test_muerte_inesperada_quita_estado_listo_y_publica_error(self):
        acabar = threading.Event()
        servidor = MagicMock()
        servidor.run.side_effect = lambda: acabar.wait(3)
        motor = MotorLocal()
        with patch.object(arranque.importlib, "import_module", return_value=types.SimpleNamespace(VERSION_APP="v")), patch.object(arranque, "crear_servidor", return_value=(servidor, acabar.set)), patch.object(arranque, "esperar_servidor", return_value=True), self.assertLogs("ampu.arranque", level="ERROR"):
            try:
                motor.iniciar()
                esperar_evento(motor, "listo", 2)
                acabar.set()
                esperar_evento(motor, "error", 2)
                self.assertTrue(motor.terminado.wait(2))
            finally:
                motor.detener()
                acabar.set()
        self.assertFalse(motor.disponible.is_set())


class EscritorioTest(unittest.TestCase):
    def test_recursos_en_fuente_y_onefile(self):
        self.assertTrue(escritorio.ruta_icono().is_file())
        self.assertTrue(escritorio.ruta_ico().is_file())
        with patch.object(sys, "_MEIPASS", "/paquete/temporal", create=True):
            self.assertEqual(escritorio.ruta_icono(), Path("/paquete/temporal/frontend/static/img/icono_ampu.png"))
            self.assertEqual(escritorio.ruta_ico(), Path("/paquete/temporal/frontend/static/favicon.ico"))

    def test_identidad_windows_y_fallo_no_fatal(self):
        shell = MagicMock()
        shell.SetCurrentProcessExplicitAppUserModelID.return_value = 0
        with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", return_value=shell, create=True):
            escritorio.identificar_aplicacion()
        shell.SetCurrentProcessExplicitAppUserModelID.assert_called_once_with(escritorio.ID_APLICACION)
        self.assertEqual(shell.SetCurrentProcessExplicitAppUserModelID.argtypes, [ctypes.c_wchar_p])
        shell.SetCurrentProcessExplicitAppUserModelID.return_value = -1
        with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", return_value=shell, create=True), self.assertLogs("ampu.escritorio", level="WARNING"):
            escritorio.identificar_aplicacion()

    def test_oculta_solo_la_consola_exclusiva_nunca_cmd_o_powershell(self):
        for total in (0, 1, 2, 5):
            with self.subTest(procesos=total):
                kernel, user = MagicMock(), MagicMock()
                kernel.GetConsoleWindow.return_value = 123

                def procesos(buffer, _):
                    buffer[0] = os.getpid()
                    return total

                kernel.GetConsoleProcessList.side_effect = procesos
                with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", side_effect=lambda nombre, **_: kernel if nombre == "kernel32" else user, create=True):
                    escritorio.ocultar_consola_propia()
                if total == 1:
                    user.ShowWindow.assert_called_once_with(123, 0)
                else:
                    user.ShowWindow.assert_not_called()

    def test_consola_de_diagnostico_es_optativa_y_error_fatal_es_grafico(self):
        kernel = MagicMock()
        kernel.AllocConsole.return_value = 1
        abrir = MagicMock()
        with patch.object(sys, "platform", "win32"), patch.object(sys, "stdout", None), patch.object(sys, "stderr", None), patch.object(ctypes, "WinDLL", return_value=kernel, create=True), patch("escritorio.open", abrir):
            escritorio.activar_consola()
        kernel.AllocConsole.assert_called_once()
        user = MagicMock()
        with patch.object(sys, "platform", "win32"), patch.object(ctypes, "WinDLL", return_value=user, create=True):
            escritorio.mostrar_error_nativo("AmPu", "Revisa la instalación")
        user.MessageBoxW.assert_called_once_with(None, "Revisa la instalación", "AmPu", 0x10)

    def test_registro_utf8_rotativo_fuera_del_paquete_y_sin_duplicados(self):
        raiz = logging.getLogger()
        nivel = raiz.level
        try:
            with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {"LOCALAPPDATA": temp}), patch.object(raiz, "handlers", []):
                try:
                    archivo = escritorio.configurar_registro()
                    self.assertEqual(archivo, Path(temp) / "AmPu/logs/ampu.log")
                    self.assertEqual(escritorio.configurar_registro(), archivo)
                    self.assertEqual(len(raiz.handlers), 1)
                    self.assertEqual(raiz.handlers[0].maxBytes, 1024 * 1024)
                    self.assertEqual(raiz.handlers[0].backupCount, 2)
                    logging.getLogger("ampu.prueba").info("Iniciación y cálculo")
                    self.assertIn("Iniciación y cálculo", archivo.read_text(encoding="utf-8"))
                finally:
                    for handler in raiz.handlers:
                        handler.close()
        finally:
            raiz.setLevel(nivel)

    def test_bandeja_desactivada_no_importa_pystray(self):
        for plataforma, apagar in (("linux", "0"), ("win32", "1")):
            eventos = SimpleQueue()
            with patch.object(sys, "platform", plataforma), patch.dict(os.environ, {"AMPU_NO_TRAY": apagar}), patch.dict(sys.modules, {"pystray": None}):
                bandeja = escritorio.BandejaWindows(eventos, threading.Event())
                bandeja.iniciar()
            self.assertEqual(eventos.get_nowait().tipo, "bandeja_no")
            self.assertFalse(bandeja.lista.is_set())

    @contextlib.contextmanager
    def bandeja_simulada(self, fallo=""):
        instancias = []
        visible, final = threading.Event(), threading.Event()

        class Menu:
            SEPARATOR = object()

            def __init__(self, *items):
                self.items = items

        class Item:
            def __init__(self, texto, accion, **opciones):
                self.texto, self.accion = texto, accion
                self.default = opciones.get("default", False)
                self.enabled = opciones.get("enabled", True)

        class Icon:
            def __init__(self, nombre, imagen, titulo, menu):
                self.nombre, self.imagen, self.titulo, self.menu = nombre, imagen, titulo, menu
                self.actualizaciones = 0
                instancias.append(self)

            def __setattr__(self, nombre, valor):
                if nombre == "visible":
                    if fallo == "visibilidad":
                        raise OSError("Explorer rechazó el icono")
                    visible.set()
                object.__setattr__(self, nombre, valor)

            def run(self, setup):
                self.daemon = threading.current_thread().daemon
                if fallo == "arranque":
                    raise OSError("No hay bandeja")
                setup(self)
                if fallo != "bucle":
                    final.wait(3)

            def stop(self):
                final.set()

            def update_menu(self):
                if fallo == "menu":
                    raise OSError("Menú no disponible")
                self.actualizaciones += 1

        eventos, disponible = SimpleQueue(), threading.Event()
        fake = types.SimpleNamespace(Icon=Icon, Menu=Menu, MenuItem=Item)
        with patch.object(sys, "platform", "win32"), patch.dict(os.environ, {"AMPU_NO_TRAY": "0"}), patch.dict(sys.modules, {"pystray": fake}):
            bandeja = escritorio.BandejaWindows(eventos, disponible)
            try:
                bandeja.iniciar()
                if not fallo or fallo in ("menu", "bucle"):
                    self.assertTrue(visible.wait(1))
                    self.assertEqual(eventos.get(timeout=1).tipo, "bandeja_lista")
                yield bandeja, eventos, disponible, instancias
            finally:
                bandeja.cerrar()
                final.set()
                bandeja._hilo.join(timeout=2)
                self.assertFalse(bandeja._hilo.is_alive())

    def test_menu_mostrar_abrir_y_salir_solo_encola_sin_tocar_tk(self):
        with self.bandeja_simulada() as (bandeja, eventos, disponible, instancias):
            icono = instancias[0]
            self.assertTrue(icono.daemon)
            self.assertEqual(icono.imagen.size, (256, 256))
            self.assertEqual([i.texto for i in icono.menu.items if hasattr(i, "texto")], ["Mostrar launcher", "Abrir AmPu", "Salir de AmPu"])
            self.assertTrue(icono.menu.items[0].default)
            self.assertFalse(icono.menu.items[1].enabled(None))
            disponible.set()
            bandeja.actualizar_menu()
            self.assertEqual(icono.actualizaciones, 1)
            self.assertTrue(icono.menu.items[1].enabled(None))
            for i in (0, 1, 3):
                icono.menu.items[i].accion(icono, None)
            self.assertEqual([e.tipo for e in vaciar(eventos)], ["mostrar", "abrir", "salir"])

    def test_fallos_de_bandeja_notifican_sin_volver_a_abrir_consola(self):
        for fallo in ("arranque", "visibilidad", "bucle", "menu"):
            registro = self.assertLogs("ampu.escritorio", level="ERROR") if fallo != "bucle" else contextlib.nullcontext()
            with self.subTest(fallo=fallo), registro:
                with self.bandeja_simulada(fallo) as (bandeja, eventos, _, __):
                    if fallo == "menu":
                        bandeja.actualizar_menu()
                    self.assertEqual(eventos.get(timeout=2).tipo, "bandeja_error")
                    self.assertFalse(bandeja.lista.is_set())

    def test_retirar_icono_no_bloquea_la_ventana_si_win32_se_atasca(self):
        icono = MagicMock()
        entro, liberar = threading.Event(), threading.Event()
        icono.stop.side_effect = lambda: (entro.set(), liberar.wait(2))
        bandeja = escritorio.BandejaWindows(SimpleQueue(), threading.Event())
        bandeja._icono = icono
        try:
            bandeja.cerrar()
            self.assertTrue(entro.wait(1))
            self.assertFalse(liberar.is_set())
            bandeja.cerrar()
            self.assertEqual(icono.stop.call_count, 1)
        finally:
            liberar.set()


class EntradaTest(unittest.TestCase):
    def test_importar_entrada_no_importa_motor_tk_ni_pystray(self):
        salida = subprocess.check_output([sys.executable, "-c", "import main,lanzador,sys; print(*[n in sys.modules for n in ('app','numpy','tkinter','pystray')])"], cwd=RAIZ, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}, text=True)
        self.assertEqual(salida.strip(), "False False False False")

    def test_windows_siempre_usa_launcher_aunque_bandeja_este_desactivada(self):
        with patch.object(sys, "platform", "win32"), patch.dict(os.environ, {"AMPU_NO_LAUNCHER": "0", "AMPU_NO_TRAY": "1"}), patch.object(main, "configurar_registro", return_value=Path("registro.log")), patch.object(main, "identificar_aplicacion"), patch.object(main, "ocultar_consola_propia") as ocultar, patch.object(main, "activar_consola") as consola, patch.object(main, "motor_configurado") as crear, patch("lanzador.ejecutar") as ejecutar, patch.object(main, "modo_consola") as modo:
            main.main()
        ejecutar.assert_called_once_with(crear.return_value, Path("registro.log"))
        crear.return_value.detener.assert_called_once()
        ocultar.assert_called_once()
        consola.assert_not_called()
        modo.assert_not_called()

    def test_error_de_tk_se_muestra_graficamente_y_no_deja_motor_huerfano(self):
        with patch.object(sys, "platform", "win32"), patch.dict(os.environ, {"AMPU_NO_LAUNCHER": "0"}), patch.object(main, "configurar_registro", return_value=Path("registro.log")), patch.object(main, "identificar_aplicacion"), patch.object(main, "ocultar_consola_propia"), patch.object(main, "activar_consola") as consola, patch.object(main, "motor_configurado") as crear, patch("lanzador.ejecutar", side_effect=ModuleNotFoundError("tkinter")), patch.object(main, "mostrar_error_nativo") as error, self.assertLogs("ampu.arranque", level="ERROR"):
            with self.assertRaises(SystemExit) as fin:
                main.main()
        self.assertEqual(fin.exception.code, 1)
        self.assertIn("registro.log", error.call_args.args[1])
        crear.return_value.detener.assert_called_once()
        consola.assert_not_called()

    def test_consola_windows_solo_con_opcion_explicita_y_linux_conserva_cli(self):
        for plataforma in ("linux", "win32"):
            with self.subTest(plataforma=plataforma), patch.object(sys, "platform", plataforma), patch.dict(os.environ, {"AMPU_NO_LAUNCHER": "1"}), patch.object(main, "activar_consola") as consola, patch.object(main, "motor_configurado") as crear, patch.object(main, "modo_consola") as modo, patch("lanzador.ejecutar") as ejecutar:
                main.main()
                modo.assert_called_once_with(crear.return_value)
                self.assertEqual(consola.call_count, plataforma == "win32")
                ejecutar.assert_not_called()

    def test_configuracion_prefiere_ampu_port_y_rechaza_puerto_invalido(self):
        with patch.dict(os.environ, {"AMPU_HOST": "::", "AMPU_PORT": "5678", "PORT": "5000"}):
            self.assertEqual(main.motor_configurado().url, "http://[::1]:5678")
        for valor in ("incorrecto", "0", "65536"):
            with patch.dict(os.environ, {"AMPU_PORT": valor}), self.assertRaises(ValueError):
                main.motor_configurado()

    def test_doble_clic_pyw_invoca_la_misma_entrada(self):
        with patch.object(main, "main") as ejecutar:
            runpy.run_path(str(RAIZ / "AmPu.pyw"), run_name="__main__")
        ejecutar.assert_called_once_with()

    def test_modo_diagnostico_respeta_no_browser_y_limpia_tras_error(self):
        for tipo in ("detenido", "error"):
            motor = MagicMock()
            motor.url = "http://local"
            motor.eventos = SimpleQueue()
            motor.eventos.put(Evento("listo", version="v"))
            motor.eventos.put(Evento(tipo, "Fallo de prueba"))
            with patch.dict(os.environ, {"AMPU_NO_BROWSER": "1"}), patch.object(main.webbrowser, "open") as abrir, contextlib.redirect_stdout(io.StringIO()):
                if tipo == "error":
                    with self.assertRaisesRegex(SystemExit, "Fallo de prueba"):
                        main.modo_consola(motor)
                else:
                    main.modo_consola(motor)
            abrir.assert_not_called()
            motor.detener.assert_called_once()
            motor.terminado.wait.assert_called_once_with(timeout=3)


if __name__ == "__main__":
    unittest.main()
