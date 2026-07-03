import React, { useState, useEffect, useRef, useCallback } from "react";

/* =====================================================================
   FORBES JAGS — a Pac-Man-inspired dorm-party prototype
   ---------------------------------------------------------------------
   Everything lives in one file here so it can be dropped straight into
   an artifact preview. When you move this to GitHub, split it along
   these section boundaries into: map.js, engine.js, Hud.jsx,
   Dialogue.jsx, Controls.jsx, Setup.jsx, and App.jsx — the comments
   below mark exactly where those seams are.
   ===================================================================== */

/* ----------------------- 1. MAP DATA (map.js) ----------------------- */

const COLS = 25;
const ROWS = 17;
const WALL = 0;
const FLOOR = 1;
const COMMON = 2;

const HALLWAY_Y = 8;
const TUNNEL_LEFT_X = 2;
const TUNNEL_RIGHT_X = 22;
const KEVIN_OFFICE = { x: 7, y: 7 };
const PLAYER_START = { x: 12, y: 9 };

function buildGrid() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(WALL));
  for (let x = TUNNEL_LEFT_X; x <= TUNNEL_RIGHT_X; x++) g[HALLWAY_Y][x] = FLOOR;
  for (let y = 1; y <= HALLWAY_Y; y++) g[y][12] = FLOOR;
  for (let y = 5; y <= 11; y++) g[y][4] = FLOOR;
  for (let x = 1; x <= 4; x++) { g[5][x] = FLOOR; g[11][x] = FLOOR; }
  for (let y = 5; y <= 11; y++) g[y][20] = FLOOR;
  for (let x = 20; x <= 23; x++) { g[5][x] = FLOOR; g[11][x] = FLOOR; }
  // Ring loop around the common room (lounge)
  for (let x = 9; x <= 14; x++) { g[9][x] = FLOOR; g[14][x] = FLOOR; }
  for (let y = 9; y <= 14; y++) { g[y][9] = FLOOR; g[y][14] = FLOOR; }
  // Common room interior (lounge) — a 4x4 room
  for (let y = 10; y <= 13; y++) for (let x = 10; x <= 13; x++) g[y][x] = COMMON;
  g[KEVIN_OFFICE.y][KEVIN_OFFICE.x] = FLOOR;
  return g;
}
const GRID = buildGrid();

function isWalkable(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return GRID[y][x] !== WALL;
}

function buildRooms() {
  const rooms = [];
  let id = 1;
  [2, 4, 6].forEach((cy) => {
    rooms.push({ id: id++, cx: 12, cy, side: "left", doorX: 11, doorY: cy, wing: "North Wing" });
    rooms.push({ id: id++, cx: 12, cy, side: "right", doorX: 13, doorY: cy, wing: "North Wing" });
  });
  [1, 2, 3].forEach((cx) => {
    rooms.push({ id: id++, cx, cy: 5, side: "up", doorX: cx, doorY: 4, wing: "West Wing (North)" });
    rooms.push({ id: id++, cx, cy: 5, side: "down", doorX: cx, doorY: 6, wing: "West Wing (North)" });
    rooms.push({ id: id++, cx, cy: 11, side: "up", doorX: cx, doorY: 10, wing: "West Wing (South)" });
    rooms.push({ id: id++, cx, cy: 11, side: "down", doorX: cx, doorY: 12, wing: "West Wing (South)" });
  });
  [21, 22, 23].forEach((cx) => {
    rooms.push({ id: id++, cx, cy: 5, side: "up", doorX: cx, doorY: 4, wing: "East Wing (North)" });
    rooms.push({ id: id++, cx, cy: 5, side: "down", doorX: cx, doorY: 6, wing: "East Wing (North)" });
    rooms.push({ id: id++, cx, cy: 11, side: "up", doorX: cx, doorY: 10, wing: "East Wing (South)" });
    rooms.push({ id: id++, cx, cy: 11, side: "down", doorX: cx, doorY: 12, wing: "East Wing (South)" });
  });
  return rooms;
}
const ROOMS = buildRooms();
const ROOM_NUMBER = (id) => 100 + id;

function freshRoomStates() {
  const rs = {};
  ROOMS.forEach((r) => (rs[r.id] = "closed"));
  return rs;
}

const PROGRAMS = [
  { id: "p1", x: 12, y: 1, name: "Movie Night", icon: "🎬" },
  { id: "p2", x: 1, y: 5, name: "Pizza with the RA", icon: "🍕" },
  { id: "p3", x: 23, y: 11, name: "Resume Workshop", icon: "📄" },
  { id: "p4", x: 12, y: 12, name: "Study Skills Workshop", icon: "📚" },
];

const ITEMS = ["Sorrento's Pizza", "Taiwan Cafe", "Panther Card", "Beer", "Music Speaker", "Cups"];
const ICON = {
  "Sorrento's Pizza": "🍕",
  "Taiwan Cafe": "🥡",
  "Panther Card": "💳",
  Beer: "🍺",
  "Music Speaker": "🔊",
  Cups: "🧃",
};

const GAME_SECONDS = 150;
const MAX_EXTRA_RAS = 2;
const MAX_STRIKES = 3;
const MAX_CARRY = 3;
const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FREEZE_TICKS = 25; // ~5s at 200ms/tick

