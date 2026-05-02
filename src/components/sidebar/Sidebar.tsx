import { SlFilm } from "react-icons/sl";
import { MdTextFields } from "react-icons/md";
import { useState } from "react";
import { Media } from "../media/Media";
import { Text } from "../features/text/Text";

type Tab = "media" | "text";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "MEDIA", icon: <SlFilm size="20" /> },
  { id: "text", label: "TEXT", icon: <MdTextFields size="20" /> },
];

export const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<Tab>("media");

  return (
    <aside className="flex w-80 shrink-0  border-r bg-surface">
      <div className="w-20 h-screen border-r  py-6 px-2 flex flex-col gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col justify-center items-center gap-1 border py-2 w-full cursor-pointer transition-colors ${
              activeTab === tab.id
                ? "bg-white border-gray-800 text-gray-800"
                : "border-transparent hover:bg-gray-200 text-gray-600"
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="w-full p-2">
        {activeTab === "media" && <Media />}
        {activeTab === "text" && <Text />}
      </div>
    </aside>
  );
};
