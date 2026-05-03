import { Sidebar } from "./components/sidebar/Sidebar";
import { Preview } from "./components/preview/Preview";
import { Timeline } from "./components/timeline/Timeline";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden bg-surface-raised">
          <Preview />
        </main>
        <div className="h-64 shrink-0 border-t border-zinc-800">
          <Timeline />
        </div>
      </div>

      <Toaster />
    </div>
  );
}

export default App;
