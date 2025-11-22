'use client';

import { useState } from "react";
import ExcalidrawWrapper from "./components/ExcalidrawWrapper";

// Type definition for Excalidraw API
type ExcalidrawImperativeAPI = any;

export default function Home() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Handle changes in drawing
  const handleChange = (elements: any, appState: any, files: any) => {
    console.log("Drawing changed:", { elements, appState, files });
    // Yahan aap save kar sakte hain, ya koi aur action le sakte hain
  };

  // Save button handler
  const handleSave = () => {
    if (excalidrawAPI) {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      console.log("Saving:", { elements, appState });
      // Yahan aap data save kar sakte hain
      alert("Drawing saved! (Check console for data)");
    }
  };

  // Export as image
  const handleExport = async () => {
    if (excalidrawAPI) {
      const blob = await excalidrawAPI.exportToBlob({
        mimeType: "image/png",
        quality: 0.92,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "excalidraw-drawing.png";
      link.click();
    }
  };

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      {/* Custom Toolbar */}
      <div style={{ 
        padding: "10px", 
        background: theme === "dark" ? "#1e1e1e" : "#fff",
        borderBottom: "1px solid #ddd",
        display: "flex",
        gap: "10px",
        alignItems: "center"
      }}>
        <button 
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Toggle Theme ({theme})
        </button>
        <button 
          onClick={handleSave}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Save
        </button>
        <button 
          onClick={handleExport}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Export PNG
        </button>
        <button 
          onClick={() => excalidrawAPI?.updateScene({ elements: [] })}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Clear Canvas
        </button>
      </div>

      {/* Excalidraw Component */}
      <div style={{ flex: 1, position: "relative" }}>
        <ExcalidrawWrapper
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
          onChange={handleChange}
          theme={theme}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false, // Disable default save
              export: {
                saveFileToDisk: false, // Disable default export
              },
            },
          }}
        />
      </div>
    </div>
  );
}

