# SPEC-10 — Real-Time Doubt Chat

| Field | Value |
|-------|-------|
| **Module** | WebSocket Doubt Chat, Message Persistence, Audio Notes, KaTeX, Moderation |
| **Phase** | Phase 2 |
| **Week** | Week 5 (Days 4–7) |
| **PRD Refs** | DOUBT-01, DOUBT-02, DOUBT-03, DOUBT-04, DOUBT-05, DOUBT-06 |
| **Depends On** | SPEC-09 (Batch Cohorts), SPEC-05 (ImageKit — for audio voice notes) |

---

## 1. Overview

The doubt chat is a real-time, batch-isolated WebSocket channel built in FastAPI. Each batch has its own isolated connection pool. Messages are persisted to Supabase via SQLAlchemy inside the WebSocket handler. Teachers can pin, resolve, and delete messages. Students can attach images (via Supabase Storage) and voice note audio (via ImageKit). KaTeX-formatted equations render inline for all participants.

---

## 2. Backend — `backend/app/routers/doubt_chat.py`

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List
from datetime import datetime
import json
from app.database import SessionLocal
from app.models.doubt import DoubtMessage
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/doubt", tags=["doubt_chat"])

# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections grouped by batch_id."""

    def __init__(self):
        # { batch_id: [websocket, ...] }
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, batch_id: int):
        await websocket.accept()
        if batch_id not in self._connections:
            self._connections[batch_id] = []
        self._connections[batch_id].append(websocket)

    def disconnect(self, websocket: WebSocket, batch_id: int):
        if batch_id in self._connections:
            self._connections[batch_id].remove(websocket)

    async def broadcast(self, message: dict, batch_id: int):
        """Sends a message to all connected clients in the same batch."""
        connections = self._connections.get(batch_id, [])
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                pass  # Dead connection — will be removed on next disconnect

    def online_count(self, batch_id: int) -> int:
        return len(self._connections.get(batch_id, []))

manager = ConnectionManager()

# ── WebSocket Endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/{batch_id}")
async def websocket_endpoint(websocket: WebSocket, batch_id: int, token: str):
    """
    WebSocket endpoint. Token is passed as a query parameter because WebSocket
    clients don't support custom headers in most browsers.
    URL: ws://api/doubt/ws/{batch_id}?token=<clerk_jwt>
    """
    # Verify Clerk JWT manually (WebSocket doesn't use FastAPI's Depends)
    from app.dependencies.auth import _get_jwks
    from jose import jwt as jose_jwt, JWTError
    try:
        payload = jose_jwt.decode(
            token, _get_jwks(), algorithms=["RS256"], options={"verify_aud": False}
        )
        clerk_id = payload["sub"]
        role = payload.get("publicMetadata", {}).get("role", "student")
    except (JWTError, KeyError):
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, batch_id)

    # Send last 50 messages on connect (message history)
    db = SessionLocal()
    try:
        history = (
            db.query(DoubtMessage)
            .filter(DoubtMessage.batch_id == batch_id)
            .order_by(DoubtMessage.sent_at.desc())
            .limit(50)
            .all()
        )
        await websocket.send_json({
            "type": "history",
            "messages": [_serialize_message(m) for m in reversed(history)],
            "online": manager.online_count(batch_id),
        })
    finally:
        db.close()

    try:
        while True:
            data = await websocket.receive_text()
            payload_data = json.loads(data)

            db = SessionLocal()
            try:
                msg_type = payload_data.get("type", "message")

                if msg_type == "message":
                    # Persist to database
                    msg = DoubtMessage(
                        batch_id=batch_id,
                        sender_clerk_id=clerk_id,
                        content=payload_data.get("content", ""),
                        image_path=payload_data.get("image_path"),
                        audio_imagekit_path=payload_data.get("audio_path"),
                    )
                    db.add(msg)
                    db.commit()
                    db.refresh(msg)

                    # Broadcast to all batch members
                    await manager.broadcast(
                        {"type": "message", "message": _serialize_message(msg)},
                        batch_id,
                    )

                elif msg_type == "resolve" and role in ["teacher", "admin"]:
                    msg_id = payload_data.get("message_id")
                    msg = db.query(DoubtMessage).filter(DoubtMessage.id == msg_id).first()
                    if msg:
                        msg.is_resolved = True
                        db.commit()
                        await manager.broadcast(
                            {"type": "resolved", "message_id": msg_id}, batch_id
                        )

                elif msg_type == "pin" and role in ["teacher", "admin"]:
                    msg_id = payload_data.get("message_id")
                    msg = db.query(DoubtMessage).filter(DoubtMessage.id == msg_id).first()
                    if msg:
                        msg.is_pinned = True
                        db.commit()
                        await manager.broadcast(
                            {"type": "pinned", "message_id": msg_id}, batch_id
                        )
            finally:
                db.close()

    except WebSocketDisconnect:
        manager.disconnect(websocket, batch_id)
        await manager.broadcast(
            {"type": "system", "content": f"A user has left the chat.", "online": manager.online_count(batch_id)},
            batch_id,
        )

