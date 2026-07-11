from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User

admin.site.register(User, UserAdmin)
admin.site.site_header = "Dervaish administration"
admin.site.site_title = "Dervaish admin"
admin.site.index_title = "Archive & catalogue management"
