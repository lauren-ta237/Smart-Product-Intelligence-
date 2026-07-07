import uuid

class AuditLogger:
    """
    Tracks important actions.
    Example:
    Vendor approved product
    Vendor edited AI result
    """
    async def log(
        self,
        user_id,
        action,
        resource
    ):
        print(
            {
                "user": user_id,
                "action": action,
                "resource": resource
            }
        )