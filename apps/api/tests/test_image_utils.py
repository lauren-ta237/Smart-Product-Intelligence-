from io import BytesIO

from PIL import Image
import pytest

from app.core.config.settings import settings
from app.modules.media.local_storage import LocalStorage
from app.utils.image_utils import crop_product_image


def test_crop_product_image_returns_jpeg_bytes_for_normalized_box():
    source = BytesIO()
    Image.new("RGBA", (100, 80), (255, 0, 0, 255)).save(source, format="PNG")

    cropped = crop_product_image(
        source.getvalue(),
        {"x": 0.1, "y": 0.25, "width": 0.5, "height": 0.5},
    )

    assert cropped is not None
    with Image.open(BytesIO(cropped)) as image:
        assert image.format == "JPEG"
        assert image.size == (50, 40)


def test_crop_product_image_rejects_non_finite_and_empty_boxes():
    source = BytesIO()
    Image.new("RGB", (20, 20)).save(source, format="JPEG")

    assert crop_product_image(
        source.getvalue(),
        {"x": float("nan"), "y": 0, "width": 0.5, "height": 0.5},
    ) is None
    assert crop_product_image(
        source.getvalue(),
        {"x": 0, "y": 0, "width": 0, "height": 0.5},
    ) is None
    assert crop_product_image(
        source.getvalue(),
        {"x": 0.9, "y": 0.1, "width": 0.5, "height": 0.5},
    ) is None


def test_crop_product_image_clamps_small_boundary_overshoot():
    source = BytesIO()
    Image.new("RGB", (20, 20)).save(source, format="JPEG")

    cropped = crop_product_image(
        source.getvalue(),
        {"x": 0.9, "y": 0.9, "width": 0.14, "height": 0.14},
    )

    assert cropped is not None
    with Image.open(BytesIO(cropped)) as image:
        assert image.size == (2, 2)


@pytest.mark.asyncio
async def test_local_storage_upload_download_delete_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    storage = LocalStorage()

    class UploadedFile:
        content_type = "image/jpeg"

        async def read(self):
            return b"original-bytes"

    storage_url = await storage.upload(UploadedFile(), "source.jpg")

    assert await storage.download(storage_url) == b"original-bytes"
    await storage.delete(storage_url)
    with pytest.raises(FileNotFoundError):
        await storage.download(storage_url)