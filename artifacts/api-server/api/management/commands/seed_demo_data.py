from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.test import RequestFactory
from rest_framework.test import force_authenticate

from api.models import Client, EmissionsRecord
from api.views.ingest import IngestSAPView, IngestTravelView, IngestUtilityView

SAP_SAMPLE = """WERKS\tBUDAT\tMATNR\tMENGE\tMEINS\tBUKRS
DE01\t20240115\tDIESEL-B7\t12500\tL\t1000
DE02\t20240201\tDIESEL-B7\t8900\tL\t1000
DE01\t20240115\tERDGAS\t45000\tM3\t1000
UK03\t20240301\tDIESEL-B7\t320000\tL\t2000
DE03\t20240210\tFLUESSIGGAS\t3200\tL\t1000
"""

UTILITY_SAMPLE = """meter_id,period_start,period_end,consumption_kwh,location,tariff
NGRID-DE01-A,2024-01-01,2024-01-31,148500,Frankfurt Plant A,HV_INDUSTRIAL
NGET-UK03-MAIN,2024-02-01,2024-02-29,201400,Manchester Site,LV_COMMERCIAL
TAURON-PL04-001,2024-03-01,2024-03-31,880000,Warsaw DC,B23
"""

TRAVEL_SAMPLE = """trip_type,origin,destination,distance_km,passengers,traveler,department,date,nights
flight,LHR,JFK,5540,2,Sarah Chen,Executive,2024-01-08,
flight,LHR,CDG,340,1,Marcus Weber,Finance,2024-01-14,
flight,BOM,DEL,1150,4,Priya Sharma,Operations,2024-02-03,
hotel,,,,,Sarah Chen,Executive,2024-01-22,3
ground,Frankfurt Airport,Frankfurt Plant A,18,1,Sarah Chen,Executive,2024-01-22,
"""


class Command(BaseCommand):
    help = "Seed demo client and ingest sample SAP, utility, and travel data"

    def handle(self, *args, **options):
        client, created = Client.objects.get_or_create(
            slug="meridian-industrial",
            defaults={"name": "Meridian Industrial Group"},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created client: {client.name}"))
        else:
            client.name = "Meridian Industrial Group"
            client.save(update_fields=["name"])

        if EmissionsRecord.objects.filter(client=client).exists():
            self.stdout.write("Demo emissions data already loaded — skipping")
            return

        user = User.objects.filter(username="analyst").first()
        if not user:
            self.stdout.write(
                self.style.WARNING("Run seed_users first — no analyst user found")
            )
            return

        factory = RequestFactory()
        uploads = [
            (IngestSAPView, "SAP_FI_BSEG_2024Q1_FUEL.txt", SAP_SAMPLE),
            (IngestUtilityView, "national_grid_electricity_jan_mar_2024.csv", UTILITY_SAMPLE),
            (IngestTravelView, "navan_export_2024Q1.csv", TRAVEL_SAMPLE),
        ]

        for view_cls, filename, content in uploads:
            uploaded = SimpleUploadedFile(filename, content.encode("utf-8"), "text/plain")
            request = factory.post(
                f"/api/ingest/{view_cls.__name__}",
                {"clientId": str(client.id)},
                format="multipart",
            )
            request.FILES["file"] = uploaded
            force_authenticate(request, user=user)
            response = view_cls.as_view()(request)
            if response.status_code not in (200, 201):
                self.stdout.write(
                    self.style.ERROR(
                        f"{filename}: ingest failed ({response.status_code}) — {getattr(response, 'data', '')}"
                    )
                )
                return
            batch = response.data
            self.stdout.write(
                f"  {filename}: {batch.get('rowCount', 0)} rows, status={batch.get('status')}"
            )

        total = EmissionsRecord.objects.filter(client=client).count()
        self.stdout.write(
            self.style.SUCCESS(f"Loaded {total} emissions records for {client.name}")
        )
