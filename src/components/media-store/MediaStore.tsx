import { useRef, type ChangeEvent } from "react";
import { useEditorStore, type MediaItem } from "../../store/editorStore";
import { Button } from "../ui/button";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadVideoMetadata(src: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = src;
    video.onloadedmetadata = () => {
      resolve({ duration: video.duration });
    };
    video.onerror = () => reject(new Error("Failed to load video metadata"));
  });
}

export const MediaStore = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaItems = useEditorStore((s) => s.mediaItems);
  const addMediaItem = useEditorStore((s) => s.addMediaItem);
  const removeMediaItem = useEditorStore((s) => s.removeMediaItem);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const src = URL.createObjectURL(file);
      try {
        const { duration } = await loadVideoMetadata(src);
        const item: MediaItem = {
          id: generateId(),
          name: file.name,
          src,
          duration,
          type: file.type.startsWith("audio/") ? "audio" : "video",
        };
        addMediaItem(item);
      } catch {
        URL.revokeObjectURL(src);
      }
    }
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <Button onClick={() => inputRef.current?.click()}>+ Add media</Button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />

      <div className="flex flex-col gap-1 overflow-y-auto">
        {mediaItems.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No media yet</p>
        )}
        {mediaItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between gap-2 border px-2 py-1.5 hover:bg-gray-100"
          >
            <button
              onClick={() => addClipFromMedia(item.id)}
              className="flex-1 min-w-0 text-left cursor-pointer"
              title="Add to timeline"
            >
              <div className="text-xs font-medium truncate">{item.name}</div>
              <div className="text-[10px] text-gray-500">
                {item.duration.toFixed(1)}s · {item.type}
              </div>
            </button>
            <button
              onClick={() => removeMediaItem(item.id)}
              className="text-xs text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
