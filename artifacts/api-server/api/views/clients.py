from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..models import Client
from ..serializers import ClientSerializer


class ClientListView(APIView):
    def get(self, request):
        clients = Client.objects.all().order_by("name")
        return Response(ClientSerializer(clients, many=True).data)

    def post(self, request):
        slug = request.data.get("slug", "")
        if Client.objects.filter(slug=slug).exists():
            return Response(
                {"error": "A client with this slug already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ClientSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ClientDetailView(APIView):
    def get(self, request, pk):
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response({"error": "Client not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ClientSerializer(client).data)
