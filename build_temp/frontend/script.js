// Configuración global
let currentTab = 'distribuciones';
let preferences = {
    theme: 'claro',
    scale: 1.0
};

// Cargar preferencias desde API
async function loadPreferences() {
    try {
        const res = await fetch('/api/preferences');
        const data = await res.json();
        preferences = data;
        document.documentElement.setAttribute('data-theme', preferences.theme);
        document.getElementById('themeBtn').innerText = `Tema: ${preferences.theme === 'claro' ? 'Claro' : 'Oscuro'}`;
    } catch (e) {
        console.error("Error cargando preferencias", e);
    }
}

// Toggle tema
async function toggleTheme() {
    const newTheme = preferences.theme === 'claro' ? 'oscuro' : 'claro';
    const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
    });
    if (res.ok) {
        preferences.theme = newTheme;
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('themeBtn').innerText = `Tema: ${newTheme === 'claro' ? 'Claro' : 'Oscuro'}`;
    }
}

// Navegación
function showTab(tabId) {
    currentTab = tabId;
    loadTab(tabId);
}

async function loadTab(tabId) {
    const container = document.getElementById('tab-content');
    container.innerHTML = '<p>Cargando vista...</p>';
    
    try {
        const res = await fetch(`/api/view/${tabId}`);
        const html = await res.text();
        container.innerHTML = html;
        initTabComponents(tabId);
    } catch (e) {
        container.innerHTML = `<p class="error">Error al cargar la vista: ${e.message}</p>`;
    }
}

// Funciones de cálculo (Distribuciones)
async function calcularDistribucion() {
    showLoading(true);
    const data = {
        clave: document.getElementById('selector-modelo').value,
        parametros: getFormValues(),
        evento: document.getElementById('input-evento').value,
        cuantil: parseFloat(document.getElementById('input-cuantil').value),
        semilla: parseInt(document.getElementById('input-semilla').value)
    };

    try {
        const res = await fetch('/api/distribucion/calcular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.error) {
            alert(result.error);
        } else {
            renderDistribucionResult(result);
        }
    } catch (e) {
        alert("Error en el cálculo: " + e.message);
    } finally {
        showLoading(false);
    }
}

function renderDistribucionResult(result) {
    document.getElementById('kpi-prob').innerText = result.respuesta.probabilidad_o_densidad.toFixed(4);
    document.getElementById('kpi-acum').innerText = result.respuesta.acumulada.toFixed(4);
    document.getElementById('kpi-media').innerText = result.respuesta.media.toFixed(4);
    document.getElementById('kpi-desv').innerText = result.respuesta.desviacion.toFixed(4);

    document.getElementById('chart-img').src = `data:image/png;base64,${result.grafico_base64}`;

    const tableBody = document.getElementById('tabla-datos-body');
    tableBody.innerHTML = '';
    const headers = result.tabla[0];
    const rows = result.tabla.slice(1);
    
    const thead = document.getElementById('tabla-datos-head');
    thead.innerHTML = '';
    const trHead = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.innerText = h;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.innerText = cell;
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function getFormValues() {
    const inputs = document.querySelectorAll('.param-input');
    const values = {};
    inputs.forEach(input => {
        values[input.dataset.param] = parseFloat(input.value);
    });
    return values;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// Inicialización de componentes
function initTabComponents(tabId) {
    if (tabId === 'distribuciones') {
        fetch('/api/distribuciones/lista')
            .then(res => res.json())
            .then(models => {
                const select = document.getElementById('selector-modelo');
                select.innerHTML = '';
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.clave;
                    opt.innerText = m.nombre;
                    select.appendChild(opt);
                });
                if (models.length > 0) updateFormulario(models[0].clave);
            });
    } else if (tabId === 'teoria') {
        fetch('/api/teoria/lista')
            .then(res => res.json())
            .then(lista => {
                const container = document.getElementById('teoria-lista');
                container.innerHTML = '';
                lista.forEach(item => {
                    const btn = document.createElement('button');
                    btn.innerText = item[1];
                    btn.style.marginRight = '0.5rem';
                    btn.onclick = () => loadTeoria(item[0]);
                    container.appendChild(btn);
                });
            });
    }
}

function updateFormulario(clave) {
    fetch(`/api/distribucion/formulario/${clave}`)
        .then(res => res.json())
        .then(params => {
            const formContainer = document.getElementById('formulario-container');
            formContainer.innerHTML = '';
            params.forEach(p => {
                const div = document.createElement('div');
                div.className = 'form-group';
                div.innerHTML = `
                    <label>${p.descripcion}</label>
                    <input type="number" class="param-input" data-param="${p.nombre}" 
                           value="${p.default !== null ? p.default : ''}"
                           step="${p.tipo === 'entero' ? '1' : 'any'}">
                `;
                formContainer.appendChild(div);
            });
        });
}

function loadTeoria(clave) {
    fetch(`/api/teoria/leer/${clave}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('teoria-contenido').innerHTML = data.contenido;
            renderMathInElement(document.getElementById('teoria-contenido'));
        });
}

function exportar(formato) {
    const data = {
        tab: currentTab,
        formato: formato,
        estado: getCurrentState()
    };
    const res = fetch('/api/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.blob())
      .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ampu_resultado.${formato}`;
          a.click();
      });
}

function getCurrentState() {
    return { tab: currentTab };
}
