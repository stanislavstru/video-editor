import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded-none! border border-border bg-background text-foreground shadow-none!",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
