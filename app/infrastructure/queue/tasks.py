from app.infrastructure.queue.celery import celery_app

@celery_app.task(
    bind=True,
    max_retries=3
)
def analyze_product_image(
    self,
    image_id
):
    """
    Background AI worker.
    Retries automatically if:
    - AI provider fails
    - network fails
    """
    try:
        print(
            f"Processing {image_id}"
        )
        # Future:
        #
        # call AIProcessor
        #
        # save results

    except Exception as error:
        raise self.retry(
            exc=error,
            countdown=10
        )