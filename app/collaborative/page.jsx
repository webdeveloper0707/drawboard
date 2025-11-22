'use client';

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { io } from "socket.io-client";
import "@excalidraw/excalidraw/index.css";

// Dynamic import with SSR disabled to avoid window is not defined error
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div style={{ 
        height: "100%", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#f5f5f5"
      }}>
        <div>Loading Excalidraw...</div>
      </div>
    ),
  }
);

export default function CollaborativeExcalidraw() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isMounted, setIsMounted] = useState(false);
  const [collaborators, setCollaborators] = useState(new Map());
  const socketRef = useRef(null);
  const lastSentElementsRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const isUpdatingFromServerRef = useRef(false); // Prevent update loops
  const userNameRef = useRef(`User-${Math.random().toString(36).substring(7)}`);
  const userColorRef = useRef(`#${Math.floor(Math.random()*16777215).toString(16)}`);

  // Ensure component is mounted on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

    // Auto-detect socket URL from current hostname for network access
    const getSocketURL = () => {
      if (typeof window !== 'undefined') {
        // Use environment variable if set, otherwise use current hostname
        if (process.env.NEXT_PUBLIC_SOCKET_URL) {
          return process.env.NEXT_PUBLIC_SOCKET_URL;
        }
        // Auto-detect: use same hostname as current page, but port 3001
        const currentHost = window.location.hostname;
        const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT || '3101';
        return `http://${currentHost}:${socketPort}`;
      }
      return 'http://localhost:3001';
    };

    const SOCKET_URL = getSocketURL();
    console.log('Connecting to Socket.io server:', SOCKET_URL);
    
    setConnectionStatus("connecting");
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('✅ Connected to collaboration server');
      // Send user info when joining
      socket.emit('join-room', {
        roomId: roomId,
        userName: userNameRef.current,
        userColor: userColorRef.current
      });
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

    // Listen for initial state when joining a room
    socket.on('initial-state', (data) => {
      if (excalidrawAPI && data.elements) {
        console.log('Received initial state:', data.elements.length, 'elements');
        // Use the server's state as source of truth
        isUpdatingFromServerRef.current = true;
        excalidrawAPI.updateScene({
          elements: data.elements
        });
        // Reset flag after a short delay to allow scene update to complete
        setTimeout(() => {
          isUpdatingFromServerRef.current = false;
        }, 100);
      }
    });

    // Listen for drawing updates from other users
    socket.on('drawing-update', (data) => {
      if (excalidrawAPI && data.userId !== socket.id && data.elements) {
        // Only update elements from other users
        const currentElements = excalidrawAPI.getSceneElements();
        
        // Merge incoming elements with current elements (don't replace!)
        const mergedElements = mergeElements(currentElements, data.elements);
        
        // Only update if merged result is different from current
        const currentElementsStr = JSON.stringify(currentElements);
        const mergedElementsStr = JSON.stringify(mergedElements);
        
        if (currentElementsStr !== mergedElementsStr) {
          // Set flag to prevent this update from triggering handleChange
          isUpdatingFromServerRef.current = true;
          // Update scene with merged elements (preserves both users' drawings)
          excalidrawAPI.updateScene({
            elements: mergedElements
          });
          // Reset flag after update completes
          setTimeout(() => {
            isUpdatingFromServerRef.current = false;
          }, 100);
        }
      }
    });

    // Listen for pointer updates (cursor tracking)
    socket.on('pointer-update', (data) => {
      if (data.userId !== socket.id && excalidrawAPI && data.pointer) {
        // Update collaborators map with pointer position
        setCollaborators(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            pointer: data.pointer,
            button: data.button,
            userName: data.userName || `User-${data.userId.substring(0, 5)}`,
            userColor: data.userColor || '#000000'
          });
          return newMap;
        });
      }
    });

    // Listen for user join/leave events
    socket.on('user-joined', (data) => {
      console.log('User joined room:', data.userId, data.userName);
      // Add user to collaborators
      setCollaborators(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, {
          userName: data.userName || `User-${data.userId.substring(0, 5)}`,
          userColor: data.userColor || '#000000',
          pointer: null,
          button: 'up'
        });
        return newMap;
      });
    });

    socket.on('user-left', (data) => {
      console.log('User left room:', data.userId);
      // Remove user from collaborators
      setCollaborators(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    });

    socketRef.current = socket;

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
      // Clear timeout on cleanup
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [roomId, excalidrawAPI]);

  // Note: Excalidraw manages collaborators internally when isCollaborating={true}
  // We don't need to manually set collaborators in appState
  // Pointer updates are handled through onPointerUpdate callback

  // Merge elements function - combines current and incoming elements intelligently
  // This ensures both users' drawings are preserved when they draw simultaneously
  const mergeElements = (currentElements, incomingElements) => {
    if (!incomingElements || incomingElements.length === 0) {
      return currentElements || [];
    }
    if (!currentElements || currentElements.length === 0) {
      return incomingElements;
    }

    // Create a map of all elements by ID for efficient lookup and merging
    const mergedMap = new Map();
    
    // First, add all current elements
    currentElements.forEach(element => {
      if (element && element.id) {
        mergedMap.set(element.id, element);
      }
    });

    // Then, process incoming elements - update existing or add new
    incomingElements.forEach(incomingElement => {
      if (!incomingElement || !incomingElement.id) return;
      
      const existingElement = mergedMap.get(incomingElement.id);

      if (existingElement) {
        // Element exists - decide which version to keep
        // Prefer the one with newer timestamp or higher version
        let shouldReplace = false;
        
        if (incomingElement.updatedAt && existingElement.updatedAt) {
          shouldReplace = incomingElement.updatedAt > existingElement.updatedAt;
        } else if (incomingElement.version !== undefined && existingElement.version !== undefined) {
          shouldReplace = incomingElement.version > existingElement.version;
        } else {
          // If no version info, prefer incoming (assumed more recent)
          shouldReplace = true;
        }
        
        if (shouldReplace) {
          mergedMap.set(incomingElement.id, incomingElement);
        }
      } else {
        // New element - add it
        mergedMap.set(incomingElement.id, incomingElement);
      }
    });

    // Convert map back to array
    return Array.from(mergedMap.values());
  };

  // Handle drawing changes with optimized debouncing for real-time updates
  const handleChange = (elements, appState, files) => {
    // Don't send update if we're currently updating from server (prevents loops)
    if (isUpdatingFromServerRef.current) {
      return;
    }

    if (!socketRef.current || !socketRef.current.connected || !elements) {
      return;
    }

    // Store current elements
    lastSentElementsRef.current = elements;

    // Clear previous timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Reduced debounce: Send update after 50ms for faster real-time feel
    // This ensures smooth collaboration while avoiding too many network calls
    updateTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && socketRef.current.connected) {
        // Only send if elements actually changed
        const elementsToSend = lastSentElementsRef.current;
        if (elementsToSend) {
          // Send all elements (server will handle state management)
          socketRef.current.emit('drawing-update', {
            roomId: roomId,
            elements: elementsToSend,
          });
        }
      }
    }, 50); // Reduced from 100ms to 50ms for faster updates
  };

  // Handle pointer updates (cursor tracking) - send frequently for smooth tracking
  const handlePointerUpdate = (payload) => {
    // Send pointer updates for cursor tracking with user info
    // No debouncing needed - cursor updates should be real-time
    if (socketRef.current && socketRef.current.connected && payload.pointer) {
      socketRef.current.emit('pointer-update', {
        roomId: roomId,
        pointer: payload.pointer,
        button: payload.button,
        userName: userNameRef.current,
        userColor: userColorRef.current
      });
    }
  };

  // Copy room link to clipboard with fallback method
  const copyRoomLink = async () => {
    if (typeof window === 'undefined') return;
    
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        alert('Room link copied! Share this with others to collaborate.');
        return;
      }
    } catch (err) {
      console.log('Clipboard API failed, trying fallback method');
    }
    
    // Fallback method: Create temporary input element
    try {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        alert('Room link copied! Share this with others to collaborate.');
      } else {
        // Last resort: show link in prompt
        prompt('Copy this room link:', link);
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Last resort: show link in prompt
      prompt('Copy this room link:', link);
    }
  };

  // Don't render until mounted on client
  if (!isMounted) {
    return (
      <div style={{ 
        height: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#f5f5f5"
      }}>
        <div>Loading...</div>
      </div>
    );
  }

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
            <strong>Users:</strong> {collaborators.size + 1}
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
          UIOptions={{
            welcomeScreen: false
          }}
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

