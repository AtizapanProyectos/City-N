const colorBorde = "#4d4383", colorFondo = "#79b0cc", colorHover = "#b64f80"; 
const coloresPartidos = { 'PAN': '#0055A6', 'PRI': '#009639', 'PRD': '#FFD100', 'PVEM': '#5CB85C', 'PT': '#E20613', 'MC': '#F37021', 'MORENA': '#B3282D', 'NAEM': '#14B5B4' };
const colorOro = '#C9A227';

let map;
let capasSecciones = {}, capaGlobalNaucalpan = null, capaResaltadaActual = null; 
let chartInstancia = null; let chartGlobalInstancia = null; let chartEncuestas = null;
let chartEscuchaC1 = null, chartEscuchaC2 = null, chartEscuchaComp = null;
let datosGlobales = null; let totalesGlobales = null; 
let pestanaActual = 'ayuntamiento'; let pestanaGlobalActual = 'ayuntamiento';
let modoProyeccion = false; let modoProyeccionGlobal = false;
let seccionActivaFiltro = null; 
let ganadoresHistoricosMap = {};
let ganadoresProyectadosMap = {};
let historialEncuestasCache = [];

let factorSentimientoGlobal = 0.6; 
let datosEscuchaProcesados = [];

let isGeoJsonLoaded = false;
let isTotalesLoaded = false;
let filtroIntensidadActivo = null;

function dibujarPill(ctx, xCentro, yCentro, texto, colorTexto, colorFondoPill) {
    ctx.save();
    ctx.font = "700 10px Montserrat, sans-serif";
    const anchoTexto = ctx.measureText(texto).width;
    const paddingX = 8, alto = 17, r = 8;
    const ancho = anchoTexto + paddingX * 2;
    const x0 = xCentro - ancho / 2, y0 = yCentro - alto / 2;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x0, y0, ancho, alto, r); } 
    else { ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + ancho, y0, x0 + ancho, y0 + alto, r); ctx.arcTo(x0 + ancho, y0 + alto, x0, y0 + alto, r); ctx.arcTo(x0, y0 + alto, x0, y0, r); ctx.arcTo(x0, y0, x0 + ancho, y0, r); ctx.closePath(); }
    ctx.fillStyle = colorFondoPill; ctx.fill(); ctx.strokeStyle = colorTexto; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = colorTexto; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, xCentro, yCentro + 0.5);
    ctx.restore();
}

const pluginLineaMeta = {
    id: 'lineaMeta',
    afterDatasetsDraw(chart) {
        const cfg = chart.config.options.plugins.lineaMeta;
        if (!cfg || !cfg.display || typeof cfg.value !== 'number') return;
        const { ctx, chartArea, scales } = chart;
        const isVertical = chart.config.options.indexAxis === 'x';
        
        ctx.save(); 
        ctx.setLineDash([5, 4]); 
        ctx.strokeStyle = cfg.color || colorOro; 
        ctx.lineWidth = 2;
        ctx.beginPath(); 

        let xPill, yPill;
        const texto = cfg.label || 'Meta';
        ctx.font = "700 10.5px Montserrat, sans-serif";
        const medida = ctx.measureText(texto).width + 16;

        if (isVertical) {
            const yAxis = scales.y;
            if (!yAxis) { ctx.restore(); return; }
            const yPixel = yAxis.getPixelForValue(cfg.value);
            ctx.moveTo(chartArea.left, yPixel); 
            ctx.lineTo(chartArea.right, yPixel);
            xPill = chartArea.right - medida / 2 - 4;
            yPill = yPixel - 12;
        } else {
            const xAxis = scales.x;
            if (!xAxis) { ctx.restore(); return; }
            const xPixel = xAxis.getPixelForValue(cfg.value);
            ctx.moveTo(xPixel, chartArea.top); 
            ctx.lineTo(xPixel, chartArea.bottom);
            xPill = Math.min(Math.max(xPixel, chartArea.left + medida / 2), chartArea.right - medida / 2);
            yPill = chartArea.top - 14;
        }
        
        ctx.stroke(); 
        dibujarPill(ctx, xPill, yPill, texto, cfg.color || colorOro, 'rgba(201,162,39,0.15)');
        ctx.restore();
    }
};
Chart.register(pluginLineaMeta);

const pluginValoresBarra = {
    id: 'valoresBarra',
    afterDatasetsDraw(chart) {
        const cfg = chart.config.options.plugins.valoresBarra;
        if (!cfg || !cfg.display) return;
        const { ctx } = chart;
        const isVertical = chart.config.options.indexAxis === 'x';
        
        chart.data.datasets.forEach((dataset, di) => {
            const meta = chart.getDatasetMeta(di);
            meta.data.forEach((bar, i) => {
                const valor = dataset.data[i];
                if (valor === undefined || valor === null || valor === 0) return;
                ctx.save();
                ctx.font = "700 10.5px Montserrat, sans-serif";
                ctx.fillStyle = cfg.color || '#1c2b45';
                
                if (isVertical) {
                    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    ctx.fillText(Number(valor).toLocaleString(), bar.x, bar.y - 8);
                } else {
                    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                    ctx.fillText(Number(valor).toLocaleString(), bar.x + 8, bar.y);
                }
                ctx.restore();
            });
        });
    }
};
Chart.register(pluginValoresBarra);

const pluginTextoCentral = {
    id: 'textoCentral',
    afterDraw(chart) {
        const cfg = chart.config.options.plugins.textoCentral;
        if (!cfg || !cfg.display) return;
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const x = (left + right) / 2;
        const y = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (cfg.value) {
            ctx.font = "800 " + (cfg.tamValor || 20) + "px Montserrat, sans-serif";
            ctx.fillStyle = cfg.color || '#0b1e3d';
            ctx.fillText(cfg.value, x, y - (cfg.label ? 10 : 0));
        }
        if (cfg.label) {
            ctx.font = "700 9px Montserrat, sans-serif";
            ctx.fillStyle = cfg.labelColor || '#5c6b85';
            ctx.fillText(cfg.label, x, y + 11);
        }
        ctx.restore();
    }
};
Chart.register(pluginTextoCentral);

function tooltipInstitucional(sufijo = 'votos') {
    return {
        backgroundColor: '#0b1e3d', titleColor: '#ffffff', titleFont: { weight: '700', size: 12 }, bodyColor: '#eaf3fc', bodyFont: { weight: '600', size: 11.5 }, padding: 10, cornerRadius: 8, displayColors: false,
        callbacks: {
            label: function (ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
                const val = Number(ctx.raw) || 0; 
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return `${val.toLocaleString()} ${sufijo} (${pct}%)`;
            }
        }
    };
}

function ordenarPorVotos(partidos, votos) {
    const combinado = partidos.map((p, i) => ({ partido: p, valor: votos[i] || 0 }));
    combinado.sort((a, b) => b.valor - a.valor);
    return { partidosOrd: combinado.map(c => c.partido), votosOrd: combinado.map(c => c.valor) };
}

function animarContador(el, valorFinal, opciones = {}) {
    if (!el) return;
    const sufijo = opciones.sufijo || '';
    const duracion = opciones.duracion || 900;
    const valorInicial = parseFloat(el.dataset.valorActual || '0');
    const destino = Number(valorFinal) || 0;
    if (valorInicial === destino) { el.innerText = destino.toLocaleString() + sufijo; el.dataset.valorActual = destino; return; }
    const inicioTiempo = performance.now();
    function paso(ahora) {
        const progreso = Math.min((ahora - inicioTiempo) / duracion, 1);
        const facilitado = 1 - Math.pow(1 - progreso, 3);
        const valorActual = valorInicial + (destino - valorInicial) * facilitado;
        el.innerText = Math.round(valorActual).toLocaleString() + sufijo;
        if (progreso < 1) { requestAnimationFrame(paso); }
        else { el.innerText = destino.toLocaleString() + sufijo; el.dataset.valorActual = destino; }
    }
    requestAnimationFrame(paso);
}

