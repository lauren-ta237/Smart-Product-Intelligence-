from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
from PIL import Image
from fastapi import BackgroundTasks, HTTPException
from starlette.datastructures import Headers, UploadFile

import cloudinary.uploader

from app.core.config.settings import settings
from app.modules.catalog.models import DetectedProduct
from app.modules.catalog.router import resolve_product_image_fields
from app.modules.intelligence.router import run_background_analysis, start_single_analysis
from app.modules.intelligence.models import AnalysisStatus
from app.modules.intelligence.service import IntelligenceService
from app.modules.intelligence.schemas import DetectedProductResponse
from app.modules.products.schemas import ProductResponse
from app.modules.media import router as media_router
from app.modules.media import cloudinary_storage
from app.modules.media.cloudinary_storage import CloudinaryStorage
from app.modules.media.models import ImageStatus


class FakeDatabase:
    def __init__(self):
        self.added = []
        self.results = []
        self.commits = 0

    def add(self, record):
        self.added.append(record)

    async def commit(self):
        self.commits += 1

    async def refresh(self, record):
        pass

    async def rollback(self):
        pass

    async def execute(self, statement):
        return self.results.pop(0)


class FakeResult:
    def __init__(self, result):
        self.result = result

    def scalar_one_or_none(self):
        return self.result


class FakeMediaService:
    def __init__(self, db):
        self.db = db

    async def upload_image(self, vendor_id, file, commit=True):
        now = datetime.now(timezone.utc)
        return SimpleNamespace(
            id=uuid4(),
            vendor_id=vendor_id,
            storage_url="https://res.cloudinary.com/example/image/upload/original.jpg",
            file_name=file.filename,
            status="uploaded",
            width=None,
            height=None,
            mime_type=file.content_type,
            created_at=now,
            updated_at=now,
        )

    async def delete(self, storage_url):
        pass


@pytest.mark.asyncio
async def test_upload_creates_one_analysis_and_schedules_one_task(monkeypatch):
    monkeypatch.setattr(media_router, "MediaService", FakeMediaService)
    db = FakeDatabase()
    background_tasks = BackgroundTasks()
    vendor_id = uuid4()
    upload = UploadFile(
        filename="shelf.jpg",
        file=BytesIO(b"image bytes"),
        headers=Headers({"content-type": "image/jpeg", "content-length": "11"}),
    )

    result = await media_router.upload_media(
        background_tasks=background_tasks,
        file=upload,
        vendor_id=vendor_id,
        db=db,
    )

    assert len(db.added) == 1
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is run_background_analysis
    assert result["analysis_id"] == db.added[0].id


