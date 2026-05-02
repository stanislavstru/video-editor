import { useState } from "react";
import { useEditorStore } from "../../../store/editorStore";
import { Button } from "../../ui/button";

export const Text = () => {
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const [value, setValue] = useState("");

  const onAddText = () => {
    addTextClip(value);
    setValue("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium text-text-color">Text layer</span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter text for the timeline"
          className="min-h-28 resize-none border border-color-border-full bg-white px-3 py-2 text-sm text-text-color outline-none transition-colors placeholder:text-text-color-disabled focus:border-text-color"
        />
      </label>

      <Button onClick={onAddText}>+ Add text</Button>
    </div>
  );
};
