from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.core.management import call_command


class Command(BaseCommand):
    help = "Create default analyst user for the Breathe ESG prototype"

    def handle(self, *args, **options):
        call_command("ensure_esg_schema")
        if not User.objects.filter(username="analyst").exists():
            User.objects.create_superuser(
                username="analyst",
                email="analyst@breathe.esg",
                password="breathe2024",
                first_name="ESG",
                last_name="Analyst",
            )
            self.stdout.write(self.style.SUCCESS("Created user: analyst / breathe2024"))
        else:
            self.stdout.write("User 'analyst' already exists — skipping")

        call_command("seed_demo_data")
