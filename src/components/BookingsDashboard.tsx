import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { getBookings, isNewBooking } from '../services/bookingsService';
import type { McsoBooking } from '../types/database';
import './BookingsDashboard.css';

function mugshotSrc(b64: string | null): string | null {
  if (!b64) return null;
  if (b64.startsWith('data:')) return b64;
  return `data:image/png;base64,${b64}`;
}

function displayName(b: McsoBooking): string {
  const parts = [b.first_name, b.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unknown';
}

function chargeList(b: McsoBooking): string[] {
  if (Array.isArray(b.charges) && b.charges.length) {
    return b.charges.map(String).filter(Boolean);
  }
  if (b.charges_raw) return [b.charges_raw];
  return [];
}

const BookingsDashboard: React.FC = () => {
  const [bookings, setBookings] = useState<McsoBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [duiOnly, setDuiOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getBookings(500);
      setBookings(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load bookings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (duiOnly && !b.is_dui) return false;
      if (!q) return true;
      const hay = [
        b.booking_number,
        b.first_name,
        b.last_name,
        b.charges_raw,
        b.arresting_agency,
        ...(b.charges || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, query, duiOnly]);

  const duiCount = useMemo(() => bookings.filter((b) => b.is_dui).length, [bookings]);
  const newCount = useMemo(
    () => bookings.filter((b) => isNewBooking(b.first_seen_at)).length,
    [bookings]
  );

  return (
    <div className="bookings-page">
      <header className="bookings-header">
        <div>
          <h1>MCSO Bookings</h1>
          <p className="bookings-sub">
            Mugshot-wall DUI leads · source badge distinguishes MCSO bookings from JC arraignment cases
          </p>
        </div>
        <button type="button" className="bookings-refresh" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <div className="bookings-stats">
        <div className="bookings-stat">
          <span className="label">Total</span>
          <span className="value">{bookings.length}</span>
        </div>
        <div className="bookings-stat accent">
          <span className="label">DUI</span>
          <span className="value">{duiCount}</span>
        </div>
        <div className="bookings-stat new">
          <span className="label">New (24h)</span>
          <span className="value">{newCount}</span>
        </div>
      </div>

      <div className="bookings-toolbar">
        <input
          type="search"
          className="bookings-search"
          placeholder="Search name, booking #, charge, agency…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="bookings-toggle">
          <input
            type="checkbox"
            checked={duiOnly}
            onChange={(e) => setDuiOnly(e.target.checked)}
          />
          DUI only
        </label>
      </div>

      {error && (
        <div className="bookings-error" role="alert">
          {error}
        </div>
      )}

      {loading && !bookings.length ? (
        <div className="bookings-empty">Loading bookings…</div>
      ) : filtered.length === 0 ? (
        <div className="bookings-empty">No bookings match.</div>
      ) : (
        <div className="bookings-grid">
          {filtered.map((b) => {
            const src = mugshotSrc(b.mugshot_b64);
            const fresh = isNewBooking(b.first_seen_at);
            const charges = chargeList(b);
            const seen = b.first_seen_at ? new Date(b.first_seen_at) : null;

            return (
              <article
                key={b.id || b.booking_number}
                className={`booking-card ${b.is_dui ? 'is-dui' : ''} ${fresh ? 'is-new' : ''}`}
              >
                <div className="booking-mug">
                  {src ? (
                    <img src={src} alt={`Mugshot ${displayName(b)}`} loading="lazy" />
                  ) : (
                    <div className="booking-mug-placeholder">No photo</div>
                  )}
                </div>
                <div className="booking-body">
                  <div className="booking-top">
                    <h2 className="booking-name">{displayName(b)}</h2>
                    <div className="booking-badges">
                      {fresh && <span className="badge badge-new">NEW</span>}
                      {b.is_dui && <span className="badge badge-dui">DUI</span>}
                      <span className="badge badge-source" title="Lead source">
                        MCSO Booking
                      </span>
                    </div>
                  </div>
                  <div className="booking-meta">
                    <span className="mono">{b.booking_number}</span>
                    {b.arresting_agency && (
                      <span className="agency">{b.arresting_agency}</span>
                    )}
                  </div>
                  <ul className="booking-charges">
                    {charges.map((c, i) => (
                      <li key={`${b.booking_number}-${i}`}>{c}</li>
                    ))}
                  </ul>
                  {seen && !Number.isNaN(seen.getTime()) && (
                    <div className="booking-seen">
                      First seen {format(seen, 'MMM d, yyyy h:mm a')} ·{' '}
                      {formatDistanceToNow(seen, { addSuffix: true })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="bookings-footnote">
        Showing {filtered.length} of {bookings.length} · JC arraignment cases live on{' '}
        <a href="/cases">/cases</a>
      </p>
    </div>
  );
};

export default BookingsDashboard;
