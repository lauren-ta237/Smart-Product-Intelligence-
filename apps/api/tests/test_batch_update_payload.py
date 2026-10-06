from app.modules.catalog.router import normalize_batch_payload


def test_normalize_batch_payload_accepts_plain_product_list():
    payload = [
        {
            "name": "Fresh Papaya",
            "price": 5.0,
            "image_url": "uploads/demo.jpg",
            "approved": True,
        }
    ]

    normalized = normalize_batch_payload(payload)

    assert normalized.products[0].name == "Fresh Papaya"
    assert normalized.products[0].price == 5.0
    assert normalized.image_url is None
