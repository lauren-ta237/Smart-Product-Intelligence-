from fastapi import HTTPException, status


class AppException(Exception):

    def __init__(
        self,
        message: str,
        code: str = "internal_error"
    ):

        self.message = message
        self.code = code



def raise_not_found(
    resource: str
):

    raise HTTPException(

        status_code=status.HTTP_404_NOT_FOUND,

        detail={
            "error": f"{resource} not found"
        }

    )