function destellar(el) {
    if (!el) return;
    el.classList.remove('destello'); void el.offsetWidth; el.classList.add('destello');
}

function obtenerOpacidad(pct) {
    if (pct < 25) return 0.35;
    if (pct < 50) return 0.55;
    if (pct < 75) return 0.75;
    return 0.95;
}

function inicializarFiltrosLeyenda() {
    const items = document.querySelectorAll('.leyenda-item');
    const btnLimpiar = document.getElementById('btn-limpiar-filtro-mapa');

    items.forEach(item => {
        item.addEventListener('click', function() {
            const opacidadClic = parseFloat(this.getAttribute('data-opacidad'));
            
            if (filtroIntensidadActivo === opacidadClic) {
                filtroIntensidadActivo = null;
                items.forEach(i => i.classList.remove('filtro-activo'));
                if(btnLimpiar) btnLimpiar.style.display = 'none';
            } else {
                filtroIntensidadActivo = opacidadClic;
                items.forEach(i => i.classList.remove('filtro-activo'));
                this.classList.add('filtro-activo');
                if(btnLimpiar) btnLimpiar.style.display = 'block';
            }
            colorearMapaGlobal(); 
        });
    });

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', function(e) {
            e.stopPropagation();
            filtroIntensidadActivo = null;
            items.forEach(i => i.classList.remove('filtro-activo'));
            this.style.display = 'none';
            colorearMapaGlobal();
        });
    }
}

