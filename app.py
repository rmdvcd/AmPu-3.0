"""Backend Flask para AmPu 3.0 Portable Web App.

Este archivo integra la lógica estadística de AmPu 3.0 (numpy, scipy, pandas)
con una API REST para el frontend web.
"""

import os
import json
import base64
import io
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify, send_file, render_template, send_from_directory

# Configurar PYTHONPATH para incluir el motor AmPu 3.0 y las dependencias vendidas
if hasattr(sys, "_MEIPASS"):
    # Modo .exe
    sys.path.insert(0, os.path.join(sys._MEIPASS, "vendor"))
    sys.path.insert(0, os.path.join(sys._MEIPASS, "engine"))
else:
    # Modo desarrollo
    base_dir = Path(__file__).parent
    sys.path.insert(0, str(base_dir / "vendor"))
    sys.path.insert(0, str(base_dir / "engine"))
    # También añadir la ruta original del repositorio AmPu 3.0 para pruebas
    sys.path.insert(0, str(base_dir.parent / "AmPu 3.0" / "src"))

# Importar la lógica de AmPu 3.0
from ampu.core.distribuciones import catalogo, obtener
from ampu.core.distribuciones.tabla import ResultadoDistribucion, analizar
from ampu.core.estadistica.descriptiva import resumir, frecuencias
from ampu.core.estadistica.combinatoria import factorial, permutaciones, combinaciones
from ampu.core.estadistica.probabilidad import condicional, independientes
from ampu.core.estadistica.inferencia import correlacion
from ampu.core.estadistica.regresion import ResultadoRegresion
from ampu.core.muestreo.diseno import ejecutar_diseno
from ampu.core.simulacion.montecarlo import ajustar_distribucion, curva_ajustada, generar_muestra, integral_cuadrado, puntos_pi, qq_plot, simular_pi
from ampu.core.errores import ErrorAmPu, ParametroInvalidoError, SoporteError, CalculoNoConvergenteError
from ampu.io.servicio import ServicioExportacion as io_servicio
from ampu.docs.teoria import listar_teoria, leer_teoria, DOCUMENTOS
from ampu.ui.preferencias import Preferencias, ruta_preferencias
from ampu.ui.preferencias_sistema import apariencia_sistema
from ampu.ui.entradas import numeros, matriz
from ampu.ui.logica import _resumir_datos, _resolver_probabilidad, _evaluar, _simular
from ampu.ui.temas import PALETAS

import numpy as np
import pandas as pd
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg

app = Flask(__name__, static_folder='frontend/static', template_folder='frontend')

# Configuración de preferencias
PREFERENCIAS = Preferencias()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('frontend/static', filename)

# --- API PREFERENCIAS ---
@app.route('/api/preferences', methods=['GET', 'POST'])
def api_preferences():
    if request.method == 'GET':
        return jsonify(PREFERENCIAS.valores)
    else:
        data = request.json
        PREFERENCIAS.valores.update(data)
        PREFERENCIAS._guardar()
        return jsonify({"status": "success", "values": PREFERENCIAS.valores})

# --- API DISTRIBUCIONES ---
@app.route('/api/distribuciones/lista', methods=['GET'])
def api_distribuciones_lista():
    modelos = catalogo()
    return jsonify([{"clave": m.clave, "nombre": m.nombre} for m in modelos])

@app.route('/api/distribucion/formulario/<clave>', methods=['GET'])
def api_distribucion_formulario(clave):
    try:
        modelo = obtener(clave)
        return jsonify([{"nombre": p.nombre, "tipo": p.tipo, "default": p.default, "descripcion": p.descripcion} for p in modelo.parametros])
    except KeyError as e:
        return jsonify({"error": str(e)}), 404

@app.route('/api/distribucion/calcular', methods=['POST'])
def api_distribucion_calcular():
    data = request.json
    clave = data.get('clave')
    parametros = data.get('parametros', {})
    evento_str = data.get('evento', '')
    cuantil = data.get('cuantil', 0.5)
    semilla = data.get('semilla', 42)

    try:
        modelo = obtener(clave)
        
        # Validar evento
        if modelo.dimensionalidad == 'univariante':
            evento = float(evento_str)
        else:
            evento = [float(x.strip()) for x in evento_str.split(',')]
        
        # Analizar
        resultado: ResultadoDistribucion = analizar(modelo, parametros, evento, cuantil, semilla)
        
        # Generar gráfico (Matplotlib Agg)
        fig = Figure(figsize=(8, 5), dpi=100)
        ax = fig.add_subplot(111)
        
        # Adaptar lógica de gráfico (simplificada para el ejemplo)
        x = np.linspace(resultado.soporte[0], resultado.soporte[1], 200) if hasattr(resultado, 'soporte') else np.linspace(0, 10, 200)
        y = modelo.pdf(x, **parametros) if not modelo.discreta else modelo.pmf(x, **parametros)
        
        ax.plot(x, y, color='#087568')
        ax.set_title(f"{modelo.nombre}")
        ax.set_xlabel("x")
        ax.set_ylabel("f(x) / P(X=x)")
        
        canvas = FigureCanvasAgg(fig)
        buf = io.BytesIO()
        canvas.print_png(buf)
        grafico_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        buf.close()

        # Preparar respuesta
        respuesta = {
            "probabilidad_o_densidad": resultado.respuesta.get("probabilidad_o_densidad", 0),
            "acumulada": resultado.respuesta.get("acumulada", 0),
            "media": resultado.respuesta.get("media", 0),
            "desviacion": resultado.respuesta.get("desviacion", 0)
        }
        
        # Convertir tabla a lista de listas para JSON
        tabla_lista = resultado.tabla.values.tolist()
        columnas = resultado.tabla.columns.tolist()
        
        return jsonify({
            "respuesta": respuesta,
            "tabla": [columnas] + tabla_lista,
            "grafico_base64": grafico_base64,
            "soporte": resultado.soporte if hasattr(resultado, 'soporte') else [0, 10]
        })

    except ErrorAmPu as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Error interno: {str(e)}"}), 500

