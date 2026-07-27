# Generated manually on 2026-06-19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0003_quard_lookup_table"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name="deviceinfo",
                    name="quard",
                ),
                migrations.AddField(
                    model_name="deviceinfo",
                    name="quard_id",
                    field=models.IntegerField(
                        blank=True,
                        help_text="Quard number: 1=Mumbai, 2=Pune (add more manually)",
                        null=True,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE device_info
                        DROP CONSTRAINT IF EXISTS device_info_quard_id_fk;
                    """,
                    reverse_sql="""
                        INSERT INTO quard (id, name)
                        VALUES (1, 'Mumbai'), (2, 'Pune')
                        ON CONFLICT (id) DO NOTHING;
                        ALTER TABLE device_info
                        ADD CONSTRAINT device_info_quard_id_fk
                        FOREIGN KEY (quard_id) REFERENCES quard(id)
                        ON DELETE SET NULL;
                    """,
                ),
            ],
        ),
        migrations.DeleteModel(
            name="Quard",
        ),
    ]