def _serialize_message(msg: DoubtMessage) -> dict:
    return {
        "id": msg.id,
        "sender_clerk_id": msg.sender_clerk_id,
        "content": msg.content,
        "image_path": msg.image_path,
        "audio_imagekit_path": msg.audio_imagekit_path,
        "is_resolved": msg.is_resolved,
        "is_pinned": msg.is_pinned,
        "sent_at": msg.sent_at.isoformat(),
    }

# ── REST: Image Upload for Doubt ──────────────────────────────────────────────

@router.post("/upload-image")
async def upload_doubt_image(
    file: UploadFile = File(...),
    batch_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Uploads an image (handwritten problem photo) to Supabase Storage."""
    from supabase import create_client
    from app.config import settings
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    path = f"doubt-images/{batch_id}/{datetime.utcnow().timestamp()}_{file.filename}"
    content = await file.read()
    supabase.storage.from_("doubt-images").upload(
        path=path, file=content,
        file_options={"content-type": file.content_type, "upsert": "true"},
    )
    url = supabase.storage.from_("doubt-images").get_public_url(path)
    return {"image_path": path, "image_url": url}
```

---

## 3. Frontend — Doubt Chat Component

### `frontend/src/pages/DoubtChat.jsx`

```jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useFetch } from "../hooks/useFetch";
import { InlineMath, BlockMath } from "react-katex";
import { MediaUploader } from "../components/MediaUploader";
import "katex/dist/katex.min.css";

const API_URL = import.meta.env.VITE_API_URL.replace("https://", "wss://").replace("http://", "ws://");

export default function DoubtChat({ batchId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [online, setOnline] = useState(0);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const { getToken } = useAuth();

  useEffect(() => {
    let ws;
    getToken().then((token) => {
      ws = new WebSocket(`${API_URL}/doubt/ws/${batchId}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "history") {
          setMessages(data.messages);
          setOnline(data.online);
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === "resolved") {
          setMessages((prev) =>
            prev.map((m) => m.id === data.message_id ? { ...m, is_resolved: true } : m)
          );
        }
      };
    });
    return () => ws?.close();
  }, [batchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "message", content: input }));
    setInput("");
  };

  const renderContent = (content) => {
    // Render LaTeX: $inline$ or $$block$$
    const parts = content.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        return <BlockMath key={i} math={part.slice(2, -2)} />;
      } else if (part.startsWith("$") && part.endsWith("$")) {
        return <InlineMath key={i} math={part.slice(1, -1)} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh] border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center">
        <h2 className="font-semibold">Batch Doubt Chat</h2>
        <span className="text-sm text-indigo-200">🟢 {online} online</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.is_pinned ? "bg-yellow-50 px-2 py-1 rounded-lg" : ""}`}>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-gray-500">{msg.sender_clerk_id.slice(0, 8)}</span>
                {msg.is_resolved && <span className="text-xs text-green-600">✓ Resolved</span>}
                {msg.is_pinned && <span className="text-xs text-yellow-600">📌</span>}
              </div>
              <div className="text-sm text-gray-800 mt-0.5">{renderContent(msg.content)}</div>
              {msg.image_path && (
                <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/doubt-images/${msg.image_path}`}
                  alt="doubt" className="mt-2 max-w-xs rounded-lg" />
              )}
              {msg.audio_imagekit_path && (
                <audio controls src={`${import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT}${msg.audio_imagekit_path}`}
                  className="mt-2 h-10 w-full" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask a doubt... (use $equation$ for LaTeX)"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button onClick={sendMessage}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Send
        </button>
      </div>
    </div>
  );
}
```

---

## 4. KaTeX Installation

```bash
npm install react-katex katex
```

LaTeX renders with `$inline$` and `$$block$$` syntax inside messages — the rendering is client-side only.

---

## 5. Audio Voice Notes

Voice notes reuse the `MediaUploader` (SPEC-05). The `audio_imagekit_path` is sent as part of the WebSocket `message` payload after the upload succeeds.

---

## 6. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `WS` | `/doubt/ws/{batch_id}?token=JWT` | Clerk JWT (query param) | Real-time doubt chat channel |
| `POST` | `/doubt/upload-image` | JWT | Upload image to Supabase Storage |

---

## 7. Implementation Steps

| Day | Task |
|-----|------|
| Day 4 | Write `ConnectionManager` class and WebSocket endpoint in FastAPI. Test with wscat. |
| Day 5 | Add message persistence to Supabase inside WebSocket handler. |
| Day 6 | Build React `DoubtChat` component. Wire WebSocket client. Test message send/receive. |
| Day 7 | Add KaTeX rendering. Add image upload endpoint. Add audio voice note support via ImageKit. |

---

## 8. Acceptance Criteria

- [ ] Two browser tabs in the same batch see each other's messages in real time
- [ ] A browser tab in Batch A cannot connect to Batch B's WebSocket
- [ ] Messages persist in `doubt_messages` table after page reload
- [ ] LaTeX `$\int_0^\infty$` renders as a formatted equation
- [ ] Image uploads display inline in the chat
- [ ] Audio voice notes play inline via the native `<audio>` element
- [ ] Teacher can resolve a message and the resolved badge appears for all users

---

## 9. Environment Variables Introduced

No new variables.
