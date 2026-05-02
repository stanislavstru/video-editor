function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans">
      <aside className="flex w-[200px] shrink-0 flex-col border-r bg-surface"></aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-background"></main>
      </div>
    </div>
  );
}

export default App;
