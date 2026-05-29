from django.urls import path
from .views.clients import ClientListView, ClientDetailView
from .views.batches import BatchListView, BatchDetailView
from .views.records import RecordListView, RecordDetailView, RecordReviewView, RecordAuditLogView
from .views.dashboard import DashboardSummaryView
from .views.ingest import IngestSAPView, IngestUtilityView, IngestTravelView

urlpatterns = [
    path("clients", ClientListView.as_view(), name="client-list"),
    path("clients/<int:pk>", ClientDetailView.as_view(), name="client-detail"),
    path("batches", BatchListView.as_view(), name="batch-list"),
    path("batches/<int:pk>", BatchDetailView.as_view(), name="batch-detail"),
    path("records", RecordListView.as_view(), name="record-list"),
    path("records/<int:pk>", RecordDetailView.as_view(), name="record-detail"),
    path("records/<int:pk>/review", RecordReviewView.as_view(), name="record-review"),
    path("records/<int:pk>/audit", RecordAuditLogView.as_view(), name="record-audit"),
    path("dashboard/summary", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("ingest/sap", IngestSAPView.as_view(), name="ingest-sap"),
    path("ingest/utility", IngestUtilityView.as_view(), name="ingest-utility"),
    path("ingest/travel", IngestTravelView.as_view(), name="ingest-travel"),
]
