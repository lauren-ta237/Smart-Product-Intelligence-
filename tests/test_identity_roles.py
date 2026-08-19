from app.modules.identity.models import UserRole
from app.modules.identity.schemas import UserCreate


def test_registration_role_is_normalized_to_db_enum_values():
    payload = UserCreate(email="user@example.com", password="password123", role="buyer")

    assert payload.role == UserRole.BUYER
    assert payload.role.value == "BUYER"
