import { SlFilm } from "react-icons/sl";
import { MdTextFields } from "react-icons/md";
import { useState } from "react";
import { MediaStore } from "../media-store/MediaStore";
import { Text } from "../features/text/Text";

type Tab = "media" | "text";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "MEDIA", icon: <SlFilm size="16" /> },
  { id: "text", label: "TEXT", icon: <MdTextFields size="16" /> },
];

export const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<Tab>("media");

  return (
    <aside className="flex w-80 shrink-0  border-r bg-surface">
      <div className="w-20 h-screen border-r py-2 px-2 flex flex-col gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col justify-center items-center gap-1 border py-1.5 w-full cursor-pointer transition-colors ${
              activeTab === tab.id
                ? "bg-white border-color-border-full text-text-color "
                : "border-transparent border bg-surface text-text-color hover:bg-surface-hover hover:border-color-border-full"
            }`}
          >
            {tab.icon}
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="w-full p-2">
        {activeTab === "media" && <MediaStore />}
        {activeTab === "text" && <Text />}
      </div>
    </aside>
  );
};
