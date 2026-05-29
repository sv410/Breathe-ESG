from django.db.models import Sum, Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from ..models import EmissionsRecord, IngestionBatch
from ..serializers import IngestionBatchSerializer


class DashboardSummaryView(APIView):
    def get(self, request):
        client_id = request.query_params.get("clientId")
        record_qs = EmissionsRecord.objects.all()
        batch_qs = IngestionBatch.objects.all()

        if client_id:
            record_qs = record_qs.filter(client_id=client_id)
            batch_qs = batch_qs.filter(client_id=client_id)

        agg = record_qs.aggregate(
            total_records=Count("id"),
            pending_count=Count("id", filter=Q(status="pending")),
            approved_count=Count("id", filter=Q(status="approved")),
            rejected_count=Count("id", filter=Q(status="rejected")),
            flagged_count=Count("id", filter=Q(status="flagged")),
            suspicious_count=Count("id", filter=Q(is_suspicious=True)),
            total_co2e_kg=Sum("normalized_co2e_kg"),
        )

        by_scope = []
        for scope_val in ["scope1", "scope2", "scope3"]:
            qs = record_qs.filter(scope=scope_val).aggregate(
                count=Count("id"), co2e_kg=Sum("normalized_co2e_kg")
            )
            by_scope.append({
                "scope": scope_val,
                "count": qs["count"] or 0,
                "co2eKg": float(qs["co2e_kg"] or 0),
            })

        by_source = []
        for src in ["sap", "utility", "travel"]:
            qs = record_qs.filter(source_type=src).aggregate(
                count=Count("id"), co2e_kg=Sum("normalized_co2e_kg")
            )
            if qs["count"]:
                by_source.append({
                    "sourceType": src,
                    "count": qs["count"],
                    "co2eKg": float(qs["co2e_kg"] or 0),
                })

        recent_batches = batch_qs.order_by("-created_at")[:5]

        return Response({
            "totalRecords": agg["total_records"] or 0,
            "pendingCount": agg["pending_count"] or 0,
            "approvedCount": agg["approved_count"] or 0,
            "rejectedCount": agg["rejected_count"] or 0,
            "flaggedCount": agg["flagged_count"] or 0,
            "suspiciousCount": agg["suspicious_count"] or 0,
            "totalCo2eKg": float(agg["total_co2e_kg"] or 0),
            "byScope": by_scope,
            "bySource": by_source,
            "recentBatches": IngestionBatchSerializer(recent_batches, many=True).data,
        })
