from django.db import migrations


class Migration(migrations.Migration):
    """Merge conflicting 0002 migrations."""

    dependencies = [
        ('projects', '0002_initial'),
        ('projects', '0002_project_uuid_invite_token'),
    ]

    operations = []
