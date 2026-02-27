# Agent Context — SPEC-10: Real-Time Doubt Chat

## Your Task
Build a real-time batch-isolated WebSocket doubt chat in FastAPI. Implement `ConnectionManager` to group connections by `batch_id`. Persist all messages to Supabase. Build the React `DoubtChat` component with inline KaTeX math rendering, image upload support, and audio voice note playback.

## Pre-Conditions
- SPEC-09 done: `Batch` model exists; `get_student_batch_id` dependency available
- SPEC-05 done: ImageKit configured for audio voice note uploads

## Files to Create

### `backend/app/routers/doubt_chat.py`

#### ConnectionManager Class
```python
class ConnectionManager:
    def __init__(self):
        self._connections: Dict[int, List[WebSocket]] = {}  # {batch_id: [ws, ...]}

    async def connect(self, ws: WebSocket, batch_id: int):
        await ws.accept()
        self._connections.setdefault(batch_id, []).append(ws)

    def disconnect(self, ws: WebSocket, batch_id: int):
        self._connections.get(batch_id, []).remove(ws)

    async def broadcast(self, message: dict, batch_id: int):
        for ws in self._connections.get(batch_id, []):
            try: await ws.send_json(message)
            except: pass  # Ignore dead connections

    def online_count(self, batch_id: int) -> int:
        return len(self._connections.get(batch_id, []))

manager = ConnectionManager()
```

#### WebSocket Endpoint — `WS /doubt/ws/{batch_id}?token=JWT`
```
1. Verify Clerk JWT manually (no Depends — WebSocket can't use headers)
   → Close with code 4001 if invalid
2. manager.connect(ws, batch_id)
3. On connect: query last 50 DoubtMessages → send as {type:"history"} JSON
4. Event loop — receive JSON messages:
   - type=="message": save DoubtMessage → db.commit() → manager.broadcast({type:"message",...})
   - type=="resolve" (teacher/admin only): set msg.is_resolved=True → broadcast {type:"resolved", message_id}
   - type=="pin" (teacher/admin only): set msg.is_pinned=True → broadcast {type:"pinned", message_id}
5. On WebSocketDisconnect: manager.disconnect → broadcast system message
```

#### `POST /doubt/upload-image` (get_current_user)
Upload image to Supabase Storage `doubt-images` bucket. Return `{image_path, image_url}`.

### `frontend/src/pages/DoubtChat.jsx`
```jsx
// WebSocket URL: wss://api/doubt/ws/{batchId}?token={clerkJwt}
// On message type=="history": setMessages(data.messages)
// On message type=="message": append to messages list
// On message type=="resolved": update is_resolved flag in list

// Render messages: pass content through renderKaTeX()
// renderKaTeX(text): split on $$ and $ delimiters
//   → <BlockMath> for $$...$$, <InlineMath> for $...$

// Input bar: text input + Enter to send
// Show voice note audio player: <audio controls src={IK_ENDPOINT + audio_path} />
// Show doubt images inline: <img src={image_url} />
// Teacher sees "Resolve" and "Pin" buttons per message
```

## Install
```bash
npm install react-katex katex
```
Import `"katex/dist/katex.min.css"` in your CSS or main.jsx.

## Message Data Shape (JS → WS → DB)
```json
// Student sends:
{"type": "message", "content": "What is $\\int_0^\\infty e^{-x^2}dx$?"}

// Backend broadcasts:
{"type": "message", "message": {
  "id": 42, "sender_clerk_id": "user_xxx", "content": "...",
  "image_path": null, "audio_imagekit_path": null,
  "is_resolved": false, "is_pinned": false, "sent_at": "2026-02-01T...Z"
}}
```

## Security Pattern
The WebSocket URL uses `?token=ClerkJWT` as a query parameter because WebSocket clients in browsers cannot set custom HTTP headers. Extract it from `request.query_params["token"]` and verify with `jose.jwt.decode(...)`.

## Voice Note Flow
1. Student records and uploads audio to ImageKit via `MediaUploader` (reuse from SPEC-05 with `mediaType="audio"`)
2. After ImageKit upload success, send a WebSocket message with `{"type":"message","audio_path":"/edtech/..."}`
3. Backend saves `audio_imagekit_path` on `DoubtMessage`
4. All clients receive it and render `<audio>` element

## Done When
- [ ] Two browser tabs in the same batch see each other's messages in real time
- [ ] Student in Batch A cannot connect to `/doubt/ws/{batchB_id}`
- [ ] Messages persist after page reload (history loads on connect)
- [ ] `$\int_0^\infty$` renders as formatted math inline
- [ ] Teacher's "Resolve" action shows resolved badge for all connected clients
- [ ] Image upload displays inline in the chat

## Read Next
Full code: `docs/specs/SPEC-10-DOUBT-CHAT.md`
