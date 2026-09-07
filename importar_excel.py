import os
import django
import pandas as pd

# Configurar el entorno de Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'city_manager.settings')
django.setup()

from elections.models import VotacionDiputacion

def procesar_diputaciones():
    # Asegúrate de que el nombre del archivo coincida con el que pusiste en la carpeta data/
    ruta_archivo = 'data/ResultadosDiputaciones.xlsx' 
    
    try:
        print(f"Procesando {ruta_archivo}...")
        df = pd.read_excel(ruta_archivo)
        
        # Limpiar filas vacías basadas en la columna de sección
        df = df.dropna(subset=['SECCION'])

        creados = 0
        actualizados = 0

        for index, row in df.iterrows():
            try:
                obj, created = VotacionDiputacion.objects.update_or_create(
                    seccion=int(row['SECCION']),
                    defaults={
                        'casillas': int(row.get('CASILLAS', 0)),
                        'lista_nominal': int(row.get('LISTA_NOMINAL', 0)),
                        'num_votos_validos': int(row.get('VOTOS_VALIDOS', 0)),
                        'participacion': float(row.get('PARTICIPACION', 0)),
                        'pan': int(row.get('PAN', 0)),
                        'pri': int(row.get('PRI', 0)),
                        'prd': int(row.get('PRD', 0)),
                        'pvem': int(row.get('PVEM', 0)),
                        'pt': int(row.get('PT', 0)),
                        'mc': int(row.get('MC', 0)),
                        'morena': int(row.get('MORENA', 0)),
                        'naem': int(row.get('NAEM', 0)),
                        'partido_ganador': str(row.get('GANADOR', 'N/A')).strip()
                    }
                )
                if created: creados += 1
                else: actualizados += 1
                    
            except Exception as row_error:
                print(f"Error en la sección {row['SECCION']}: {row_error}")
                
        print(f"Éxito: {creados} secciones creadas y {actualizados} actualizadas en Diputaciones.")
        
    except Exception as e:
        print(f"Error leyendo el archivo: {e}")

if __name__ == '__main__':
    procesar_diputaciones()