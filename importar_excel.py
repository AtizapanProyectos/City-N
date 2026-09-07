import os
import django
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'city_manager.settings')
django.setup()

from elections.models import VotacionDiputacion, VotacionAyuntamiento

def obtener_datos_fila(row):
    casillas = int(row.get('CASILLAS', 0))
    lista_nominal = int(row.get('LISTA_NOMINAL', 0))
    num_votos_validos = int(row.get('NUM_VOTOS_VALIDOS', 0))
    
    participacion = 0.0
    if lista_nominal > 0:
        participacion = round((num_votos_validos / lista_nominal) * 100, 2)
        
    partidos = ['PAN', 'PRI', 'PRD', 'PVEM', 'PT', 'MC', 'MORENA', 'NAEM']
    votos_partidos = {p: int(row.get(p, 0)) for p in partidos}
    partido_ganador = max(votos_partidos, key=votos_partidos.get) if sum(votos_partidos.values()) > 0 else 'N/A'
    
    datos = {
        'casillas': casillas,
        'lista_nominal': lista_nominal,
        'num_votos_validos': num_votos_validos,
        'participacion': participacion,
        'partido_ganador': partido_ganador
    }
    for p in partidos:
        datos[p.lower()] = votos_partidos[p]
        
    return datos

def procesar_eleccion(modelo, ruta_archivo, nombre_eleccion):
    try:
        print(f"Procesando {ruta_archivo}...")
        df = pd.read_excel(ruta_archivo)
        df = df.dropna(subset=['SECCION'])
        creados, actualizados = 0, 0

        for index, row in df.iterrows():
            try:
                datos = obtener_datos_fila(row)
                obj, created = modelo.objects.update_or_create(
                    seccion=int(row['SECCION']),
                    defaults=datos
                )
                if created: creados += 1
                else: actualizados += 1
            except Exception as row_error:
                print(f"Error en sección {row['SECCION']}: {row_error}")
                
        print(f"Éxito: {creados} creadas y {actualizados} actualizadas en {nombre_eleccion}.")
    except Exception as e:
        print(f"Error leyendo el archivo {ruta_archivo}: {e}")

if __name__ == '__main__':
    procesar_eleccion(VotacionDiputacion, 'data/ResultadosDiputaciones.xlsx', 'Diputaciones')
    procesar_eleccion(VotacionAyuntamiento, 'data/ResultadosAyuntamiento.xlsx', 'Ayuntamientos')