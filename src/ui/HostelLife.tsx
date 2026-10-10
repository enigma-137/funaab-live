import { HostelThumbnail } from "./HostelThumbnail";
import { RoomControls } from "./RoomControls";
import React, { useEffect, useRef, useState } from "react";
import { useHostelStore } from "../stores/hostelStore";
import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";
import { useWalletStore } from "../stores/walletStore";
import { useSocialStore } from "../stores/socialStore";
import { HOSTEL_SHOP, hostelItem } from "../config/hostelShop";
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
      (x) => Math.hypot(x.myPosition[0], x.myPosition[2] - 48) < 8,
    ),
    nearSecurity = useGameStore(
      (x) => Math.hypot(x.myPosition[0] - 8, x.myPosition[2] - 7) < 3,
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
      {(s.transition || securityHold) && (
        <div className="hostel-fade" role="status">
          {securityHold
            ? "Security says: small pause at the post 😭. Fictional game debt only."
            : s.transition}
        </div>
      )}
      {away && modal !== "hostel" && !s.preview && !s.pose && (
        <div className="hostel-dock">
          <strong>
            {s.owner
              ? `${s.snapshot?.owner_name || "Student"}’s room`
              : "Off-campus courtyard"}
          </strong>
          <button onClick={() => openHostel()}>Room</button>
          <button onClick={() => openHostel("shop")}>Shop</button>
          <button onClick={() => openHostel("decorate")}>Items</button>
          <button onClick={() => openHostel("invites")}>Invite</button>
          <button onClick={() => s.travel(s.owner ? "hostel" : "campus")}>
            {s.owner ? "Leave room" : "Go Campus"}
          </button>
        </div>
      )}
      {!away && nearGate && modal === null && (
        <button className="hostel-gate" onClick={() => openHostel()}>
          Go Hostel
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
              <small>OFF-CAMPUS LIFE · GAME CURRENCY</small>
              <h1>
                {s.panel === "shop"
                  ? "Iya Ibeji Shop"
                  : s.panel === "debts"
                    ? "Iya Ibeji debts"
                    : s.panel === "decorate"
                      ? "Make room for you."
                      : s.panel === "invites"
                        ? "Come my place."
                        : "Your room is ready."}
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
            {(["home", "shop", "decorate", "debts", "invites"] as const).map(
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
          <fieldset disabled={s.busy || !!s.transition}>
            {s.panel === "home" && (
              <>
                <p>
                  A mattress, a bucket, a light. The rest is your student story.
                </p>
                <div className="hostel-actions">
                  <button onClick={() => s.travel("hostel")}>Go Hostel</button>
                  <button onClick={() => s.travel("room")}>My Room</button>
                  <button
                    onClick={() => useHostelStore.setState({ panel: "shop" })}
                  >
                    Visit Iya Ibeji
                  </button>
                  <button onClick={() => s.travel("campus")}>Go Campus</button>
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
                  real hours; 24-hour grace period. Limit ₦1,500. No real money.
                </p>
                <nav aria-label="Shop categories">
                  {[
                    "Room",
                    "Entertainment",
                    "Power",
                    "Foodstuff",
                    "Basics",
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
                          <strong>₦{i.price}</strong>
                          <div className="hostel-actions">
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
                            {i.credit && (
                              <button
                                disabled={owned}
                                onClick={() =>
                                  s.command("purchase", {
                                    item: i.id,
                                    credit: true,
                                  })
                                }
                              >
                                Credit · owe ₦{Math.ceil((i.price * 110) / 100)}
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
                    Enter My Room to place furniture. Guests can inspect, but
                    cannot edit the owner’s room.{" "}
                    <button onClick={() => s.travel("room")}>My Room</button>
                  </p>
                )}
                <div className="hostel-items">
                  {inventory
                    .filter((i) => hostelItem(i.itemId))
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