function colorearMapaGlobal() {
    if (!capaGlobalNaucalpan || !isGeoJsonLoaded || !isTotalesLoaded) return;
    
    capaGlobalNaucalpan.eachLayer(function (layer) {
        let sec = layer.seccionID;
        let dataObj = modoProyeccionGlobal ? ganadoresProyectadosMap[sec] : ganadoresHistoricosMap[sec];
        
        let ganador = dataObj ? dataObj.partido : null;
        let porcentaje = dataObj ? dataObj.porcentaje : 0;

        if (ganador && coloresPartidos[ganador] && ganador !== 'N/A') {
            let baseColor = coloresPartidos[ganador];
            let opacidad = obtenerOpacidad(porcentaje);
            
            layer.options.originalFillColor = baseColor;
            layer.options.originalFillOpacity = opacidad;

            if (filtroIntensidadActivo !== null && opacidad !== filtroIntensidadActivo) {
                if (capaResaltadaActual !== layer) {
                    layer.setStyle({ fillColor: '#ffffff', fillOpacity: 0.2, weight: 1, color: '#cbd5e1' });
                }
            } else {
                if (capaResaltadaActual !== layer) {
                    layer.setStyle({ fillColor: baseColor, fillOpacity: opacidad, weight: 1, color: '#2a244d' });
                }
            }
        } else {
            layer.options.originalFillColor = colorFondo;
            layer.options.originalFillOpacity = 0.45;

            if (filtroIntensidadActivo !== null) {
                if (capaResaltadaActual !== layer) {
                    layer.setStyle({ fillColor: '#ffffff', fillOpacity: 0.2, weight: 1, color: '#cbd5e1' });
                }
            } else {
                if (capaResaltadaActual !== layer) {
                    layer.setStyle({ fillColor: colorFondo, fillOpacity: 0.45, weight: 1, color: '#2a244d' });
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    inicializarMapa(); 
    cargarTablaPromovidos(); 
    configurarEventosGlobales();
    inicializarFiltrosLeyenda(); 
    
    fetch('/api/escucha-social/').then(r => r.json()).then(res => {
        if(res.status === 'ok' && res.data && res.data.length === 2) {
            datosEscuchaProcesados = res.data;
            factorSentimientoGlobal = res.factor_global;
            
            document.getElementById('escucha-vacio').style.display = 'none';
            document.getElementById('escucha-contenido').style.display = 'flex';
            renderizarTabsEscucha();
        }
    }).catch(e => console.log("Sin datos previos de escucha social")).finally(() => {
        cargarDatosTotales();
    });
    
    const btnProy = document.getElementById('btn-toggle-proyeccion');
    if (btnProy) {
        btnProy.addEventListener('click', function() {
            modoProyeccion = !modoProyeccion;
            this.innerText = modoProyeccion ? "Ver resultados reales" : "Ver proyección";
            this.style.background = modoProyeccion ? "#b64f80" : "linear-gradient(135deg, #0055A6, #001B44)";
            renderizarPestana();
        });
    }

    const btnProyGlobal = document.getElementById('btn-toggle-proyeccion-global');
    if (btnProyGlobal) {
        btnProyGlobal.addEventListener('click', function() {
            modoProyeccionGlobal = !modoProyeccionGlobal;
            this.innerText = modoProyeccionGlobal ? "Ver resultados reales" : "Ver proyección";
            this.style.background = modoProyeccionGlobal ? "#b64f80" : "linear-gradient(135deg, #0055A6, #001B44)";
            renderizarPestanaGlobal();
            colorearMapaGlobal(); 
        });
    }
});

function mostrarToast(mensaje = "Proceso completado exitosamente") {
    const toast = document.getElementById('toast-notificacion');
    toast.innerText = mensaje; toast.style.display = 'block';
    setTimeout(() => { toast.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => { toast.style.transform = 'translateY(100px)'; setTimeout(() => { toast.style.display = 'none'; }, 400); }, 4000);
}

function dispararRecalculoProyeccion() {
    document.getElementById('loading-overlay').style.display = 'flex';
    Promise.all([
        fetch(`/api/totales/?factor_escucha=${factorSentimientoGlobal}`).then(r => r.json()), 
        seccionActivaFiltro ? fetch(`/api/seccion/${seccionActivaFiltro}/?factor_escucha=${factorSentimientoGlobal}`).then(r => r.json()) : Promise.resolve(null)
    ]).then(([totalesData, seccionData]) => {
        if(totalesData) {
            totalesGlobales = totalesData;
            ganadoresHistoricosMap = totalesData.ganadores_historicos || {};
            ganadoresProyectadosMap = totalesData.ganadores_proyectados || {};
            renderizarPestanaGlobal();
            colorearMapaGlobal();
        }
        if (seccionData) { 
            datosGlobales = seccionData; 
            renderizarPestana(); 
        }
        setTimeout(() => { document.getElementById('loading-overlay').style.display = 'none'; mostrarToast("Proyecciones actualizadas"); }, 900);
    }).catch(err => {
        console.error(err);
        document.getElementById('loading-overlay').style.display = 'none';
    });
}

function crearGradienteInstitucionalVertical(ctx) {
    const gradiente = ctx.createLinearGradient(0, 300, 0, 0);
    gradiente.addColorStop(0, '#001B44'); gradiente.addColorStop(0.4, '#0055A6'); gradiente.addColorStop(1, '#4E9CE0');    
    return gradiente;
}

function crearGradienteInstitucionalHorizontal(ctx) {
    const gradiente = ctx.createLinearGradient(0, 0, 300, 0);
    gradiente.addColorStop(0, '#001B44'); gradiente.addColorStop(0.4, '#0055A6'); gradiente.addColorStop(1, '#4E9CE0');    
    return gradiente;
}

function inicializarMapa() {
    map = L.map('mapa-naucalpan', { zoomControl: true, preferCanvas: true, maxBoundsViscosity: 1.0 }).setView([19.5584, -99.2483], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles &copy; Esri' }).addTo(map);

    map.createPane('paneFondo'); map.getPane('paneFondo').style.zIndex = 400;
    map.createPane('paneSecciones'); map.getPane('paneSecciones').style.zIndex = 410;
    var rendererFondo = L.canvas({ pane: 'paneFondo' }); var rendererSecciones = L.canvas({ pane: 'paneSecciones' });

    fetch('/static/data/contorno_municipio.geojson').then(res => res.json()).then(data => {
        L.geoJSON(data, { renderer: rendererFondo, style: { color: colorBorde, weight: 2, fillColor: colorFondo, fillOpacity: 0.45 }, interactive: false }).addTo(map);
    }).catch(e => console.log("Falta contorno"));

    fetch('/static/data/secciones_naucalpan.geojson').then(res => res.json()).then(data => {
        capaGlobalNaucalpan = L.geoJSON(data, {
            renderer: rendererSecciones, style: { color: '#2a244d', weight: 1, fillColor: colorFondo, fillOpacity: 0 },
            onEachFeature: function (feature, layer) {
                var numSeccion = feature.properties.SECCION || feature.properties.seccion || feature.properties.Seccion; 
                if (numSeccion) { 
                    layer.seccionID = numSeccion; capasSecciones[numSeccion] = layer; 
                    layer.bindTooltip("Sec: " + numSeccion.toString(), { permanent: false, direction: 'auto', className: 'label-seccion', interactive: false, opacity: 0.9 });
                }
                layer.on('mouseover', function () { 
                    if (capaResaltadaActual !== layer) {
                        this.setStyle({ fillColor: colorHover, fillOpacity: 0.7, weight: 2 }); 
                    }
                });
                layer.on('mouseout', function () { 
                    if (capaResaltadaActual !== layer) {
                        let baseColor = this.options.originalFillColor || colorFondo;
                        let opacity = this.options.originalFillOpacity || (baseColor === colorFondo ? 0.45 : 0.55);
                        
                        if (filtroIntensidadActivo !== null && opacity !== filtroIntensidadActivo) {
                            this.setStyle({ fillColor: '#ffffff', fillOpacity: 0.2, weight: 1, color: '#cbd5e1' });
                        } else {
                            this.setStyle({ fillColor: baseColor, fillOpacity: opacity, weight: 1, color: '#2a244d' }); 
                        }
                    }
                });
                layer.on('click', function () { abrirDashboardElectoral(numSeccion, layer); });
            }
        }).addTo(map);
        var limites = capaGlobalNaucalpan.getBounds(); map.fitBounds(limites);
        setTimeout(() => { map.setZoom(13); map.setMinZoom(12); map.setMaxBounds(limites.pad(0.3)); }, 100);
        
        isGeoJsonLoaded = true;
        colorearMapaGlobal(); 
    });

    document.getElementById('btn-buscar').addEventListener('click', () => { const s = document.getElementById('input-buscador').value.trim(); if (capasSecciones[s]) abrirDashboardElectoral(s, capasSecciones[s]); });
    document.getElementById('input-buscador').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btn-buscar').click(); });
    
    document.getElementById('btn-restaurar-mapa').addEventListener('click', function() {
        seccionActivaFiltro = null; 
        document.getElementById('label-seccion-promovidos').innerText = "Global"; 
        cargarTablaPromovidos(); 
        
        document.getElementById('mapa-wrapper').classList.remove('modo-cuadrante'); 
        document.getElementById('dashboard-layout').classList.remove('modo-cuadrante');
        
        document.getElementById('panel-totales-municipio').classList.remove('oculto'); 
        this.style.display = 'none';
        
        if (capaResaltadaActual && capaGlobalNaucalpan) { 
            capaResaltadaActual.unbindTooltip();
            capaResaltadaActual.bindTooltip("Sec: " + capaResaltadaActual.seccionID, { permanent: false, direction: 'auto', className: 'label-seccion', interactive: false, opacity: 0.9 });
            
            let baseColor = capaResaltadaActual.options.originalFillColor || colorFondo;
            let opacity = capaResaltadaActual.options.originalFillOpacity || (baseColor === colorFondo ? 0.45 : 0.55);
            
            if (filtroIntensidadActivo !== null && opacity !== filtroIntensidadActivo) {
                 capaResaltadaActual.setStyle({ fillColor: '#ffffff', fillOpacity: 0.2, weight: 1, color: '#cbd5e1' });
            } else {
                 capaResaltadaActual.setStyle({ fillColor: baseColor, fillOpacity: opacity, weight: 1, color: '#2a244d' }); 
            }
            capaResaltadaActual = null; 
        }
        
        const btnProy = document.getElementById('btn-toggle-proyeccion');
        if(btnProy) btnProy.style.display = 'none';
        setTimeout(() => { map.invalidateSize(); if (capaGlobalNaucalpan) { map.flyToBounds(capaGlobalNaucalpan.getBounds(), { duration: 1.2 }); setTimeout(() => { map.setZoom(13); }, 1200); } }, 500);
    });
}

function abrirDashboardElectoral(seccion, capa) {
    if (capaResaltadaActual && capaGlobalNaucalpan) {
        capaResaltadaActual.unbindTooltip();
        capaResaltadaActual.bindTooltip("Sec: " + capaResaltadaActual.seccionID, { permanent: false, direction: 'auto', className: 'label-seccion', interactive: false, opacity: 0.9 });
        let baseColor = capaResaltadaActual.options.originalFillColor || colorFondo;
        let opacity = capaResaltadaActual.options.originalFillOpacity || (baseColor === colorFondo ? 0.45 : 0.55);
        
        if (filtroIntensidadActivo !== null && opacity !== filtroIntensidadActivo) {
             capaResaltadaActual.setStyle({ fillColor: '#ffffff', fillOpacity: 0.2, weight: 1, color: '#cbd5e1' });
        } else {
             capaResaltadaActual.setStyle({ fillColor: baseColor, fillOpacity: opacity, weight: 1, color: '#2a244d' });
        }
    }
    capa.setStyle({ fillColor: colorHover, fillOpacity: 0.9, color: '#222', weight: 3 });
    capa.unbindTooltip(); capa.bindTooltip("Sec: " + seccion, { permanent: true, direction: 'center', className: 'label-seccion', interactive: false }).openTooltip();
    capaResaltadaActual = capa;

    document.getElementById('panel-totales-municipio').classList.add('oculto'); 
    document.getElementById('mapa-wrapper').classList.add('modo-cuadrante');
    document.getElementById('dashboard-layout').classList.add('modo-cuadrante');

    document.getElementById('btn-restaurar-mapa').style.display = 'block'; 
    document.getElementById('ui-seccion-id').innerText = seccion;

    setTimeout(() => { map.invalidateSize({ animate: true }); map.flyToBounds(capa.getBounds(), { maxZoom: 16, duration: 0.8, padding: [10, 10] }); }, 400);

    fetch(`/api/seccion/${seccion}/?factor_escucha=${factorSentimientoGlobal}`).then(res => res.json()).then(data => { 
        datosGlobales = data; modoProyeccion = false; 
        const btnProy = document.getElementById('btn-toggle-proyeccion');
        if(btnProy) { btnProy.innerText = "Ver proyección"; btnProy.style.background = "linear-gradient(135deg, #0055A6, #001B44)"; }
        seccionActivaFiltro = seccion;
        document.getElementById('label-seccion-promovidos').innerText = `(Sección ${seccion})`;
        cargarTablaPromovidos(); cambiarPestana('ayuntamiento'); 
    }).catch(err => {
        console.error("Error al cargar datos:", err);
        datosGlobales = { error: true };
        cambiarPestana('ayuntamiento');
    });
}

window.cambiarPestana = function(tipo) {
    pestanaActual = tipo;
    document.getElementById('tab-ayuntamiento').className = 'tab-btn' + (tipo === 'ayuntamiento' ? ' activo-gradiente' : '');
    document.getElementById('tab-diputacion').className = 'tab-btn' + (tipo === 'diputacion' ? ' activo' : '');
    renderizarPestana();
};

function renderizarPestana() {
    if (!datosGlobales) return; 
    
    const btnProy = document.getElementById('btn-toggle-proyeccion');
    const contenedorMeta = document.getElementById('stat-meta-container');
    const metaValor = document.getElementById('stat-meta');

    if (datosGlobales.error || !datosGlobales[pestanaActual]) {
        if (btnProy) btnProy.style.display = 'none';
        if (contenedorMeta) contenedorMeta.style.display = 'none';
        
        document.getElementById('stat-casillas').innerText = "0";
        document.getElementById('stat-nominal').innerText = "0";
        document.getElementById('stat-votos').innerText = "0";
        document.getElementById('stat-participacion').innerText = "0%";
        const barraLocal = document.getElementById('barra-participacion-local');
        if (barraLocal) barraLocal.style.width = '0%';
        
        const elGanador = document.getElementById('stat-ganador');
        if (elGanador) elGanador.innerHTML = `<span style="color: #5c6b85;">Sin datos en la base de datos</span>`;
        
        if (chartInstancia) { chartInstancia.destroy(); chartInstancia = null; }
        return;
    }

    const datos = datosGlobales[pestanaActual]; 
    
    if (!datos.proyeccion || datos.num_votos_validos === 0) {
        if (btnProy) btnProy.style.display = 'none';
        contenedorMeta.style.display = 'none';
        if (modoProyeccion) { modoProyeccion = false; if(btnProy) { btnProy.innerText = "Ver proyección"; btnProy.style.background = "linear-gradient(135deg, #0055A6, #001B44)"; } }
    } else { 
        if (btnProy) btnProy.style.display = 'inline-block'; 
        if (modoProyeccion && datos.proyeccion.meta_ganar > 0) {
            contenedorMeta.style.display = 'block';
            metaValor.innerText = datos.proyeccion.meta_ganar.toLocaleString();
        } else { contenedorMeta.style.display = 'none'; }
    }

    const fuenteDatos = modoProyeccion ? datos.proyeccion : datos;
    if (!fuenteDatos) return;

    const contenedor = document.getElementById('local-dynamic-content');
    contenedor.classList.remove('fade-efecto'); void contenedor.offsetWidth; contenedor.classList.add('fade-efecto');

    // SE ACTUALIZARON PARA TOMAR FUENTEDATOS EN VEZ DE DATOS (Aplica el 10% cuando es proyección)
    animarContador(document.getElementById('stat-casillas'), fuenteDatos.casillas);
    animarContador(document.getElementById('stat-nominal'), fuenteDatos.lista_nominal);
    animarContador(document.getElementById('stat-votos'), fuenteDatos.num_votos_validos);
    animarContador(document.getElementById('stat-participacion'), parseFloat(fuenteDatos.participacion) || 0, { sufijo: '%' });

    const barraLocal = document.getElementById('barra-participacion-local');
    if (barraLocal) barraLocal.style.width = Math.min(parseFloat(fuenteDatos.participacion) || 0, 100) + '%';
    
    const elGanador = document.getElementById('stat-ganador');
    const prefijo = modoProyeccion ? "Proyectado: " : "Ganador: ";
    if (fuenteDatos.ganador === 'PAN') { elGanador.innerHTML = `<span class="texto-gradiente">🏆 ${prefijo}PAN</span>`; } 
    else { elGanador.innerHTML = `<span style="color: #0b1e3d;">🏆 ${prefijo}${fuenteDatos.ganador}</span>`; }
    destellar(elGanador);

    if (chartInstancia) chartInstancia.destroy();
    const ctx = document.getElementById('grafica-principal').getContext('2d');
    const partidosBase = ['PAN', 'PRI', 'PRD', 'PVEM', 'PT', 'MC', 'MORENA', 'NAEM'];
    const votosBase = [fuenteDatos.pan, fuenteDatos.pri, fuenteDatos.prd, fuenteDatos.pvem, fuenteDatos.pt, fuenteDatos.mc, fuenteDatos.morena, fuenteDatos.naem];
    const { partidosOrd, votosOrd } = ordenarPorVotos(partidosBase, votosBase);
    
    const gradientePAN = crearGradienteInstitucionalVertical(ctx);
    const bgColor = partidosOrd.map(p => p === 'PAN' ? gradientePAN : (coloresPartidos[p] || '#888888'));
    
    const bordeColor = partidosOrd.map(p => p === fuenteDatos.ganador ? colorOro : 'transparent');
    const bordeAncho = partidosOrd.map(p => p === fuenteDatos.ganador ? 3 : 0);

    const hayMeta = modoProyeccion && !!(datos.proyeccion && datos.proyeccion.meta_ganar > 0);
    const metaValorAbsoluto = hayMeta ? datos.proyeccion.meta_ganar : 0;
    
    const maxVoto = votosOrd.length > 0 ? Math.max(...votosOrd.map(Number)) : 0;
    const maxEscalaY = Math.max(maxVoto, metaValorAbsoluto) * 1.25;

    chartInstancia = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: partidosOrd, 
            datasets: [{ 
                data: votosOrd, backgroundColor: bgColor, 
                borderColor: bordeColor, borderWidth: bordeAncho, 
                borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.8, minBarLength: 6 
            }] 
        }, 
        options: { 
            indexAxis: 'x',
            responsive: true, maintainAspectRatio: false, 
            layout: { padding: { top: hayMeta ? 38 : 22, bottom: 4 } }, 
            plugins: { 
                legend: { display: false }, 
                tooltip: tooltipInstitucional(),
                valoresBarra: { display: true, color: '#1c2b45' },
                lineaMeta: { display: hayMeta, value: metaValorAbsoluto, label: 'Meta 50%+1', color: colorOro }
            }, 
            scales: { 
                y: { display: false, grid: { display: false }, beginAtZero: true, suggestedMax: maxEscalaY }, 
                x: { display: true, ticks: { color: '#1c2b45', font: {size: 11, weight: '700'} }, grid: { display: false } } 
            }, 
            animation: { duration: 800, easing: 'easeOutQuart' } 
        } 
    });

    requestAnimationFrame(() => { if (chartInstancia) chartInstancia.resize(); });
}

function cargarDatosTotales() { 
    fetch(`/api/totales/?factor_escucha=${factorSentimientoGlobal}`)
    .then(res => res.json())
    .then(data => { 
        if(data && !data.error) {
            totalesGlobales = data; 
            if(data.ganadores_historicos) {
                ganadoresHistoricosMap = data.ganadores_historicos;
                ganadoresProyectadosMap = data.ganadores_proyectados || {};
                isTotalesLoaded = true;
                colorearMapaGlobal(); 
            }
            cambiarPestanaGlobal('ayuntamiento'); 
        }
    }); 
}

window.cambiarPestanaGlobal = function(tipo) {
    pestanaGlobalActual = tipo;
    document.getElementById('tab-global-ayuntamiento').className = 'tab-btn-mini' + (tipo === 'ayuntamiento' ? ' activo' : '');
    document.getElementById('tab-global-diputacion').className = 'tab-btn-mini' + (tipo === 'diputacion' ? ' activo' : '');
    renderizarPestanaGlobal();
};

function renderizarPestanaGlobal() {
    if (!totalesGlobales) return; 
    const datos = totalesGlobales[pestanaGlobalActual]; 
    if (!datos) return;
    
    const btnProyG = document.getElementById('btn-toggle-proyeccion-global');
    const contenedorMetaG = document.getElementById('g-stat-meta-container');
    const metaValorG = document.getElementById('g-stat-meta');

    if (!datos.proyeccion || datos.num_votos_validos === 0) {
        if (btnProyG) btnProyG.style.display = 'none';
        contenedorMetaG.style.display = 'none';
        if (modoProyeccionGlobal) { modoProyeccionGlobal = false; if(btnProyG) { btnProyG.innerText = "Ver proyección"; btnProyG.style.background = "linear-gradient(135deg, #0055A6, #001B44)"; } }
    } else { 
        if (btnProyG) btnProyG.style.display = 'inline-block'; 
        if (modoProyeccionGlobal && datos.proyeccion.meta_ganar > 0) {
            contenedorMetaG.style.display = 'block';
            metaValorG.innerText = datos.proyeccion.meta_ganar.toLocaleString();
        } else { contenedorMetaG.style.display = 'none'; }
    }

    const fuenteDatos = modoProyeccionGlobal ? datos.proyeccion : datos;
    if (!fuenteDatos) return;

    const contenedorGlobal = document.getElementById('global-dynamic-content');
    contenedorGlobal.classList.remove('fade-efecto'); void contenedorGlobal.offsetWidth; contenedorGlobal.classList.add('fade-efecto');

    // SE ACTUALIZARON PARA TOMAR FUENTEDATOS EN VEZ DE DATOS
    animarContador(document.getElementById('g-stat-casillas'), fuenteDatos.casillas);
    animarContador(document.getElementById('g-stat-nominal'), fuenteDatos.lista_nominal);
    animarContador(document.getElementById('g-stat-votos'), fuenteDatos.num_votos_validos);
    animarContador(document.getElementById('g-stat-participacion'), parseFloat(fuenteDatos.participacion) || 0, { sufijo: '%' });

    const barraGlobal = document.getElementById('barra-participacion-global');
    if (barraGlobal) barraGlobal.style.width = Math.min(parseFloat(fuenteDatos.participacion) || 0, 100) + '%';
    
    const elGanadorGlobal = document.getElementById('g-stat-ganador');
    const prefijoG = modoProyeccionGlobal ? "Proyectado: " : "Ganador: ";
    if (fuenteDatos.ganador === 'PAN') { elGanadorGlobal.innerHTML = `<span class="texto-gradiente">🏆 ${prefijoG}PAN</span>`; } 
    else { elGanadorGlobal.innerHTML = `<span style="color: #0b1e3d;">🏆 ${prefijoG}${fuenteDatos.ganador}</span>`; }
    destellar(elGanadorGlobal);

    if (chartGlobalInstancia) chartGlobalInstancia.destroy();
    const ctxGlobal = document.getElementById('grafica-global').getContext('2d');
    
    const partidosBase = ['PAN', 'PRI', 'PRD', 'PVEM', 'PT', 'MC', 'MORENA', 'NAEM'];
    const votosBase = [fuenteDatos.pan, fuenteDatos.pri, fuenteDatos.prd, fuenteDatos.pvem, fuenteDatos.pt, fuenteDatos.mc, fuenteDatos.morena, fuenteDatos.naem];
    const { partidosOrd, votosOrd } = ordenarPorVotos(partidosBase, votosBase);
    
    const gradientePANGlobal = crearGradienteInstitucionalHorizontal(ctxGlobal);

    const bordeColorG = partidosOrd.map(p => p === fuenteDatos.ganador ? colorOro : 'transparent');
    const bordeAnchoG = partidosOrd.map(p => p === fuenteDatos.ganador ? 3 : 0);
    const hayMetaG = modoProyeccionGlobal && !!(datos.proyeccion && datos.proyeccion.meta_ganar > 0);
    const metaValorAbsolutoG = hayMetaG ? datos.proyeccion.meta_ganar : 0;
    
    const maxVotoG = votosOrd.length > 0 ? Math.max(...votosOrd.map(Number)) : 0;
    const maxEscalaX = Math.max(maxVotoG, metaValorAbsolutoG) * 1.15;

    chartGlobalInstancia = new Chart(ctxGlobal, { 
        type: 'bar', 
        data: { 
            labels: partidosOrd, 
            datasets: [{ 
                data: votosOrd, backgroundColor: partidosOrd.map(p => p === 'PAN' ? gradientePANGlobal : coloresPartidos[p]), 
                borderColor: bordeColorG, borderWidth: bordeAnchoG, 
                borderRadius: 6, borderSkipped: false, barPercentage: 0.72, categoryPercentage: 0.82, minBarLength: 6 
            }] 
        }, 
        options: { 
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false, 
            layout: { padding: { right: 56, top: 30, bottom: 4 } }, 
            plugins: { 
                legend: { display: false }, 
                tooltip: tooltipInstitucional(),
                valoresBarra: { display: true, color: '#ffffff' },
                lineaMeta: { display: hayMetaG, value: metaValorAbsolutoG, label: 'Meta 50%+1', color: colorOro }
            }, 
            scales: { 
                x: { display: false, grid: { display: false }, beginAtZero: true, suggestedMax: maxEscalaX }, 
                y: { display: true, ticks: { color: '#ffffff', font: {size: 10.5, weight: '700'} }, grid: { display: false } }
            }, 
            animation: { duration: 800, easing: 'easeOutQuart' } 
        } 
    });

    requestAnimationFrame(() => { if (chartGlobalInstancia) chartGlobalInstancia.resize(); });
}

function cargarTablaPromovidos() {
    let url = '/api/promovidos/'; if (seccionActivaFiltro) url += `?seccion=${seccionActivaFiltro}`;
    fetch(url).then(res => res.json()).then(data => {
        const tbodyMini = document.getElementById('tabla-promovidos-body'), tbodyModal = document.getElementById('modal-tabla-body');
        if(tbodyMini && tbodyModal) {
            tbodyMini.innerHTML = ''; tbodyModal.innerHTML = '';
            data.forEach(p => {
                const colorEstatus = p.estatus === 'Confirmado' ? '#10b981' : (p.estatus === 'Inalcanzable' ? '#ef4444' : '#b64f80');
                tbodyMini.innerHTML += `<tr><td><b>${p.nombre}</b></td><td>${p.seccion || '-'}</td><td style="color: ${colorEstatus}; font-weight:bold;">${p.estatus || '-'}</td></tr>`;
                tbodyModal.innerHTML += `<tr><td><b>${p.nombre}</b></td><td>${p.telefono || '-'}</td><td>${p.direccion || '-'}</td><td>${p.seccion || '-'}</td><td>${p.medio || '-'}</td><td>${p.fecha || '-'}</td><td style="color: ${colorEstatus}; font-weight:bold;">${p.estatus || '-'}</td></tr>`;
            });
        }
    });
}

function configurarEventosGlobales() {
    const modal = document.getElementById('modal-promovidos');
    document.getElementById('btn-vista-completa').addEventListener('click', () => modal.classList.add('active'));
    document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('active'));
    
    const inputGlobalProm = document.getElementById('file-promovidos-global');
    if(inputGlobalProm) {
        inputGlobalProm.addEventListener('change', (e) => { 
            if (e.target.files.length) subirArchivoPromovidos(e.target.files[0]); 
        });
    }

    const btnReiniciar = document.getElementById('btn-reiniciar-encuestas');
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarEncuestas);
    }
}

