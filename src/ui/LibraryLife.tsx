import { useEffect, useState } from "react";
import { LIBRARY_ROOM, LIBRARY_HOURS, isLibraryOpen } from "../config/library";
import { useHostelStore } from "../stores/hostelStore";
import { useGameStore } from "../stores/gameStore";
import { useLibraryStore } from "../stores/libraryStore";

export function LibraryLife() {
  const inside = useHostelStore((s) => s.roomId === LIBRARY_ROOM);
  const modal = useGameStore((s) => s.activeModal);
  const { notice, enter, leave } = useLibraryStore();
  const [open, setOpen] = useState(isLibraryOpen);
  useEffect(() => {
    const check = () => {
      const open = isLibraryOpen();
      setOpen(open);
      if (!open)
        leave(
          "The library has closed for today. Please visit Monday–Friday, 8am–5pm.",
        );
    };
    const ended = (event: Event) =>
      leave((event as CustomEvent).detail || "Library access ended.");
    check();
    const timer = window.setInterval(check, 1000);
    window.addEventListener("library-access-ended", ended);
    return () => {
      clearInterval(timer);
      window.removeEventListener("library-access-ended", ended);
    };
  }, [leave]);
  useEffect(() => {
    if (modal !== "library") return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useGameStore.getState().setActiveModal(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal]);
  return (
    <>
      {inside && (
        <button
          className="hostel-campus-return"
          onClick={() => leave()}
          aria-label="Leave library"
        >
          ← Leave library
        </button>
      )}
      {notice && modal !== "library" && (
        <div className="hostel-notice" role="status">
          {notice}{" "}
          <button
            aria-label="Dismiss library notice"
            onClick={() => useLibraryStore.setState({ notice: "" })}
          >
            ×
          </button>
        </div>
      )}
      {modal === "library" && (
        <div className="keke-backdrop">
          <section
            className="keke-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Library"
          >
            <header>
              <h2>📚 'Nimbe Adedipe Library</h2>
              <button
                autoFocus
                aria-label="Close library"
                onClick={() => useGameStore.getState().setActiveModal(null)}
              >
                ×
              </button>
            </header>
            <p>
              Browse the bookcases, meet other students and share a quiet study
              break in the reading room.
            </p>
            <p>
              <strong>{open ? "Open now" : "Closed now"}</strong> ·{" "}
              {LIBRARY_HOURS}
            </p>
            {notice && <p role="status">{notice}</p>}
            <footer>
              <button className="keke-confirm" disabled={!open} onClick={enter}>
                {open ? "Enter library" : "Library closed"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
