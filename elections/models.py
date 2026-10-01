from django.db import models


class VotacionAyuntamiento(models.Model):
    seccion = models.IntegerField(unique=True)
    casillas = models.IntegerField()
    lista_nominal = models.IntegerField()
    num_votos_validos = models.IntegerField()
    participacion = models.DecimalField(max_digits=5, decimal_places=2)
    pan = models.IntegerField(default=0)
    pri = models.IntegerField(default=0)
    prd = models.IntegerField(default=0)
    pvem = models.IntegerField(default=0)
    pt = models.IntegerField(default=0)
    mc = models.IntegerField(default=0)
    morena = models.IntegerField(default=0)
    naem = models.IntegerField(default=0)
    partido_ganador = models.CharField(max_length=50)

class VotacionDiputacion(models.Model):
    seccion = models.IntegerField(unique=True)
    casillas = models.IntegerField()
    lista_nominal = models.IntegerField()
    num_votos_validos = models.IntegerField()
    participacion = models.DecimalField(max_digits=5, decimal_places=2)
    pan = models.IntegerField(default=0)
    pri = models.IntegerField(default=0)
    prd = models.IntegerField(default=0)
    pvem = models.IntegerField(default=0)
    pt = models.IntegerField(default=0)
    mc = models.IntegerField(default=0)
    morena = models.IntegerField(default=0)
    naem = models.IntegerField(default=0)
    partido_ganador = models.CharField(max_length=50)

class Promovido(models.Model):
    nombre_completo = models.CharField(max_length=255)
    telefono_movil = models.CharField(max_length=20, blank=True, null=True)
    correo_electronico = models.EmailField(blank=True, null=True)
    facebook = models.CharField(max_length=255, blank=True, null=True)
    instagram = models.CharField(max_length=255, blank=True, null=True)
    direccion_completa = models.TextField(blank=True, null=True)
    seccion_electoral = models.IntegerField(blank=True, null=True)
    distrito_zona = models.CharField(max_length=100, blank=True, null=True)
    confirma_apoyo = models.CharField(max_length=2, default='No')
    medio_contacto = models.CharField(max_length=50, blank=True, null=True)
    responsable_captura = models.CharField(max_length=255, blank=True, null=True)
    fecha_registro = models.DateField(blank=True, null=True)
    estatus = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"{self.nombre_completo} - {self.seccion_electoral}"

class Encuesta(models.Model):
    fecha_registro = models.DateTimeField(auto_now_add=True)
    casa_encuestadora = models.CharField(max_length=100, default='General', blank=True)
    
    pan = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    pri = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    prd = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    pvem = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    pt = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    mc = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    morena = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    naem = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    
    indecisos = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)

    class Meta:
        ordering = ['-fecha_registro']

    def __str__(self):
        return f"{self.casa_encuestadora} - {self.fecha_registro.strftime('%d/%m/%Y')}"