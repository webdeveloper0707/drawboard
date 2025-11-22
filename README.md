# Excalidraw Next.js Demo

Ye ek simple Next.js project hai jo Excalidraw ko embed karta hai.

## Installation

```bash
npm install
# ya
yarn install
```

## Run Karne Ke Liye

```bash
npm run dev
# ya
yarn dev
```

Phir browser me kholo: http://localhost:3000

## Features

✅ Basic Excalidraw integration
✅ Theme switching (Light/Dark)
✅ Save functionality
✅ Export as PNG
✅ Clear canvas
✅ **Collaboration ready** (backend setup required)

## Collaboration Add Karne Ke Liye

1. `COLLABORATION_GUIDE.md` file dekhein - detailed guide hai
2. `app/collaborative-page.tsx` - ready-to-use collaboration component
3. WebSocket server setup karein
4. Environment variable set karein: `NEXT_PUBLIC_WS_URL`

## Usage

### Basic Usage (Current)
- `app/page.tsx` - Basic Excalidraw with custom toolbar

### Collaboration Usage (After Backend Setup)
- `app/collaborative-page.tsx` - Real-time collaboration enabled

## Customization

Aap easily customize kar sakte hain:
- Initial data (pre-loaded drawing)
- Custom UI elements
- Event handlers
- Styling
- Theme

## Next Steps

1. ✅ Basic integration - Done
2. ⏳ Collaboration backend setup
3. ⏳ User authentication (optional)
4. ⏳ Drawing persistence (optional)
