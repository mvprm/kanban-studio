import base64
import json

import pytest
from itsdangerous import TimestampSigner

from app.auth import hash_password, verify_password
from app.main import SESSION_SECRET


def login(client, username="user", password="password"):
    return client.post("/api/login", json={"username": username, "password": password})


def register(client, username="alice", password="secret-pass"):
    return client.post("/api/register", json={"username": username, "password": password})


def delete_account(client, password):
    return client.request("DELETE", "/api/me", json={"password": password})


# Password hashing


def test_hash_is_salted_and_verifies():
    first, second = hash_password("secret-pass"), hash_password("secret-pass")
    assert first != second
    assert first.startswith("scrypt$")
    assert "secret-pass" not in first
    assert verify_password("secret-pass", first)
    assert verify_password("secret-pass", second)
    assert not verify_password("wrong-pass", first)


# Sign in


def test_me_requires_login(client):
    assert client.get("/api/me").status_code == 401


def test_demo_user_can_sign_in(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json()["username"] == "user"
    me = client.get("/api/me").json()
    assert me["username"] == "user"
    assert me["createdAt"].endswith("Z")
    assert "password_hash" not in me


@pytest.mark.parametrize(
    "username, password",
    [("user", "wrong"), ("nobody", "password"), ("", "")],
)
def test_wrong_credentials_are_rejected(client, username, password):
    response = login(client, username, password)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"
    assert client.get("/api/me").status_code == 401


def test_login_missing_fields(client):
    assert client.post("/api/login", json={"username": "user"}).status_code == 422


def test_username_is_case_insensitive_at_sign_in(client):
    assert login(client, "USER").status_code == 200


def test_logout_clears_session(signed_in):
    assert signed_in.post("/api/logout").status_code == 200
    assert signed_in.get("/api/me").status_code == 401


def test_session_cookie_is_httponly(client):
    assert "httponly" in login(client).headers["set-cookie"].lower()


def test_session_from_the_mvp_is_not_accepted(client):
    # MVP sessions stored a username instead of a user id
    payload = base64.b64encode(json.dumps({"username": "user"}).encode())
    client.cookies.set("session", TimestampSigner(SESSION_SECRET).sign(payload).decode())
    assert client.get("/api/me").status_code == 401


# Registration


def test_register_signs_in_and_creates_first_board(client):
    response = register(client)
    assert response.status_code == 201
    assert response.json()["username"] == "alice"
    assert client.get("/api/me").json()["username"] == "alice"
    [board] = client.get("/api/boards").json()
    assert board["name"] == "My first board"


def test_registered_user_can_sign_in_again(client):
    register(client)
    client.post("/api/logout")
    assert login(client, "alice", "secret-pass").status_code == 200
    assert login(client, "alice", "wrong-pass").status_code == 401


@pytest.mark.parametrize("username", ["user", "USER", "alice"])
def test_register_rejects_taken_username(client, username):
    register(client, "alice")
    client.post("/api/logout")
    response = register(client, username)
    assert response.status_code == 409
    assert response.json()["detail"] == "That username is taken"


@pytest.mark.parametrize(
    "username, password",
    [
        pytest.param("ab", "secret-pass", id="username too short"),
        pytest.param("a" * 33, "secret-pass", id="username too long"),
        pytest.param("has space", "secret-pass", id="username with space"),
        pytest.param("alice!", "secret-pass", id="username with symbol"),
        pytest.param("alice", "short", id="password too short"),
    ],
)
def test_register_validates_input(client, username, password):
    assert register(client, username, password).status_code == 422
    assert client.get("/api/me").status_code == 401


def test_register_accepts_allowed_characters(client):
    assert register(client, "a.b_c-1").status_code == 201


# Password change


def change_password(client, current, new):
    return client.put("/api/me/password", json={"currentPassword": current, "newPassword": new})


def test_change_password(signed_in):
    assert change_password(signed_in, "password", "new-password").status_code == 200
    signed_in.post("/api/logout")
    assert login(signed_in).status_code == 401
    assert login(signed_in, password="new-password").status_code == 200


def test_change_password_requires_current_password(signed_in):
    response = change_password(signed_in, "wrong", "new-password")
    assert response.status_code == 403
    signed_in.post("/api/logout")
    assert login(signed_in).status_code == 200


def test_change_password_validates_new_password(signed_in):
    assert change_password(signed_in, "password", "short").status_code == 422


def test_change_password_requires_login(client):
    assert change_password(client, "password", "new-password").status_code == 401


# Account deletion


def test_delete_account_removes_user_and_boards(client, new_client):
    register(client)
    board_id = client.get("/api/boards").json()[0]["id"]
    assert delete_account(client, "secret-pass").status_code == 204
    assert client.get("/api/me").status_code == 401
    assert login(client, "alice", "secret-pass").status_code == 401
    # The username is free again, and the old board is gone
    other = new_client("alice")
    assert other.get(f"/api/boards/{board_id}").status_code == 404


def test_delete_account_requires_password(signed_in):
    assert delete_account(signed_in, "wrong").status_code == 403
    assert signed_in.get("/api/me").status_code == 200


def test_deleted_account_signs_out_other_sessions(client, new_client):
    register(client)
    other = new_client()
    login(other, "alice", "secret-pass")
    delete_account(client, "secret-pass")
    assert other.get("/api/me").status_code == 401
    assert other.get("/api/boards").status_code == 401


def test_old_session_does_not_reach_a_new_account(client, new_client):
    # Ids are never reused, so a deleted user's session can't sign in as a newer user
    register(client)
    other = new_client()
    login(other, "alice", "secret-pass")
    cookie = other.cookies["session"]
    delete_account(client, "secret-pass")
    new_client("bob")
    stale = new_client()
    stale.cookies.set("session", cookie)
    assert stale.get("/api/me").status_code == 401
