const colorBorde = "#4d4383", colorFondo = "#79b0cc", colorHover = "#b64f80"; 
const coloresPartidos = { 'PAN': '#0055A6', 'PRI': '#009639', 'PRD': '#FFD100', 'PVEM': '#5CB85C', 'PT': '#E20613', 'MC': '#F37021', 'MORENA': '#B3282D', 'NAEM': '#14B5B4' };

var capasSecciones = {}, capaGlobalNaucalpan = null, capaResaltadaActual = null; 
let chartInstancia = null; let chartGlobalInstancia = null; 
let datosGlobales = null; let totalesGlobales = null; 
let pestanaActual = 'ayuntamiento'; let pestanaGlobalActual = 'ayuntamiento';

// COORDENADAS DE NAUCALPAN Y DIV mapa-naucalpan
var map = L.map('mapa-naucalpan', { 
    zoomControl: true, preferCanvas: true, maxBoundsViscosity: 1.0 
}).setView([19.4750, -99.2372], 13);

// OPENSTREETMAP BASE
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

function crearGradienteInstitucional(ctx) {
    const gradiente = ctx.createLinearGradient(0, 0, 0, 200);
    gradiente.addColorStop(0, '#56858d'); gradiente.addColorStop(0.33, '#79b0cc'); gradiente.addColorStop(0.66, '#6767a5'); gradiente.addColorStop(1, '#4d4383');    
    return gradiente;
}

// NUEVO ARCHIVO GEOJSON DE NAUCALPAN
fetch('/static/data/secciones_naucalpan.geojson')
    .then(res => res.json())
    .then(data => {
        capaGlobalNaucalpan = L.geoJSON(data, {
            style: { color: '#2a244d', weight: 2, fillColor: colorFondo, fillOpacity: 0.45 },
            onEachFeature: function (feature, layer) {
                var numSeccion = feature.properties.SECCION || feature.properties.seccion || feature.properties.Seccion; 
                if (numSeccion) { 
                    capasSecciones[numSeccion] = layer; 
                    layer.bindTooltip(numSeccion.toString(), { permanent: true, direction: 'center', className: 'label-seccion', interactive: false });
                }
                layer.on('mouseover', function () { if (capaResaltadaActual !== layer) this.setStyle({ fillColor: colorHover, fillOpacity: 0.7 }); });
                layer.on('mouseout', function () { if (capaResaltadaActual !== layer) capaGlobalNaucalpan.resetStyle(this); });
                layer.on('click', function () { abrirDashboardElectoral(numSeccion, layer); });
            }
        }).addTo(map);

        var limites = capaGlobalNaucalpan.getBounds();
        map.fitBounds(limites);
        setTimeout(() => { map.setZoom(13); map.setMinZoom(12); map.setMaxBounds(limites.pad(0.3)); }, 100);
    });

function abrirDashboardElectoral(seccion, capa) {
    if (capaResaltadaActual && capaGlobalNaucalpan) capaGlobalNaucalpan.resetStyle(capaResaltadaActual);
    capa.setStyle({ fillColor: colorHover, fillOpacity: 0.9, color: '#222', weight: 3 });
    capaResaltadaActual = capa;

    document.getElementById('panel-totales-municipio').classList.add('oculto');
    document.getElementById('mapa-wrapper').classList.add('modo-cuadrante');
    document.getElementById('btn-restaurar-mapa').style.display = 'block';
    document.getElementById('ui-seccion-id').innerText = seccion;

    setTimeout(() => { map.invalidateSize(); map.flyToBounds(capa.getBounds(), { maxZoom: 18, duration: 1.2, padding: [5, 5] }); }, 500);

    fetch(`/api/seccion/${seccion}/`).then(res => res.json()).then(data => { datosGlobales = data; cambiarPestana('ayuntamiento'); });
}

window.cambiarPestana = function(tipo) {
    pestanaActual = tipo;
    document.getElementById('tab-ayuntamiento').className = 'tab-btn' + (tipo === 'ayuntamiento' ? ' activo-gradiente' : '');
    document.getElementById('tab-diputacion').className = 'tab-btn' + (tipo === 'diputacion' ? ' activo' : '');
    renderizarPestana();
};

