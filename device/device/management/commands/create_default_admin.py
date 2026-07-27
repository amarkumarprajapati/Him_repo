from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = 'Create default admin user idempotently'

    def handle(self, *args, **kwargs):
        User = get_user_model()
        username = 'admin'
        password = 'Admin@123'
        email = 'admin@example.com'

        user, created = User.objects.get_or_create(username=username)
        user.set_password(password)
        user.email = email
        user.is_superuser = True
        user.is_staff = True
        user.role = User.ROLE_SUPER_ADMIN
        user.is_active = True
        user.save()
        
        if created:
            self.stdout.write(self.style.SUCCESS(f"Successfully created default admin user '{username}'"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Successfully verified/recreated default admin user '{username}'"))
