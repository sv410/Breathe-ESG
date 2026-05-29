from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..models import EmissionsRecord, AuditLog
from ..serializers import EmissionsRecordSerializer, AuditLogSerializer


class RecordListView(APIView):
    def get(self, request):
        qs = EmissionsRecord.objects.all()
        client_id = request.query_params.get("clientId")
        batch_id = request.query_params.get("batchId")
        rec_status = request.query_params.get("status")
        scope = request.query_params.get("scope")
        source_type = request.query_params.get("sourceType")
        is_suspicious = request.query_params.get("isSuspicious")

        if client_id:
            qs = qs.filter(client_id=client_id)
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if rec_status:
            qs = qs.filter(status=rec_status)
        if scope:
            qs = qs.filter(scope=scope)
        if source_type:
            qs = qs.filter(source_type=source_type)
        if is_suspicious is not None:
            qs = qs.filter(is_suspicious=is_suspicious.lower() == "true")

        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 50))
        total = qs.count()
        offset = (page - 1) * limit
        records = qs[offset: offset + limit]

        return Response({
            "data": EmissionsRecordSerializer(records, many=True).data,
            "total": total,
            "page": page,
            "limit": limit,
        })


class RecordDetailView(APIView):
    def get(self, request, pk):
        try:
            record = EmissionsRecord.objects.get(pk=pk)
        except EmissionsRecord.DoesNotExist:
            return Response({"error": "Record not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(EmissionsRecordSerializer(record).data)

    def delete(self, request, pk):
        try:
            record = EmissionsRecord.objects.get(pk=pk)
        except EmissionsRecord.DoesNotExist:
            return Response({"error": "Record not found"}, status=status.HTTP_404_NOT_FOUND)

        before = EmissionsRecordSerializer(record).data
        AuditLog.objects.create(
            record=record,
            action="deleted",
            actor=request.user.username,
            before_state=before,
            after_state=None,
        )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecordReviewView(APIView):
    def patch(self, request, pk):
        try:
            record = EmissionsRecord.objects.get(pk=pk)
        except EmissionsRecord.DoesNotExist:
            return Response({"error": "Record not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status not in ("approved", "rejected", "flagged"):
            return Response(
                {"error": "status must be approved, rejected, or flagged"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        before = EmissionsRecordSerializer(record).data
        record.status = new_status
        record.review_notes = request.data.get("reviewNotes", record.review_notes)
        record.reviewed_by = request.user.username
        record.reviewed_at = timezone.now()
        record.save()

        after = EmissionsRecordSerializer(record).data
        AuditLog.objects.create(
            record=record,
            action=new_status,
            actor=request.user.username,
            before_state=before,
            after_state=after,
        )
        return Response(after)


class RecordAuditLogView(APIView):
    def get(self, request, pk):
        logs = AuditLog.objects.filter(record_id=pk).order_by("created_at")
        return Response(AuditLogSerializer(logs, many=True).data)
