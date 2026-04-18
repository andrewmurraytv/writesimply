"""
Backend API tests for SolopreneurWriter
Covers: auth (login/register/me/logout), articles CRUD, prompts, filtering
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://draft-hub-16.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    # httpOnly cookie should be set
    assert "access_token" in s.cookies.get_dict(), "access_token cookie not set"
    return s


@pytest.fixture(scope="module")
def new_user_session():
    """Register a brand-new user for isolation-testing article ownership."""
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "passw0rd!", "name": "Tester"}, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    return s, email


# ── Auth ──
class TestAuth:
    def test_login_success_sets_cookie(self, admin_session):
        # Covered by fixture; validate /me
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data.get("role") == "admin"

    def test_login_invalid_password(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpw"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_duplicate_email(self, new_user_session):
        _s, email = new_user_session
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "x", "name": "dup"}, timeout=15)
        assert r.status_code == 400

    def test_logout_clears_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        # Old cookie cleared; /me should return 401 now
        s.cookies.clear()
        r2 = s.get(f"{API}/auth/me", timeout=15)
        assert r2.status_code == 401


# ── Articles CRUD ──
class TestArticlesCRUD:
    def test_create_and_get_article(self, admin_session):
        payload = {
            "title": "TEST_Article_" + uuid.uuid4().hex[:6],
            "notes": "scratchpad notes",
            "article_content": "Hello body",
            "status": "idea",
            "tags": ["TEST_tagA", "TEST_tagB"],
            "reference_links": [{"label": "Google", "url": "https://google.com"}]
        }
        r = admin_session.post(f"{API}/articles", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["title"] == payload["title"]
        assert created["status"] == "idea"
        assert created["tags"] == payload["tags"]
        assert "id" in created
        assert "_id" not in created  # ObjectId excluded

        aid = created["id"]
        r = admin_session.get(f"{API}/articles/{aid}", timeout=15)
        assert r.status_code == 200
        fetched = r.json()
        assert fetched["id"] == aid
        assert fetched["notes"] == "scratchpad notes"

        # cleanup
        admin_session.delete(f"{API}/articles/{aid}", timeout=15)

    def test_update_article_persists(self, admin_session):
        r = admin_session.post(f"{API}/articles", json={"title": "TEST_Update"}, timeout=15)
        aid = r.json()["id"]
        r = admin_session.put(f"{API}/articles/{aid}", json={"title": "Updated", "status": "draft", "tags": ["x"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == "Updated"
        # verify persistence
        r = admin_session.get(f"{API}/articles/{aid}", timeout=15)
        assert r.json()["title"] == "Updated"
        assert r.json()["status"] == "draft"
        admin_session.delete(f"{API}/articles/{aid}", timeout=15)

    def test_delete_article_removes_it(self, admin_session):
        r = admin_session.post(f"{API}/articles", json={"title": "TEST_Delete"}, timeout=15)
        aid = r.json()["id"]
        r = admin_session.delete(f"{API}/articles/{aid}", timeout=15)
        assert r.status_code == 200
        r = admin_session.get(f"{API}/articles/{aid}", timeout=15)
        assert r.status_code == 404

    def test_filter_by_status_and_tag(self, admin_session):
        r = admin_session.post(f"{API}/articles", json={"title": "TEST_F1", "status": "draft", "tags": ["TEST_filter"]}, timeout=15)
        aid1 = r.json()["id"]
        r = admin_session.post(f"{API}/articles", json={"title": "TEST_F2", "status": "ready", "tags": ["TEST_filter"]}, timeout=15)
        aid2 = r.json()["id"]

        r = admin_session.get(f"{API}/articles?status=draft", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any(a["id"] == aid1 for a in items)
        assert all(a["status"] == "draft" for a in items)

        r = admin_session.get(f"{API}/articles?tag=TEST_filter", timeout=15)
        ids = [a["id"] for a in r.json()]
        assert aid1 in ids and aid2 in ids

        admin_session.delete(f"{API}/articles/{aid1}", timeout=15)
        admin_session.delete(f"{API}/articles/{aid2}", timeout=15)

    def test_article_ownership_isolation(self, admin_session, new_user_session):
        # create with admin
        r = admin_session.post(f"{API}/articles", json={"title": "TEST_Owner"}, timeout=15)
        aid = r.json()["id"]
        # other user cannot access
        other, _ = new_user_session
        r = other.get(f"{API}/articles/{aid}", timeout=15)
        assert r.status_code == 404
        admin_session.delete(f"{API}/articles/{aid}", timeout=15)

    def test_list_requires_auth(self):
        r = requests.get(f"{API}/articles", timeout=15)
        assert r.status_code == 401


# ── Prompts ──
class TestPrompts:
    def test_list_prompts_has_two_seeded(self, admin_session):
        r = admin_session.get(f"{API}/prompts", timeout=15)
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) >= 2
        names = [p.get("name") for p in prompts]
        assert any("Outline" in n for n in names)
        assert any("Draft" in n for n in names)

    def test_update_prompt_persists(self, admin_session):
        r = admin_session.get(f"{API}/prompts", timeout=15)
        prompt = r.json()[0]
        pid = prompt["id"]
        new_content = "TEST_content " + uuid.uuid4().hex[:5]
        r = admin_session.put(f"{API}/prompts/{pid}", json={"content": new_content}, timeout=15)
        assert r.status_code == 200
        assert r.json()["content"] == new_content
        # restore
        admin_session.put(f"{API}/prompts/{pid}", json={"content": prompt["content"]}, timeout=15)


# ── New user gets seeded prompts ──
class TestNewUserSeeding:
    def test_new_user_has_prompts(self, new_user_session):
        s, _ = new_user_session
        r = s.get(f"{API}/prompts", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 2
