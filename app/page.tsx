export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Job Hunt Autopilot</h1>
        <p className="text-gray-600 mb-8">
          Automate your job search - from capture to offer
        </p>
        <div className="space-x-4">
          <a
            href="/signup"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Get Started
          </a>
          <a
            href="/login"
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
