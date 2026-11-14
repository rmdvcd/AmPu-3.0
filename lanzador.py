"""Ventana de lanzamiento de AmPu: Tk en el hilo principal, motor y bandeja aparte."""

from __future__ import annotations

import logging
import os
from queue import Empty
import threading
import time
import webbrowser

from arranque import Evento
from escritorio import BandejaWindows, ruta_ico, ruta_icono

log = logging.getLogger("ampu.lanzador")


class ControladorLauncher:
    """Coordina acciones sin invocar Tk desde callbacks de pystray o del motor."""

    def __init__(self, vista, motor, bandeja=None):
        self.vista, self.motor = vista, motor
        self.bandeja = bandeja or BandejaWindows(motor.eventos, motor.disponible)
        self.cerrando = False
        self._finalizado = False
        self._auto_abierto = False
        self._abriendo = threading.Event()
        self._limite_cierre = 0
        vista.conectar(abrir=self.abrir, minimizar=self.minimizar, cerrar=self.cerrar_ventana, salir=self.salir)

    def iniciar(self):
        self.vista.estado("iniciando", "Cargando el motor estadístico…")
        self.vista.bandeja(False, "Preparando la bandeja de Windows…")
        self.bandeja.iniciar()
        self.motor.iniciar()
        self.vista.programar(100, self._procesar)

    def _procesar(self):
        if self._finalizado:
            return
        for _ in range(60):
            try:
                evento = self.motor.eventos.get_nowait()
            except Empty:
                break
            if not self.cerrando:
                self._atender(evento)
        if self.cerrando and ((self.motor.terminado.is_set() and self.bandeja.terminada.is_set())
                              or time.monotonic() >= self._limite_cierre):
            self._finalizado = True
            self.vista.terminar()
            return
        self.vista.programar(100, self._procesar)

    def _atender(self, evento):
        if evento.tipo == "listo":
            self.vista.estado("listo", evento.detalle, evento.version)
            self.bandeja.actualizar_menu()
            if not self._auto_abierto and os.environ.get("AMPU_NO_BROWSER") != "1":
                self._auto_abierto = True
                self.abrir()
        elif evento.tipo in ("iniciando", "error", "detenido"):
            self.vista.estado(evento.tipo, evento.detalle, evento.version)
            if evento.tipo in ("error", "detenido"):
                self.bandeja.actualizar_menu()
                self.vista.mostrar()
        elif evento.tipo == "bandeja_lista":
            self.vista.bandeja(True, "Minimizar o cerrar esta ventana deja AmPu en la bandeja. Usa «Salir» para detener el motor.")
        elif evento.tipo in ("bandeja_no", "bandeja_error"):
            self.vista.bandeja(False, evento.detalle)
            if evento.tipo == "bandeja_error":
                self.vista.mostrar()
        elif evento.tipo == "mostrar":
            self.vista.mostrar()
        elif evento.tipo == "abrir":
            self.abrir()
        elif evento.tipo == "salir":
            self.salir()
        elif evento.tipo == "navegador_error":
            self.vista.mostrar()
            self.vista.avisar("No se pudo abrir el navegador", f"El motor sigue disponible. Copia esta dirección en tu navegador:\n\n{self.motor.url}")

    def abrir(self):
        if self.cerrando or not self.motor.disponible.is_set() or self._abriendo.is_set():
            return
        self._abriendo.set()

        def ejecutar():
            try:
                if not webbrowser.open(self.motor.url):
                    self.motor.eventos.put(Evento("navegador_error"))
            except Exception:
                log.exception("No se pudo abrir el navegador.")
                self.motor.eventos.put(Evento("navegador_error"))
            finally:
                self._abriendo.clear()

        threading.Thread(target=ejecutar, name="AmPu-navegador", daemon=True).start()

    def minimizar(self):
        # Solo se retira de la barra de tareas tras confirmar que el icono existe.
        if not self.cerrando and self.bandeja.lista.is_set():
            self.vista.ocultar()

    def cerrar_ventana(self):
        if self.cerrando:
            return
        if self.bandeja.lista.is_set():
            self.minimizar()
        elif self.vista.confirmar_salida():
            self.salir()

    def salir(self):
        if self.cerrando:
            return
        self.cerrando = True
        self._limite_cierre = time.monotonic() + 3
        self.vista.estado("cerrando", "Deteniendo el motor y retirando el icono de la bandeja…")
        self.motor.detener()
        self.bandeja.cerrar()

    def limpiar(self):
        self.motor.detener()
        self.bandeja.cerrar()


