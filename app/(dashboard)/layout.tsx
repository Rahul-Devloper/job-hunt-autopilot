export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar - we'll build this in Session 4 */}
        <aside className="w-64 bg-white border-r min-h-screen">
          <div className="p-4">
            <h1 className="text-xl font-bold">Job Hunt Autopilot</h1>
          </div>
          <nav className="p-4 space-y-2">
            <a href="/dashboard/jobs" className="block p-2 hover:bg-gray-100 rounded">
              Jobs
            </a>
            <a href="/dashboard/analytics" className="block p-2 hover:bg-gray-100 rounded">
              Analytics
            </a>
            <a href="/dashboard/settings" className="block p-2 hover:bg-gray-100 rounded">
              Settings
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
