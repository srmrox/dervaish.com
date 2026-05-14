from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import ImportBatch
from .serializers import ImportBatchSerializer
from .services import run_import_batch


class ImportBatchViewSet(ModelViewSet):
    serializer_class = ImportBatchSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = ImportBatch.objects.select_related("created_by").order_by("-created_at")

    def perform_create(self, serializer):
        batch = serializer.save(created_by=self.request.user)
        run_import_batch(batch)

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        batch = run_import_batch(self.get_object())
        return Response(ImportBatchSerializer(batch).data, status=status.HTTP_200_OK)
