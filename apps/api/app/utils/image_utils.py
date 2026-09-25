import os
from pathlib import Path
from typing import Any, Optional

from PIL import Image


def crop_product_image(
    source_image_path: str,
    bounding_box: dict[str, Any],
    output_dir: str,
    product_id: str,
) -> Optional[str]:
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

    Returns:
        URL path that can be stored in PostgreSQL and consumed
        by the React frontend.

        Example:
            /static/cropped/cropped_<uuid>.jpg

    Returns None if cropping fails.
    """

    try:
        if not source_image_path:
            raise ValueError("Source image path is empty.")

        if not bounding_box:
            raise ValueError("Bounding box is empty.")

        # ---------------------------------------------------------
        # 1. Verify source image exists
        # ---------------------------------------------------------
        source_path = Path(source_image_path)

        if not source_path.exists():
            raise FileNotFoundError(
                f"Source image does not exist: {source_path}"
            )

        # ---------------------------------------------------------
        # 2. Read normalized bounding box
        # ---------------------------------------------------------
        x = float(bounding_box.get("x", 0))
        y = float(bounding_box.get("y", 0))
        width = float(bounding_box.get("width", 0))
        height = float(bounding_box.get("height", 0))

        # ---------------------------------------------------------
        # 3. Validate bounding box
        # ---------------------------------------------------------
        if width <= 0 or height <= 0:
            raise ValueError(
                f"Invalid bounding box dimensions: {bounding_box}"
            )

        # Clamp coordinates to the valid normalized range.
        x = max(0.0, min(1.0, x))
        y = max(0.0, min(1.0, y))

        width = max(0.0, min(1.0 - x, width))
        height = max(0.0, min(1.0 - y, height))

        if width <= 0 or height <= 0:
            raise ValueError(
                f"Bounding box falls outside image boundaries: {bounding_box}"
            )

        # ---------------------------------------------------------
        # 4. Open original image
        # ---------------------------------------------------------
        with Image.open(source_path) as img:

            # Convert to RGB because JPEG cannot store RGBA/P modes.
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            elif img.mode == "L":
                img = img.convert("RGB")

            image_width, image_height = img.size

            # -----------------------------------------------------
            # 5. Convert normalized coordinates to pixels
            # -----------------------------------------------------
            x_min = int(round(x * image_width))
            y_min = int(round(y * image_height))

            x_max = int(round((x + width) * image_width))
            y_max = int(round((y + height) * image_height))

            # Final safety clamp.
            x_min = max(0, min(image_width, x_min))
            y_min = max(0, min(image_height, y_min))
            x_max = max(0, min(image_width, x_max))
            y_max = max(0, min(image_height, y_max))

            if x_max <= x_min or y_max <= y_min:
                raise ValueError(
                    f"Calculated crop is invalid: "
                    f"({x_min}, {y_min}, {x_max}, {y_max})"
                )

            # -----------------------------------------------------
            # 6. Crop product
            # -----------------------------------------------------
            cropped_img = img.crop(
                (
                    x_min,
                    y_min,
                    x_max,
                    y_max,
                )
            )

            # -----------------------------------------------------
            # 7. Make sure output directory exists
            # -----------------------------------------------------
            output_path = Path(output_dir)
            output_path.mkdir(
                parents=True,
                exist_ok=True,
            )

            # -----------------------------------------------------
            # 8. Generate unique filename
            # -----------------------------------------------------
            output_filename = f"cropped_{product_id}.jpg"
            final_file_path = output_path / output_filename

            # -----------------------------------------------------
            # 9. Save cropped image
            # -----------------------------------------------------
            cropped_img.save(
                final_file_path,
                format="JPEG",
                quality=90,
                optimize=True,
            )

            print(
                f"[IMAGE CROP] Successfully cropped product "
                f"{product_id}: {final_file_path}"
            )

            # -----------------------------------------------------
            # 10. Return frontend URL
            # -----------------------------------------------------
            return f"/static/cropped/{output_filename}"

    except Exception as exc:
        print(
            f"[IMAGE CROP ERROR] Could not crop product "
            f"{product_id}: {exc}"
        )
        return None
