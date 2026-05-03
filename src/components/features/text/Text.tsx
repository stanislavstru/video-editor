import { useEditorStore } from "../../../store/editorStore";
import { Button } from "../../ui/button";

export const Text = () => {
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const currentTime = useEditorStore((s) => s.currentTime);

  const onAddHeading = () => {
    addTextClip("Heading", currentTime, 4);
  };

  const onAddBodyText = () => {
    addTextClip("Body text", currentTime, 4);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-2">
      <span className="text-xs font-medium text-text-color uppercase">
        Text layer
      </span>
      <div className="flex flex-col gap-2">
        <Button onClick={onAddHeading}>Add heading</Button>
        <Button onClick={onAddBodyText}>Add body text</Button>
      </div>
    </div>
  );
};
