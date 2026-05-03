import { Film, Type, Download } from "lucide-react";
import { useState } from "react";
import { MediaStore } from "../media-store/MediaStore";
import { Text } from "../features/text/Text";
import { ExportPanel } from "../export/ExportPanel";

type Tab = "media" | "text" | "export";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "MEDIA", icon: <Film size={16} /> },
  { id: "text", label: "TEXT", icon: <Type size={16} /> },
  { id: "export", label: "EXPORT", icon: <Download size={16} /> },
];

export const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<Tab>("media");

  return (
    <aside
      className="flex w-96 shrink-0 border-r"
      style={{
        backgroundColor: "var(--color-action-bg)",
        color: "var(--color-action-text)",
        borderColor:
          "color-mix(in oklab, var(--color-action-text) 18%, transparent)",
      }}
    >
      <div
        className="w-20 h-screen border-r py-2 px-2 flex flex-col gap-2"
        style={{
          borderColor:
            "color-mix(in oklab, var(--color-action-text) 18%, transparent)",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col justify-center items-center gap-1 border py-1.5 w-full cursor-pointer transition-colors ${
              activeTab === tab.id
                ? "bg-white/14 border-white/55 text-white"
                : "border-transparent bg-transparent text-white/75 hover:bg-white/10 hover:border-white/35 hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="w-full p-2 bg-surface text-text">
        {activeTab === "media" && <MediaStore />}
        {activeTab === "text" && <Text />}
        {activeTab === "export" && <ExportPanel />}
      </div>
    </aside>
  );
};
