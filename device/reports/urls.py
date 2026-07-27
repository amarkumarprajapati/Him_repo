from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("reports/statistical/", views.statistical_report, name="reports-statistical"),
    path("reports/analysis/", views.analysis_report, name="reports-analysis"),
    path("export/csv/", views.csv_export, name="export-csv"),
]
