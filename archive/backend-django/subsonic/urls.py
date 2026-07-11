from django.urls import path

from . import views

# OpenSubsonic clients call /rest/<method>.view
urlpatterns = [
    path("ping.view", views.ping),
    path("getLicense.view", views.get_license),
    path("getLyricsBySongId.view", views.get_lyrics_by_song_id),
    path("stream.view", views.stream),
]