function subirArchivoPromovidos(file) {
    document.getElementById('loading-overlay').style.display = 'flex';
    const formData = new FormData(); formData.append('file', file);
    fetch('/api/cargar-promovidos/', { method: 'POST', body: formData }).then(res => res.json()).then(data => {
        if (data.status === 'ok') { 
            cargarTablaPromovidos(); 
            dispararRecalculoProyeccion();
            mostrarToast("Padrón cargado correctamente");
        } else { 
            document.getElementById('loading-overlay').style.display = 'none';
            alert(`Error: ${data.error}`); 
        }
    }).catch(err => {
        document.getElementById('loading-overlay').style.display = 'none';
        console.error(err);
    });
}

window.procesarArchivosEscucha = function(e) {
    if (e.target.files.length !== 2) {
        alert("Por favor selecciona exactamente 2 archivos de reporte Excel para comparar.");
        e.target.value = ''; 
        return;
    }
    document.getElementById('loading-overlay').style.display = 'flex';
    
    let formData = new FormData();
    formData.append('files', e.target.files[0]);
    formData.append('files', e.target.files[1]);
    
    fetch('/api/procesar-escucha/', { method: 'POST', body: formData }).then(r => r.json()).then(res => {
        if(res.status === 'ok') {
            datosEscuchaProcesados = res.data;
            factorSentimientoGlobal = res.factor_global; 
            
            document.getElementById('escucha-vacio').style.display = 'none';
            document.getElementById('escucha-contenido').style.display = 'flex';
            
            renderizarTabsEscucha();
            dispararRecalculoProyeccion();
        } else {
            document.getElementById('loading-overlay').style.display = 'none';
            alert("Error al procesar: " + res.error);
        }
        e.target.value = ''; 
    }).catch(err => {
        document.getElementById('loading-overlay').style.display = 'none';
        console.error(err);
    });
};