function renderizarPestana() {
    if (!datosGlobales) return; const datos = datosGlobales[pestanaActual]; if (!datos) return;
    const contenedor = document.getElementById('local-dynamic-content');
    contenedor.classList.remove('fade-efecto'); void contenedor.offsetWidth; contenedor.classList.add('fade-efecto');

    document.getElementById('stat-casillas').innerText = datos.casillas.toLocaleString();
    document.getElementById('stat-nominal').innerText = datos.lista_nominal.toLocaleString();
    document.getElementById('stat-votos').innerText = datos.num_votos_validos.toLocaleString();
    document.getElementById('stat-participacion').innerText = datos.participacion + '%';
    
    const elGanador = document.getElementById('stat-ganador');
    elGanador.className = 'ganador-highlight'; 
    if (datos.ganador === 'PAN') { elGanador.innerHTML = `<span class="texto-gradiente">🏆 Ganador: PAN</span>`; } 
    else { const colorTxt = (pestanaActual === 'ayuntamiento') ? '#4d4383' : '#79b0cc'; elGanador.innerHTML = `<span style="color: ${colorTxt};">🏆 Ganador: ${datos.ganador}</span>`; }

    if (chartInstancia) chartInstancia.destroy();
    const ctx = document.getElementById('grafica-principal').getContext('2d');
    const gradientePAN = crearGradienteInstitucional(ctx);
    const partidos = ['PAN', 'PRI', 'PRD', 'PVEM', 'PT', 'MC', 'MORENA', 'NAEM'];
    const votos = [datos.pan, datos.pri, datos.prd, datos.pvem, datos.pt, datos.mc, datos.morena, datos.naem];
    
    chartInstancia = new Chart(ctx, {
        type: 'bar', data: { labels: partidos, datasets: [{ data: votos, backgroundColor: partidos.map(p => p === 'PAN' ? gradientePAN : coloresPartidos[p]), borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#555', font: {size: 10} }, grid: { display: false } }, y: { ticks: { color: '#555' }, grid: { color: '#ddd' } } } }
    });
}

fetch('/api/totales/').then(res => res.json()).then(data => { totalesGlobales = data; cambiarPestanaGlobal('ayuntamiento'); });

window.cambiarPestanaGlobal = function(tipo) {
    pestanaGlobalActual = tipo;
    document.getElementById('tab-global-ayuntamiento').className = 'tab-btn-mini' + (tipo === 'ayuntamiento' ? ' activo' : '');
    document.getElementById('tab-global-diputacion').className = 'tab-btn-mini' + (tipo === 'diputacion' ? ' activo' : '');
    renderizarPestanaGlobal();
};

function renderizarPestanaGlobal() {
    if (!totalesGlobales) return; const datos = totalesGlobales[pestanaGlobalActual]; if (!datos) return;
    const contenedorGlobal = document.getElementById('global-dynamic-content');
    contenedorGlobal.classList.remove('fade-efecto'); void contenedorGlobal.offsetWidth; contenedorGlobal.classList.add('fade-efecto');

    document.getElementById('g-stat-casillas').innerText = datos.casillas.toLocaleString();
    document.getElementById('g-stat-nominal').innerText = datos.lista_nominal.toLocaleString();
    document.getElementById('g-stat-votos').innerText = datos.num_votos_validos.toLocaleString();
    
    const colorPart = (pestanaGlobalActual === 'ayuntamiento') ? '#b64f80' : '#79b0cc';
    const participacionElement = document.getElementById('g-stat-participacion');
    participacionElement.innerText = datos.participacion + '%'; participacionElement.style.color = colorPart;
    
    const elGanadorGlobal = document.getElementById('g-stat-ganador');
    elGanadorGlobal.className = 'ganador-highlight tarjeta-perla global-ganador';
    if (datos.ganador === 'PAN') { elGanadorGlobal.innerHTML = `<span class="texto-gradiente">🏆 Ganador: PAN</span>`; } 
    else { const colorTxtGlobal = (pestanaGlobalActual === 'ayuntamiento') ? '#4d4383' : '#79b0cc'; elGanadorGlobal.innerHTML = `<span style="color: ${colorTxtGlobal};">🏆 Ganador: ${datos.ganador}</span>`; }

    if (chartGlobalInstancia) chartGlobalInstancia.destroy();
    const ctxGlobal = document.getElementById('grafica-global').getContext('2d');
    const gradientePANGlobal = crearGradienteInstitucional(ctxGlobal);
    const partidos = ['PAN', 'PRI', 'PRD', 'PVEM', 'PT', 'MC', 'MORENA', 'NAEM'];
    const votos = [datos.pan, datos.pri, datos.prd, datos.pvem, datos.pt, datos.mc, datos.morena, datos.naem];
    
    chartGlobalInstancia = new Chart(ctxGlobal, {
        type: 'bar', data: { labels: partidos, datasets: [{ data: votos, backgroundColor: partidos.map(p => p === 'PAN' ? gradientePANGlobal : coloresPartidos[p]), borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#555', font: {size: 10} }, grid: { display: false } }, y: { ticks: { color: '#555' }, grid: { color: '#eee' } } } }
    });
}

document.getElementById('btn-buscar').addEventListener('click', () => { const s = document.getElementById('input-buscador').value.trim(); if (capasSecciones[s]) abrirDashboardElectoral(s, capasSecciones[s]); });
document.getElementById('input-buscador').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btn-buscar').click(); });

// --- LÓGICA DE PROMOVIDOS (CUADRANTE INFERIOR IZQUIERDO) ---
let seccionActivaFiltro = null; 

window.cambiarPestanaPromovidos = function(tipo) {
    const btnLista = document.getElementById('tab-promovidos-lista'), btnCargar = document.getElementById('tab-promovidos-cargar'), vistaLista = document.getElementById('vista-promovidos-lista'), vistaCargar = document.getElementById('vista-promovidos-cargar');
    if (tipo === 'lista') { btnLista.style.color = '#4d4383'; btnLista.style.fontWeight = 'bold'; btnLista.style.borderBottom = '2px solid #4d4383'; btnCargar.style.color = '#777'; btnCargar.style.fontWeight = 'normal'; btnCargar.style.borderBottom = 'none'; vistaLista.style.display = 'block'; vistaCargar.style.display = 'none'; } 
    else { btnCargar.style.color = '#4d4383'; btnCargar.style.fontWeight = 'bold'; btnCargar.style.borderBottom = '2px solid #4d4383'; btnLista.style.color = '#777'; btnLista.style.fontWeight = 'normal'; btnLista.style.borderBottom = 'none'; vistaCargar.style.display = 'flex'; vistaLista.style.display = 'none'; }
};

function cargarTablaPromovidos() {
    let url = '/api/promovidos/'; if (seccionActivaFiltro) url += `?seccion=${seccionActivaFiltro}`;
    fetch(url).then(res => res.json()).then(data => {
        const tbodyMini = document.getElementById('tabla-promovidos-body'), tbodyModal = document.getElementById('modal-tabla-body');
        if(tbodyMini && tbodyModal) {
            tbodyMini.innerHTML = ''; tbodyModal.innerHTML = '';
            data.forEach(p => {
                const colorEstatus = p.estatus === 'Confirmado' ? 'green' : (p.estatus === 'Inalcanzable' ? 'red' : '#b64f80');
                tbodyMini.innerHTML += `<tr><td><b>${p.nombre}</b></td><td>${p.seccion || '-'}</td><td style="color: ${colorEstatus}; font-weight:bold;">${p.estatus || '-'}</td></tr>`;
                tbodyModal.innerHTML += `<tr><td><b>${p.nombre}</b></td><td>${p.telefono || '-'}</td><td>${p.direccion || '-'}</td><td>${p.seccion || '-'}</td><td>${p.medio || '-'}</td><td>${p.fecha || '-'}</td><td style="color: ${colorEstatus}; font-weight:bold;">${p.estatus || '-'}</td></tr>`;
            });
        }
    });
}

const funcOriginalAbrirDashboard = abrirDashboardElectoral;
abrirDashboardElectoral = function(seccion, capa) {
    funcOriginalAbrirDashboard(seccion, capa); 
    seccionActivaFiltro = seccion;
    document.getElementById('label-seccion-promovidos').innerText = `(Sección ${seccion})`; document.getElementById('modal-label-seccion').innerText = `(Sección ${seccion})`;
    cargarTablaPromovidos();
};

document.getElementById('btn-restaurar-mapa').addEventListener('click', function() {
    seccionActivaFiltro = null;
    document.getElementById('label-seccion-promovidos').innerText = "Global"; document.getElementById('modal-label-seccion').innerText = "(Todas)";
    cargarTablaPromovidos();
    document.getElementById('mapa-wrapper').classList.remove('modo-cuadrante'); document.getElementById('panel-totales-municipio').classList.remove('oculto'); this.style.display = 'none';
    if (capaResaltadaActual && capaGlobalNaucalpan) { capaGlobalNaucalpan.resetStyle(capaResaltadaActual); capaResaltadaActual = null; }
    setTimeout(() => { map.invalidateSize(); if (capaGlobalNaucalpan) { map.flyToBounds(capaGlobalNaucalpan.getBounds(), { duration: 1.2 }); setTimeout(() => { map.setZoom(13); }, 1200); } }, 500);
});

const modal = document.getElementById('modal-promovidos');
document.getElementById('btn-vista-completa').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
document.addEventListener('DOMContentLoaded', cargarTablaPromovidos);

const dropZone = document.getElementById('drop-zone'), fileInput = document.getElementById('file-input'), uploadStatus = document.getElementById('upload-status');
if(dropZone) {
    dropZone.addEventListener('click', () => fileInput.click()); dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover')); dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) subirArchivo(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) subirArchivo(e.target.files[0]); });
}
function subirArchivo(file) {
    uploadStatus.innerText = "⏳ Procesando..."; uploadStatus.style.color = "#4d4383";
    const formData = new FormData(); formData.append('file', file);
    fetch('/api/cargar-promovidos/', { method: 'POST', body: formData }).then(res => res.json()).then(data => {
        if (data.status === 'ok') { uploadStatus.innerText = `✅ Carga Exitosa`; uploadStatus.style.color = "green"; cargarTablaPromovidos(); setTimeout(() => cambiarPestanaPromovidos('lista'), 2000); } 
        else { uploadStatus.innerText = `❌ Error: ${data.error}`; uploadStatus.style.color = "red"; }
    });
}