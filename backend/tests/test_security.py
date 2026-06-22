"""Unit tests for the pure security primitives."""
from services import security


def test_hash_password_roundtrip():
    h = security.hash_password("correct horse battery staple")
    assert h != "correct horse battery staple"  # never stored as plaintext
    assert security.verify_password("correct horse battery staple", h) is True


def test_verify_rejects_wrong_password():
    h = security.hash_password("right-password")
    assert security.verify_password("wrong-password", h) is False


def test_hash_is_salted_unique_per_call():
    a = security.hash_password("samepw")
    b = security.hash_password("samepw")
    assert a != b  # different salt each time
    assert security.verify_password("samepw", a)
    assert security.verify_password("samepw", b)


def test_verify_never_raises_on_garbage_hash():
    # Malformed hash must return False, not raise — supports uniform error paths.
    assert security.verify_password("anything", "") is False
    assert security.verify_password("anything", "not-a-bcrypt-hash") is False


def test_bcrypt_72_byte_truncation_is_handled():
    # Passwords longer than 72 bytes must hash and verify without raising.
    long_pw = "a" * 100
    h = security.hash_password(long_pw)
    assert security.verify_password(long_pw, h) is True


def test_session_id_is_unique_and_high_entropy():
    ids = {security.generate_session_id() for _ in range(1000)}
    assert len(ids) == 1000  # no collisions
    assert all(len(i) >= 40 for i in ids)  # token_urlsafe(32) -> ~43 chars


def test_hash_session_id_is_deterministic_and_hides_raw():
    raw = security.generate_session_id()
    assert security.hash_session_id(raw) == security.hash_session_id(raw)
    assert raw not in security.hash_session_id(raw)  # raw token not recoverable


def test_csrf_token_unique():
    assert security.generate_csrf_token() != security.generate_csrf_token()


def test_tokens_equal():
    assert security.tokens_equal("abc", "abc") is True
    assert security.tokens_equal("abc", "abd") is False
