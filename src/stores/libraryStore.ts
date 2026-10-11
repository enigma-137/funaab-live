import { create } from "zustand";
import { isLibraryOpen, LIBRARY_ROOM, LIBRARY_HOURS } from "../config/library";
import { locationById } from "../config/campusLocations";
import { useAuthStore } from "./authStore";
import { useGameStore } from "./gameStore";
import { useHostelStore } from "./hostelStore";
import { useInputStore } from "./inputStore";
import { useLectureStore } from "./lectureStore";
import { networkManager } from "../game/multiplayer/networkManager";

function changeRoom(roomId: string, position: [number, number, number]) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  useInputStore.getState().clearTargetDestination();
  useInputStore.setState({ isDraggingCamera: false });
  useGameStore.setState({
    myPosition: position,
    myAnimation: "idle",
    activeModal: null,
    nearbyInteractable: null,
    selectedPlayer: null,
    selectedHallLocationId: null,
  });
  useHostelStore.setState({
    roomId,
    owner: null,
    pose: null,
    preview: null,
    teleport: null,
    selected: null,
    panel: "home",
  });
  void networkManager.switchRoom(roomId, user);
}
export const useLibraryStore = create<{
  notice: string;
  enter: () => void;
  leave: (notice?: string) => void;
}>((set) => ({
  notice: "",
  enter: () => {
    const game = useGameStore.getState();
    if (!isLibraryOpen()) {
      set({ notice: LIBRARY_HOURS });
      return;
    }
    if (
      useHostelStore.getState().roomId !== "world:funaab:main" ||
      useLectureStore.getState().isInClassroom ||
      useLectureStore.getState().isTransitioning ||
      game.isRidingKeke
    )
      return;
    const entrance = locationById("library").entrance;
    if (
      Math.hypot(
        game.myPosition[0] - entrance[0],
        game.myPosition[2] - entrance[2],
      ) > 7
    ) {
      set({ notice: "Walk to the library entrance first." });
      return;
    }
    set({ notice: "" });
    changeRoom(LIBRARY_ROOM, [0, 0, 9]);
  },
  leave: (notice = "") => {
    if (useHostelStore.getState().roomId !== LIBRARY_ROOM) return;
    set({ notice });
    changeRoom("world:funaab:main", [...locationById("library").entrance]);
  },
}));