function renderizarTabsEscucha() {
    if (!datosEscuchaProcesados || datosEscuchaProcesados.length < 2) return;
    const metricas = Object.keys(datosEscuchaProcesados[0].metricas);
    const container = document.getElementById('escucha-tabs');
    container.innerHTML = '';
    
    const metricasParaTabs = metricas.filter(m => m !== 'Número de positivos' && m !== 'Número de negativos');
    
    const btnSentimiento = document.createElement('button');
    btnSentimiento.className = 'tab-metrica activo';
    btnSentimiento.id = 'tab-Sentimiento';
    btnSentimiento.innerText = 'Sentimiento (Pos/Neg)';
    btnSentimiento.onclick = () => seleccionarMetricaEscucha('Sentimiento');
    container.appendChild(btnSentimiento);

    metricasParaTabs.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'tab-metrica';
        btn.id = 'tab-' + m.replace(/\s+/g, '');
        btn.innerText = m;
        btn.onclick = () => seleccionarMetricaEscucha(m);
        container.appendChild(btn);
    });
    
    seleccionarMetricaEscucha('Sentimiento');
}

window.seleccionarMetricaEscucha = function(metricaSeleccionada) {
    document.querySelectorAll('.tab-metrica').forEach(b => b.classList.remove('activo'));
    document.getElementById('tab-' + metricaSeleccionada.replace(/\s+/g, '')).classList.add('activo');
    
    const vistaDual = document.getElementById('escucha-vista-dual');
    const vistaComp = document.getElementById('escucha-vista-comparativa');

    if (metricaSeleccionada === 'Sentimiento') {
        vistaDual.style.display = 'flex';
        vistaComp.style.display = 'none';
        renderizarVistaDual();
    } else {
        vistaDual.style.display = 'none';
        vistaComp.style.display = 'flex';
        renderizarVistaComparativa(metricaSeleccionada);
    }
}