// Setup-screen options (max 3 each)
const GOAL_OPTIONS = [10, 15, 20];
const DEFAULT_GOAL = 15; // medium difficulty by default
const PLAYER_SPRITES = [
  { id: "boy", label: "Boy", src: "/sprites/boy.png" },
  { id: "girl", label: "Girl", src: "/sprites/girl.png" },
  { id: "panther", label: "Panther", src: "/sprites/panther.png" },
];
function playerSpriteSrc(id) {
  return (PLAYER_SPRITES.find((s) => s.id === id) || PLAYER_SPRITES[0]).src;
}
const RA_SPRITE_OPTIONS = ["📋", "🔍", "🚩"];

// Kevin is the main villain — average speed. Ali is nice and moves slower.
// Vanessa is basically a second Kevin — same speed, just as relentless.
const RA_ROSTER = [
  { name: "Kevin", patrolInterval: 2, chaseInterval: 1, color: "#6f8fd4" },
  { name: "Ali", patrolInterval: 3, chaseInterval: 2, color: "#7ec9a3" },
  { name: "Vanessa", patrolInterval: 2, chaseInterval: 1, color: "#c15fd1" },
];
const ALI_TRIGGER_ITEMS = 3; // Ali comes on duty once you've collected this many items total
const VANESSA_TRIGGER_CATCHES = 1; // Vanessa comes on duty the first time you're caught

/* ----------------------- 2. GAME ENGINE (engine.js) ------------------ */

function makeRA(id, roster, icon) {
  return {
    id,
    name: roster.name,
    color: roster.color,
    icon,
    patrolInterval: roster.patrolInterval,
    chaseInterval: roster.chaseInterval,
    x: KEVIN_OFFICE.x,
    y: KEVIN_OFFICE.y,
    dir: "down",
    state: "patrol",
    timer: 0,
    lastX: null,
    lastY: null,
    targetX: null,
    targetY: null,
  };
}

function initialGame(winTarget, raSprites, playerSprite, playerName) {
  const pelletsCollected = {};
  PROGRAMS.forEach((p) => (pelletsCollected[p.id] = false));
  return {
    phase: "intro", // intro | setup | playing | dialogue | win | lose
    playerName: playerName || "Freshman",
    playerSprite: playerSprite || PLAYER_SPRITES[0].id,
    raSprites: raSprites || { Kevin: RA_SPRITE_OPTIONS[0], Ali: RA_SPRITE_OPTIONS[0], Vanessa: RA_SPRITE_OPTIONS[0] },
    winTarget: winTarget || DEFAULT_GOAL,
    player: { x: PLAYER_START.x, y: PLAYER_START.y, dir: "down" },
    kevin: makeRA(1, RA_ROSTER[0], (raSprites && raSprites.Kevin) || RA_SPRITE_OPTIONS[0]),
    extraRAs: [],
    nextRAId: 2,
    strikes: 0,
    catchCount: 0,
    totalCollected: 0,
    roomStates: freshRoomStates(),
    pelletsCollected,
    carried: [],
    delivered: 0,
    score: 0,
    alert: 0,
    timeLeft: GAME_SECONDS,
    message: "Tonight, everyone wants to hang out.",
    dialogue: null,
    recruitBoost: 0,
    tickCount: 0,
    loseReason: null,
  };
}

function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function neighbors(x, y) {
  const base = Object.entries(DIR_VEC)
    .map(([dir, [dx, dy]]) => ({ dir, x: x + dx, y: y + dy }))
    .filter((n) => isWalkable(n.x, n.y) && GRID[n.y][n.x] !== COMMON);
  if (x === TUNNEL_LEFT_X && y === HALLWAY_Y) base.push({ dir: "left", x: TUNNEL_RIGHT_X, y: HALLWAY_Y });
  if (x === TUNNEL_RIGHT_X && y === HALLWAY_Y) base.push({ dir: "right", x: TUNNEL_LEFT_X, y: HALLWAY_Y });
  return base;
}

function moveRA(ra, player, tickCount) {
  if (ra.state === "frozen") {
    const t = ra.timer - 1;
    if (t <= 0) return { ...ra, state: "patrol", timer: 0 };
    return { ...ra, timer: t };
  }

  const fast = ra.state === "chasing" || ra.state === "alerted";
  const interval = fast ? ra.chaseInterval : ra.patrolInterval;
  if (tickCount % interval !== 0) return ra;

  const { x, y, lastX, lastY, state, timer } = ra;

  if (state === "returning") {
    if (x === KEVIN_OFFICE.x && y === KEVIN_OFFICE.y) {
      return { ...ra, state: "patrol", timer: 0, lastX: x, lastY: y };
    }
    const opts = neighbors(x, y).filter((n) => !(n.x === lastX && n.y === lastY));
    const pool = opts.length ? opts : neighbors(x, y);
    const pick = pool.sort((a, b) => dist(a, KEVIN_OFFICE) - dist(b, KEVIN_OFFICE))[0];
    if (!pick) return ra;
    return { ...ra, x: pick.x, y: pick.y, dir: pick.dir, lastX: x, lastY: y };
  }

  if (state === "chasing" || state === "alerted") {
    const t = timer - 1;
    const target = state === "alerted" && ra.targetX != null ? { x: ra.targetX, y: ra.targetY } : player;
    const opts = neighbors(x, y).filter((n) => !(n.x === lastX && n.y === lastY));
    const pool = opts.length ? opts : neighbors(x, y);
    const pick = pool.sort((a, b) => dist(a, target) - dist(b, target))[0];
    if (!pick) return ra;
    const arrived = pick.x === target.x && pick.y === target.y;
    if (t <= 0 || (state === "alerted" && arrived)) {
      return { ...ra, x: pick.x, y: pick.y, dir: pick.dir, state: "patrol", timer: 0, lastX: x, lastY: y };
    }
    return { ...ra, x: pick.x, y: pick.y, dir: pick.dir, timer: t, lastX: x, lastY: y };
  }

  const opts = neighbors(x, y).filter((n) => !(n.x === lastX && n.y === lastY));
  const pool = opts.length ? opts : neighbors(x, y);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return ra;
  return { ...ra, x: pick.x, y: pick.y, dir: pick.dir, lastX: x, lastY: y };
}

