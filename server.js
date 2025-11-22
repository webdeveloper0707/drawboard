const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0'; // 0.0.0.0 allows all network interfaces
const port = parseInt(process.env.PORT || '3101', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.io setup with CORS for network access
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? true : process.env.NEXT_PUBLIC_URL || true, // Allow all origins in dev mode
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Store rooms, their clients, and current drawing state
  const rooms = new Map(); // roomId -> { clients: Map, elements: Array }

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

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // Join room with user info
    socket.on('join-room', (data) => {
      const roomId = typeof data === 'string' ? data : data.roomId;
      const userName = typeof data === 'object' ? data.userName : null;
      const userColor = typeof data === 'object' ? data.userColor : null;
      
      socket.join(roomId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          clients: new Map(),
          elements: [] // Store current drawing elements
        });
      }
      
      const room = rooms.get(roomId);
      room.clients.set(socket.id, {
        userName: userName || `User-${socket.id.substring(0, 5)}`,
        userColor: userColor || `#${Math.floor(Math.random()*16777215).toString(16)}`
      });
      
      console.log(`User ${socket.id} (${userName || 'Anonymous'}) joined room ${roomId}`);
      
      // Send current room state to the newly joined user
      if (room.elements && room.elements.length > 0) {
        socket.emit('initial-state', {
          roomId: roomId,
          elements: room.elements
        });
        console.log(`Sent initial state (${room.elements.length} elements) to ${socket.id}`);
      }
      
      // Notify others in the room
      socket.to(roomId).emit('user-joined', {
        userId: socket.id,
        roomId: roomId,
        userName: userName || `User-${socket.id.substring(0, 5)}`,
        userColor: userColor || `#${Math.floor(Math.random()*16777215).toString(16)}`
      });
    });

    // Handle drawing updates
    socket.on('drawing-update', (data) => {
      const roomId = data.roomId;
      const room = rooms.get(roomId);
      
      if (room && data.elements) {
        // Merge incoming elements with room's current elements (don't replace!)
        room.elements = mergeElements(room.elements, data.elements);
        
        // Broadcast merged elements to all other clients in the room (not to sender)
        socket.to(roomId).emit('drawing-update', {
          roomId: roomId,
          elements: room.elements, // Send merged state
          userId: socket.id
        });
      }
    });

    // Handle pointer updates (cursor tracking)
    socket.on('pointer-update', (data) => {
      // Get user info from room
      const roomId = data.roomId;
      const room = rooms.get(roomId);
      const userInfo = room?.clients?.get(socket.id);
      
      // Broadcast to all other clients in the room (including sender for sync)
      socket.to(data.roomId).emit('pointer-update', {
        ...data,
        userId: socket.id,
        userName: data.userName || userInfo?.userName || `User-${socket.id.substring(0, 5)}`,
        userColor: data.userColor || userInfo?.userColor || '#000000'
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('🔴 Client disconnected:', socket.id);
      
      // Remove from all rooms
      rooms.forEach((room, roomId) => {
        if (room.clients.has(socket.id)) {
          const userInfo = room.clients.get(socket.id);
          room.clients.delete(socket.id);
          socket.to(roomId).emit('user-left', {
            userId: socket.id,
            roomId: roomId,
            userName: userInfo?.userName
          });
          
          // Clean up empty rooms (but keep elements for 5 minutes in case user reconnects)
          if (room.clients.size === 0) {
            setTimeout(() => {
              const currentRoom = rooms.get(roomId);
              if (currentRoom && currentRoom.clients.size === 0) {
                rooms.delete(roomId);
                console.log(`Cleaned up empty room: ${roomId}`);
              }
            }, 5 * 60 * 1000); // 5 minutes
          }
        }
      });
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`);
      console.log(`> Socket.io server running`);
      console.log(`> Network access: http://<your-ip>:${port}`);
      console.log(`> Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)`);
    });
});