function renderizarVistaDual() {
    const c1 = datosEscuchaProcesados[0];
    const c2 = datosEscuchaProcesados[1];

    const pos1 = c1.metricas['Número de positivos'] || 0;
    const neg1 = c1.metricas['Número de negativos'] || 0;
    const total1 = c1.total_menciones || 1; 
    const neu1 = Math.max(0, total1 - pos1 - neg1);

    const pos2 = c2.metricas['Número de positivos'] || 0;
    const neg2 = c2.metricas['Número de negativos'] || 0;
    const total2 = c2.total_menciones || 1; 
    const neu2 = Math.max(0, total2 - pos2 - neg2); 

    const pctPos1 = ((pos1/total1)*100).toFixed(1);
    const pctNeg1 = ((neg1/total1)*100).toFixed(1);
    const pctPos2 = ((pos2/total2)*100).toFixed(1);
    const pctNeg2 = ((neg2/total2)*100).toFixed(1);

    document.getElementById('ui-cand1-name-dual').innerText = c1.candidato;
    document.getElementById('ui-cand1-pos').innerText = `Positivos: ${pos1} (${pctPos1}%)`;
    document.getElementById('ui-cand1-neg').innerText = `Negativos: ${neg1} (${pctNeg1}%)`;
    document.getElementById('ui-cand2-name-dual').innerText = c2.candidato;
    document.getElementById('ui-cand2-pos').innerText = `Positivos: ${pos2} (${pctPos2}%)`;
    document.getElementById('ui-cand2-neg').innerText = `Negativos: ${neg2} (${pctNeg2}%)`;

    const dom1Positivo = pos1 >= neg1;
    const dom2Positivo = pos2 >= neg2;

    const tooltipFlotante = (context) => {
        let tooltipEl = document.getElementById('tooltip-externo-dona');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'tooltip-externo-dona';
            tooltipEl.style.background = '#0b1e3d';
            tooltipEl.style.borderRadius = '8px';
            tooltipEl.style.color = '#fff';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.position = 'absolute';
            tooltipEl.style.transform = 'translate(-50%, -100%)';
            tooltipEl.style.zIndex = '99999';
            tooltipEl.style.padding = '8px 12px';
            tooltipEl.style.fontFamily = 'Montserrat, sans-serif';
            tooltipEl.style.fontSize = '11.5px';
            tooltipEl.style.fontWeight = '700';
            tooltipEl.style.boxShadow = '0 8px 24px rgba(0,16,45,0.3)';
            tooltipEl.style.transition = 'opacity 0.2s ease, left 0.1s ease, top 0.1s ease';
            
            let caret = document.createElement('div');
            caret.style.position = 'absolute';
            caret.style.bottom = '-5px';
            caret.style.left = '50%';
            caret.style.transform = 'translateX(-50%)';
            caret.style.borderWidth = '5px 5px 0';
            caret.style.borderStyle = 'solid';
            caret.style.borderColor = '#0b1e3d transparent transparent transparent';
            tooltipEl.appendChild(caret);
            
            let textNode = document.createElement('span');
            textNode.id = 'tooltip-texto-interior';
            tooltipEl.appendChild(textNode);
            
            document.body.appendChild(tooltipEl);
        }

        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        if (tooltipModel.body) {
            const texto = tooltipModel.body[0].lines[0];
            document.getElementById('tooltip-texto-interior').innerText = texto;
        }

        const position = context.chart.canvas.getBoundingClientRect();
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX + 'px';
        tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - 10 + 'px';
    };

    const opcionesDona = (pctDominante, esPositivo) => ({
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 15, bottom: 15 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false, 
                external: tooltipFlotante, 
                callbacks: { 
                    title: () => null, 
                    label: (ctx) => {
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0';
                        return `${ctx.label}: ${ctx.raw.toLocaleString()} menciones (${pct}%)`;
                    }
                }
            },
            textoCentral: {
                display: true, value: pctDominante + '%',
                label: esPositivo ? 'POSITIVO' : 'NEGATIVO',
                color: esPositivo ? '#10b981' : '#ef4444',
                labelColor: esPositivo ? '#10b981' : '#ef4444',
                tamValor: 19
            }
        },
        cutout: '74%',
        animation: { animateScale: true, animateRotate: true, duration: 1100, easing: 'easeOutBack' }
    });

    if (chartEscuchaC1) chartEscuchaC1.destroy();
    const ctx1 = document.getElementById('chart-escucha-c1').getContext('2d');
    chartEscuchaC1 = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Positivos', 'Negativos', 'Neutras'], 
            datasets: [{ 
                data: [pos1, neg1, neu1], 
                backgroundColor: ['#10b981', '#ef4444', '#e6ebf3'], 
                hoverBackgroundColor: ['#10b981', '#ef4444', '#e6ebf3'], 
                borderWidth: 3, 
                borderColor: '#ffffff', 
                hoverBorderColor: '#ffffff', 
                hoverOffset: 6 
            }]
        }, options: opcionesDona(dom1Positivo ? pctPos1 : pctNeg1, dom1Positivo)
    });

    if (chartEscuchaC2) chartEscuchaC2.destroy();
    const ctx2 = document.getElementById('chart-escucha-c2').getContext('2d');
    chartEscuchaC2 = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Positivos', 'Negativos', 'Neutras'], 
            datasets: [{ 
                data: [pos2, neg2, neu2], 
                backgroundColor: ['#10b981', '#ef4444', '#e6ebf3'], 
                hoverBackgroundColor: ['#10b981', '#ef4444', '#e6ebf3'], 
                borderWidth: 3, 
                borderColor: '#ffffff', 
                hoverBorderColor: '#ffffff', 
                hoverOffset: 6 
            }]
        }, options: opcionesDona(dom2Positivo ? pctPos2 : pctNeg2, dom2Positivo)
    });
}

