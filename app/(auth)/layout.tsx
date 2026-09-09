export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="max-w-md w-full space-y-8 p-8 bg-card rounded-lg shadow">
        {children}
      </div>
    </div>
  );
}
