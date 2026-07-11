from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "display_name", "role", "trust_score", "preferences")
        read_only_fields = ("id", "role", "trust_score")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ("username", "email", "password", "display_name")

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            display_name=validated_data.get("display_name", ""),
        )


class PreferencesSerializer(serializers.Serializer):
    preferences = serializers.JSONField()

    def update(self, instance, validated_data):
        # Merge so a client can patch a subset of keys.
        merged = {**(instance.preferences or {}), **validated_data["preferences"]}
        instance.preferences = merged
        instance.save(update_fields=["preferences"])
        return instance
