from django.core.management.base import BaseCommand
from django.db import connection

from api.models import AuditLog, Client, EmissionsRecord, IngestionBatch


class Command(BaseCommand):
    help = "Create ESG tables when missing (local SQLite / first-time setup)"

    def handle(self, *args, **options):
        existing = set(connection.introspection.table_names())
        models = [Client, IngestionBatch, EmissionsRecord, AuditLog]
        created = []

        with connection.schema_editor() as editor:
            for model in models:
                table = model._meta.db_table
                if table not in existing:
                    editor.create_model(model)
                    created.append(table)

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created tables: {', '.join(created)}")
            )
        else:
            self.stdout.write("ESG tables already exist — nothing to do")
