import { CAMPUS_SPAWN } from '../config/campusLocations';
import { HostelLauncherArt } from './phoneIcons';
import { ECONOMY_CONFIG, canBuyOnCredit, formatNaira, hostelCreditDebt } from '../config/economy';
import { SECURITY_POST, SECURITY_RADIUS } from '../config/hostelCompound';
import { HostelCompoundHud } from './HostelCompoundHud';
import { ArrowLeft, Home, ShoppingBag, Backpack, Users, Menu } from 'lucide-react';
import { HostelThumbnail } from "./HostelThumbnail";
import { RoomControls } from "./RoomControls";
import React, { useEffect, useRef, useState } from "react";
import { useHostelStore } from "../stores/hostelStore";
import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";
import { useWalletStore } from "../stores/walletStore";
import { useSocialStore } from "../stores/socialStore";
import { toast } from "../stores/toastStore";
import { HOSTEL_SHOP, hostelItem } from "../config/hostelShop";
import { WEARABLES, isKeepsake } from "../config/hostelItems";
import { FLOORS, PAINTS, ROOM_EXPANSION_PRICE, floorById, paintById, roomSizeOf } from "../config/roomMakeover";
import "./hostel.css";
export const openHostel = (
  panel: "home" | "shop" | "decorate" | "debts" | "invites" = "home",
) => {
  useHostelStore.setState({ panel, error: null, notice: null });
  useGameStore.getState().setActiveModal("hostel");
};
export function HostelLife() {
  const s = useHostelStore(),
    user = useAuthStore((x) => x.user),
    modal = useGameStore((x) => x.activeModal);
  const nearGate = useGameStore(
      (x) => Math.hypot(x.myPosition[0]-CAMPUS_SPAWN[0], x.myPosition[2]-CAMPUS_SPAWN[2]) < 8,
    ),
    nearSecurity = useGameStore(
      (x) => Math.hypot(x.myPosition[0] - SECURITY_POST[0], x.myPosition[2] - SECURITY_POST[2]) < SECURITY_RADIUS,
    ),
    setModal = useGameStore((x) => x.setActiveModal);
  const { inventory, balance } = useWalletStore(),
    friends = useSocialStore((x) => x.friends);
  const [category, setCategory] = useState("Room"),
    [securityHold, setSecurityHold] = useState(false);
  const securitySeen = useRef(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.querySelector(".hostel-panel")?.scrollTo(0, 0);
  }, [s.panel, category]);
  useEffect(() => {
    const overdue = s.debts.some(
      (d) => !d.paid_at && Date.now() > Date.parse(d.due_at) + 86400000,
    );
    if (
      s.roomId === "world:funaab:hostel" &&
      overdue &&
      nearSecurity &&
      !securitySeen.current
    ) {
      securitySeen.current = true;
      setSecurityHold(true);
      openHostel("debts");
      s.command("security");
      const timer = setTimeout(() => setSecurityHold(false), 3000);
      return () => {
        clearTimeout(timer);
        setSecurityHold(false);
      };
    }
  }, [s.roomId, nearSecurity, s.debts.length]);
  const mine = !!user && s.owner === user.id,
    away = s.roomId !== "world:funaab:main";
  // Sleeping happens in your own room, on the mattress; say so the first time you walk in.
  const [dockOpen, setDockOpen] = useState(false);
  // Notices ("Saved.") fade on their own so they never sit over the room.
  useEffect(() => {
    if (!s.notice) return;
    const t = setTimeout(() => useHostelStore.setState({ notice: null }), 3500);
    return () => clearTimeout(t);
  }, [s.notice]);
  const sleepHint = useRef("");
  useEffect(() => {
    if (!away || !mine || sleepHint.current === s.roomId) return;
    sleepHint.current = s.roomId;
    toast({ icon: "🛏️", text: "Want to sleep? Walk to your mattress and tap Lie Down.", tone: "info", ms: 6000 });
  }, [away, mine, s.roomId]);
  useEffect(() => {
    if (!user) return;
    s.load();
    const interval = setInterval(() => {
      s.load();
      if (useHostelStore.getState().owner)
        s.loadRoom(useHostelStore.getState().owner!);
    }, 10000);
    const change = () => {
      const o = useHostelStore.getState().owner;
      if (o) s.loadRoom(o);
    };
    const ended = (e: Event) => {
      useHostelStore.setState({
        notice: (e as CustomEvent).detail || "Room access ended.",
      });
      s.travel("hostel");
    };
    const notice = (e: Event) =>
      useHostelStore.setState({ notice: (e as CustomEvent).detail });
    window.addEventListener("hostel-room-changed", change);
    window.addEventListener("hostel-access-ended", ended);
    window.addEventListener("hostel-notice", notice);
    return () => {
      clearInterval(interval);
      window.removeEventListener("hostel-room-changed", change);
      window.removeEventListener("hostel-access-ended", ended);
      window.removeEventListener("hostel-notice", notice);
    };
  }, [user?.id]);
  useEffect(() => {
    if (modal !== "hostel") return;
    const previous = document.activeElement as HTMLElement;
    close.current?.focus();
    s.load();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        useHostelStore.setState({ preview: null });
      }
      if (e.key === "Tab") {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".hostel-panel button:not(:disabled),.hostel-panel select",
          ),
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  if (!user) return null;
  const incoming = s.invites.filter(
    (i) => i.guest_id === user.id && i.status === "pending",
  );
  const severe = s.debts.some(
    (d) => !d.paid_at && Date.now() > Date.parse(d.due_at) + 86400000,
  );
  const securityStop = away && !s.owner && severe && nearSecurity;
  return (
    <>
      <RoomControls />
      <HostelCompoundHud />
      {away && !s.preview && !s.pose && <button className="hostel-campus-return" aria-label="Return to campus" title="Return to campus" onClick={()=>s.travel('campus')}><ArrowLeft size={17}/><span>Campus</span></button>}

      {(s.transition || securityHold) && (
        <div className="hostel-fade" role="status">
          {securityHold
            ? "Security says: small pause at the post 😭. Fictional game debt only."
            : s.transition}
        </div>
      )}
      {away && modal !== "hostel" && !s.preview && !s.pose && !dockOpen && (
        <button className="hostel-menu-btn" aria-label="Open room menu" onClick={() => setDockOpen(true)}>
          <Menu size={18} /> Room menu
        </button>
      )}
      {away && modal !== "hostel" && !s.preview && !s.pose && dockOpen && (
        <div className="hostel-dock">
          <strong>
            {s.owner
              ? `${s.snapshot?.owner_name || "Student"}’s Room`
              : "HOSTEL"}
            <button className="hostel-dock-close" aria-label="Close room menu" onClick={() => setDockOpen(false)}>×</button>
          </strong>
          <button onClick={() => { setDockOpen(false); openHostel(); }}><Home size={16}/>Room</button>
          <button onClick={() => { setDockOpen(false); openHostel("shop"); }}><ShoppingBag size={16}/>Shop</button>
          <button onClick={() => { setDockOpen(false); openHostel("decorate"); }}><Backpack size={16}/>Items</button>
          <button onClick={() => { setDockOpen(false); openHostel("invites"); }}><Users size={16}/>Invite</button>
          {s.owner && <button onClick={() => { setDockOpen(false); s.travel('hostel'); }}>Leave room</button>}
        </div>
      )}
      {!away && nearGate && modal === null && (
        <button className="hostel-gate" onClick={() => openHostel()} aria-label="Enter hostel" title="Hostel">
          <HostelLauncherArt size={32} />
        </button>
      )}
      {incoming.length > 0 && modal === null && (
        <button className="hostel-invite" onClick={() => openHostel("invites")}>
          {incoming.length} room invitation{incoming.length > 1 ? "s" : ""}
        </button>
      )}
      {securityStop && modal === null && (
        <div className="hostel-security">
          <p>Hostel security: Iya Ibeji sent us 😭</p>
          <p>
            Game debt only. Take a moment at the post; your debt remains until
            paid.
          </p>
          <button
            onClick={() => {
              s.command("security");
              openHostel("debts");
            }}
          >
            Check game debt at the post
          </button>
        </div>
      )}
      {s.notice && modal === null && (
        <div className="hostel-notice" role="status">
          {s.notice}
          <button
            aria-label="Dismiss"
            onClick={() => useHostelStore.setState({ notice: null })}
          >
            ×
          </button>
        </div>
      )}
      {modal === "hostel" && (
        <section
          className="hostel-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Hostel life"
        >
          <header>
            <div>
              <small>HOSTEL · GAME CURRENCY</small>
              <h1>
                {s.panel === "shop"
                  ? "Iya Ibeji Shop"
                  : s.panel === "debts"
                    ? "Iya Ibeji debts"
                    : s.panel === "decorate"
                      ? "Make room for you."
                      : s.panel === "makeover"
                        ? "Room makeover"
                      : s.panel === "invites"
                        ? "Come my place."
                        : s.owner ? `${s.snapshot?.owner_name || "Student"}’s Room` : "HOSTEL"}
              </h1>
            </div>
            <button
              ref={close}
              aria-label="Close hostel"
              onClick={() => {
                setModal(null);
                useHostelStore.setState({ preview: null });
              }}
            >
              ×
            </button>
          </header>
          <nav aria-label="Hostel sections">
            {(["home", "shop", "decorate", "makeover", "debts", "invites"] as const).map(
              (p) => (
                <button
                  key={p}
                  aria-pressed={s.panel === p}
                  onClick={() =>
                    useHostelStore.setState({ panel: p, preview: null })
                  }
                >
                  {p === "decorate" ? "My items" : p}
                </button>
              ),
            )}
          </nav>
          <p className="hostel-balance">
            Wallet ₦{balance.toLocaleString()} · Virtual game prices
          </p>
          {s.error && (
            <p role="alert" className="hostel-error">
              {s.error} <button onClick={() => s.load()}>Retry loading</button>
            </p>
          )}
          {s.notice && <p role="status">{s.notice}</p>}
          {s.justBought && hostelItem(s.justBought) && (
            <div className="hostel-placeprompt" role="group" aria-label="Place your new item">
              <b>Place {hostelItem(s.justBought)!.name} now?</b>
              <div className="hostel-actions">
                <button onClick={() => void s.placeNow(s.justBought!)}>{mine ? "Place it" : "Go to my room & place it"}</button>
                <button onClick={() => useHostelStore.setState({ justBought: null })}>Later</button>
              </div>
            </div>
          )}
          <fieldset disabled={s.busy || !!s.transition}>
            {s.panel === "home" && (
              <>
                <p>
                  A mattress, a bucket, a light. The rest is your student story.
                </p>
                <div className="hostel-actions">
                  <button onClick={() => s.travel("hostel")}>Visit courtyard</button>
                  <button onClick={() => s.travel("room")}>Enter room</button>
                  <button
                    onClick={() => useHostelStore.setState({ panel: "shop" })}
                  >
                    Visit Iya Ibeji
                  </button>
                  <button onClick={() => s.travel("campus")}>Return to campus</button>
                </div>
                {s.owner && (
                  <>
                    <h2>Room life</h2>
                    <div className="hostel-actions">
                      <button
                        onClick={() => {
                          setModal(null);
                          useHostelStore.setState({
                            selected: "hostel_mattress",
                          });
                        }}
                      >
                        Find mattress
                      </button>
                      {mine &&
                        s.snapshot?.placements.some(
                          (p) => p.item_id === "hostel_tv_basic",
                        ) && (
                          <button onClick={() => s.command("tv")}>
                            Turn TV {s.snapshot.room.tv_on ? "Off" : "On"}
                          </button>
                        )}
                      {["hostel_tv_basic", "hostel_ps_console"].every((id) =>
                        s.snapshot?.placements.some((p) => p.item_id === id),
                      ) && (
                        <button onClick={() => setModal("ps_match")}>
                          Play PS with a friend
                        </button>
                      )}
                    </div>
                    <p>
                      Home PS uses the campus game. No wagers or home income.
                    </p>
                  </>
                )}
                <h2>Privacy</h2>
                <p>Owner + four guests. Invites expire after two hours.</p>
                <div className="hostel-actions">
                  {["private", "friends", "invite"].map((privacy) => (
                    <button
                      key={privacy}
                      onClick={() => s.command("privacy", { privacy })}
                    >
                      {privacy === "invite" ? "Invite only" : privacy}
                    </button>
                  ))}
                </div>
                {mine && <p>Current privacy: {s.snapshot?.room.privacy}</p>}
              </>
            )}
            {s.panel === "shop" && (
              <>
                <p>
                  “My student, choose well!” Credit: 10% game fee, due in 48
                  real hours; 24-hour grace period. Limit {formatNaira(ECONOMY_CONFIG.HOSTEL_CREDIT_LIMIT)}. No real money.
                </p>
                <nav aria-label="Shop categories">
                  {[
                    "Room",
                    "Entertainment",
                    "Power",
                    "Plants",
                    "Appliances",
                    "Foodstuff",
                    "Basics",
                    "Fashion",
                    "Cars",
                  ].map((c) => (
                    <button
                      key={c}
                      aria-pressed={c === category}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </nav>
                <div className="hostel-items">
                  {HOSTEL_SHOP.filter((i) => i.category === category).map(
                    (i) => {
                      const owned =
                        inventory.some((x) => x.itemId === i.id) &&
                        !i.consumable;
                      return (
                        <article key={i.id}>
                          <HostelThumbnail id={i.id} name={i.name} />
                          <h2>{i.name}</h2>
                          <p>
                            Owned:{" "}
                            {inventory.find((x) => x.itemId === i.id)
                              ?.quantity || 0}
                          </p>
                          <strong>{formatNaira(i.price)}</strong>
                          <div className="hostel-actions">
                            {owned && WEARABLES[i.id] ? (() => {
                              const w = WEARABLES[i.id];
                              const on = user?.avatarConfig?.[w.slot] === w.value;
                              return (
                                <button onClick={() => void useAuthStore.getState().updateAvatar({ [w.slot]: on ? "none" : w.value })}>
                                  {on ? "Take off" : "Wear"}
                                </button>
                              );
                            })() : owned && i.category === "Cars" ? (
                              <button disabled>In your garage · driving opens with the estate</button>
                            ) : (
                            <button
                              disabled={owned}
                              onClick={() =>
                                s.command("purchase", {
                                  item: i.id,
                                  credit: false,
                                })
                              }
                            >
                              {owned ? "Owned" : "Pay Now"}
                            </button>
                            )}
                            {i.credit && canBuyOnCredit(i.price) && (
                              <button
                                disabled={owned}
                                onClick={() =>
                                  s.command("purchase", {
                                    item: i.id,
                                    credit: true,
                                  })
                                }
                              >
                                Credit · owe {formatNaira(hostelCreditDebt(i.price))}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </>
            )}
            {s.panel === "decorate" && (
              <>
                {!mine && (
                  <p>
                    Enter Hostel to place furniture. Guests can inspect, but
                    cannot edit the owner’s Room.{" "}
                    <button onClick={() => s.travel("room")}>Hostel</button>
                  </p>
                )}
                <div className="hostel-items">
                  {inventory
                    .filter((i) => hostelItem(i.itemId) && !isKeepsake(hostelItem(i.itemId)!.category))
                    .map((i) => {
                      const c = hostelItem(i.itemId)!;
                      const placed = s.snapshot?.placements.find(
                        (p) => p.item_id === i.itemId,
                      );
                      return (
                        <article key={i.id}>
                          <HostelThumbnail id={c.id} name={c.name} />
                          <h2>
                            {c.name} ×{i.quantity}
                          </h2>
                          <p>
                            Owned {i.quantity} · Placed {placed ? 1 : 0} ·
                            Available{" "}
                            {Math.max(0, i.quantity - (placed ? 1 : 0))}
                          </p>
                          {c.consumable ? (
                            <button
                              onClick={() =>
                                s.command("consume", { item: c.id })
                              }
                            >
                              Enjoy snack
                            </button>
                          ) : (
                            c.placementType !== "none" && (
                              <div className="hostel-actions">
                                <button
                                  disabled={!mine}
                                  onClick={() => s.beginEdit(c.id)}
                                >
                                  {placed ? "Move" : "Place"}
                                </button>
                                {placed && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setModal(null);
                                        useHostelStore.setState({
                                          selected: c.id,
                                        });
                                      }}
                                    >
                                      Locate
                                    </button>
                                    <button
                                      disabled={!mine}
                                      onClick={() =>
                                        s.command("place", {
                                          item: c.id,
                                          anchor: null,
                                          owner: s.owner,
                                        })
                                      }
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            )
                          )}
                        </article>
                      );
                    })}
                </div>
              </>
            )}
            {s.panel === "makeover" && <Makeover mine={mine} balance={balance} />}
            {s.panel === "debts" && (
              <>
                {s.debts.length === 0 && (
                  <p>No game debt. Iya Ibeji is smiling.</p>
                )}
                {s.debts.map((d) => (
                  <article key={d.id}>
                    <h2>
                      {hostelItem(d.item_id)?.name} · ₦{d.amount}
                    </h2>
                    <p>
                      {d.paid_at
                        ? "Paid"
                        : Date.now() > Date.parse(d.due_at)
                          ? "Iya Ibeji: “Ah ah, you never pay me o.” — OVERDUE GAME DEBT"
                          : `Due ${new Date(d.due_at).toLocaleString()}`}
                    </p>
                    {!d.paid_at && (
                      <button onClick={() => s.command("pay", { debt: d.id })}>
                        Pay ₦{d.amount}
                      </button>
                    )}
                  </article>
                ))}
                {severe && (
                  <p>
                    Security has been informed about your Iya Ibeji game debt
                    😭. Visit the courtyard post. No real-world consequences;
                    jobs remain available.
                  </p>
                )}
                <button onClick={() => setModal("campus_jobs")}>
                  Earn with campus jobs
                </button>
              </>
            )}
            {s.panel === "invites" && (
              <>
                <h2>Invitations for you</h2>
                {s.invites
                  .filter(
                    (i) => i.guest_id === user.id && i.status !== "declined",
                  )
                  .map((i) => (
                    <article key={i.owner_id}>
                      <p>
                        {friends.find((f) => f.id === i.owner_id)?.username ||
                          "Your friend"}{" "}
                        invited you to their room.
                      </p>
                      <div className="hostel-actions">
                        <button
                          onClick={async () => {
                            if (
                              await s.command("respond", {
                                owner: i.owner_id,
                                accept: true,
                              })
                            )
                              await s.travel("room", i.owner_id);
                          }}
                        >
                          Visit
                        </button>
                        <button
                          onClick={() =>
                            s.command("respond", {
                              owner: i.owner_id,
                              accept: false,
                            })
                          }
                        >
                          Decline
                        </button>
                      </div>
                    </article>
                  ))}
                <h2>Invite a friend</h2>
                {friends.map((f) => (
                  <article key={f.id}>
                    <strong>{f.username}</strong>
                    <div className="hostel-actions">
                      <button
                        onClick={() => s.command("invite", { guest: f.id })}
                      >
                        Invite to Hostel
                      </button>
                      <button onClick={() => s.travel("room", f.id)}>
                        Visit room
                      </button>
                      <button
                        onClick={() => s.command("revoke", { guest: f.id })}
                      >
                        Revoke invite
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}
          </fieldset>
        </section>
      )}
    </>
  );
}

/** Paint, floor and the one-off room expansion. Prices are checked again by the database (migration 024). */
function Makeover({ mine, balance }: { mine: boolean; balance: number }) {
  const s = useHostelStore();
  const room = s.snapshot?.room;
  if (!mine || !room)
    return (
      <p>
        Enter your own room to repaint, change the floor or expand it.{" "}
        <button onClick={() => s.travel("room")}>Go to my room</button>
      </p>
    );
  const paint = paintById(room.wall_paint), floor = floorById(room.floor_style), large = roomSizeOf(room.room_size) === "large";
  return (
    <>
      <h2>Wall paint</h2>
      <p>Repaint all four walls. Going back to hostel white is free.</p>
      <div className="room-swatches" role="radiogroup" aria-label="Wall paint">
        {PAINTS.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={p.id === paint.id}
            className="room-swatch"
            disabled={p.id === paint.id || balance < p.price}
            onClick={() => s.command("decorate", { wall: p.id, owner: s.owner })}
          >
            <i style={{ background: `linear-gradient(135deg, ${p.back} 0 55%, ${p.side} 55% 100%)` }} aria-hidden />
            <span>{p.label}</span>
            <small>{p.id === paint.id ? "Current" : p.price ? formatNaira(p.price) : "Free"}</small>
          </button>
        ))}
      </div>
      <h2>Floor</h2>
      <div className="room-swatches" role="radiogroup" aria-label="Floor design">
        {FLOORS.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={f.id === floor.id}
            className="room-swatch"
            disabled={f.id === floor.id || balance < f.price}
            onClick={() => s.command("decorate", { floor: f.id, owner: s.owner })}
          >
            <i
              aria-hidden
              style={{
                background:
                  f.pattern === "checker" ? `conic-gradient(${f.accent} 0 25%, ${f.base} 0 50%, ${f.accent} 0 75%, ${f.base} 0) 0 0 / 50% 50%`
                  : f.pattern === "planks" ? `repeating-linear-gradient(0deg, ${f.base} 0 8px, ${f.accent} 8px 10px)`
                  : `radial-gradient(${f.accent} 1px, ${f.base} 1.5px) 0 0 / 6px 6px`,
              }}
            />
            <span>{f.label}</span>
            <small>{f.id === floor.id ? "Current" : f.price ? formatNaira(f.price) : "Free"}</small>
          </button>
        ))}
      </div>
      <h2>Bigger room</h2>
      {large ? (
        <p>✓ Expanded. Your room is 11 m wide: space for more furniture and more friends to hang out.</p>
      ) : (
        <>
          <p>Knock through to the next store room: your room becomes 11 m wide instead of 8 m. Furniture stays where it is. One-time payment.</p>
          <div className="hostel-actions">
            <button
              disabled={balance < ROOM_EXPANSION_PRICE}
              onClick={() => {
                if (window.confirm(`Expand your room for ${formatNaira(ROOM_EXPANSION_PRICE)}?`)) void s.command("expand", { owner: s.owner });
              }}
            >
              Expand room · {formatNaira(ROOM_EXPANSION_PRICE)}
            </button>
          </div>
          {balance < ROOM_EXPANSION_PRICE && <p>You need {formatNaira(ROOM_EXPANSION_PRICE - balance)} more. Campus jobs and hustles can help.</p>}
        </>
      )}
    </>
  );
}
