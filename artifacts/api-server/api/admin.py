from django.contrib import admin
from .models import Client, IngestionBatch, EmissionsRecord, AuditLog

admin.site.register(Client)
admin.site.register(IngestionBatch)
admin.site.register(EmissionsRecord)
admin.site.register(AuditLog)
