from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("media", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContentSource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=160)),
                ("slug", models.SlugField(max_length=180, unique=True)),
                ("base_url", models.URLField(max_length=512)),
                ("description", models.TextField(blank=True)),
                ("kind", models.CharField(choices=[("official", "Official"), ("community", "Community"), ("personal", "Personal")], default="community", max_length=12)),
                ("icon_url", models.URLField(blank=True, max_length=512)),
                ("is_official", models.BooleanField(default=False)),
                ("is_default", models.BooleanField(default=False)),
                ("is_enabled", models.BooleanField(default=True)),
                ("verified", models.BooleanField(default=False)),
                ("priority", models.IntegerField(default=100)),
            ],
            options={"ordering": ["priority", "name"]},
        ),
        migrations.CreateModel(
            name="MediaMirror",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=160)),
                ("slug", models.SlugField(max_length=180, unique=True)),
                ("base_url", models.URLField(max_length=512)),
                ("kind", models.CharField(choices=[("r2", "Cloudflare R2 / S3 CDN"), ("cdn", "Generic CDN"), ("github", "GitHub raw"), ("external", "External host"), ("local", "Local / self-hosted")], default="cdn", max_length=12)),
                ("notes", models.CharField(blank=True, max_length=300)),
                ("is_official", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("is_default_enabled", models.BooleanField(default=True)),
                ("verified", models.BooleanField(default=False)),
                ("carries_all", models.BooleanField(default=False)),
                ("priority", models.IntegerField(default=100)),
            ],
            options={"ordering": ["priority", "name"]},
        ),
        migrations.CreateModel(
            name="MediaAssetMirror",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("available", models.BooleanField(default=True)),
                ("url_override", models.URLField(blank=True, max_length=1024)),
                ("checksum_ok", models.BooleanField(blank=True, null=True)),
                ("last_checked", models.DateTimeField(blank=True, null=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mirror_availability", to="media.mediaasset")),
                ("mirror", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="asset_availability", to="federation.mediamirror")),
            ],
        ),
        migrations.AddConstraint(
            model_name="mediaassetmirror",
            constraint=models.UniqueConstraint(fields=("asset", "mirror"), name="unique_asset_mirror"),
        ),
    ]
