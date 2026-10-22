# FUNAAB Life — launch video

`funaab-life-launch.mp4` is 48.5 s long, 1920×1080, 30 fps, H.264 + AAC, loudness-normalised to −14 LUFS. `poster.jpg` is a thumbnail frame.

All footage is real in-engine capture of this repo's client. The soundtrack is original, synthesised by `music.py`, so it has no licensing restrictions.

| Time | Shot | Caption |
| --- | --- | --- |
| 0:00 | Logo card | FUNAAB Life · Public Beta · "Your campus. Your story." |
| 0:04 | Drone over the library / W-landmark | Your campus, now a living 3D world. |
| 0:09 | Walking in from the main gate | Step onto campus. |
| 0:13 | Drone around COLENG | Every college. One campus. |
| 0:16.5 | Students + proximity chat at the library | Meet real students. |
| 0:22 | Security officer catches you on the lawn (₦500 fine) | Just… stay off the lawn. |
| 0:26 | Keke ride from the car park | Hop on a keke. |
| 0:31.5 | Mai Suya / Indomie & Egg stalls | Suya after class? |
| 0:35.5 | Campus map | Never get lost. |
| 0:38 | Rising drone over the ceremonial road | Lectures · Campus jobs · Hostel life · Your ₦ wallet |
| 0:43.5 | End card | Public Beta — live now · not-affiliated disclaimer |

## Re-rendering

The pipeline runs the real game against a mocked Supabase and realtime server. Time is virtual: each captured frame advances the game by exactly 1/30 s, so software-rendered WebGL still gives smooth 30 fps footage.

1. Install the app dependencies with `npm ci`. Create a `.env` with `VITE_SUPABASE_URL=https://student-test.supabase.co` and `VITE_SUPABASE_ANON_KEY=test`. Then start `npx vite --port 5178 --host 127.0.0.1` and `npm run server`.
2. From this folder, run `node render.cjs [shot ...]`. It writes `frames/<shot>/NNNN.jpg`. A full render takes about 30–60 minutes with SwiftShader, and you can run shot subsets in parallel. Set `QUICK=1` to render 3 frames per shot as a smoke test.
3. Run `python3 music.py 48.5` to write `music.wav`. This needs numpy.
4. Run `node compose.cjs` to lay out the captions, cards and cuts from `compose.html` into `out/NNNNN.jpg`.
5. Encode:

   ```sh
   ffmpeg -framerate 30 -i out/%05d.jpg -i music.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 \
     -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart \
     -c:a aac -b:a 160k -ar 48000 -shortest funaab-life-launch.mp4
   ```

Set `PLAYWRIGHT_MODULE` if Playwright isn't resolvable from this folder.

Edit `EDL` in `compose.html` to change the copy, ordering or timing. Shot lengths are multiples of 15 frames, so cuts land on the 120 BPM beat. If you change the total length, update `music.py` to match.

## "What's new on FUNAAB Live" (update video)

`funaab-live-whats-new.mp4` is 36.5 s long, 1080p, with music only. Its shots are campus at night, the Arena, the new keke, more colleges, FPY farm work and sports, then a "Play now" end card. `whats-new-poster.jpg` is its thumbnail.

To re-render it, use the same steps as above with these changes:
- Render with `node render2.cjs [shot ...]`. The staged students come from `peers2.cjs`.
- Generate the music with `python3 music.py 36.5 -1 -1 music2.wav`.
- Lay out the frames with `PAGE=compose2.html OUT=/out2 node compose.cjs`.
- Encode `out2/` with `music2.wav`.

`render2.cjs` sets day or night per shot, so the output doesn't depend on the real Lagos clock.

## "Even more on campus" (second update video)

`funaab-live-more-new.mp4` is 30 s long, 1080p, with music only. Its shots are your own car, the mosque and church, Royal Gardens Estate and group chats, then the end card. `more-new-poster.jpg` is its thumbnail.

To re-render it:
- Run `node render3.cjs car mosque chapel estate`.
- Run `node render3.cjs group` separately. It renders at 960×540 @2x so the chat text is sharp.
- Generate the music with `python3 music.py 30 -1 -1 music3.wav`.
- Lay out the frames with `PAGE=compose3.html OUT=/out3 node compose.cjs`, then encode `out3/` with `music3.wav`.

The chapel only opens on Sundays, so its shot moves the game clock two days ahead (`window.__dayShift` in `vtime.js`).

## "New on campus" (third update video)

`funaab-live-race-gym-plaza.mp4` is 34 s long, 1080p, with music only. Its shots are the Campus Grand Prix, the gym, Gate Plaza shops and billboards, better transport (the Korope on the campus route, with no fares shown) and cooking at home, then the end card. `race-gym-plaza-poster.jpg` is its thumbnail.

To re-render it:
- Run `node render4.cjs race gym plaza` and `node render4.cjs transport kitchen`. The two groups can run in parallel.
- Generate the music with `python3 music.py 34 -1 -1 music4.wav`.
- Lay out the frames with `PAGE=compose4.html OUT=/out4 node compose.cjs`, then encode `out4/` with `music4.wav`.

The race uses an autopilot that steers along the race line. The gym shot moves the game clock to 5:30 PM Lagos time so the gym is open. The kitchen room comes from the mocked `hostel_snapshot` in `harness.cjs`.
