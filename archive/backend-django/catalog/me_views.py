"""Owner-scoped /me/* endpoints: library (saved items) and queues.

Every queryset is filtered to ``request.user`` — a user only ever sees and
mutates their own library and queues.
"""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Queue, QueueItem, SavedItem
from .serializers import QueueItemSerializer, QueueSerializer, SavedItemSerializer


class LibraryViewSet(viewsets.ModelViewSet):
    """GET/POST /api/v1/me/library/ ; DELETE /api/v1/me/library/{id}/"""

    serializer_class = SavedItemSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return (
            SavedItem.objects.filter(user=self.request.user)
            .select_related("rendition__kalam")
        )

    def perform_create(self, serializer):
        # Idempotent save: re-saving a rendition is a no-op, not a 500.
        rendition = serializer.validated_data["rendition"]
        serializer.instance, _ = SavedItem.objects.get_or_create(
            user=self.request.user, rendition=rendition
        )


class QueueViewSet(viewsets.ModelViewSet):
    """CRUD queues plus item management under /api/v1/me/queues/."""

    serializer_class = QueueSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Queue.objects.filter(user=self.request.user)
            .prefetch_related("items__rendition__kalam")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def items(self, request, pk=None):
        """POST /me/queues/{id}/items/ {rendition: slug, position?} → add to queue."""
        queue = self.get_object()
        serializer = QueueItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rendition = serializer.validated_data["rendition"]
        position = serializer.validated_data.get("position")
        if position is None:
            last = queue.items.order_by("-position").first()
            position = (last.position + 1) if last else 0
        item, _ = QueueItem.objects.update_or_create(
            queue=queue, rendition=rendition, defaults={"position": position}
        )
        return Response(QueueItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"items/(?P<item_id>[^/.]+)")
    def remove_item(self, request, pk=None, item_id=None):
        """DELETE /me/queues/{id}/items/{item_id}/ → remove one item."""
        queue = self.get_object()
        deleted, _ = QueueItem.objects.filter(queue=queue, pk=item_id).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reorder(self, request, pk=None):
        """POST /me/queues/{id}/reorder/ {order: [item_id, …]} → set positions."""
        queue = self.get_object()
        order = request.data.get("order", [])
        if not isinstance(order, list):
            return Response({"detail": "order must be a list of item ids."}, status=400)
        ids = [int(i) for i in order]
        existing = {item.id: item for item in queue.items.all()}
        for position, item_id in enumerate(ids):
            item = existing.get(item_id)
            if item:
                item.position = position
        QueueItem.objects.bulk_update(existing.values(), ["position"])
        queue.refresh_from_db()
        return Response(QueueSerializer(queue).data)
