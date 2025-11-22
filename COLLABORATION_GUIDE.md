# Excalidraw Collaboration Setup Guide

## ✅ Haan, Collaboration Add Kar Sakte Hain!

Excalidraw me built-in collaboration support hai. Iske liye aapko ek WebSocket-based backend server chahiye.

## Requirements

1. **Backend Server** - WebSocket server (Node.js, Python, ya koi bhi language)
2. **Database** (optional) - Drawing data store karne ke liye
3. **Authentication** (optional) - Users ko identify karne ke liye

## How It Works

Excalidraw collaboration ke liye yeh props use karta hai:
- `isCollaborating={true}` - Collaboration mode enable karta hai
- `onPointerUpdate` - Cursor/pointer movements track karta hai
- `onChange` - Drawing changes sync karta hai

## Implementation Steps

### Option 1: Simple WebSocket Server (Node.js)

```javascript
// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // roomId -> Set of clients

wss.on('connection', (ws) => {
  let roomId = null;
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'join') {
      roomId = data.roomId;
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(ws);
    }
    
    if (data.type === 'update') {
      // Broadcast to all clients in the room
      rooms.get(roomId)?.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'sync',
            elements: data.elements,
            appState: data.appState,
          }));
        }
      });
    }
  });
  
  ws.on('close', () => {
    if (roomId) {
      rooms.get(roomId)?.delete(ws);
    }
  });
});
```

### Option 2: Use Existing Services

1. **Socket.io** - Popular WebSocket library
2. **Pusher** - Real-time messaging service
3. **Ably** - Real-time infrastructure
4. **Firebase Realtime Database** - Google ka service

## Next.js Client Side Implementation

```tsx
'use client';

import { useState, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function CollaborativeExcalidraw() {
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [roomId] = useState(() => {
    // Get roomId from URL or generate new one
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room') || Math.random().toString(36).substring(7);
    }
    return 'default-room';
  });

  useEffect(() => {
    // Connect to WebSocket server
    const websocket = new WebSocket('ws://localhost:8080');
    
    websocket.onopen = () => {
      console.log('Connected to collaboration server');
      websocket.send(JSON.stringify({
        type: 'join',
        roomId: roomId
      }));
      setIsCollaborating(true);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sync') {
        // Update Excalidraw with received data
        // You'll need to use excalidrawAPI here
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      setIsCollaborating(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [roomId]);

  const handleChange = (elements: any, appState: any, files: any) => {
    // Send changes to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'update',
        roomId: roomId,
        elements: elements,
        appState: appState,
      }));
    }
  };

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div style={{ padding: "10px", background: "#f0f0f0" }}>
        <p>Room ID: {roomId}</p>
        <p>Status: {isCollaborating ? "🟢 Connected" : "🔴 Disconnected"}</p>
      </div>
      <Excalidraw
        isCollaborating={isCollaborating}
        onChange={handleChange}
        onPointerUpdate={(payload) => {
          // Send pointer updates for cursor tracking
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'pointer',
              roomId: roomId,
              pointer: payload.pointer,
            }));
          }
        }}
      />
    </div>
  );
}
```

## Quick Start with Socket.io

### 1. Install Dependencies

```bash
npm install socket.io-client
```

### 2. Server Setup (separate project)

```bash
mkdir excalidraw-collab-server
cd excalidraw-collab-server
npm init -y
npm install socket.io express
```

### 3. Server Code

```javascript
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('drawing-update', (data) => {
    socket.to(data.roomId).emit('drawing-update', data);
  });

  socket.on('pointer-update', (data) => {
    socket.to(data.roomId).emit('pointer-update', data);
  });
});

server.listen(3001, () => {
  console.log('Collaboration server running on port 3001');
});
```

## Important Notes

1. **Security**: Production me authentication add karein
2. **Scalability**: Multiple rooms handle karne ke liye proper architecture
3. **Data Persistence**: Drawings save karne ke liye database use karein
4. **Error Handling**: Network errors handle karein
5. **Optimization**: Only changes send karein, full state nahi

## Next Steps

1. Backend server setup karein
2. WebSocket connection implement karein
3. Room-based collaboration add karein
4. User authentication (optional)
5. Drawing persistence (optional)

## Resources

- [Excalidraw Collaboration Docs](https://docs.excalidraw.com)
- [Socket.io Documentation](https://socket.io/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

