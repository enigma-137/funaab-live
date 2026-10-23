import { HOSTEL_SPAWN } from "../config/hostelCompound";
import { CAMPUS_SPAWN } from '../config/campusLocations';
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";
import { useGameStore } from "./gameStore";
import { useInputStore } from "./inputStore";
import { useWalletStore } from "./walletStore";
import { useLectureStore } from "./lectureStore";
import { networkManager } from "../game/multiplayer/networkManager";
import {
  candidate,
  placementError,
  position,
  safeStand,
  type EditPlacement,
  type RoomTransform,
} from "../config/roomPlacement";
import { roomSizeOf } from "../config/roomMakeover";
import { hostelItem } from "../config/hostelShop";
import { COOK_MS, dishFor } from "../config/homeKitchen";
export interface Placement extends RoomTransform {}
/** The current room's size (standard until the owner pays to expand it). */
export const roomSizeNow = () => { const r = useHostelStore.getState().snapshot?.room; return roomSizeOf(r?.room_size, r?.style); };
export interface RoomSnapshot {
  room: {
    owner_id: string;
    privacy: string;
    tv_on: boolean;
    /** 'lodge' while renting an off-campus self-contain (migration 020). */
    style?: string;
    /** Room makeover (migration 024). */
    wall_paint?: string;
    floor_style?: string;
    room_size?: string;
    rested_at: string | null;
    security_at: string | null;
    /** Home kitchen (migration 054): what stands on the Small Table. */
    served_food?: string | null;
    served_drink?: string | null;
  };
  placements: Placement[];
  owner_name: string;
}
interface Debt {
  id: string;
  item_id: string;
  amount: number;
  due_at: string;
  paid_at: string | null;
}
interface Invite {
  owner_id: string;
  guest_id: string;
  status: string;
  expires_at: string;
}
interface HostelState {
  roomId: string;
  owner: string | null;
  snapshot: RoomSnapshot | null;
  debts: Debt[];
  invites: Invite[];
  busy: boolean;
  error: string | null;
  notice: string | null;
  panel: "home" | "shop" | "decorate" | "makeover" | "kitchen" | "debts" | "invites";
  /** A dish on the stove: the pot steams until it's served. */
  cooking: { item: string; until: number } | null;
  /** Cook/serve your foodstuff on the table, or eat/drink what's served in the room you're in. */
  kitchen: (action: "serve" | "eat", data: { item?: string; slot?: "food" | "drink" }) => Promise<boolean>;
  preview: EditPlacement | null;
  transition: string | null;
  selected: string | null;
  pose: {
    animation: "sit" | "sleep";
    position: [number, number, number];
    rotation: number;
    item: string;
  } | null;
  teleport: [number, number, number] | null;
  /** Furniture just bought, so the shop can offer to place it right away. */
  justBought: string | null;
  /** Go to your room if needed and start placing this item. */
  placeNow: (item: string) => Promise<void>;
  beginEdit: (item: string) => void;
  confirmEdit: () => Promise<void>;
  rest: (item: string) => void;
  wake: () => void;
  load: () => Promise<void>;
  loadRoom: (owner: string) => Promise<boolean>;
  command: (action: string, data?: object) => Promise<boolean>;
  travel: (
    target: "campus" | "hostel" | "room",
    owner?: string,
    /** Campus or courtyard: where to arrive (e.g. outside the estate house, or by your hostel garage) instead of the gate. */
    at?: [number, number, number],
  ) => Promise<void>;
}
const requests = new Map<string, string>();
export const useHostelStore = create<HostelState>((set, get) => ({
  roomId: "world:funaab:main",
  owner: null,
  snapshot: null,
  debts: [],
  invites: [],
  busy: false,
  error: null,
  notice: null,
  panel: "home",
  cooking: null,
  preview: null,
  transition: null,
  selected: null,
  pose: null,
  teleport: null,
  justBought: null,
  placeNow: async (item) => {
    const me = useAuthStore.getState().user?.id;
    if (!me) return;
    set({ justBought: null });
    if (get().owner !== me) {
      useGameStore.setState({ activeModal: null });
      await get().travel("room");
      if (get().owner !== me) return;
    }
    get().beginEdit(item);
  },
  beginEdit: (item) => {
    if (
      get().owner !== useAuthStore.getState().user?.id ||
      get().pose ||
      get().busy ||
      get().transition
    )
      return;
    const old = get().snapshot?.placements.find((p) => p.item_id === item);
    const [x, , z] = old ? position(old) : [1, 0, 0];
    set({
      preview: candidate(item, x, z, old?.rotation || 0, get().snapshot?.placements || [], roomSizeNow()),
      selected: null,
      error: null,
      notice: null,
    });
    useInputStore.getState().clearTargetDestination();
    useGameStore.setState({ activeModal: null });
  },
  confirmEdit: async () => {
    const p = get().preview;
    if (!p) return;
    const error = placementError(p, get().snapshot?.placements || [], roomSizeNow());
    if (error) {
      set({ error });
      return;
    }
    if (await get().command("place", { ...p, owner: get().owner })) {
      set({ preview: null });
    }
  },
  rest: (item) => {
    const p = get().snapshot?.placements.find((p) => p.item_id === item);
    const pos: [number, number, number] =
      item === "hostel_mattress"
        ? [-2.6, 0.34, -1.9]
        : p
          ? position(p)
          : [0, 0, 0];
    if (item !== "hostel_mattress" && !p) return;
    const here = useGameStore.getState().myPosition;
    if (
      Math.hypot(
        here[0] - pos[0],
        here[2] - (item === "hostel_mattress" ? -2.8 : pos[2]),
      ) > 2.5
    ) {
      set({ notice: "Walk closer to use this furniture." });
      return;
    }
    useInputStore.getState().clearTargetDestination();
    set({
      pose: {
        animation: item === "hostel_mattress" ? "sleep" : "sit",
        position: pos,
        rotation:
          item === "hostel_mattress" ? 0 : ((p?.rotation || 0) * Math.PI) / 180,
        item,
      },
      selected: null,
    });
    useGameStore.setState({ activeModal: null });
    if (
      item === "hostel_mattress" &&
      get().owner === useAuthStore.getState().user?.id
    )
      void get().command("sleep");
  },
  wake: () => {
    const p = get().pose;
    if (!p) return;
    const destination = safeStand(get().snapshot?.placements || [], p.position, roomSizeNow());
    if (!destination) {
      set({ error: "No clear space to stand. Ask the owner to make space." });
      return;
    }
    useInputStore.getState().clearTargetDestination();
    set({ pose: null, teleport: destination });
  },
  load: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const results = await Promise.all([
      supabase
        .from("game_debts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("hostel_invites")
        .select("*")
        .gt("expires_at", new Date().toISOString()),
    ]);
    if (useAuthStore.getState().user?.id !== user.id) return;
    if (results.some((r) => r.error)) {
      set({ error: "Hostel service is unavailable. Retry shortly." });
      return;
    }
    set({ debts: results[0].data || [], invites: results[1].data || [] });
  },
  loadRoom: async (owner) => {
    const { data, error } = await supabase.rpc("hostel_snapshot", {
      p_owner: owner,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    if (useAuthStore.getState().user && (!get().owner || get().owner === owner))
      set({ snapshot: data });
    return true;
  },
  kitchen: async (action, data) => {
    if (get().busy) return false;
    const user = useAuthStore.getState().user, owner = get().owner;
    if (!user || !owner) return false;
    const dish = dishFor(data.item);
    set({ busy: true, error: null });
    try {
      // Cooked dishes steam on the stove for a moment first, so you see it being made.
      if (action === "serve" && dish?.cooked) {
        set({ cooking: { item: dish.item, until: Date.now() + COOK_MS } });
        await new Promise((r) => setTimeout(r, COOK_MS));
      }
      const { data: result, error } = await supabase.rpc("hostel_kitchen", {
        p_action: action,
        p_data: { ...data, owner },
        p_request: crypto.randomUUID(),
      });
      if (error) throw error;
      if (result?.snapshot && get().owner === owner) set({ snapshot: result.snapshot });
      if (action === "serve") await useWalletStore.getState().loadWallet(user.id);
      networkManager.roomChanged();
      set({
        notice:
          action === "serve"
            ? `${dish?.name || "Food"} is served on the table. Enjoy!`
            : data.slot === "drink" ? "Ahh, cold water. Refreshing." : "Chop life! The plate is clean.",
      });
      return true;
    } catch (e) {
      set({ error: (e as Error).message || "Could not reach the kitchen. Try again." });
      return false;
    } finally {
      set({ busy: false, cooking: null });
    }
  },
  command: async (action, data = {}) => {
    if (get().busy) return false;
    const user = useAuthStore.getState().user;
    if (!user) return false;
    const key = user.id + action + JSON.stringify(data),
      request = requests.get(key) || crypto.randomUUID();
    requests.set(key, request);
    set({ busy: true, error: null });
    try {
      const { data: result, error } = await supabase.rpc("hostel_command", {
        p_action: action,
        p_data: data,
        p_request: request,
      });
      if (error) throw error;
      if (useAuthStore.getState().user?.id !== user.id) return false;
      if (result?.snapshot && get().owner === user.id)
        set({ snapshot: result.snapshot });
      requests.delete(key);
      await get().load();
      await useWalletStore.getState().loadWallet(user.id);
      if (get().owner) await get().loadRoom(get().owner!);
      networkManager.roomChanged();
      const bought = action === "purchase" ? hostelItem(String((data as { item?: string }).item)) : undefined;
      const placeable = !!bought && !bought.consumable && bought.placementType !== "none";
      if (action === "purchase") set({ justBought: placeable ? bought!.id : null });
      set({
        notice:
          action === "sleep"
            ? null
            : action === "purchase"
              ? placeable
                ? `${bought!.name} is yours! Place it in your room below, or later under My items → Place.`
                : "Added to your inventory. Find it under My items."
              : action === "pay"
                ? "Iya Ibeji: Thank you, my student!"
                : action === "consume"
                  ? "Small chop. Student life continues."
                  : "Saved.",
      });
      return true;
    } catch (e) {
      set({ error: (e as Error).message || "Could not save. Retry safely." });
      return false;
    } finally {
      set({ busy: false });
    }
  },
  travel: async (target, owner, at) => {
    const user = useAuthStore.getState().user;
    if (!user || get().transition) return;
    if (useLectureStore.getState().isInClassroom) {
      set({ error: "Leave your lecture before travelling." });
      return;
    }
    if (target !== "campus" && !(await get().command("ensure"))) return;
    const roomOwner = owner || user.id;
    if (target === "room") {
      const { data, error } = await supabase.rpc("hostel_snapshot", {
        p_owner: roomOwner,
      });
      if (error) {
        set({ error: error.message });
        return;
      }
      set({ snapshot: data });
    }
    set({
      transition:
        target === "campus" ? "Returning to campus…" : "Heading home…",
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const roomId =
      target === "campus"
        ? "world:funaab:main"
        : target === "hostel"
          ? "world:funaab:hostel"
          : `world:funaab:hostel-room:${roomOwner}`;
    useInputStore.getState().clearTargetDestination();
    useGameStore.setState({
      myPosition:
        target === "campus"
          ? at ?? CAMPUS_SPAWN
          : target === "room"
            ? [0, 0, 2]
            : at ?? HOSTEL_SPAWN,
      activeModal: null,
      nearbyInteractable: null,
      isRidingKeke: false,
      selectedPlayer: null,
    });
    set({
      roomId,
      owner: target === "room" ? roomOwner : null,
      preview: null,
      transition: null,
      selected: null,
      pose: null,
      teleport: null,
    });
    await networkManager.switchRoom(roomId, user);
    try {
      if (target === "room")
        sessionStorage.setItem("funaab-room:" + user.id, roomOwner);
      else sessionStorage.removeItem("funaab-room:" + user.id);
    } catch {
      /* Storage may be unavailable; server persistence is unaffected. */
    }
  },
}));
