import React from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useAdStore } from '../stores/adStore';
import { GATE_PLAZA, PLAZA_DIRECTORY_ID, PLAZA_SHOPS, adSpotById, type AdListing } from '../config/adSpaces';

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

function ComingSoon({ billboard }: { billboard: boolean }) {
  return (
    <section className="hustle-card">
      <h3>{billboard ? 'Advertisement coming soon' : 'Shop closed · to let'}</h3>
      <p className="academic-note">
        {billboard
          ? 'This billboard will carry adverts for campus businesses. Booking a slot opens soon.'
          : 'Businesses will soon be able to rent this shop and put up their flyer. Tapping the flyer will open their business page.'}
      </p>
    </section>
  );
}

/** A plaza shop or billboard: the business that rented it, or "coming soon" while renting isn't open. */
export function AdSpaceSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { selected, listings, open } = useAdStore();
  const close = () => setModal(null);

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
                      <b>{s.name}</b><span>{listings[s.id]?.business_name ?? 'Closed · to let'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!rented && <p className="academic-note">All eight shops are closed for now. Renting opens soon.</p>}
        </div>
      </Sheet>
    );
  }

  const spot = adSpotById(selected);
  if (!spot) return null;
  const listing = listings[spot.id], billboard = spot.kind === 'billboard';
  const title = billboard ? `${spot.name} billboard` : `${GATE_PLAZA.name} · ${spot.name}`;
  return (
    <Sheet title={listing?.business_name ?? title} subtitle={listing ? title : billboard ? 'Big campus billboard' : 'Flyer space'} icon={billboard ? '🪧' : '🏬'} accent="#15803d" onClose={close}>
      <div className="academic-body">
        {listing ? <Business listing={listing} /> : <ComingSoon billboard={billboard} />}
        {!billboard && <button type="button" className="hustle-btn is-quiet" onClick={() => open(PLAZA_DIRECTORY_ID)}>All plaza shops</button>}
      </div>
    </Sheet>
  );
}
