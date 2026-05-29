from django.db import models


class Client(models.Model):
    name = models.TextField()
    slug = models.TextField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "clients"
        managed = False

    def __str__(self):
        return self.name


class IngestionBatch(models.Model):
    SOURCE_CHOICES = [("sap", "SAP"), ("utility", "Utility"), ("travel", "Travel")]
    STATUS_CHOICES = [("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, db_column="client_id")
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="processing")
    filename = models.TextField()
    row_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    error_details = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ingestion_batches"
        managed = False
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source_type} batch #{self.id} ({self.status})"


class EmissionsRecord(models.Model):
    SCOPE_CHOICES = [("scope1", "Scope 1"), ("scope2", "Scope 2"), ("scope3", "Scope 3")]
    SOURCE_CHOICES = [("sap", "SAP"), ("utility", "Utility"), ("travel", "Travel")]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("flagged", "Flagged"),
    ]

    batch = models.ForeignKey(IngestionBatch, on_delete=models.CASCADE, db_column="batch_id")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, db_column="client_id")
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES)
    category = models.TextField()
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    raw_data = models.JSONField(default=dict)
    activity_amount = models.FloatField()
    activity_unit = models.TextField()
    normalized_co2e_kg = models.FloatField()
    activity_date = models.DateField()
    location = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    review_notes = models.TextField(null=True, blank=True)
    reviewed_by = models.TextField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_suspicious = models.BooleanField(default=False)
    suspicious_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "emissions_records"
        managed = False
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.scope} — {self.category} — {self.normalized_co2e_kg:.2f} kg CO2e"


class AuditLog(models.Model):
    record = models.ForeignKey(EmissionsRecord, on_delete=models.CASCADE, db_column="record_id")
    action = models.TextField()
    actor = models.TextField()
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        managed = False
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.action} on record #{self.record_id} by {self.actor}"
