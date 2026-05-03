export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function loadVideoMetadata(src: string): Promise<{ duration: number }> {
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