# --- API TEORÍA ---
@app.route('/api/teoria/lista', methods=['GET'])
def api_teoria_lista():
    return jsonify(listar_teoria())

@app.route('/api/teoria/<clave>', methods=['GET'])
def api_teoria_contenido(clave):
    try:
        contenido = leer_teoria(clave)
        return jsonify({"contenido": contenido})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404

# --- API VISTAS (Descriptiva, Probabilidad, etc.) ---
@app.route('/api/view/<tabId>', methods=['GET'])
def api_view(tabId):
    views = {
        'distribuciones': '''
            <div class="grid">
                <div class="sidebar">
                    <h3>Configura tu modelo</h3>
                    <div class="form-group">
                        <label>Modelo</label>
                        <select id="selector-modelo" onchange="updateFormulario(this.value)"></select>
                    </div>
                    <div id="formulario-container"></div>
                    <div class="form-group">
                        <label>x · valor a evaluar</label>
                        <input type="text" id="input-evento" value="5">
                    </div>
                    <div class="form-group">
                        <label>Cuantil q</label>
                        <input type="number" id="input-cuantil" value="0.5" step="0.05" min="0" max="1">
                    </div>
                    <div class="form-group">
                        <label>Semilla</label>
                        <input type="number" id="input-semilla" value="42">
                    </div>
                    <button onclick="calcularDistribucion()">Calcular y visualizar</button>
                    <button class="export-btn" onclick="exportar('png')">Exportar PNG</button>
                    <button class="export-btn" onclick="exportar('pdf')">Exportar PDF</button>
                    <button class="export-btn" onclick="exportar('excel')">Exportar Excel</button>
                </div>
                <div class="main-area">
                    <div class="kpis">
                        <div class="kpi">P(X=x)/f(x): <span id="kpi-prob">0</span></div>
                        <div class="kpi">CDF: <span id="kpi-acum">0</span></div>
                        <div class="kpi">Media: <span id="kpi-media">0</span></div>
                        <div class="kpi">Desviación: <span id="kpi-desv">0</span></div>
                    </div>
                    <div class="chart-container">
                        <img id="chart-img" src="" alt="Gráfico" style="width:100%;">
                    </div>
                    <div class="table-container">
                        <table id="tabla-datos">
                            <thead id="tabla-datos-head"></thead>
                            <tbody id="tabla-datos-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        ''',
        'teoria': '''
            <div class="teoria-content">
                <h3>Biblioteca de Teoría</h3>
                <div id="teoria-lista" style="margin-bottom: 2rem;"></div>
                <div id="teoria-contenido"></div>
            </div>
            <script>
                fetch('/api/teoria/lista')
                    .then(res => res.json())
                    .then(lista => {
                        const container = document.getElementById('teoria-lista');
                        lista.forEach(item => {
                            const btn = document.createElement('button');
                            btn.innerText = item[1];
                            btn.style.marginRight = '0.5rem';
                            btn.onclick = () => loadTeoria(item[0]);
                            container.appendChild(btn);
                        });
                    });
            </script>
        ''',
        'descriptiva': '<h2>Análisis Descriptivo</h2><p>En construcción...</p>',
        'muestreo': '<h2>Diseño Muestral</h2><p>En construcción...</p>',
        'probabilidad': '<h2>Fundamentos de Probabilidad</h2><p>En construcción...</p>',
        'inferencia': '<h2>Inferencia Estadística</h2><p>En construcción...</p>',
        'simulacion': '<h2>Simulación Monte Carlo</h2><p>En construcción...</p>'
    }
    
    html = views.get(tabId, '<h2>Vista no encontrada</h2>')
    return html

@app.route('/api/teoria/leer/<clave>', methods=['GET'])
def api_teoria_leer(clave):
    try:
        contenido = leer_teoria(clave)
        return jsonify({"contenido": contenido})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404

# --- API EXPORTACIÓN ---
@app.route('/api/exportar', methods=['POST'])
def api_exportar():
    data = request.json
    formato = data.get('formato')
    tab = data.get('tab')
    estado = data.get('estado', {})

    temp_dir = tempfile.gettempdir()
    filename = os.path.join(temp_dir, f"ampu_export.{formato}")

    try:
        if formato == 'excel':
            df = pd.DataFrame({"Col1": [1, 2], "Col2": [3, 4]})
            df.to_excel(filename, index=False)
        elif formato == 'pdf':
            from reportlab.pdfgen import canvas
            c = canvas.Canvas(filename)
            c.drawString(100, 800, f"Informe AmPu 3.0 - {tab}")
            c.save()
        elif formato == 'png':
            fig = Figure(figsize=(6, 4))
            fig.text(0.5, 0.5, f"Gráfico {tab}", ha='center')
            canvas = FigureCanvasAgg(fig)
            canvas.print_png(filename)
        
        return send_file(filename, as_attachment=True, download_name=f"ampu_resultado.{formato}")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('AMPU_PORT', 5000))
    app.run(host='127.0.0.1', port=port, debug=False)