/* --------------------------- 4. ROOT APP ----------------------------- */

export default function ForbesJags() {
  const [setup, setSetup] = useState({
    name: "",
    playerSprite: PLAYER_SPRITES[0].id,
    raSprites: { Kevin: RA_SPRITE_OPTIONS[0], Ali: RA_SPRITE_OPTIONS[0], Vanessa: RA_SPRITE_OPTIONS[0] },
    goal: DEFAULT_GOAL,
  });
  const [game, setGame] = useState(() => initialGame(DEFAULT_GOAL));
  const pressedDir = useRef(null);
  const [activeBtn, setActiveBtn] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null); // the prompt event can only be used once
  };

  useEffect(() => {
    if (!game.message) return;
    const t = setTimeout(() => setGame((g) => ({ ...g, message: "" })), 2200);
    return () => clearTimeout(t);
  }, [game.message]);

  useEffect(() => {
    const keyMap = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const onDown = (e) => {
      if (keyMap[e.key]) { pressedDir.current = keyMap[e.key]; e.preventDefault(); }
      if (e.key === " ") { e.preventDefault(); knock(); }
    };
    const onUp = (e) => {
      if (keyMap[e.key] && pressedDir.current === keyMap[e.key]) pressedDir.current = null;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const knock = useCallback(() => {
    setGame((g) => {
      if (g.phase !== "playing") return g;
      const { x, y, dir } = g.player;
      const room = ROOMS.find((r) => r.cx === x && r.cy === y && r.side === dir);
      if (!room) return g;
      const state = g.roomStates[room.id];
      if (state === "recruited" || state === "empty" || state === "locked") return g;
      if (g.carried.length >= MAX_CARRY) {
        return { ...g, message: "Your hands are full — get to the Common Room first!" };
      }

      const boosted = g.recruitBoost > 0;
      const roll = Math.random();
      const next = { ...g, roomStates: { ...g.roomStates } };

      if (roll < (boosted ? 0.65 : 0.42)) {
        const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        next.roomStates[room.id] = "recruited";
        next.carried = [...g.carried, item];
        next.totalCollected = (g.totalCollected || 0) + 1;
        next.message = `Room ${ROOM_NUMBER(room.id)}: got ${item}! ${ICON[item]}`;

        const hasAli = g.extraRAs.some((r) => r.name === "Ali");
        if (!hasAli && next.totalCollected >= ALI_TRIGGER_ITEMS && next.extraRAs.length < MAX_EXTRA_RAS) {
          const ali = makeRA(g.nextRAId, RA_ROSTER[1], g.raSprites.Ali);
          const speedUp = (ra) => ({
            ...ra,
            patrolInterval: Math.max(1, ra.patrolInterval - 1),
            chaseInterval: Math.max(1, ra.chaseInterval - 1),
          });
          next.kevin = speedUp(g.kevin);
          next.extraRAs = [...g.extraRAs, speedUp(ali)];
          next.nextRAId = g.nextRAId + 1;
          next.message += " Ali is now on duty — everyone's moving faster!";
        }
      } else if (roll < (boosted ? 0.8 : 0.62)) {
        next.roomStates[room.id] = "empty";
        next.message = "Nobody answered...";
      } else if (roll < (boosted ? 0.93 : 0.82)) {
        next.roomStates[room.id] = "locked";
        next.message = "Door is locked.";
      } else {
        next.roomStates[room.id] = "studying";
        next.message = "They're struggling with Lon-Cappa — knock again later!";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const studyingDoors = ROOMS.filter((r) => game.roomStates[r.id] === "studying");
    if (studyingDoors.length === 0) return;
    const t = setTimeout(() => {
      setGame((g) => {
        const rs = { ...g.roomStates };
        studyingDoors.forEach((r) => { if (rs[r.id] === "studying") rs[r.id] = "closed"; });
        return { ...g, roomStates: rs };
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [game.roomStates]);

  const tick = useCallback((g) => {
    let next = { ...g, tickCount: g.tickCount + 1 };

    if (next.tickCount % 5 === 0) next.timeLeft = Math.max(0, g.timeLeft - 1);
    if (next.recruitBoost > 0 && next.tickCount % 5 === 0) next.recruitBoost = Math.max(0, next.recruitBoost - 1);
    if (next.alert > 0 && next.tickCount % 10 === 0) next.alert = Math.max(0, next.alert - 2);

    const dir = pressedDir.current;
    if (dir) {
      const [dx, dy] = DIR_VEC[dir];
      let nx = g.player.x + dx, ny = g.player.y + dy;
      if (dir === "left" && g.player.x === TUNNEL_LEFT_X && g.player.y === HALLWAY_Y) { nx = TUNNEL_RIGHT_X; ny = HALLWAY_Y; }
      else if (dir === "right" && g.player.x === TUNNEL_RIGHT_X && g.player.y === HALLWAY_Y) { nx = TUNNEL_LEFT_X; ny = HALLWAY_Y; }
      next.player = isWalkable(nx, ny) ? { x: nx, y: ny, dir } : { ...g.player, dir };
    }

    const pellet = PROGRAMS.find((p) => !next.pelletsCollected[p.id] && p.x === next.player.x && p.y === next.player.y);
    if (pellet) {
      next.pelletsCollected = { ...next.pelletsCollected, [pellet.id]: true };
      next.phase = "dialogue";
      next.dialogue = { name: pellet.name, icon: pellet.icon };
      return next;
    }

    const onCommon = GRID[next.player.y][next.player.x] === COMMON;
    if (onCommon && next.carried.length > 0) {
      next.delivered = g.delivered + next.carried.length;
      next.score = next.delivered * 10;
      next.message = `Delivered ${next.carried.length} item(s) to the party!`;
      next.carried = [];
    }

    next.kevin = moveRA(g.kevin, next.player, next.tickCount);
    next.extraRAs = g.extraRAs.map((ra) => moveRA(ra, next.player, next.tickCount));

    const allRAs = [next.kevin, ...next.extraRAs];
    const hitIdx = allRAs.findIndex((ra) => ra.state !== "frozen" && ra.x === next.player.x && ra.y === next.player.y);
    if (hitIdx !== -1) {
      const setReturning = (ra) => ({ ...ra, state: "returning", timer: 0 });
      // Getting caught shakes the floor up — every door resets so there
      // are fresh snacks to find on your next pass.
      next.roomStates = freshRoomStates();
      next.catchCount = g.catchCount + 1;

      if (next.carried.length > 0) {
        next.strikes = g.strikes + 1;
        next.carried = [];
        next.message = `Busted! Strike ${next.strikes}/${MAX_STRIKES}. Rooms reset!`;
        next.alert = Math.min(100, next.alert + 20);
        if (hitIdx === 0) next.kevin = setReturning(next.kevin);
        else next.extraRAs = next.extraRAs.map((ra, i) => (i === hitIdx - 1 ? setReturning(ra) : ra));
        if (next.strikes >= MAX_STRIKES) {
          next.phase = "lose";
          next.loseReason = "busted";
        }
      } else {
        next.alert = Math.min(100, next.alert + 10);
        if (hitIdx === 0) next.kevin = setReturning(next.kevin);
        else next.extraRAs = next.extraRAs.map((ra, i) => (i === hitIdx - 1 ? setReturning(ra) : ra));
        next.message = "Caught! Rooms reset — fresh snacks are out there.";
      }

      const hasVanessa = next.extraRAs.some((r) => r.name === "Vanessa");
      if (!hasVanessa && next.catchCount >= VANESSA_TRIGGER_CATCHES && next.extraRAs.length < MAX_EXTRA_RAS) {
        next.extraRAs = [...next.extraRAs, makeRA(next.nextRAId, RA_ROSTER[2], next.raSprites.Vanessa)];
        next.nextRAId = next.nextRAId + 1;
        next.message += " Vanessa is now on duty!";
      }
    }

    if (next.delivered >= next.winTarget) {
      next.phase = "win";
    } else if (next.timeLeft <= 0 && next.phase === "playing") {
      next.phase = "lose";
      next.loseReason = "time";
    }

    return next;
  }, []);

  useEffect(() => {
    if (game.phase !== "playing") return;
    const id = setInterval(() => setGame((g) => tick(g)), 200);
    return () => clearInterval(id);
  }, [game.phase, tick]);

  const goToSetup = () => setGame((g) => ({ ...g, phase: "setup" }));
  const goToMenu = () => setGame((g) => ({ ...g, phase: "intro" }));

  const startGame = () => {
    pressedDir.current = null;
    setGame({
      ...initialGame(setup.goal, setup.raSprites, setup.playerSprite, setup.name || "Freshman"),
      phase: "playing",
    });
  };

  const answerProgram = (yes) => {
    setGame((g) => {
      if (yes) {
        const freeze = (ra) => ({ ...ra, state: "frozen", timer: FREEZE_TICKS });
        return {
          ...g,
          phase: "playing",
          kevin: freeze(g.kevin),
          extraRAs: g.extraRAs.map(freeze),
          recruitBoost: 15,
          message: `Everyone freezes for ${g.dialogue?.name}! Safe to move — residents seem friendlier too.`,
          dialogue: null,
        };
      }
      return {
        ...g,
        phase: "playing",
        kevin: { ...g.kevin, state: "chasing", timer: 18 },
        alert: Math.min(100, g.alert + 25),
        message: "Kevin is NOT happy. He's coming for you!",
        dialogue: null,
      };
    });
  };

  const pressDir = (dir) => { pressedDir.current = dir; setActiveBtn(dir); };
  const releaseDir = (dir) => {
    if (pressedDir.current === dir) pressedDir.current = null;
    setActiveBtn((b) => (b === dir ? null : b));
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        * { box-sizing: border-box; }
        .fj-btn { font-family: 'Press Start 2P', monospace; cursor: pointer; border: none; image-rendering: pixelated; }
        .fj-btn:active { transform: translateY(2px); }
        @keyframes fj-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fj-shake { 0%,100% { transform: translateX(0) rotate(0deg); } 25% { transform: translateX(-3px) rotate(-8deg); } 75% { transform: translateX(3px) rotate(8deg); } }
        @keyframes fj-doorglow { 0%,100% { box-shadow: 0 0 4px 2px rgba(255,214,120,0.85); } 50% { box-shadow: 0 0 11px 6px rgba(255,214,120,1); } }
        .fj-door-glow { animation: fj-doorglow 0.9s ease-in-out infinite; outline: 2px solid #fff8dc; z-index: 3; }
      `}</style>

      {game.phase === "intro" && <IntroScreen onStart={goToSetup} installPrompt={installPrompt} onInstall={handleInstall} />}
      {game.phase === "setup" && <SetupScreen setup={setup} setSetup={setSetup} onStart={startGame} />}
      {(game.phase === "playing" || game.phase === "dialogue") && (
        <PlayScreen game={game} pressDir={pressDir} releaseDir={releaseDir} activeBtn={activeBtn} knock={knock} onMenu={goToMenu} />
      )}
      {game.phase === "dialogue" && <ProgramDialogue dialogue={game.dialogue} onAnswer={answerProgram} />}
      {game.phase === "win" && <EndScreen won game={game} onRestart={goToSetup} onMenu={goToMenu} />}
      {game.phase === "lose" && <EndScreen won={false} game={game} onRestart={goToSetup} onMenu={goToMenu} />}
    </div>
  );
}

/* --------------------------- UI: Intro Screen ------------------------- */

function IntroScreen({ onStart, installPrompt, onInstall }) {
  return (
    <div style={styles.introWrap}>
      <div style={styles.introCard}>
        <div style={styles.title}>FORBES JAGS</div>
        <div style={styles.subtitle}>Freshman Year Begins</div>
        <p style={styles.introText}>
          You just moved into Forbes Hall and tonight, everyone wants to hang out.
          Knock on doors across the North, West, and East wings, recruit your
          floormates, and haul supplies back to the common room before it's the
          best gathering spot on campus. You can only carry 3 items at a time,
          so plan your trips.
        </p>
        <p style={styles.introText}>
          Kevin, the main RA on duty, patrols the halls and really wants everyone at his RA
          Programs instead. Get caught and every door resets with fresh snacks
          to find — but collect 3 items and easygoing Ali joins the patrol (and
          everyone speeds up), and the very first time you're caught,
          no-nonsense Vanessa joins too. Get caught carrying supplies three
          times and you're busted — the party's over. Say yes to an RA
          Program and everyone freezes in place for a few seconds — safe
          passage. RAs can never set foot in the lounge, so use the
          stairwell to loop around and duck in there when things get hot.
        </p>
        <p style={styles.introSmall}>
          Move: Arrow keys / WASD &nbsp;·&nbsp; Knock: Spacebar or the KNOCK button
        </p>
        <button className="fj-btn" style={styles.startBtn} onClick={onStart}>CONTINUE →</button>
        {installPrompt && (
          <div>
            <button className="fj-btn" style={styles.installBtn} onClick={onInstall}>📲 Install App</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- UI: Setup Screen -------------------------- */

function SetupScreen({ setup, setSetup, onStart }) {
  const updateRA = (name, icon) =>
    setSetup((s) => ({ ...s, raSprites: { ...s.raSprites, [name]: icon } }));

  return (
    <div style={styles.introWrap}>
      <div style={styles.introCard}>
        <div style={styles.title}>SETUP</div>
        <div style={styles.subtitle}>Make it yours</div>

        <div style={styles.setupSection}>
          <label style={styles.setupLabel}>Your name</label>
          <input
            style={styles.textInput}
            value={setup.name}
            maxLength={16}
            placeholder="Freshman"
            onChange={(e) => setSetup((s) => ({ ...s, name: e.target.value }))}
          />
        </div>

        <div style={styles.setupSection}>
          <label style={styles.setupLabel}>Your sprite</label>
          <div style={styles.spriteRow}>
            {PLAYER_SPRITES.map((sp) => (
              <button
                key={sp.id}
                className="fj-btn"
                onClick={() => setSetup((s) => ({ ...s, playerSprite: sp.id }))}
                style={{ ...styles.spriteBtn, background: setup.playerSprite === sp.id ? "#e2a13b" : "#2f2657" }}
              >
                <img src={sp.src} alt={sp.label} style={styles.spriteThumb} />
              </button>
            ))}
          </div>
        </div>

        {RA_ROSTER.map((r) => (
          <div style={styles.setupSection} key={r.name}>
            <label style={styles.setupLabel}>{r.name}'s sprite</label>
            <div style={styles.spriteRow}>
              {RA_SPRITE_OPTIONS.map((sp) => (
                <button
                  key={sp}
                  className="fj-btn"
                  onClick={() => updateRA(r.name, sp)}
                  style={{ ...styles.spriteBtn, background: setup.raSprites[r.name] === sp ? "#e2a13b" : "#2f2657" }}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={styles.setupSection}>
          <label style={styles.setupLabel}>Party goal (items to deliver)</label>
          <div style={styles.spriteRow}>
            {GOAL_OPTIONS.map((n) => (
              <button
                key={n}
                className="fj-btn"
                onClick={() => setSetup((s) => ({ ...s, goal: n }))}
                style={{ ...styles.goalBtn, background: setup.goal === n ? "#e2a13b" : "#2f2657" }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button className="fj-btn" style={styles.startBtn} onClick={onStart}>START GAME</button>
      </div>
    </div>
  );
}

/* --------------------------- UI: End Screen ---------------------------- */

function EndScreen({ won, game, onRestart, onMenu }) {
  const loseText =
    game.loseReason === "busted"
      ? "Kevin busted you three times. The party's cancelled."
      : "Time's up before the RA got you a third time.";
  return (
    <div style={styles.introWrap}>
      <div style={styles.introCard}>
        <div style={{ ...styles.title, color: won ? "#6ea36a" : "#d1453b" }}>
          {won ? "PARTY OF THE YEAR!" : game.loseReason === "busted" ? "BUSTED!" : "TIME'S UP"}
        </div>
        <div style={styles.subtitle}>{won ? "This will be the best story told at Jagfest 10 years from now." : loseText}</div>
        <p style={styles.introText}>
          Items delivered: {game.delivered}/{game.winTarget} &nbsp;·&nbsp; Party Score: {game.score} &nbsp;·&nbsp; Strikes: {game.strikes}/{MAX_STRIKES}
        </p>
        <button className="fj-btn" style={styles.startBtn} onClick={onRestart}>PLAY AGAIN</button>
        <div>
          <button className="fj-btn" style={styles.menuLink} onClick={onMenu}>← Main Menu</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- UI: Program Dialogue ----------------------- */

function ProgramDialogue({ dialogue, onAnswer }) {
  if (!dialogue) return null;
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>
        <div style={styles.modalIcon}>{dialogue.icon}</div>
        <p style={styles.modalText}>Kevin spotted you.</p>
        <p style={styles.modalText}>Would you like to attend {dialogue.name}?</p>
        <div style={styles.modalBtnRow}>
          <button className="fj-btn" style={styles.yesBtn} onClick={() => onAnswer(true)}>YES</button>
          <button className="fj-btn" style={styles.noBtn} onClick={() => onAnswer(false)}>NO</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- UI: HUD --------------------------------- */

function Hud({ game, onMenu }) {
  const segments = 10;
  const filled = Math.round((game.alert / 100) * segments);
  const objective = game.carried.length > 0 ? "Get back to the Common Room to deliver!" : "Knock on doors to find party supplies!";
  const onDuty = [
    `${game.kevin.icon} ${game.kevin.name}`,
    ...game.extraRAs.map((r) => `${r.icon} ${r.name}`),
  ].join(", ");
  return (
    <div style={styles.hud}>
      <div style={styles.hudRow}>
        <div style={styles.hudStat}>
          <img src={playerSpriteSrc(game.playerSprite)} alt="" style={styles.hudSpriteThumb} /> {game.playerName}
        </div>
        <div style={styles.hudStat}>⏱ {game.timeLeft}s</div>
        <button className="fj-btn" style={styles.menuBtn} onClick={onMenu}>☰ MENU</button>
      </div>
      <div style={styles.hudRow}>
        <div style={styles.hudStat}>🎉 {game.score}</div>
        <div style={styles.hudStat}>📦 {game.delivered}/{game.winTarget}</div>
        <div style={styles.hudStat}>🚨 {game.strikes}/{MAX_STRIKES}</div>
      </div>
      <div style={styles.hudRow}>
        <div style={styles.hudStat}>On duty: {onDuty}</div>
      </div>
      <div style={styles.hudRow}>
        <div style={styles.carriedRow}>
          {game.carried.length === 0 && <span style={styles.hudMuted}>Carrying nothing</span>}
          {game.carried.map((it, i) => <span key={i} style={styles.carriedIcon}>{ICON[it]}</span>)}
        </div>
      </div>
      <div style={styles.hudRow}>
        <span style={styles.alertLabel}>RA ALERT</span>
        <div style={styles.alertMeter}>
          {Array.from({ length: segments }).map((_, i) => (
            <div key={i} style={{
              ...styles.alertSeg,
              background: i < filled ? (filled >= 8 ? "#d1453b" : filled >= 5 ? "#e2a13b" : "#6ea36a") : "#3a3060",
              animation: filled >= 8 && i < filled ? "fj-pulse 0.6s infinite" : "none",
            }} />
          ))}
        </div>
      </div>
      <div style={styles.objective}>{objective}</div>
      {game.message && <div style={styles.toast}>{game.message}</div>}
    </div>
  );
}

/* --------------------------- UI: Play Screen ---------------------------- */

function PlayScreen({ game, pressDir, releaseDir, activeBtn, knock, onMenu }) {
  const cellPct = 100 / COLS;
  const cellPctY = 100 / ROWS;
  const allRAs = [game.kevin, ...game.extraRAs];
  const facingRoom = ROOMS.find(
    (r) => r.cx === game.player.x && r.cy === game.player.y && r.side === game.player.dir
  );

  return (
    <div style={styles.playWrap}>
      <Hud game={game} onMenu={onMenu} />
      <div style={styles.boardWrap}>
        <div style={{ ...styles.board, aspectRatio: `${COLS} / ${ROWS}` }}>
          <div style={{ ...styles.tileGrid, gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
            {GRID.map((row, y) =>
              row.map((cell, x) => {
                const isOffice = x === KEVIN_OFFICE.x && y === KEVIN_OFFICE.y;
                const isTunnel = (x === TUNNEL_LEFT_X || x === TUNNEL_RIGHT_X) && y === HALLWAY_Y;
                let bg = cell === WALL ? "#241b3a" : cell === COMMON ? "#e2a13b" : "#e9dab3";
                if (isOffice) bg = "#3a4a7a";
                if (isTunnel) bg = "#4a3f7a";
                return <div key={`${x}-${y}`} style={{ background: bg, border: cell === WALL ? "none" : "1px solid rgba(0,0,0,0.06)" }} />;
              })
            )}
          </div>

          <div style={{
            position: "absolute",
            left: `${(KEVIN_OFFICE.x - 0.3) * cellPct}%`,
            top: `${(KEVIN_OFFICE.y - 0.9) * cellPctY}%`,
            width: `${2.2 * cellPct}%`,
            fontSize: "0.42em",
            color: "#8fa3d1",
            fontFamily: "'Press Start 2P', monospace",
            lineHeight: 1.1,
            textAlign: "center",
          }}>
            RA
          </div>

          {ROOMS.map((room) => {
            const state = game.roomStates[room.id];
            const color =
              state === "recruited" ? "#6ea36a" :
              state === "empty" ? "#7a7a7a" :
              state === "locked" ? "#d1453b" :
              state === "studying" ? "#c9a24b" : "#8a5a34";
            const icon =
              state === "recruited" ? "✓" :
              state === "locked" ? "🔒" :
              state === "studying" ? "📚" : "";
            return (
              <div key={room.id} title={`Room ${ROOM_NUMBER(room.id)}`}
                className={facingRoom && facingRoom.id === room.id ? "fj-door-glow" : undefined}
                style={{
                position: "absolute",
                left: `${room.doorX * cellPct}%`,
                top: `${room.doorY * cellPctY}%`,
                width: `${cellPct}%`,
                height: `${cellPctY}%`,
                background: color,
                animation: state === "studying" ? "fj-pulse 1s infinite" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.4em", color: "#fff", fontFamily: "'Press Start 2P', monospace",
              }}>
                {icon}
              </div>
            );
          })}

          {PROGRAMS.map((p) => !game.pelletsCollected[p.id] ? (
            <div key={p.id} style={{
              position: "absolute",
              left: `${p.x * cellPct}%`, top: `${p.y * cellPctY}%`,
              width: `${cellPct}%`, height: `${cellPctY}%`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6em", animation: "fj-pulse 1.2s infinite",
            }}>
              {p.icon}
            </div>
          ) : null)}

          {allRAs.map((ra) => {
            const frozen = ra.state === "frozen";
            const chasing = ra.state === "chasing" || ra.state === "alerted";
            return (
              <div key={ra.id} title={ra.name} style={{
                position: "absolute",
                left: `${ra.x * cellPct}%`, top: `${ra.y * cellPctY}%`,
                width: `${cellPct}%`, height: `${cellPctY}%`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "left 0.15s linear, top 0.15s linear",
              }}>
                <div style={{
                  width: "88%", height: "88%",
                  background: frozen ? "#cfe3ff" : chasing ? "#d1453b" : ra.color,
                  borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.5em", boxShadow: "0 0 0 2px #1c1533",
                  animation: frozen ? "fj-shake 0.25s infinite" : "none",
                }}>
                  {frozen ? "😵" : ra.icon}
                </div>
              </div>
            );
          })}

          <div style={{
            position: "absolute",
            left: `${game.player.x * cellPct}%`, top: `${game.player.y * cellPctY}%`,
            width: `${cellPct}%`, height: `${cellPctY}%`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "left 0.15s linear, top 0.15s linear",
          }}>
            <div style={{
              width: "88%", height: "88%", background: "#e2a13b", borderRadius: 3,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 2px #1c1533", overflow: "hidden",
              transform: game.player.dir === "left" ? "scaleX(-1)" : game.player.dir === "up" ? "rotate(-15deg)" : game.player.dir === "down" ? "rotate(15deg)" : "none",
            }}>
              <img src={playerSpriteSrc(game.playerSprite)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        </div>
      </div>
      <Controls pressDir={pressDir} releaseDir={releaseDir} activeBtn={activeBtn} knock={knock} />
    </div>
  );
}

/* ---------------------------- UI: Controls ------------------------------ */

function Controls({ pressDir, releaseDir, activeBtn, knock }) {
  const dpadBtn = (dir, label, gridArea) => (
    <button className="fj-btn" style={{ ...styles.dpadBtn, gridArea, background: activeBtn === dir ? "#e2a13b" : "#2f2657" }}
      onPointerDown={(e) => { e.preventDefault(); pressDir(dir); }}
      onPointerUp={() => releaseDir(dir)}
      onPointerLeave={() => releaseDir(dir)}
      onContextMenu={(e) => e.preventDefault()}>
      {label}
    </button>
  );
  return (
    <div style={styles.controlsWrap}>
      <div style={styles.dpad}>
        {dpadBtn("up", "▲", "up")}
        {dpadBtn("left", "◀", "left")}
        {dpadBtn("right", "▶", "right")}
        {dpadBtn("down", "▼", "down")}
      </div>
      <button className="fj-btn" style={styles.knockBtn}
        onPointerDown={(e) => { e.preventDefault(); knock(); }}
        onContextMenu={(e) => e.preventDefault()}>
        KNOCK
      </button>
    </div>
  );
}

/* -------------------------------- STYLES -------------------------------- */

const styles = {
  page: { minHeight: "100vh", background: "#1c1533", color: "#ead9b3", fontFamily: "'VT323', monospace", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px" },
  introWrap: { minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
  introCard: { maxWidth: 480, textAlign: "center", padding: "24px 20px", border: "4px solid #2f2657", background: "#241b3a", borderRadius: 6 },
  title: { fontFamily: "'Press Start 2P', monospace", fontSize: "1.3em", color: "#e2a13b", letterSpacing: 2, marginBottom: 10, lineHeight: 1.4 },
  subtitle: { fontFamily: "'Press Start 2P', monospace", fontSize: "0.6em", color: "#8fa3d1", marginBottom: 16 },
  introText: { fontSize: "1.05em", lineHeight: 1.35, marginBottom: 10 },
  introSmall: { fontSize: "0.85em", color: "#8fa3d1", marginBottom: 18 },
  startBtn: { fontSize: "0.7em", padding: "12px 20px", background: "#6ea36a", color: "#1c1533", borderRadius: 4, boxShadow: "0 4px 0 #4d7749" },
  installBtn: { fontSize: "0.6em", padding: "10px 16px", marginTop: 10, background: "#8fa3d1", color: "#1c1533", borderRadius: 4, boxShadow: "0 4px 0 #5f75a3" },
  menuLink: { fontSize: "0.55em", padding: "10px 4px", background: "transparent", color: "#8fa3d1", marginTop: 10, textDecoration: "underline" },
  setupSection: { marginBottom: 14, textAlign: "left" },
  setupLabel: { fontFamily: "'Press Start 2P', monospace", fontSize: "0.48em", color: "#8fa3d1", display: "block", marginBottom: 6 },
  spriteRow: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  spriteBtn: { fontSize: "1.2em", padding: "8px 12px", borderRadius: 6, color: "#fff" },
  spriteThumb: { width: 34, height: 34, display: "block", imageRendering: "pixelated" },
  hudSpriteThumb: { width: 12, height: 12, verticalAlign: "middle", imageRendering: "pixelated" },
  goalBtn: { fontFamily: "'Press Start 2P', monospace", fontSize: "0.55em", padding: "10px 14px", borderRadius: 6, color: "#fff" },
  textInput: { width: "100%", padding: "8px", fontFamily: "'VT323', monospace", fontSize: "1.15em", borderRadius: 4, border: "2px solid #2f2657", background: "#1c1533", color: "#ead9b3" },
  playWrap: { width: "100%", maxWidth: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  hud: { width: "100%", background: "#241b3a", border: "3px solid #2f2657", borderRadius: 6, padding: "6px 8px" },
  hudRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 5 },
  hudStat: { fontFamily: "'Press Start 2P', monospace", fontSize: "0.4em", color: "#e2a13b" },
  menuBtn: { fontFamily: "'Press Start 2P', monospace", fontSize: "0.38em", color: "#ead9b3", background: "#2f2657", borderRadius: 4, padding: "5px 8px", marginLeft: "auto" },
  carriedRow: { display: "flex", gap: 5, fontSize: "1.05em", minHeight: 20 },
  carriedIcon: { filter: "drop-shadow(0 0 2px #000)" },
  hudMuted: { color: "#8fa3d1", fontSize: "0.75em" },
  alertLabel: { fontFamily: "'Press Start 2P', monospace", fontSize: "0.4em", color: "#d1453b", marginRight: 6 },
  alertMeter: { display: "flex", gap: 2, flex: 1 },
  alertSeg: { flex: 1, height: 10, borderRadius: 1 },
  objective: { fontSize: "0.95em", color: "#8fa3d1", marginTop: 2 },
  toast: { marginTop: 4, fontSize: "0.9em", color: "#e2a13b", background: "#1c1533", padding: "3px 7px", borderRadius: 4, border: "1px solid #2f2657" },
  boardWrap: { width: "100%", display: "flex", justifyContent: "center" },
  board: { position: "relative", width: "100%", maxWidth: 660, border: "4px solid #2f2657", borderRadius: 4, overflow: "hidden" },
  tileGrid: { display: "grid", width: "100%", height: "100%" },
  controlsWrap: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  dpad: { display: "grid", gridTemplateAreas: `". up ." "left . right" ". down ."`, gridTemplateColumns: "44px 44px 44px", gridTemplateRows: "44px 44px 44px", gap: 4 },
  dpadBtn: { color: "#e9dab3", borderRadius: 4, fontSize: "1em", touchAction: "none" },
  knockBtn: { background: "#d1453b", color: "#fff", fontSize: "0.75em", padding: "18px 26px", borderRadius: 6, boxShadow: "0 4px 0 #8f2e28", touchAction: "none" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(28,21,51,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "#241b3a", border: "4px solid #8fa3d1", borderRadius: 6, padding: "24px 20px", textAlign: "center", maxWidth: 380 },
  modalIcon: { fontSize: "2.4em", marginBottom: 8 },
  modalText: { fontSize: "1.05em", lineHeight: 1.35, marginBottom: 6 },
  modalBtnRow: { display: "flex", gap: 12, justifyContent: "center", marginTop: 14 },
  yesBtn: { background: "#6ea36a", color: "#1c1533", fontSize: "0.65em", padding: "10px 18px", borderRadius: 4, boxShadow: "0 4px 0 #4d7749" },
  noBtn: { background: "#d1453b", color: "#fff", fontSize: "0.65em", padding: "10px 18px", borderRadius: 4, boxShadow: "0 4px 0 #8f2e28" },
};