function renderizarVistaComparativa(metrica) {
    const c1 = datosEscuchaProcesados[0];
    const c2 = datosEscuchaProcesados[1];
    
    const v1 = c1.metricas[metrica] || 0;
    const v2 = c2.metricas[metrica] || 0;
    const total = v1 + v2;

    const p1 = total > 0 ? ((v1 / total) * 100).toFixed(1) : '0.0';
    const p2 = total > 0 ? ((v2 / total) * 100).toFixed(1) : '0.0';
    
    document.getElementById('ui-cand1-name-comp').innerText = c1.candidato;
    animarContador(document.getElementById('ui-cand1-val'), v1);
    document.getElementById('ui-cand1-pct').innerText = `(${p1}%)`;
    
    document.getElementById('ui-cand2-name-comp').innerText = c2.candidato;
    animarContador(document.getElementById('ui-cand2-val'), v2);
    document.getElementById('ui-cand2-pct').innerText = `(${p2}%)`;
    
    if (chartEscuchaComp) chartEscuchaComp.destroy();
    const ctx = document.getElementById('chart-escucha-comp').getContext('2d');
    
    const grad1 = ctx.createLinearGradient(0, 0, 300, 0);
    grad1.addColorStop(0, '#001B44'); grad1.addColorStop(1, '#0055A6');

    const grad2 = ctx.createLinearGradient(0, 0, 300, 0);
    grad2.addColorStop(0, '#8e3d63'); grad2.addColorStop(1, '#b64f80');

    const colorC1 = c1.candidato.includes('RUABOGADO') ? grad1 : grad2;
    const colorC2 = c2.candidato.includes('RUABOGADO') ? grad1 : grad2;

    const dotC1 = document.getElementById('ui-cand1-name-comp').previousElementSibling;
    const dotC2 = document.getElementById('ui-cand2-name-comp').previousElementSibling;
    if (dotC1) dotC1.style.background = c1.candidato.includes('RUABOGADO') ? '#0055A6' : '#b64f80';
    if (dotC2) dotC2.style.background = c2.candidato.includes('RUABOGADO') ? '#0055A6' : '#b64f80';

    const lider = v1 >= v2 ? c1.candidato : c2.candidato;
    const datosOrd = [
        { n: c1.candidato, v: v1, color: colorC1 },
        { n: c2.candidato, v: v2, color: colorC2 }
    ];

    chartEscuchaComp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: datosOrd.map(d => d.n),
            datasets: [{
                data: datosOrd.map(d => d.v),
                backgroundColor: datosOrd.map(d => d.color),
                borderColor: datosOrd.map(d => d.n === lider ? colorOro : 'transparent'),
                borderWidth: datosOrd.map(d => d.n === lider ? 3 : 0),
                borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7, minBarLength: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 56, top: 8, bottom: 8 } },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: '#0b1e3d', titleColor: '#fff', bodyColor: '#eaf3fc', padding: 10, cornerRadius: 8, displayColors: false,
                    callbacks: { label: (ctx) => `${ctx.raw.toLocaleString()} menciones` } 
                },
                valoresBarra: { display: true, color: '#1c2b45' }
            },
            scales: {
                x: { display: false, grid: { display: false }, beginAtZero: true },
                y: { display: true, ticks: { color: '#1c2b45', font: { size: 12, weight: '700' } }, grid: { display: false } }
            },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });
}

window.abrirModalEncuestas = function() { 
    document.getElementById('modal-encuestas').classList.add('active'); 
    cambiarTabEncuestas('promedio'); 
}
window.cerrarModalEncuestas = function() { 
    document.getElementById('modal-encuestas').classList.remove('active'); 
    cancelarEdicion(); 
}

