import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AD_RENT, cleanListing, type AdListing } from '../config/adSpaces';
import { useGameStore } from './gameStore';
import { useAuthStore } from './authStore';

/** Opening this id in the ad sheet shows the admin review page. */
export const AD_ADMIN_ID = 'ad-admin';

export interface MyAdRequest { id: string; spot_id: string; business_name: string; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string }
export interface AdRequestForReview {
  id: string; spot_id: string; business_name: string; tagline: string | null; description: string | null;
  contact: string; link_url: string | null; flyer_path: string; created_at: string; username: string; college: string;
  spot_taken_until: string | null;
}
export interface AdminListing { spot_id: string; business_name: string; starts_at: string; ends_at: string | null; owner: string | null; live: boolean }
export interface AdRequestForm { spot_id: string; business_name: string; tagline: string; description: string; contact: string; link_url: string | null }

/** Supabase errors carry the message raised by the SQL function. */
const message = (e: unknown, fallback: string) => (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string' ? (e as any).message : fallback);

interface AdStore {
  /** Live listings by spot id. A spot without one is closed / coming soon. */
  listings: Record<string, AdListing>;
  /** Open in the ad sheet: a spot id, the plaza directory, or the admin page. */
  selected: string | null;
  /** The signed-in student's side: admin or not, spots they hold (with end dates), their requests. */
  isAdmin: boolean;
  pendingCount: number;
  mySpots: Record<string, string | null>;
  myRequests: MyAdRequest[];
  /** Admin page data. */
  review: { requests: AdRequestForReview[]; listings: AdminListing[] } | null;
  load: () => Promise<void>;
  loadMine: () => Promise<void>;
  open: (id: string) => void;
  submitRequest: (form: AdRequestForm, flyer: File) => Promise<void>;
  loadReview: () => Promise<void>;
  reviewRequest: (request: AdRequestForReview, approve: boolean, note?: string) => Promise<void>;
  extendListing: (spotId: string, days: number) => Promise<void>;
  endListing: (spotId: string) => Promise<void>;
}

export const flyerPublicUrl = (path: string) => supabase.storage.from(AD_RENT.BUCKET).getPublicUrl(path).data.publicUrl;

export const useAdStore = create<AdStore>((set, get) => ({
  listings: {},
  selected: null,
  isAdmin: false,
  pendingCount: 0,
  mySpots: {},
  myRequests: [],
  review: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    // RLS only returns listings that are live right now.
    const { data, error } = await supabase.from('ad_listings')
      .select('spot_id,business_name,tagline,description,flyer_url,link_url,contact');
    if (error || !Array.isArray(data)) return;
    const listings: Record<string, AdListing> = {};
    for (const row of data) { const l = cleanListing(row); if (l) listings[l.spot_id] = l; }
    set({ listings });
  },
  loadMine: async () => {
    if (!isSupabaseConfigured || !useAuthStore.getState().user) return;
    const { data, error } = await supabase.rpc('ad_my_state');
    if (error || !data) return;
    set({
      isAdmin: !!data.is_admin,
      pendingCount: Number(data.pending_count) || 0,
      mySpots: data.my_spots || {},
      myRequests: Array.isArray(data.my_requests) ? data.my_requests : [],
    });
  },
  open: (id) => {
    set({ selected: id });
    useGameStore.getState().setActiveModal('ad_space');
    void get().loadMine();
  },
  submitRequest: async (form, flyer) => {
    const user = useAuthStore.getState().user;
    if (!isSupabaseConfigured || !user) throw new Error('Sign in to rent a spot.');
    if (!AD_RENT.FLYER_TYPES.includes(flyer.type)) throw new Error('The flyer must be a JPG, PNG or WebP image.');
    if (flyer.size > AD_RENT.FLYER_MAX_BYTES) throw new Error('The flyer must be 5 MB or smaller.');
    const ext = flyer.type === 'image/png' ? 'png' : flyer.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage.from(AD_RENT.BUCKET).upload(path, flyer, { contentType: flyer.type, upsert: false });
    if (upload.error) throw new Error(message(upload.error, 'Could not upload the flyer. Please try again.'));
    const { error } = await supabase.rpc('submit_ad_request', {
      p_spot: form.spot_id, p_business_name: form.business_name, p_tagline: form.tagline,
      p_description: form.description, p_contact: form.contact, p_link_url: form.link_url, p_flyer_path: path,
    });
    if (error) throw new Error(message(error, 'Could not send your request. Please try again.'));
    await get().loadMine();
  },
  loadReview: async () => {
    const { data, error } = await supabase.rpc('admin_ad_state');
    if (error) throw new Error(message(error, 'Could not load requests.'));
    set({ review: { requests: data?.requests || [], listings: data?.listings || [] } });
  },
  reviewRequest: async (request, approve, note) => {
    const { error } = await supabase.rpc('review_ad_request', {
      p_id: request.id, p_approve: approve, p_flyer_url: approve ? flyerPublicUrl(request.flyer_path) : null, p_note: note || null,
    });
    if (error) throw new Error(message(error, 'Could not save that.'));
    await Promise.all([get().loadReview(), get().load(), get().loadMine()]);
  },
  extendListing: async (spotId, days) => {
    const { error } = await supabase.rpc('admin_extend_ad_listing', { p_spot: spotId, p_days: days });
    if (error) throw new Error(message(error, 'Could not extend it.'));
    await Promise.all([get().loadReview(), get().load()]);
  },
  endListing: async (spotId) => {
    const { error } = await supabase.rpc('admin_end_ad_listing', { p_spot: spotId });
    if (error) throw new Error(message(error, 'Could not end it.'));
    await Promise.all([get().loadReview(), get().load()]);
  },
}));
