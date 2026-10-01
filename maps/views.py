import pandas as pd
import json
import os
from decimal import Decimal, InvalidOperation
from datetime import datetime
from django.shortcuts import render
from django.http import JsonResponse
from django.db import connection
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from elections.models import VotacionAyuntamiento, VotacionDiputacion, Promovido, Encuesta

ESCUCHA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'escucha_data.json')

def safe_float(val):
    try:
        if val is None: return 0.0
        v = str(val).strip().replace(',', '')
        if not v or v.lower() in ['null', 'none', 'nan']: return 0.0
        return float(v)
    except Exception:
        return 0.0

def safe_decimal(val):
    try:
        if val is None: return Decimal('0.0')
        v = str(val).strip().replace(',', '')
        if not v or v.lower() in ['null', 'none', 'nan']: return Decimal('0.0')
        return Decimal(v)
    except Exception:
        return Decimal('0.0')

def safe_percentage(val):
    d = safe_decimal(val)
    if d < 0: return Decimal('0.0')
    if d > 100: return Decimal('100.0')
    return d

def mapa_view(request):
    return render(request, 'maps/mapa.html')

def calcular_proyeccion_generica(LN, Vt, historicos, eg_dinamico, Ss=0.6, promovidos_count=0):
    if LN == 0 or Vt == 0: 
        return None
    
    participacion_historica = Vt / LN
    V_esperados = int(LN * participacion_historica)
    Pp = (promovidos_count / LN) if LN > 0 else 0  
    
    W1, W2, W3 = 0.50, 0.30, 0.20
    partidos = ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem'] 
    fuerza_bruta = {}
    
    for partido in partidos:
        Vp = safe_float(historicos.get(partido, 0))
        term1 = W1 * (Vp / Vt) 
        
        if partido == 'pan':
            term2 = W2 * ((Pp * LN) / V_esperados) if V_esperados > 0 else 0
            Eg_actual = safe_float(eg_dinamico.get(partido, 0))
            if Eg_actual == 0: Eg_actual = 0.35
            term3 = W3 * (Eg_actual * Ss)                  
        else:
            term2 = 0
            Eg_actual = safe_float(eg_dinamico.get(partido, 0))
            if Eg_actual > 0:
                term3 = W3 * (Eg_actual * 1.0)
            else:
                term3 = W3 * (Vp / Vt) * 1.0 
        
        fuerza_bruta[partido] = term1 + term2 + term3
    
    total_fuerza = sum(fuerza_bruta.values())
    proyecciones = {}
    
    for partido in partidos:
        porcentaje_real = fuerza_bruta[partido] / total_fuerza if total_fuerza > 0 else 0
        proyecciones[partido] = int(V_esperados * porcentaje_real)
        
    if proyecciones:
        proyecciones['ganador'] = max(proyecciones, key=proyecciones.get).upper()
        proyecciones['meta_ganar'] = int((V_esperados / 2) + 1)
    else:
        proyecciones['ganador'] = 'N/A'
        proyecciones['meta_ganar'] = 0
        
    return proyecciones

