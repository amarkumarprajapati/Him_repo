import atexit

from django.apps import AppConfig


class TelemetryAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "telemetry"

    def ready(self):
        import sys

        from .services import start_background_tasks, stop_background_tasks

        mgmt_cmds_to_skip = {
            "makemigrations",
            "migrate",
            "collectstatic",
            "test",
            "shell",
            "shell_plus",
            "dbshell",
            "dumpdata",
            "loaddata",
            "check",
            "createsuperuser",
            "changepassword",
        }
        if len(sys.argv) > 1 and sys.argv[1] in mgmt_cmds_to_skip:
            return

        start_background_tasks()
        atexit.register(stop_background_tasks)
