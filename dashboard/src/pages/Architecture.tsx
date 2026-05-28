import TabBar from '../components/TabBar'

export default function Architecture() {
  return (
    <div className="min-h-screen bg-gray-950">
      <TabBar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-6">Architecture</h1>
          <img
            src="/prowler-cspm-pipeline.png"
            alt="Prowler CSPM DevSecOps pipeline architecture"
            className="w-full rounded"
          />
        </div>
      </div>
    </div>
  )
}
