import json
from typing import Dict, List
from fastapi import WebSocket

class AnalysisConnectionManager:
    """Manages active WebSocket connections mapped by vendor_id."""

    def __init__(self):
        # Maps vendor_id (str) -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, vendor_id: str, websocket: WebSocket):
        await websocket.accept()
        if vendor_id not in self.active_connections:
            self.active_connections[vendor_id] = []
        self.active_connections[vendor_id].append(websocket)
        print(f"[WS MANAGER 🔌] Connected socket for Vendor ID: {vendor_id}")

    def disconnect(self, vendor_id: str, websocket: WebSocket):
        if vendor_id in self.active_connections:
            self.active_connections[vendor_id].remove(websocket)
            if not self.active_connections[vendor_id]:
                del self.active_connections[vendor_id]
        print(f"[WS MANAGER 🔌] Disconnected socket for Vendor ID: {vendor_id}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_vendor(self, vendor_id: str, message: dict):
        """Broadcasts real-time events to all active tabs/sockets open by a vendor."""
        if vendor_id in self.active_connections:
            for connection in self.active_connections[vendor_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"[WS ERROR ⚠️] Failed pushing to socket: {e}")

ws_manager = AnalysisConnectionManager()