window.cambiarTabEncuestas = function(tipo) {
    const tabs = ['promedio', 'historial', 'agregar'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-modal-${t}`);
        const vista = document.getElementById(`vista-modal-${t}`);
        if(t === tipo) { 
            btn.className = 'tab-btn activo'; btn.style.background = ''; btn.style.color = ''; 
            vista.style.display = (t === 'historial') ? 'flex' : 'block'; 
        } 
        else { btn.className = 'tab-btn'; btn.style.background = 'transparent'; btn.style.color = '#777'; vista.style.display = 'none'; }
    });
    if (tipo === 'promedio') cargarGraficaPromedio();
    if (tipo === 'historial') cargarHistorialEncuestas();
};

function cargarHistorialEncuestas() {
    const tbody = document.getElementById('tabla-historial-body');
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:18px; color:#5c6b85;">Cargando historial…</td></tr>`;

    fetch('/api/historial-encuestas/')
        .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(data => {
            historialEncuestasCache = Array.isArray(data) ? data : [];
            tbody.innerHTML = '';

            const btnReiniciar = document.getElementById('btn-reiniciar-encuestas');
            if (btnReiniciar) btnReiniciar.disabled = historialEncuestasCache.length === 0;

            if (historialEncuestasCache.length === 0) {
                tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:18px; color:#5c6b85;">Aún no hay encuestas registradas. Agrega la primera en "Agregar Nueva".</td></tr>`;
                return;
            }

            historialEncuestasCache.forEach((e, idx) => {
                const fila = document.createElement('tr');
                fila.innerHTML = `
                    <td>${e.fecha}</td><td><b>${e.casa}</b></td>
                    <td style="color:#0055A6; font-weight:bold;">${e.pan}%</td>
                    <td style="color:#009639;">${e.pri}%</td>
                    <td style="color:#FFD100;">${e.prd}%</td>
                    <td style="color:#5CB85C;">${e.pvem}%</td>
                    <td style="color:#E20613;">${e.pt}%</td>
                    <td style="color:#F37021;">${e.mc}%</td>
                    <td style="color:#B3282D; font-weight:bold;">${e.morena}%</td>
                    <td style="color:#14B5B4;">${e.naem}%</td>
                    <td style="color:#a7b4c9;">${e.indecisos}%</td>
                    <td style="text-align:center;">
                        <button class="btn-editar-encuesta" data-idx="${idx}" title="Editar" style="background:none; border:none; cursor:pointer; font-size:13px; color:#4d4383; font-weight:bold;">Editar</button>
                        <button class="btn-eliminar-encuesta" data-id="${e.id}" title="Eliminar" style="background:none; border:none; cursor:pointer; font-size:13px; color:#dc3545; font-weight:bold; margin-left:10px;">Eliminar</button>
                    </td>`;
                tbody.appendChild(fila);
            });

            tbody.querySelectorAll('.btn-editar-encuesta').forEach(btn => {
                btn.addEventListener('click', () => editarEncuesta(historialEncuestasCache[Number(btn.dataset.idx)]));
            });
            tbody.querySelectorAll('.btn-eliminar-encuesta').forEach(btn => {
                btn.addEventListener('click', () => eliminarEncuesta(Number(btn.dataset.id)));
            });
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:18px; color:#dc3545;">No se pudo cargar el historial. Revisa la consola (F12) para más detalle.</td></tr>`;
        });
}

window.eliminarEncuesta = function(id) {
    if(!confirm("¿Desea eliminar esta encuesta? El sistema recalculará las proyecciones.")) return;
    document.getElementById('loading-overlay').style.display = 'flex';
    let formData = new FormData(); formData.append('id', id);
    fetch('/api/eliminar-encuesta/', { method: 'POST', body: formData })
        .then(res => { if(!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(data => { 
            if(data.status === 'ok') { 
                cargarHistorialEncuestas();
                dispararRecalculoProyeccion();
            } else {
                document.getElementById('loading-overlay').style.display = 'none';
                alert('No se pudo eliminar la encuesta: ' + (data.msg || 'error desconocido'));
            }
        })
        .catch(err => {
            document.getElementById('loading-overlay').style.display = 'none';
            console.error(err);
            alert('Error de conexión al eliminar la encuesta.');
        });
}

window.editarEncuesta = function(encuesta) {
    document.getElementById('enc-id').value = encuesta.id; document.getElementById('enc-casa').value = encuesta.casa;
    document.getElementById('enc-pan').value = encuesta.pan; document.getElementById('enc-pri').value = encuesta.pri;
    document.getElementById('enc-prd').value = encuesta.prd; document.getElementById('enc-pvem').value = encuesta.pvem;
    document.getElementById('enc-pt').value = encuesta.pt; document.getElementById('enc-mc').value = encuesta.mc;
    document.getElementById('enc-morena').value = encuesta.morena; document.getElementById('enc-naem').value = encuesta.naem;
    document.getElementById('enc-indecisos').value = encuesta.indecisos;
    document.getElementById('tab-modal-agregar').innerText = 'Editar Registro'; document.getElementById('btn-guardar-encuesta').innerText = 'Actualizar Datos';
    document.getElementById('btn-cancelar-edicion').style.display = 'block';
    document.getElementById('form-encuesta').dispatchEvent(new Event('input')); cambiarTabEncuestas('agregar');
}

window.cancelarEdicion = function() {
    document.getElementById('form-encuesta').reset(); document.getElementById('enc-id').value = '';
    document.getElementById('tab-modal-agregar').innerText = 'Agregar Nueva'; document.getElementById('btn-guardar-encuesta').innerText = 'Procesar Encuesta';
    document.getElementById('btn-cancelar-edicion').style.display = 'none'; document.getElementById('total-encuesta').innerText = 'Total: 0.0%';
}

document.getElementById('form-encuesta').addEventListener('input', function() {
    let ids = ['enc-pan', 'enc-pri', 'enc-prd', 'enc-pvem', 'enc-pt', 'enc-mc', 'enc-morena', 'enc-naem', 'enc-indecisos'];
    let total = 0; ids.forEach(id => total += parseFloat(document.getElementById(id).value || 0));
    let elTotal = document.getElementById('total-encuesta');
    elTotal.innerText = `Total: ${total.toFixed(1)}%`; elTotal.style.color = (Math.abs(total - 100.0) < 0.05) ? 'green' : 'red';
});

window.guardarNuevaEncuesta = function() {
    const btnGuardar = document.getElementById('btn-guardar-encuesta');
    if (btnGuardar) btnGuardar.disabled = true;
    document.getElementById('loading-overlay').style.display = 'flex';

    let formData = new FormData(); const idEdicion = document.getElementById('enc-id').value; if(idEdicion) formData.append('id', idEdicion);
    formData.append('casa_encuestadora', document.getElementById('enc-casa').value);
    formData.append('pan', document.getElementById('enc-pan').value); formData.append('pri', document.getElementById('enc-pri').value);
    formData.append('prd', document.getElementById('enc-prd').value); formData.append('pvem', document.getElementById('enc-pvem').value);
    formData.append('pt', document.getElementById('enc-pt').value); formData.append('mc', document.getElementById('enc-mc').value);
    formData.append('morena', document.getElementById('enc-morena').value); formData.append('naem', document.getElementById('enc-naem').value);
    formData.append('indecisos', document.getElementById('enc-indecisos').value);

    fetch('/api/guardar-encuesta/', { method: 'POST', body: formData })
        .then(res => { if(!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(data => {
            if (btnGuardar) btnGuardar.disabled = false;
            if(data.status === 'ok') { 
                cerrarModalEncuestas(); 
                dispararRecalculoProyeccion(); 
            }
            else { 
                document.getElementById('loading-overlay').style.display = 'none';
                alert('No se pudo guardar la encuesta: ' + (data.msg || 'error desconocido')); 
            }
        })
        .catch(err => {
            if (btnGuardar) btnGuardar.disabled = false;
            document.getElementById('loading-overlay').style.display = 'none';
            console.error(err);
            alert('Error de conexión al guardar la encuesta.');
        });
};

function reiniciarEncuestas() {
    if (!confirm('Esto eliminará TODAS las encuestas registradas y reiniciará el contador a 0. Esta acción no se puede deshacer. ¿Deseas continuar?')) return;
    const confirmacion = prompt('Para confirmar, escribe REINICIAR en mayúsculas:');
    if (confirmacion !== 'REINICIAR') { 
        if (confirmacion !== null) alert('Texto incorrecto. Operación cancelada.'); 
        return; 
    }

    document.getElementById('loading-overlay').style.display = 'flex';
    fetch('/api/reiniciar-encuestas/', { method: 'POST' })
        .then(res => { if(!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(data => {
            if (data.status === 'ok') {
                cargarHistorialEncuestas();
                dispararRecalculoProyeccion();
            } else {
                document.getElementById('loading-overlay').style.display = 'none';
                alert('No se pudo reiniciar el historial: ' + (data.msg || 'error desconocido'));
            }
        })
        .catch(err => {
            document.getElementById('loading-overlay').style.display = 'none';
            console.error(err);
            alert('Error de conexión al reiniciar el historial.');
        });
}

function cargarGraficaPromedio() {
    fetch('/api/promedio-encuestas/').then(res => res.json()).then(data => {
        const partidosBase = ['PAN', 'PRI', 'PRD', 'PVEM', 'PT', 'MC', 'MORENA', 'NAEM', 'Indecisos'];
        const valoresBase = [data.pan, data.pri, data.prd, data.pvem, data.pt, data.mc, data.morena, data.naem, data.indecisos];
        const sumaTotal = valoresBase.reduce((a, b) => a + (Number(b) || 0), 0);

        const canvasWrap = document.querySelector('#vista-modal-promedio .grafica-modal');
        const vacioEl = document.getElementById('promedio-vacio');

        if (sumaTotal === 0) {
            if (chartEncuestas) { chartEncuestas.destroy(); chartEncuestas = null; }
            if (canvasWrap) canvasWrap.style.display = 'none';
            if (vacioEl) vacioEl.style.display = 'flex';
            return;
        }
        if (canvasWrap) canvasWrap.style.display = 'block';
        if (vacioEl) vacioEl.style.display = 'none';

        if(chartEncuestas) chartEncuestas.destroy();
        const ctx = document.getElementById('grafica-encuestas').getContext('2d');
        const { partidosOrd, votosOrd } = ordenarPorVotos(partidosBase, valoresBase);
        const colores = partidosOrd.map(p => { if (p === 'Indecisos') return '#a7b4c9'; if (p === 'PAN') return '#0055A6'; return coloresPartidos[p] ? coloresPartidos[p] : '#888888'; });
        
        const maxVoto = Math.max(...votosOrd.map(Number));
        const bordeColor = partidosOrd.map((p, i) => (votosOrd[i] === maxVoto && maxVoto > 0 && p !== 'Indecisos') ? colorOro : 'transparent');
        const bordeAncho = partidosOrd.map((p, i) => (votosOrd[i] === maxVoto && maxVoto > 0 && p !== 'Indecisos') ? 3 : 0);

        chartEncuestas = new Chart(ctx, { 
            type: 'bar', 
            data: { 
                labels: partidosOrd, 
                datasets: [{ 
                    data: votosOrd, backgroundColor: colores, 
                    borderColor: bordeColor, borderWidth: bordeAncho,
                    borderRadius: 6, barPercentage: 0.72, categoryPercentage: 0.82, minBarLength: 4 
                }] 
            }, 
            options: { 
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false, layout: { padding: { right: 44 } },
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { 
                        backgroundColor: '#0b1e3d', titleColor: '#fff', bodyColor: '#eaf3fc', padding: 10, cornerRadius: 8, displayColors: false,
                        callbacks: { label: (ctx) => `${ctx.parsed.x}%` } 
                    },
                    valoresBarra: { display: true, color: '#1c2b45' }
                }, 
                scales: { 
                    x: { display: false, grid: { display: false }, min: 0, max: 100 }, 
                    y: { ticks: { font: {size: 10.5, weight: '700'} }, grid: { display: false } } 
                } 
            } 
        });
    }).catch(err => console.error(err));
}