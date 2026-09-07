import pandas as pd
from datetime import datetime
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Sum
from django.views.decorators.csrf import csrf_exempt
from elections.models import VotacionAyuntamiento, VotacionDiputacion, Promovido

def mapa_view(request):
    return render(request, 'maps/mapa.html')

def obtener_datos_seccion(request, num_seccion):
    try:
        ayuntamiento = VotacionAyuntamiento.objects.filter(seccion=num_seccion).first()
        diputacion = VotacionDiputacion.objects.filter(seccion=num_seccion).first()
        
        def calcular_proyeccion(obj):
            if not obj or obj.num_votos_validos == 0 or obj.lista_nominal == 0: 
                return None
            
            # --- DATOS REALES DE LOS EXCEL ---
            LN = obj.lista_nominal
            Vt = obj.num_votos_validos 
            V_esperados = Vt  # Proyectamos que la participación (Pc) será la misma
            
            # --- VARIABLES DE SIMULACIÓN ---
            Pp = 0.12  # 12% del LN (Representa tus promovidos)
            Eg = 0.35  # 35% de intención de voto en encuestas
            Ss = 0.60  # Índice de sentimiento (¡Ojo! 0.6 castiga la intención. >1.0 la premia)
            
            W1, W2, W3 = 0.50, 0.30, 0.20
            PARTIDO_PROYECTADO = 'pan' 
            partidos = ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem']
            
            fuerza_bruta = {}
            
            # PASO 1: Calcular la fuerza de tracción de cada partido
            for partido in partidos:
                Vp = getattr(obj, partido, 0) 
                term1 = W1 * (Vp / Vt)  # Tracción por historia
                
                if partido == PARTIDO_PROYECTADO:
                    term2 = W2 * ((Pp * LN) / V_esperados)  # Tracción por estructura
                    term3 = W3 * (Eg * Ss)                  # Tracción por clima de opinión
                else:
                    term2 = 0
                    # A la oposición le calculamos su clima de opinión base derivado de su histórico
                    term3 = W3 * (Vp / Vt) * 1.0 
                
                fuerza_bruta[partido] = term1 + term2 + term3
            
            # PASO 2: Normalización (Juego de Suma Cero)
            total_fuerza = sum(fuerza_bruta.values())
            proyecciones = {}
            
            for partido in partidos:
                porcentaje_real = fuerza_bruta[partido] / total_fuerza if total_fuerza > 0 else 0
                proyecciones[partido] = int(V_esperados * porcentaje_real)
                
            if proyecciones:
                proyecciones['ganador'] = max(proyecciones, key=proyecciones.get).upper()
            else:
                proyecciones['ganador'] = 'N/A'
                
            return proyecciones

        def serializar_modelo(obj):
            if not obj: return None
            datos = {
                'casillas': obj.casillas, 'lista_nominal': obj.lista_nominal,
                'num_votos_validos': obj.num_votos_validos, 'participacion': float(obj.participacion),
                'pan': obj.pan, 'pri': obj.pri, 'prd': obj.prd, 'pvem': obj.pvem, 'pt': obj.pt,
                'mc': obj.mc, 'morena': obj.morena, 'naem': obj.naem, 'ganador': obj.partido_ganador
            }
            datos['proyeccion'] = calcular_proyeccion(obj)
            return datos

        return JsonResponse({
            'seccion': num_seccion,
            'ayuntamiento': serializar_modelo(ayuntamiento),
            'diputacion': serializar_modelo(diputacion)
        })
    except Exception as e:
        return JsonResponse({'error': 'Error interno'}, status=500)

def obtener_datos_totales(request):
    try:
        def get_totales(modelo):
            columnas = ['casillas', 'lista_nominal', 'num_votos_validos', 'pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem']
            agregados = {col: Sum(col) for col in columnas}
            totales = modelo.objects.aggregate(**agregados)
            for k, v in totales.items():
                if v is None: totales[k] = 0
            
            participacion = (totales['num_votos_validos'] / totales['lista_nominal'] * 100) if totales['lista_nominal'] > 0 else 0
            votos_partidos = { 'PAN': totales['pan'], 'PRI': totales['pri'], 'PRD': totales['prd'], 'PVEM': totales['pvem'], 'PT': totales['pt'], 'MC': totales['mc'], 'MORENA': totales['morena'], 'NAEM': totales['naem'] }
            ganador = max(votos_partidos, key=votos_partidos.get) if sum(votos_partidos.values()) > 0 else 'N/A'

            return {
                'casillas': totales['casillas'], 'lista_nominal': totales['lista_nominal'],
                'num_votos_validos': totales['num_votos_validos'], 'participacion': round(participacion, 2),
                'ganador': ganador, 'pan': totales['pan'], 'pri': totales['pri'], 'prd': totales['prd'],
                'pvem': totales['pvem'], 'pt': totales['pt'], 'mc': totales['mc'], 'morena': totales['morena'], 'naem': totales['naem']
            }
        return JsonResponse({'ayuntamiento': get_totales(VotacionAyuntamiento), 'diputacion': get_totales(VotacionDiputacion)})
    except Exception as e:
        return JsonResponse({'error': 'Error interno'}, status=500)

def listar_promovidos(request):
    seccion = request.GET.get('seccion')
    if seccion: promovidos = Promovido.objects.filter(seccion_electoral=seccion).order_by('-id')
    else: promovidos = Promovido.objects.all().order_by('-id')
    data = [{
        'nombre': p.nombre_completo, 'telefono': p.telefono_movil, 'direccion': p.direccion_completa,
        'seccion': p.seccion_electoral, 'medio': p.medio_contacto,
        'fecha': p.fecha_registro.strftime('%d/%m/%Y') if p.fecha_registro else '-', 'estatus': p.estatus
    } for p in promovidos]
    return JsonResponse(data, safe=False)

@csrf_exempt
def cargar_promovidos(request):
    if request.method == 'POST' and request.FILES.get('file'):
        try:
            excel_file = request.FILES['file']
            df = pd.read_excel(excel_file, sheet_name='Registro', header=2)
            df = df.dropna(subset=['Nombre completo'])
            creados = 0
            for index, row in df.iterrows():
                try:
                    fecha_reg = None
                    if pd.notna(row['Fecha de registro']):
                        fecha_reg = datetime.strptime(row['Fecha de registro'], "%d/%m/%Y").date() if isinstance(row['Fecha de registro'], str) else row['Fecha de registro'].date()
                    obj, created = Promovido.objects.update_or_create(
                        nombre_completo=str(row['Nombre completo']).strip(),
                        telefono_movil=str(row['Teléfono móvil']).strip() if pd.notna(row['Teléfono móvil']) else "",
                        defaults={
                            'seccion_electoral': int(row['Sección electoral']) if pd.notna(row['Sección electoral']) else None,
                            'medio_contacto': str(row['Medio de contacto preferido']).strip() if pd.notna(row['Medio de contacto preferido']) else "",
                            'estatus': str(row['Estatus']).strip() if pd.notna(row['Estatus']) else "",
                            'fecha_registro': fecha_reg,
                            'direccion_completa': str(row['Dirección completa']).strip() if pd.notna(row['Dirección completa']) else ""
                        }
                    )
                    if created: creados += 1
                except Exception: continue
            return JsonResponse({'status': 'ok', 'mensaje': f'Se procesaron correctamente los datos. Nuevos: {creados}'})
        except Exception as e: return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'No se envió ningún archivo'}, status=400)