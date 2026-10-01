from django.core.management.base import BaseCommand
from django.db import connection
from elections.models import Encuesta


class Command(BaseCommand):
    help = "Elimina todas las encuestas registradas y reinicia el contador de ID a 0."

    def add_arguments(self, parser):
        parser.add_argument(
            '--si',
            action='store_true',
            help='Confirma la eliminación sin preguntar de forma interactiva.',
        )

    def handle(self, *args, **options):
        total = Encuesta.objects.count()

        if not options['si']:
            respuesta = input(
                f"Esto eliminará {total} encuesta(s) de forma permanente y reiniciará el "
                f"contador a 0. Escribe REINICIAR para confirmar: "
            )
            if respuesta != 'REINICIAR':
                self.stdout.write(self.style.WARNING('Operación cancelada.'))
                return

        eliminadas, _ = Encuesta.objects.all().delete()

        table_name = Encuesta._meta.db_table
        vendor = connection.vendor
        with connection.cursor() as cursor:
            if vendor == 'postgresql':
                cursor.execute(f'ALTER SEQUENCE "{table_name}_id_seq" RESTART WITH 1;')
            elif vendor == 'mysql':
                cursor.execute(f'ALTER TABLE `{table_name}` AUTO_INCREMENT = 1;')
            elif vendor == 'sqlite':
                cursor.execute("DELETE FROM sqlite_sequence WHERE name = ?;", [table_name])

        self.stdout.write(self.style.SUCCESS(
            f'Se eliminaron {eliminadas} encuesta(s) y el contador se reinició a 0.'
        ))