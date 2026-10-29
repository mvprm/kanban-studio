import hashlib
import hmac
import secrets


def _scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


def hash_password(password: str) -> str:
    """Return a salted scrypt hash as "scrypt$<salt hex>$<hash hex>"."""
    salt = secrets.token_bytes(16)
    return f"scrypt${salt.hex()}${_scrypt(password, salt).hex()}"


def verify_password(password: str, stored: str) -> bool:
    _, salt, digest = stored.split("$")
    return hmac.compare_digest(_scrypt(password, bytes.fromhex(salt)).hex(), digest)
