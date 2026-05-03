interface PreviewOverlayMessagesProps {
  initError: string | null;
  hasActiveVideos: boolean;
}

export function PreviewOverlayMessages({
  initError,
  hasActiveVideos,
}: PreviewOverlayMessagesProps) {
  return (
    <>
      {!initError && !hasActiveVideos && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded border border-white/20 bg-black/45 px-4 py-2 text-sm text-white/90">
            Add video clips to see layered preview
          </div>
        </div>
      )}

      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white">
          WebGL preview is unavailable: {initError}
        </div>
      )}
    </>
  );
}
