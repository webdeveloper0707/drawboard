'use client';

import { useState, useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { io, Socket } from "socket.io-client";
import "@excalidraw/excalidraw/index.css";

export default function CollaborativeExcalidraw() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const socketRef = useRef<Socket | null>(null);

  // Get or create room ID from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoomId = params.get('room');
      if (urlRoomId) {
        setRoomId(urlRoomId);
      } else {
        // Generate new room ID
        const newRoomId = Math.random().toString(36).substring(7);
        setRoomId(newRoomId);
        // Update URL without reload
        window.history.replaceState({}, '', `?room=${newRoomId}`);
      }
    }
  }, []);

  // Socket.io connection setup
  useEffect(() => {
    if (!roomId) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    
    setConnectionStatus("connecting");
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Connected to collaboration server');
      socket.emit('join-room', roomId);
      setIsCollaborating(true);
      setConnectionStatus("connected");
      socketRef.current = socket;
    });

    socket.on('disconnect', () => {
      console.log('🔴 Disconnected from collaboration server');
      setConnectionStatus("disconnected");
      setIsCollaborating(false);
      socketRef.current = null;
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
      setConnectionStatus("disconnected");
      setIsCollaborating(false);
    });

    // Listen for drawing updates from other users
    socket.on('drawing-update', (data) => {
      if (excalidrawAPI && data.userId !== socket.id) {
        // Update Excalidraw with received data
        excalidrawAPI.updateScene({
          elements: data.elements,
          appState: data.appState,
        });
      }
    });

    // Listen for pointer updates (cursor tracking)
    socket.on('pointer-update', (data) => {
      // Excalidraw handles pointer updates internally when isCollaborating is true
      // This is just for logging/debugging
      if (data.userId !== socket.id) {
        console.log('Pointer update from user:', data.userId);
      }
    });

    // Listen for user join/leave events
    socket.on('user-joined', (data) => {
      console.log('User joined room:', data.userId);
    });

    socket.on('user-left', (data) => {
      console.log('User left room:', data.userId);
    });

    socketRef.current = socket;

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [roomId, excalidrawAPI]);

  // Handle drawing changes
  const handleChange = (elements: any, appState: any, files: any) => {
    // Send changes to server via Socket.io
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('drawing-update', {
        roomId: roomId,
        elements: elements,
        appState: appState,
      });
    }
  };

  // Handle pointer updates (cursor tracking)
  const handlePointerUpdate = (payload: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "down" | "up";
    pointersMap: any;
  }) => {
    // Send pointer updates for cursor tracking
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('pointer-update', {
        roomId: roomId,
        pointer: payload.pointer,
        button: payload.button,
      });
    }
  };

  // Copy room link to clipboard
  const copyRoomLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    alert('Room link copied! Share this with others to collaborate.');
  };

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      {/* Collaboration Status Bar */}
      <div style={{ 
        padding: "10px", 
        background: "#f0f0f0",
        borderBottom: "1px solid #ddd",
        display: "flex",
        gap: "15px",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div>
            <strong>Room ID:</strong> {roomId}
          </div>
          <div>
            <strong>Status:</strong> 
            <span style={{ 
              marginLeft: "5px",
              color: connectionStatus === "connected" ? "green" : 
                     connectionStatus === "connecting" ? "orange" : "red"
            }}>
              {connectionStatus === "connected" ? "🟢 Connected" : 
               connectionStatus === "connecting" ? "🟡 Connecting..." : 
               "🔴 Disconnected"}
            </span>
          </div>
        </div>
        <button 
          onClick={copyRoomLink}
          style={{ 
            padding: "8px 16px", 
            cursor: "pointer",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px"
          }}
        >
          📋 Copy Room Link
        </button>
      </div>

      {/* Excalidraw Component */}
      <div style={{ flex: 1, position: "relative" }}>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          isCollaborating={isCollaborating}
        />
      </div>

      {/* Info Box */}
      {connectionStatus === "disconnected" && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          padding: "15px",
          borderRadius: "8px",
          maxWidth: "400px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <strong>⚠️ Collaboration Not Active</strong>
          <p style={{ margin: "10px 0 0 0", fontSize: "14px" }}>
            Server start karein: <code>node server.js</code>
            <br />
            Ya <code>npm run dev:server</code> command use karein.
          </p>
        </div>
      )}
    </div>
  );
}

