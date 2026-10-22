import React, { useEffect, useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { AD_ADMIN_ID, flyerPublicUrl, useAdStore, type AdRequestForReview } from '../stores/adStore';
import { AD_RENT, GATE_PLAZA, PLAZA_DIRECTORY_ID, PLAZA_SHOPS, adSpotById, adSpotLabel, normalizeAdLink, type AdListing, type AdSpot } from '../config/adSpaces';

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : null;

function Business({ listing }: { listing: AdListing }) {
  return (
    <section className="hustle-card ad-business">
      {listing.flyer_url && <img className="ad-flyer" src={listing.flyer_url} alt={`${listing.business_name} flyer`} loading="lazy" referrerPolicy="no-referrer" />}
      {listing.tagline && <p className="ad-tagline">{listing.tagline}</p>}
      {listing.description && <p className="academic-note">{listing.description}</p>}
      {listing.contact && <p className="ad-contact">📞 {listing.contact}</p>}
      {listing.link_url && <a className="hustle-btn ad-visit" href={listing.link_url} target="_blank" rel="noopener noreferrer nofollow">Visit business ↗</a>}
    </section>
  );
}

/** A free spot: the student's request status, or the form to ask for it. */
function RentPanel({ spot }: { spot: AdSpot }) {
  const myRequests = useAdStore((s) => s.myRequests);
  const [renting, setRenting] = useState(false);
  const billboard = spot.kind === 'billboard';
  const latest = myRequests.find((r) => r.spot_id === spot.id);
  const pending = latest?.status === 'pending';

  if (renting && !pending) return <RentForm spot={spot} onDone={() => setRenting(false)} />;
  return (
    <section className="hustle-card">
      <h3>{billboard ? 'Advertise here' : 'Shop closed · to let'}</h3>
      {pending ? (
        <p className="academic-note">⏳ Your request for <b>{latest.business_name}</b> is waiting for review. It goes up as soon as it's approved.</p>
      ) : (
        <>
          {latest?.status === 'rejected' && (
            <p className="ad-note">Your last request wasn't approved{latest.admin_note ? `: ${latest.admin_note}` : '.'}</p>
          )}
          <p className="academic-note">
            {billboard
              ? 'Put your business on this big campus billboard.'
              : 'Rent this shop: your flyer goes on the shopfront and students can tap it to reach you.'}{' '}
            Free for {AD_RENT.DAYS} days while we launch. Every flyer is checked before it goes up.
          </p>
          <button type="button" className="hustle-btn" onClick={() => setRenting(true)}>Rent this {billboard ? 'billboard' : 'shop'}</button>
        </>
      )}
    </section>
  );
}

function RentForm({ spot, onDone }: { spot: AdSpot; onDone: () => void }) {
  const submitRequest = useAdStore((s) => s.submitRequest);
  const billboard = spot.kind === 'billboard';
  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [link, setLink] = useState('');
  const [flyer, setFlyer] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (flyer ? URL.createObjectURL(flyer) : null), [flyer]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFlyer = (file: File | undefined) => {
    setError(null);
    if (!file) return setFlyer(null);
    if (!AD_RENT.FLYER_TYPES.includes(file.type)) return setError('The flyer must be a JPG, PNG or WebP image.');
    if (file.size > AD_RENT.FLYER_MAX_BYTES) return setError('The flyer must be 5 MB or smaller.');
    setFlyer(file);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const linkUrl = normalizeAdLink(link);
    if (link.trim() && !linkUrl) return setError('That link doesn\'t look right. Paste the full link, e.g. https://wa.me/…');
    if (!flyer) return setError('Add your flyer image.');
    setSending(true);
    setError(null);
    try {
      await submitRequest({ spot_id: spot.id, business_name: businessName, tagline, description, contact, link_url: linkUrl }, flyer);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="hustle-card ad-form" onSubmit={submit}>
      <h3>Rent this {billboard ? 'billboard' : 'shop'}</h3>
      <label>Business name *
        <input required maxLength={60} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Styled by Smile" />
      </label>
      <label>Short tagline
        <input maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line under your name" />
      </label>
      <label>About your business
        <textarea maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you sell, prices, where to find you…" />
      </label>
      <label>Phone number *
        <input required maxLength={80} inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0801 234 5678" />
      </label>
      <label>Link (WhatsApp, Instagram, website)
        <input maxLength={300} inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://wa.me/…" />
      </label>
      <label>Flyer image * <small>{billboard ? 'Wide, about 2.3 : 1 (e.g. 2000 × 880)' : 'Portrait (taller than wide)'} · JPG, PNG or WebP · up to 5 MB</small>
        <input type="file" accept={AD_RENT.FLYER_TYPES.join(',')} onChange={(e) => pickFlyer(e.target.files?.[0])} />
      </label>
      {preview && <img className="ad-flyer" src={preview} alt="Your flyer" />}
      {error && <p className="ad-note" role="alert">{error}</p>}
      <div className="ad-actions">
        <button type="button" className="hustle-btn is-quiet" onClick={onDone} disabled={sending}>Cancel</button>
        <button type="submit" className="hustle-btn" disabled={sending}>{sending ? 'Sending…' : 'Send for review'}</button>
      </div>
      <p className="academic-note">Free for {AD_RENT.DAYS} days. We check every flyer before it goes up.</p>
    </form>
  );
}

function ReviewCard({ request }: { request: AdRequestForReview }) {
  const reviewRequest = useAdStore((s) => s.reviewRequest);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try { await reviewRequest(request, approve, note); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save that.'); setBusy(false); }
  };
  return (
    <section className="hustle-card ad-business">
      <h3>{request.business_name}</h3>
      <p className="ad-contact">{adSpotLabel(request.spot_id)} · from @{request.username} ({request.college}) · {day(request.created_at)}</p>
      <img className="ad-flyer" src={flyerPublicUrl(request.flyer_path)} alt={`${request.business_name} flyer`} loading="lazy" referrerPolicy="no-referrer" />
      {request.tagline && <p className="ad-tagline">{request.tagline}</p>}
      {request.description && <p className="academic-note">{request.description}</p>}
      <p className="ad-contact">📞 {request.contact}</p>
      {request.link_url && <a className="ad-contact" href={request.link_url} target="_blank" rel="noopener noreferrer nofollow">{request.link_url}</a>}
      {request.spot_taken_until && <p className="ad-note">This spot is taken. End that listing before approving.</p>}
      <div className="ad-form">
        <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason, if you reject (they'll see it)" />
      </div>
      {error && <p className="ad-note" role="alert">{error}</p>}
      <div className="ad-actions">
        <button type="button" className="hustle-btn is-quiet" disabled={busy} onClick={() => act(false)}>Reject</button>
        <button type="button" className="hustle-btn" disabled={busy || !!request.spot_taken_until} onClick={() => act(true)}>Approve · {AD_RENT.DAYS} days</button>
      </div>
    </section>
  );
}

function AdminReview() {
  const { review, loadReview, extendListing, endListing } = useAdStore();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadReview().catch((err) => setError(err.message)); }, [loadReview]);
  const run = (fn: () => Promise<void>) => { setError(null); fn().catch((err) => setError(err.message)); };

  if (error && !review) return <p className="ad-note" role="alert">{error}</p>;
  if (!review) return <p className="academic-note">Loading…</p>;
  return (
    <>
      {error && <p className="ad-note" role="alert">{error}</p>}
      {review.requests.length
        ? review.requests.map((r) => <ReviewCard key={r.id} request={r} />)
        : <p className="academic-note">No requests waiting.</p>}
      <section className="hustle-card">
        <h3>Listings</h3>
        {review.listings.length ? (
          <ul className="ad-admin-listings">
            {review.listings.map((l) => (
              <li key={l.spot_id}>
                <div>
                  <b>{l.business_name}</b>
                  <span>{adSpotLabel(l.spot_id)}{l.owner ? ` · @${l.owner}` : ''}</span>
                  <span>{l.live ? (l.ends_at ? `Ends ${day(l.ends_at)}` : 'No end date') : `Ended ${day(l.ends_at)}`}</span>
                </div>
                <div className="ad-actions">
                  <button type="button" className="hustle-btn is-quiet" onClick={() => run(() => extendListing(l.spot_id, AD_RENT.DAYS))}>+{AD_RENT.DAYS} days</button>
                  {l.live && <button type="button" className="hustle-btn is-quiet" onClick={() => { if (window.confirm(`Take ${l.business_name} down now?`)) run(() => endListing(l.spot_id)); }}>End now</button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="academic-note">No listings yet.</p>}
      </section>
    </>
  );
}

function AdminButton() {
  const { isAdmin, pendingCount, open } = useAdStore();
  if (!isAdmin) return null;
  return <button type="button" className="hustle-btn is-quiet" onClick={() => open(AD_ADMIN_ID)}>Review ad requests{pendingCount ? ` (${pendingCount})` : ''}</button>;
}

/** A plaza shop or billboard: the business that rented it, or the way to rent it. */
export function AdSpaceSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { selected, listings, mySpots, open } = useAdStore();
  const close = () => setModal(null);

  if (selected === AD_ADMIN_ID) {
    return (
      <Sheet title="Ad requests" subtitle="Approve flyers, renew or end listings" icon="🗂️" accent="#15803d" onClose={close}>
        <div className="academic-body">
          <AdminReview />
          <button type="button" className="hustle-btn is-quiet" onClick={() => open(PLAZA_DIRECTORY_ID)}>All plaza shops</button>
        </div>
      </Sheet>
    );
  }

  if (selected === PLAZA_DIRECTORY_ID) {
    const rented = PLAZA_SHOPS.filter((s) => listings[s.id]).length;
    return (
      <Sheet title={GATE_PLAZA.name} subtitle={`${rented} of ${PLAZA_SHOPS.length} shops open`} icon="🏬" accent="#15803d" onClose={close}>
        <div className="academic-body">
          {[1, 0].map((floor) => (
            <section key={floor} className="hustle-card">
              <h3>{floor ? 'Upstairs' : 'Ground floor'}</h3>
              <ul className="ad-directory">
                {PLAZA_SHOPS.filter((s) => s.floor === floor).map((s) => (
                  <li key={s.id}>
                    <button type="button" className="hustle-btn is-quiet" onClick={() => open(s.id)}>
                      <b>{s.name}</b><span>{listings[s.id]?.business_name ?? 'To let'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {rented < PLAZA_SHOPS.length && <p className="academic-note">Tap a shop that's to let to rent it.</p>}
          <AdminButton />
        </div>
      </Sheet>
    );
  }

  const spot = adSpotById(selected);
  if (!spot) return null;
  const listing = listings[spot.id], billboard = spot.kind === 'billboard';
  const title = billboard ? `${spot.name} billboard` : `${GATE_PLAZA.name} · ${spot.name}`;
  const myEnd = spot.id in mySpots ? mySpots[spot.id] : undefined;
  return (
    <Sheet title={listing?.business_name ?? title} subtitle={listing ? title : billboard ? 'Big campus billboard' : 'Flyer space'} icon={billboard ? '🪧' : '🏬'} accent="#15803d" onClose={close}>
      <div className="academic-body">
        {listing ? <Business listing={listing} /> : <RentPanel spot={spot} />}
        {listing && myEnd !== undefined && (
          <p className="ad-note is-info">This is your {billboard ? 'billboard' : 'shop'}{myEnd ? `, up until ${day(myEnd)}` : ''}. Renewing opens soon.</p>
        )}
        {!billboard && <button type="button" className="hustle-btn is-quiet" onClick={() => open(PLAZA_DIRECTORY_ID)}>All plaza shops</button>}
        <AdminButton />
      </div>
    </Sheet>
  );
}
