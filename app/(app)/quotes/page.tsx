import { QuotesTable } from '@/components/quotes/quotes-table';

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Quotes</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search, filter, and review every quote your team has produced.
        </p>
      </div>
      <QuotesTable />
    </div>
  );
}
