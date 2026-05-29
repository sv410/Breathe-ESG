from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..models import IngestionBatch
from ..serializers import IngestionBatchSerializer


class BatchListView(APIView):
    def get(self, request):
        qs = IngestionBatch.objects.all()
        client_id = request.query_params.get("clientId")
        source_type = request.query_params.get("sourceType")
        batch_status = request.query_params.get("status")
        if client_id:
            qs = qs.filter(client_id=client_id)
        if source_type:
            qs = qs.filter(source_type=source_type)
        if batch_status:
            qs = qs.filter(status=batch_status)
        return Response(IngestionBatchSerializer(qs, many=True).data)


class BatchDetailView(APIView):
    def get(self, request, pk):
        try:
            batch = IngestionBatch.objects.get(pk=pk)
        except IngestionBatch.DoesNotExist:
            return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IngestionBatchSerializer(batch).data)