def obtener_datos_seccion(request, num_seccion):
    try:
        factor_escucha = safe_float(request.GET.get('factor_escucha', 0.6))
        ayuntamiento = VotacionAyuntamiento.objects.filter(seccion=num_seccion).first()
        diputacion = VotacionDiputacion.objects.filter(seccion=num_seccion).first()
        promovidos_count = Promovido.objects.filter(seccion_electoral=num_seccion).count()
        
        promedios = Encuesta.objects.aggregate(
            Avg('pan'), Avg('pri'), Avg('prd'), Avg('pvem'), Avg('pt'), Avg('mc'), Avg('morena'), Avg('naem')
        )
        eg_dinamico = { p: (safe_float(promedios.get(f'{p}__avg')) / 100) for p in ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem'] }

        def serializar_modelo(obj):
            if not obj: return None
            datos = {
                'casillas': obj.casillas, 'lista_nominal': obj.lista_nominal,
                'num_votos_validos': obj.num_votos_validos, 'participacion': safe_float(obj.participacion),
                'pan': obj.pan, 'pri': obj.pri, 'prd': obj.prd, 'pvem': obj.pvem, 'pt': obj.pt,
                'mc': obj.mc, 'morena': obj.morena, 'naem': obj.naem, 
                'ganador': str(obj.partido_ganador).upper() if obj.partido_ganador else 'N/A'
            }
            historicos = { p: getattr(obj, p, 0) for p in ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem'] }
            datos['proyeccion'] = calcular_proyeccion_generica(
                obj.lista_nominal, obj.num_votos_validos, historicos, eg_dinamico, 
                Ss=factor_escucha, promovidos_count=promovidos_count
            )
            return datos

        return JsonResponse({
            'seccion': num_seccion,
            'ayuntamiento': serializar_modelo(ayuntamiento),
            'diputacion': serializar_modelo(diputacion)
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def obtener_datos_totales(request):
    try:
        factor_escucha = safe_float(request.GET.get('factor_escucha', 0.6))
        
        promovidos_por_seccion = {
            item['seccion_electoral']: item['total'] 
            for item in Promovido.objects.values('seccion_electoral').annotate(total=Count('id')) 
            if item['seccion_electoral']
        }
        promovidos_count_total = sum(promovidos_por_seccion.values())
        
        promedios = Encuesta.objects.aggregate(
            Avg('pan'), Avg('pri'), Avg('prd'), Avg('pvem'), Avg('pt'), Avg('mc'), Avg('morena'), Avg('naem')
        )
        eg_dinamico = { p: (safe_float(promedios.get(f'{p}__avg')) / 100) for p in ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem'] }

        def get_totales(modelo):
            columnas = ['casillas', 'lista_nominal', 'num_votos_validos', 'pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem']
            agregados = {col: Sum(col) for col in columnas}
            totales = modelo.objects.aggregate(**agregados)
            for k, v in totales.items():
                if v is None: totales[k] = 0
            
            lista_nom = safe_float(totales['lista_nominal'])
            votos_val = safe_float(totales['num_votos_validos'])
            participacion = (votos_val / lista_nom * 100) if lista_nom > 0 else 0
            
            votos_partidos = { 'pan': totales['pan'], 'pri': totales['pri'], 'prd': totales['prd'], 'pvem': totales['pvem'], 'pt': totales['pt'], 'mc': totales['mc'], 'morena': totales['morena'], 'naem': totales['naem'] }
            ganador = max(votos_partidos, key=votos_partidos.get).upper() if sum(votos_partidos.values()) > 0 else 'N/A'

            datos = {
                'casillas': totales['casillas'], 'lista_nominal': totales['lista_nominal'],
                'num_votos_validos': totales['num_votos_validos'], 'participacion': round(participacion, 2),
                'ganador': ganador, 'pan': totales['pan'], 'pri': totales['pri'], 'prd': totales['prd'],
                'pvem': totales['pvem'], 'pt': totales['pt'], 'mc': totales['mc'], 'morena': totales['morena'], 'naem': totales['naem']
            }
            datos['proyeccion'] = calcular_proyeccion_generica(
                totales['lista_nominal'], totales['num_votos_validos'], votos_partidos, eg_dinamico, 
                Ss=factor_escucha, promovidos_count=promovidos_count_total
            )
            return datos

        secciones_ayto = VotacionAyuntamiento.objects.all()
        ganadores_map = {}
        proyectados_map = {}
        
        for s in secciones_ayto:
            sec_str = str(s.seccion)
            historicos = { p: getattr(s, p, 0) for p in ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem'] }
            
            # Cálculo de Porcentaje Histórico Real
            votos_validos = s.num_votos_validos if s.num_votos_validos else sum(historicos.values())
            ganador_hist = str(s.partido_ganador).upper() if s.partido_ganador else 'N/A'
            pct_hist = 0
            if ganador_hist != 'N/A' and ganador_hist.lower() in historicos and votos_validos > 0:
                pct_hist = (safe_float(historicos[ganador_hist.lower()]) / safe_float(votos_validos)) * 100
            
            ganadores_map[sec_str] = {
                'partido': ganador_hist,
                'porcentaje': pct_hist
            }
            
            # Cálculo de Porcentaje de Proyección
            proy = calcular_proyeccion_generica(
                s.lista_nominal, s.num_votos_validos, historicos, eg_dinamico, 
                Ss=factor_escucha, promovidos_count=promovidos_por_seccion.get(s.seccion, 0)
            )
            
            if proy and proy.get('ganador') and proy['ganador'] != 'N/A':
                ganador_proy = proy['ganador']
                total_proy = sum([proy.get(p, 0) for p in ['pan', 'pri', 'prd', 'pvem', 'pt', 'mc', 'morena', 'naem']])
                pct_proy = (proy.get(ganador_proy.lower(), 0) / total_proy * 100) if total_proy > 0 else 0
                
                proyectados_map[sec_str] = {
                    'partido': ganador_proy,
                    'porcentaje': pct_proy
                }
            else:
                proyectados_map[sec_str] = {'partido': 'N/A', 'porcentaje': 0}

        return JsonResponse({
            'ayuntamiento': get_totales(VotacionAyuntamiento), 
            'diputacion': get_totales(VotacionDiputacion),
            'ganadores_historicos': ganadores_map,
            'ganadores_proyectados': proyectados_map
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def procesar_escucha_social(request):
    if request.method == 'POST':
        archivos = request.FILES.getlist('files')
        if len(archivos) != 2:
            return JsonResponse({'error': 'Debe adjuntar exactamente 2 reportes para la comparativa.'}, status=400)
        
        resultados = []
        factor_calculado = 0.6 
        for f in archivos:
            try:
                df = pd.read_excel(f, sheet_name='Datos analíticos')
                df = df.iloc[:10] 
                nombre_candidato = str(f.name).replace('.xlsx', '').replace('.xls', '').upper()
                
                def get_valor(nombre):
                    val = df.loc[df['Métrica'].str.strip() == nombre, 'Valor'].values
                    return float(val[0]) if len(val) > 0 and pd.notna(val[0]) else 0.0

                total_menciones = get_valor('Menciones')
                total_redes = get_valor('Menciones en las redes sociales')
                positivos = get_valor('Número de positivos')
                
                if total_menciones == 0: total_menciones = 1.0
                if total_redes == 0: total_redes = 1.0 
                factor_sentimiento = positivos / total_redes
                
                metricas_limpias = {}
                for _, row in df.iterrows():
                    nombre_metrica = str(row['Métrica']).strip()
                    if nombre_metrica.lower() != 'número de acciones':
                        metricas_limpias[nombre_metrica] = safe_float(row['Valor'])
                    
                resultados.append({
                    'candidato': nombre_candidato,
                    'factor_sentimiento': factor_sentimiento,
                    'metricas': metricas_limpias,
                    'total_menciones': total_menciones 
                })
            except Exception as e:
                return JsonResponse({'error': 'Error al procesar archivo.'}, status=400)
        
        if len(resultados) > 0:
            factor_calculado = resultados[0]['factor_sentimiento']
        datos_guardar = {'data': resultados, 'factor_global': factor_calculado}
        try:
            with open(ESCUCHA_FILE, 'w', encoding='utf-8') as f:
                json.dump(datos_guardar, f)
        except Exception: pass
        return JsonResponse({'status': 'ok', 'data': resultados, 'factor_global': factor_calculado})
    return JsonResponse({'error': 'Método no permitido'}, status=400)

def obtener_escucha_social(request):
    if os.path.exists(ESCUCHA_FILE):
        try:
            with open(ESCUCHA_FILE, 'r', encoding='utf-8') as f:
                datos = json.load(f)
                return JsonResponse({'status': 'ok', 'data': datos['data'], 'factor_global': datos['factor_global']})
        except: pass
    return JsonResponse({'status': 'empty'})

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

@csrf_exempt
def guardar_encuesta(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'msg': 'Método no permitido'})
    try:
        enc_id = request.POST.get('id')
        casa = str(request.POST.get('casa_encuestadora', '')).strip()[:150]
        if not casa:
            casa = 'General'

        defaults = {
            'casa_encuestadora': casa,
            'pan': safe_percentage(request.POST.get('pan')),
            'pri': safe_percentage(request.POST.get('pri')),
            'prd': safe_percentage(request.POST.get('prd')),
            'pvem': safe_percentage(request.POST.get('pvem')),
            'pt': safe_percentage(request.POST.get('pt')),
            'mc': safe_percentage(request.POST.get('mc')),
            'morena': safe_percentage(request.POST.get('morena')),
            'naem': safe_percentage(request.POST.get('naem')),
            'indecisos': safe_percentage(request.POST.get('indecisos')),
        }

        if enc_id and str(enc_id).strip() != '':
            actualizadas = Encuesta.objects.filter(id=enc_id).update(**defaults)
            if actualizadas == 0:
                return JsonResponse({'status': 'error', 'msg': 'La encuesta que intentas editar ya no existe.'})
        else:
            defaults['fecha_registro'] = timezone.now()
            Encuesta.objects.create(**defaults)

        return JsonResponse({'status': 'ok'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'msg': str(e)})

@csrf_exempt
def eliminar_encuesta(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'msg': 'Método no permitido'})
    try:
        enc_id = request.POST.get('id')
        if not enc_id:
            return JsonResponse({'status': 'error', 'msg': 'No se recibió el identificador de la encuesta.'})
        eliminadas, _ = Encuesta.objects.filter(id=enc_id).delete()
        if eliminadas == 0:
            return JsonResponse({'status': 'error', 'msg': 'La encuesta ya no existe (probablemente ya fue eliminada).'})
        return JsonResponse({'status': 'ok'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'msg': str(e)})

@csrf_exempt
def reiniciar_encuestas(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'msg': 'Método no permitido'}, status=405)
    try:
        total_eliminadas, _ = Encuesta.objects.all().delete()
        table_name = Encuesta._meta.db_table
        vendor = connection.vendor
        
        try:
            with connection.cursor() as cursor:
                if vendor == 'postgresql':
                    cursor.execute(f'ALTER SEQUENCE "{table_name}_id_seq" RESTART WITH 1;')
                elif vendor == 'mysql':
                    cursor.execute(f'ALTER TABLE `{table_name}` AUTO_INCREMENT = 1;')
                elif vendor == 'sqlite':
                    cursor.execute("DELETE FROM sqlite_sequence WHERE name = %s;", [table_name])
        except Exception:
            pass 
            
        return JsonResponse({'status': 'ok', 'eliminadas': total_eliminadas})
    except Exception as e:
        return JsonResponse({'status': 'error', 'msg': str(e)}, status=500)

def obtener_promedio_encuestas(request):
    try:
        promedios = Encuesta.objects.aggregate(
            Avg('pan'), Avg('pri'), Avg('prd'), Avg('pvem'), Avg('pt'), Avg('mc'), Avg('morena'), Avg('naem'), Avg('indecisos')
        )
        if promedios['pan__avg'] is None:
            return JsonResponse({'pan': 0, 'pri': 0, 'prd': 0, 'pvem': 0, 'pt': 0, 'mc': 0, 'morena': 0, 'naem': 0, 'indecisos': 0})
        return JsonResponse({
            'pan': safe_float(promedios['pan__avg']), 'pri': safe_float(promedios['pri__avg']), 'prd': safe_float(promedios['prd__avg']), 'pvem': safe_float(promedios['pvem__avg']),
            'pt': safe_float(promedios['pt__avg']), 'mc': safe_float(promedios['mc__avg']), 'morena': safe_float(promedios['morena__avg']), 'naem': safe_float(promedios['naem__avg']),
            'indecisos': safe_float(promedios['indecisos__avg'])
        })
    except Exception:
        return JsonResponse({'error': 'Error interno'}, status=500)

def historial_encuestas(request):
    try:
        encuestas = Encuesta.objects.all().order_by('-id')
        data = [{
            'id': e.id, 
            'fecha': e.fecha_registro.strftime('%d/%m/%Y') if e.fecha_registro else '-', 
            'casa': e.casa_encuestadora,
            'pan': safe_float(e.pan), 'pri': safe_float(e.pri), 'prd': safe_float(e.prd), 
            'pvem': safe_float(e.pvem), 'pt': safe_float(e.pt), 'mc': safe_float(e.mc),
            'morena': safe_float(e.morena), 'naem': safe_float(e.naem), 'indecisos': safe_float(e.indecisos)
        } for e in encuestas]
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse([], safe=False)