def test_detected_product_schema_exposes_stored_crop_url_as_crop_url():
    crop_url = "https://res.cloudinary.com/example/image/upload/crops/item.jpg"
    detected = DetectedProduct(
        id=uuid4(),
        analysis_id=uuid4(),
        name="Tomato tin",
        confidence_score=0.95,
        bounding_box={"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4},
        image_url="https://res.cloudinary.com/example/image/upload/original.jpg",
        cropped_image_url=crop_url,
    )

    response = DetectedProductResponse.model_validate(detected).model_dump(by_alias=True)

    assert response["crop_url"] == crop_url
    assert response["image_url"] == detected.image_url


def test_product_response_exposes_known_crop_path_and_preserves_original_fallback():
    fields = {
        "id": uuid4(),
        "name": "Product",
        "approved": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    crop_url = "https://res.cloudinary.com/test/image/upload/smart-product-ai/crops/item.jpg"
    crop_response = ProductResponse(**fields, image_url="uploads/original.jpg", crop_url=crop_url).model_dump()
    original_url = "uploads/old-original.jpg"
    old_response = ProductResponse(**fields, image_url=original_url, crop_url=None).model_dump()

    assert crop_response["crop_url"] == crop_url
    assert old_response["crop_url"] is None
    assert old_response["image_url"] == original_url


@pytest.mark.asyncio
async def test_product_crop_resolution_requires_exact_identity_and_box():
    vendor_id = uuid4()
    crop_product = SimpleNamespace(
        id=uuid4(),
        vendor_id=vendor_id,
        name="Smartwatch with Black Strap",
        image_url="uploads/source.jpg",
        bounding_box={"x": 0.457, "y": 0.252, "width": 0.151, "height": 0.224},
    )
    original_product = SimpleNamespace(
        id=uuid4(),
        vendor_id=vendor_id,
        name="Red Tomatoes",
        image_url="uploads/tomatoes.jpg",
        bounding_box={"x": 0, "y": 0.73, "width": 0.35, "height": 0.27},
    )
    blob_product = SimpleNamespace(
        id=uuid4(),
        vendor_id=vendor_id,
        name="Smartwatch (Black)",
        image_url="blob:http://localhost:5173/old-preview",
        bounding_box={"x": 0.44, "y": 0.27, "width": 0.17, "height": 0.22},
    )
    exact_detection = SimpleNamespace(
        name=crop_product.name,
        image_url=crop_product.image_url,
        bounding_box=dict(crop_product.bounding_box),
        cropped_image_url="/static/cropped/crop.jpg",
    )
    ambiguous_detection = SimpleNamespace(
        name=crop_product.name,
        image_url=crop_product.image_url,
        bounding_box={"x": 0.45, "y": 0.25, "width": 0.16, "height": 0.22},
        cropped_image_url="/static/cropped/other.jpg",
    )
    recovered_detection = SimpleNamespace(
        name=blob_product.name,
        image_url="uploads/source.jpg",
        bounding_box=dict(blob_product.bounding_box),
        cropped_image_url=None,
    )

    class CropResult:
        def all(self):
            return [
                (exact_detection, vendor_id),
                (ambiguous_detection, vendor_id),
                (recovered_detection, vendor_id),
            ]

    class CropDatabase:
        async def execute(self, statement):
            return CropResult()

    image_fields = await resolve_product_image_fields(
        CropDatabase(),
        [crop_product, original_product, blob_product],
    )

    assert image_fields[crop_product.id] == {"crop_url": "/static/cropped/crop.jpg"}
    assert blob_product.id in image_fields
    assert image_fields[blob_product.id] == {"image_url": "uploads/source.jpg"}
    assert original_product.id not in image_fields


@pytest.mark.asyncio
async def test_legacy_start_returns_existing_analysis_without_scheduling_another():
    image = SimpleNamespace(id=uuid4(), storage_url="uploads/original.jpg")
    analysis = SimpleNamespace(id=uuid4(), status=AnalysisStatus.PROCESSING)
    db = FakeDatabase()
    db.results = [FakeResult(image), FakeResult(analysis)]

    result = await start_single_analysis(
        image_id=str(image.id),
        vendor=uuid4(),
        db=db,
    )

    assert result["analysis_id"] == str(analysis.id)
    assert db.added == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_legacy_start_rejects_untracked_image_without_creating_analysis():
    image = SimpleNamespace(id=uuid4(), storage_url="uploads/original.jpg")
    db = FakeDatabase()
    db.results = [FakeResult(image), FakeResult(None)]

    with pytest.raises(HTTPException) as error:
        await start_single_analysis(
            image_id=str(image.id),
            vendor=uuid4(),
            db=db,
        )

    assert error.value.status_code == 409
    assert db.added == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_analysis_failure_persists_error_and_marks_image_failed():
    image_id = uuid4()
    analysis = SimpleNamespace(
        id=uuid4(),
        image_id=image_id,
        status=AnalysisStatus.PROCESSING,
        error_message=None,
        processing_time=None,
    )
    image = SimpleNamespace(status=ImageStatus.PROCESSING)
    db = FakeDatabase()
    db.results = [FakeResult(analysis), FakeResult(image)]
    service = IntelligenceService.__new__(IntelligenceService)
    service.db = db

    result = await service._mark_failed(analysis.id, 1.0, "ValueError: invalid image")

    assert result.status == AnalysisStatus.FAILED
    assert result.error_message == "ValueError: invalid image"
    assert image.status == ImageStatus.FAILED
    assert db.commits == 1


@pytest.mark.asyncio
async def test_analysis_uploads_backend_crop_and_persists_crop_url():
    source = BytesIO()
    Image.new("RGB", (100, 80), (0, 180, 0)).save(source, format="PNG")
    analysis = SimpleNamespace(
        id=uuid4(),
        image_url="https://storage.example/original.png",
        status=AnalysisStatus.PROCESSING,
        detected_count=0,
        processing_time=None,
        error_message=None,
    )

    class FakeProcessor:
        async def process_image(self, image, context):
            return {
                "products": [{
                    "name": "Green product",
                    "confidence_score": 0.95,
                    "bounding_box": {"x": 0.1, "y": 0.25, "width": 0.5, "height": 0.5},
                }]
            }

    class FakeMedia:
        uploaded = []

        async def download(self, storage_url):
            assert storage_url == analysis.image_url
            return source.getvalue()

        async def upload_bytes(self, contents, filename, content_type, folder=""):
            self.uploaded.append((contents, filename, content_type, folder))
            return "https://storage.example/crops/generated.jpg"

    db = FakeDatabase()
    db.results = [FakeResult(analysis)]
    image = SimpleNamespace(
        id=uuid4(),
        storage_url=analysis.image_url,
        mime_type="image/png",
        status=ImageStatus.PROCESSING,
    )
    service = IntelligenceService.__new__(IntelligenceService)
    service.db = db
    service.processor = FakeProcessor()
    service.media = FakeMedia()
    service._match_product_pg_trgm = AsyncMock(return_value=None)

    result = await service.analyze(image, SimpleNamespace(), str(analysis.id))

    assert result.status == AnalysisStatus.COMPLETED
    assert image.status == ImageStatus.COMPLETED
    assert len(service.media.uploaded) == 1
    crop_bytes, filename, content_type, folder = service.media.uploaded[0]
    assert filename.endswith(".jpg")
    assert content_type == "image/jpeg"
    assert folder == "crops"
    with Image.open(BytesIO(crop_bytes)) as crop:
        assert crop.format == "JPEG"
        assert crop.size == (50, 40)
    detected_product = db.added[0]
    assert detected_product.cropped_image_url == "https://storage.example/crops/generated.jpg"


@pytest.mark.asyncio
async def test_cloudinary_storage_adapter_upload_download_delete_without_network(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "test-cloud")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "test-key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "test-secret")
    uploaded = {}
    deleted = []

    def fake_upload(stream, **options):
        uploaded.update(options)
        assert stream.read() == b"crop-bytes"
        return {
            "secure_url": (
                "https://res.cloudinary.com/test-cloud/image/upload/v1/"
                f"{options['folder']}/{options['public_id']}.jpg"
            )
        }

    def fake_destroy(public_id, **options):
        deleted.append((public_id, options))

    class DownloadResponse(BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.close()

    monkeypatch.setattr(cloudinary.uploader, "upload", fake_upload)
    monkeypatch.setattr(cloudinary.uploader, "destroy", fake_destroy)
    monkeypatch.setattr(
        cloudinary_storage,
        "urlopen",
        lambda url, timeout: DownloadResponse(b"original-bytes"),
    )
    storage = CloudinaryStorage()

    crop_url = await storage.upload_bytes(b"crop-bytes", "crop.jpg", "image/jpeg", "crops")
    original_bytes = await storage.download(
        "https://res.cloudinary.com/test-cloud/image/upload/v1/source.jpg"
    )
    await storage.delete(crop_url)

    assert crop_url.startswith("https://res.cloudinary.com/")
    assert original_bytes == b"original-bytes"
    assert uploaded["resource_type"] == "image"
    assert uploaded["folder"] == "smart-product-ai/crops"
    assert deleted == [
        (f"smart-product-ai/crops/{uploaded['public_id']}", {"resource_type": "image"})
    ]