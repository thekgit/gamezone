import VisitorsTableClient from "../ui/VisitorsTableClient";

export default function VisitorsPage() {
  return (
    <div>
      <div className="text-sm text-black/50">Visitors / List</div>
      <div className="flex items-center justify-between mt-2">
        <h1 className="text-2xl font-bold">All Visitors</h1>
        <div className="flex gap-2">
          <button
            id="downloadCsvBtn"
            className="rounded-lg px-3 py-2 bg-blue-600 text-white text-sm font-semibold"
          >
            Download CSV
          </button>
          <button
            id="downloadExcelBtn"
            className="rounded-lg px-3 py-2 bg-blue-600 text-white text-sm font-semibold"
          >
            Download Excel
          </button>
        </div>
      </div>

      <div className="mt-4">
        <VisitorsTableClient />
      </div>
    </div>
  );
}