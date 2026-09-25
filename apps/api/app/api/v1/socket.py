from fastapi import APIRouter, WebSocket

router = APIRouter()

@router.websocket(
    "/ws/analysis/{analysis_id}"
)
async def analysis_socket(
    websocket: WebSocket,
    analysis_id:str
):
    """
    Real-time AI progress.
    Frontend receives:
    queued
    processing
    completed
    """
    await websocket.accept()
    await websocket.send_json(
        {
        "analysis_id": analysis_id,
        "status": "processing"
        }
    )
    await websocket.close()