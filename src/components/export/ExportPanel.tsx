import { JsonExportSection } from "./components/json-export/JsonExportSection";
import { VideoExportSection } from "./components/video-export/VideoExportSection";

export const ExportPanel = () => {
  return (
    <div className="flex flex-col gap-4 p-2">
      <span className="text-xs font-medium text-text-color">EXPORT</span>
      <VideoExportSection />
      <JsonExportSection />
    </div>
  );
};