class VentanaLauncher:
    """Vista nativa pequeña, con controles de Windows y la identidad de la app."""

    def __init__(self, root, motor, registro):
        # Importación diferida: el servidor web y los tests sin GUI no requieren Tk.
        import tkinter as tk
        from tkinter import messagebox, ttk

        self.root, self.motor, self.registro = root, motor, registro
        self.tk, self.ttk, self.messagebox = tk, ttk, messagebox
        self._tipo = "iniciando"
        root.title("AmPu · Launcher")
        root.configure(background="#f4f7fa")
        root.report_callback_exception = self._error_callback
        self._imagenes = []
        try:
            imagen = tk.PhotoImage(file=str(ruta_icono()))
            root.iconphoto(True, imagen)
            self._imagenes = [imagen, imagen.subsample(4, 4)]
            if os.name == "nt":
                root.iconbitmap(default=str(ruta_ico()))
        except (tk.TclError, OSError):
            log.warning("No se pudo aplicar el icono de la ventana.", exc_info=True)

        estilo = ttk.Style(root)
        estilo.theme_use("clam")
        estilo.configure("TFrame", background="#f4f7fa")
        estilo.configure("TLabel", background="#f4f7fa", foreground="#18313d", font=("Segoe UI", 10))
        estilo.configure("Titulo.TLabel", font=("Segoe UI", 24, "bold"))
        estilo.configure("Tenue.TLabel", foreground="#506675")
        estilo.configure("Tarjeta.TFrame", background="#ffffff", borderwidth=1, relief="solid")
        estilo.configure("Tarjeta.TLabel", background="#ffffff")
        estilo.configure("Estado.TLabel", background="#ffffff", font=("Segoe UI", 14, "bold"))
        estilo.configure("Detalle.TLabel", background="#ffffff", foreground="#506675")
        estilo.configure("TButton", font=("Segoe UI", 10), padding=(12, 10), background="#ffffff", foreground="#18313d")
        estilo.map("TButton", background=[("active", "#e2f2ee")], foreground=[("disabled", "#71818b")])
        estilo.configure("Primario.TButton", background="#0b4a42", foreground="#ffffff", font=("Segoe UI", 10, "bold"))
        estilo.map("Primario.TButton", background=[("disabled", "#dfe7eb"), ("active", "#09675a")], foreground=[("disabled", "#71818b")])
        estilo.configure("Enlace.TButton", background="#f4f7fa", foreground="#086f61", padding=(0, 5))
        estilo.configure("AmPu.Horizontal.TProgressbar", background="#0b7b69", troughcolor="#e5efee", borderwidth=0)
        alto_linea = int(root.tk.call("font", "metrics", ("Segoe UI", 10), "-linespace"))

        marco = ttk.Frame(root, padding=28)
        marco.grid(sticky="nsew")
        root.columnconfigure(0, weight=1)
        root.rowconfigure(0, weight=1)
        marco.columnconfigure(0, weight=1)
        cabecera = ttk.Frame(marco)
        cabecera.grid(row=0, column=0, sticky="ew", pady=(0, 24))
        cabecera.columnconfigure(1, weight=1)
        if self._imagenes:
            ttk.Label(cabecera, image=self._imagenes[1]).grid(row=0, column=0, rowspan=2, padx=(0, 16))
        ttk.Label(cabecera, text="AmPu", style="Titulo.TLabel").grid(row=0, column=1, sticky="w")
        ttk.Label(cabecera, text="Probabilidad y estadística · En tu equipo", style="Tenue.TLabel").grid(row=1, column=1, sticky="w")
        self.version = tk.StringVar()
        ttk.Label(cabecera, textvariable=self.version, style="Tenue.TLabel").grid(row=0, column=2, sticky="ne")

        tarjeta = ttk.Frame(marco, style="Tarjeta.TFrame", padding=22)
        tarjeta.grid(row=1, column=0, sticky="nsew")
        tarjeta.columnconfigure(0, weight=1)
        # Reserva dos líneas para que los avisos no recorten los botones al llegar.
        tarjeta.rowconfigure(1, minsize=alto_linea * 2 + 14)
        self.titulo = tk.StringVar(value="Iniciando AmPu…")
        self.detalle = tk.StringVar(value="Preparando el laboratorio local.")
        self.label_estado = ttk.Label(tarjeta, textvariable=self.titulo, style="Estado.TLabel")
        self.label_estado.grid(row=0, column=0, sticky="w", pady=(0, 8))
        self.label_detalle = ttk.Label(tarjeta, textvariable=self.detalle, style="Detalle.TLabel", wraplength=480, justify="left")
        self.label_detalle.grid(row=1, column=0, sticky="ew", pady=(0, 14))
        self.url = tk.StringVar(value=motor.url)
        self.direccion = ttk.Entry(tarjeta, textvariable=self.url, state="readonly", font=("Consolas", 10))
        self.direccion.grid(row=2, column=0, sticky="ew", ipady=4)
        self.progreso = ttk.Progressbar(tarjeta, mode="indeterminate", style="AmPu.Horizontal.TProgressbar")
        self.progreso.grid(row=3, column=0, sticky="ew", pady=(16, 0))

        acciones = ttk.Frame(marco)
        acciones.grid(row=2, column=0, sticky="ew", pady=(20, 0))
        acciones.columnconfigure(0, weight=1)
        acciones.columnconfigure(1, weight=1)
        self.boton_abrir = ttk.Button(acciones, text="Abrir AmPu", style="Primario.TButton", underline=0, state="disabled")
        self.boton_abrir.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.boton_minimizar = ttk.Button(acciones, text="Minimizar a bandeja", underline=0, state="disabled")
        self.boton_minimizar.grid(row=0, column=1, sticky="ew")
        self.pista = tk.StringVar()
        self.label_pista = ttk.Label(marco, textvariable=self.pista, style="Tenue.TLabel", wraplength=520, justify="left")
        self.label_pista.grid(row=3, column=0, sticky="ew", pady=(16, 12))
        marco.rowconfigure(3, minsize=alto_linea * 2 + 28)
        marco.rowconfigure(4, weight=1)
        inferior = ttk.Frame(marco)
        inferior.grid(row=5, column=0, sticky="ew", pady=(8, 0))
        inferior.columnconfigure(0, weight=1)
        self.boton_registro = ttk.Button(inferior, text="Ver registro", style="Enlace.TButton", command=self.abrir_registro)
        self.boton_registro.grid(row=0, column=0, sticky="w")
        if registro is None:
            self.boton_registro.state(["disabled"])
        self.boton_salir = ttk.Button(inferior, text="Salir", underline=0)
        self.boton_salir.grid(row=0, column=1, sticky="e")
        root.bind("<Configure>", self._redimensionar)
        root.update_idletasks()
        ancho = min(max(620, root.winfo_reqwidth()), root.winfo_screenwidth() - 48)
        alto = min(max(470, root.winfo_reqheight()), root.winfo_screenheight() - 80)
        # El tamaño requerido incorpora la escala de fuentes/DPI de Tk.
        root.minsize(ancho, alto)
        root.geometry(f"{ancho}x{alto}+{max(0, (root.winfo_screenwidth()-ancho)//2)}+{max(0, (root.winfo_screenheight()-alto)//2)}")

    def conectar(self, *, abrir, minimizar, cerrar, salir):
        self.boton_abrir.configure(command=abrir)
        self.boton_minimizar.configure(command=minimizar)
        self.boton_salir.configure(command=salir)
        self.root.protocol("WM_DELETE_WINDOW", cerrar)
        self.root.bind("<Unmap>", lambda e: minimizar() if e.widget is self.root and self.root.state() == "iconic" else None)
        self.root.bind("<Alt-a>", lambda _: abrir())
        self.root.bind("<Alt-m>", lambda _: minimizar())
        self.root.bind("<Alt-s>", lambda _: salir())
        self.root.bind("<Escape>", lambda _: minimizar())

    def estado(self, tipo, detalle, version=""):
        self._tipo = tipo
        titulos = {"iniciando": "Iniciando AmPu…", "listo": "●  AmPu está listo", "error": "El motor no está disponible", "detenido": "Motor detenido", "cerrando": "Cerrando AmPu…"}
        self.titulo.set(titulos.get(tipo, "AmPu"))
        self.detalle.set(detalle)
        if version:
            self.version.set(f"v{version}")
        self.label_estado.configure(foreground="#a12c32" if tipo == "error" else "#0b4a42")
        self.boton_abrir.state(["!disabled"] if tipo == "listo" else ["disabled"])
        if tipo in ("iniciando", "cerrando"):
            self.progreso.grid()
            self.progreso.start(14)
        else:
            self.progreso.stop()
            self.progreso.grid_remove()
        if tipo == "cerrando":
            self.boton_minimizar.state(["disabled"])
            self.boton_salir.state(["disabled"])

    def bandeja(self, disponible, detalle):
        self.pista.set(detalle)
        self.boton_minimizar.state(["!disabled"] if disponible and self._tipo != "cerrando" else ["disabled"])

    def mostrar(self):
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        (self.boton_abrir if self._tipo == "listo" else self.boton_salir).focus_set()

    def ocultar(self):
        self.root.withdraw()

    def programar(self, espera, accion):
        self.root.after(espera, accion)

    def confirmar_salida(self):
        return self.messagebox.askyesno("Salir de AmPu", "La bandeja no está disponible. ¿Quieres detener el motor y salir de AmPu?", parent=self.root)

    def avisar(self, titulo, mensaje):
        self.messagebox.showwarning(titulo, mensaje, parent=self.root)

    def abrir_registro(self):
        try:
            os.startfile(str(self.registro))
        except (AttributeError, OSError):
            self.avisar("Registro de AmPu", f"No se pudo abrir el archivo automáticamente.\n\n{self.registro}")

    def _redimensionar(self, evento):
        if evento.widget is self.root:
            self.label_detalle.configure(wraplength=max(240, evento.width - 104))
            self.label_pista.configure(wraplength=max(240, evento.width - 60))

    def _error_callback(self, tipo, valor, traza):
        log.error("Error en la ventana de lanzamiento.", exc_info=(tipo, valor, traza))
        self.mostrar()
        self.avisar("AmPu", "No se pudo completar la acción. Consulta el registro o usa «Salir» para cerrar AmPu.")

    def terminar(self):
        self.progreso.stop()
        self.root.destroy()


def ejecutar(motor, registro):
    import tkinter as tk

    root = tk.Tk()
    controlador = None
    try:
        vista = VentanaLauncher(root, motor, registro)
        controlador = ControladorLauncher(vista, motor)
        controlador.iniciar()
        root.mainloop()
    finally:
        if controlador is not None:
            controlador.limpiar()
        else:
            motor.detener()
        try:
            root.destroy()
        except tk.TclError:
            pass
