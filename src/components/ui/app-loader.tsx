export function AppLoader({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border border-primary/20 mx-auto"></div>
        </div>
        {message && (
          <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
        )}
      </div>
    </div>
  );
}

export function InlineLoader({ size = "md", message }: { size?: "sm" | "md" | "lg", message?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-b-2"
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4">
      <div className={`animate-spin rounded-full ${sizeClasses[size]} border-primary`}></div>
      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
