import { RateCardManager } from '@/components/rate-cards/rate-card-manager';

export default function RateCardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rate cards</h1>
        <p className="mt-2 text-sm text-slate-600">
          Maintain your production rate cards, quantity bands, and make-ready fees.
        </p>
      </div>
      <RateCardManager />
    </div>
  );
}
