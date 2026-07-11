from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from catalog.models import Kalam, Queue, Rendition, SavedItem
from common.models import EditorialState, Visibility

User = get_user_model()
PUBLIC = {"visibility": Visibility.PUBLIC, "state": EditorialState.PUBLISHED}


def make_rendition(slug: str) -> Rendition:
    kalam = Kalam.objects.create(slug=f"k-{slug}", title=f"Kalam {slug}", **PUBLIC)
    return Rendition.objects.create(slug=slug, kalam=kalam, title=f"Rendition {slug}", **PUBLIC)


class LibraryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u", password="x")
        self.rendition = make_rendition("r1")

    def test_library_requires_auth(self):
        self.assertEqual(self.client.get("/api/v1/me/library/").status_code, 401)

    def test_add_list_and_idempotent_save(self):
        self.client.force_authenticate(self.user)
        r1 = self.client.post("/api/v1/me/library/", {"rendition": "r1"}, format="json")
        self.assertEqual(r1.status_code, 201)
        # saving again is a no-op, not an error
        self.client.post("/api/v1/me/library/", {"rendition": "r1"}, format="json")
        self.assertEqual(SavedItem.objects.filter(user=self.user).count(), 1)
        listing = self.client.get("/api/v1/me/library/")
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(listing.data["results"][0]["rendition_detail"]["slug"], "r1")

    def test_user_only_sees_own_library(self):
        other = User.objects.create_user(username="other", password="x")
        SavedItem.objects.create(user=other, rendition=self.rendition)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/v1/me/library/").data["count"], 0)


class QueueTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u", password="x")
        self.client.force_authenticate(self.user)
        make_rendition("a")
        make_rendition("b")

    def test_create_add_reorder_remove(self):
        q = self.client.post("/api/v1/me/queues/", {"name": "Drive"}, format="json")
        self.assertEqual(q.status_code, 201)
        qid = q.data["id"]

        i1 = self.client.post(f"/api/v1/me/queues/{qid}/items/", {"rendition": "a"}, format="json")
        i2 = self.client.post(f"/api/v1/me/queues/{qid}/items/", {"rendition": "b"}, format="json")
        self.assertEqual(i1.data["position"], 0)
        self.assertEqual(i2.data["position"], 1)

        # reorder b before a
        reordered = self.client.post(
            f"/api/v1/me/queues/{qid}/reorder/", {"order": [i2.data["id"], i1.data["id"]]}, format="json"
        )
        slugs = [it["rendition_detail"]["slug"] for it in reordered.data["items"]]
        self.assertEqual(slugs, ["b", "a"])

        # remove one
        rm = self.client.delete(f"/api/v1/me/queues/{qid}/items/{i1.data['id']}/")
        self.assertEqual(rm.status_code, 204)
        detail = self.client.get(f"/api/v1/me/queues/{qid}/")
        self.assertEqual(len(detail.data["items"]), 1)

    def test_queue_scoped_to_owner(self):
        other = User.objects.create_user(username="other", password="x")
        Queue.objects.create(user=other, name="theirs")
        self.assertEqual(self.client.get("/api/v1/me/queues/").data["count"], 0)


class SearchTests(APITestCase):
    def test_grouped_and_visibility_filtered(self):
        make_rendition("public-one")  # title "Rendition public-one", kalam "Kalam public-one"
        Kalam.objects.create(
            slug="secret", title="Secret Draft", visibility=Visibility.DRAFT,
            state=EditorialState.DRAFT,
        )
        resp = self.client.get("/api/v1/search/", {"q": "public-one"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual({"kalams", "people", "renditions", "collections"}, set(resp.data))
        self.assertTrue(any(k["slug"] == "k-public-one" for k in resp.data["kalams"]))

        # draft never leaks
        draft = self.client.get("/api/v1/search/", {"q": "Secret"})
        self.assertEqual(draft.data["kalams"], [])

    def test_empty_query_returns_empty_groups(self):
        resp = self.client.get("/api/v1/search/", {"q": ""})
        self.assertEqual(resp.data, {"kalams": [], "people": [], "renditions": [], "collections": []})
