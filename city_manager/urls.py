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
]