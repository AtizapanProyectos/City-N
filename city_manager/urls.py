from django.contrib import admin
from django.urls import path
from maps import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.mapa_view, name='mapa'),
    path('api/seccion/<int:num_seccion>/', views.obtener_datos_seccion, name='datos_seccion'),
    path('api/totales/', views.obtener_datos_totales, name='datos_totales'),
    path('api/promovidos/', views.listar_promovidos, name='listar_promovidos'),
    path('api/cargar-promovidos/', views.cargar_promovidos, name='cargar_promovidos'),
    path('api/guardar-encuesta/', views.guardar_encuesta, name='guardar_encuesta'),
    path('api/promedio-encuestas/', views.obtener_promedio_encuestas, name='promedio_encuestas'),
    path('api/historial-encuestas/', views.historial_encuestas, name='historial_encuestas'),
    path('api/eliminar-encuesta/', views.eliminar_encuesta, name='eliminar_encuesta'),
    path('api/procesar-escucha/', views.procesar_escucha_social, name='procesar_escucha'),
    path('api/escucha-social/', views.obtener_escucha_social, name='obtener_escucha'),
    path('api/reiniciar-encuestas/', views.reiniciar_encuestas, name='reiniciar_encuestas'),
]