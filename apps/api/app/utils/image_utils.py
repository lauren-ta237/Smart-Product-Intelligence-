from io import BytesIO
import math
from typing import Any, Optional

from PIL import Image


def crop_product_image(
    source_image_bytes: bytes,
    bounding_box: dict[str, Any],
    boundary_tolerance: float = 0.05,
) -> Optional[bytes]:
    """
    Crop one detected product from a source shelf image.

    The AI bounding box is expected to use normalized coordinates
    between 0 and 1:

        {
            "x": 0.142,
            "y": 0.141,
            "width": 0.134,
            "height": 0.785
        }

    Returns a JPEG-encoded crop, or None when the box/image is invalid.
    """
    try:
        if not source_image_bytes or not bounding_box:
            return None

        coordinates = {
            key: float(bounding_box[key])
            for key in ("x", "y", "width", "height")
        }
        if not all(math.isfinite(value) for value in coordinates.values()):
            return None

        x, y = coordinates["x"], coordinates["y"]
        width, height = coordinates["width"], coordinates["height"]
        if width <= 0 or height <= 0:
            return None
        if (
            x < -boundary_tolerance
            or y < -boundary_tolerance
            or x > 1 + boundary_tolerance
            or y > 1 + boundary_tolerance
            or width > 1 + boundary_tolerance
            or height > 1 + boundary_tolerance
            or x + width > 1 + boundary_tolerance
            or y + height > 1 + boundary_tolerance
        ):
            return None

        x_min_norm = max(0.0, min(1.0, x))
        y_min_norm = max(0.0, min(1.0, y))
        x_max_norm = max(0.0, min(1.0, x + width))
        y_max_norm = max(0.0, min(1.0, y + height))
        if x_max_norm <= x_min_norm or y_max_norm <= y_min_norm:
            return None

        with Image.open(BytesIO(source_image_bytes)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                return None
            source.load()
            image = source.convert("RGB")
            image_width, image_height = image.size
            box = (
                max(0, min(image_width, round(x_min_norm * image_width))),
                max(0, min(image_height, round(y_min_norm * image_height))),
                max(0, min(image_width, round(x_max_norm * image_width))),
                max(0, min(image_height, round(y_max_norm * image_height))),
            )
            if box[2] <= box[0] or box[3] <= box[1]:
                return None

            output = BytesIO()
            image.crop(box).save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue()
    except (KeyError, TypeError, ValueError, OSError, OverflowError):
        return None
