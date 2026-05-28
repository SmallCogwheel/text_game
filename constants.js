// ==========================================
// constants.js — 상수 & 전역 상태
// ==========================================

// ── 게임 상수 ──────────────────────────────
const MAX_FLOOR            = 3;
const MAX_REST_COUNT       = 2;
const DEF_BLOCK_CAP        = 0.60;
const SAMURAI_BONUS_RATIO  = 0.20;
const SAMURAI_KILL_THRESHOLD = 4;
const SAMURAI_ATK_BONUS    = 2;
const LOOT_SUCCESS_CHANCE  = 0.20;
const LOOT_GOLD_CHANCE     = 0.40;
const LOOT_TRAP_THRESHOLD  = 0.80;
const LOOT_MEGA_THRESHOLD  = 0.99;
const SHOP_HEAL_COST       = 10;
const SHOP_SCAN_COST       = 8;
const SHOP_ITEM_COST       = 25;
const SHOP_ELITE_COST      = 110;
const SHOP_SILVER_COST     = 4;
const SHOP_HEAL_AMOUNT     = 8;
const FLOOR_HP_SCALE       = 0.55;
const FLOOR_ATK_SCALE      = 0.38;
const FLOOR_BOSS_HP_SCALE  = 0.65;
const FLOOR_BOSS_ATK_SCALE = 0.42;
const FLOOR_GOLD_SCALE     = 0.35;
const GUARD_DEF_BONUS      = 8;     // 가드 시 일시 DEF 상승 고정치
const GUARD_DEF_CAP        = 0.85;  // 가드 시 최대 피해 감소율 (85%)

// ── DOM 캐시 ───────────────────────────────
const story      = document.getElementById("story");
const mapDiv     = document.getElementById("map");
const choicesDiv = document.getElementById("choices");
const statusWin  = document.getElementById("status-window");
const invDiv     = document.getElementById("inventory");

// ── JSON 데이터 ────────────────────────────
let monsters      = [];
let items         = [];
let bosses        = [];
let eliteMonsters = [];
let eliteItems    = [];
let superiorItems = [];
let gameDataPromise = null;

// ── 플레이어 상태 ──────────────────────────
let player = { hp: 20, maxHp: 20, atk: 5, def: 0, gold: 20, silver: 0, x: 1, y: 1 };
let playerInventory  = [];
let inventorySortMode = "rarity";

// ── 게임 진행 상태 ─────────────────────────
let chosenClass    = "netrunner";
let currentFloor   = 1;
let mapSize        = 6;
const maxFloor     = MAX_FLOOR;

let currentEnemy   = null;
let inBattle       = false;
let isGameOver     = false;
let isGuarding     = false;  // 가드 상태 플래그
let totalSearches  = 0;
let maxSearches    = 3;
let restCount      = 0;
const maxRestCount = MAX_REST_COUNT;

let prevX = 1, prevY = 1;
let bossX = 0, bossY = 0;
let restX = 0, restY = 0;
let radarX = 0, radarY = 0;
let eliteChestX = 0, eliteChestY = 0;
let currentRoomKey = null;

const visited  = new Set();
let roomStates = {};
let hasRadar   = false;

// ── 데이터 로드 ────────────────────────────
function fetchJson(path) {
    return fetch(path).then(res => {
        if (!res.ok) throw new Error(`${path} 로드 실패 (${res.status})`);
        return res.json();
    });
}

async function loadGameData() {
    if (gameDataPromise) return gameDataPromise;

    gameDataPromise = Promise.all([
        fetchJson("./assets/monsters.json"),
        fetchJson("./assets/items.json"),
        fetchJson("./assets/boss.json"),
        fetchJson("./assets/elite.json"),
        fetchJson("./assets/elite_items.json"),
        fetchJson("./assets/superior_items.json")
    ]).then(([m, i, b, em, ei, si]) => {
        monsters = m; items = i; bosses = b;
        eliteMonsters = em; eliteItems = ei; superiorItems = si;
    }).catch(e => {
        console.error("데이터 로드 실패:", e);
        monsters = []; items = []; bosses = [];
        eliteMonsters = []; eliteItems = []; superiorItems = [];
    });

    return gameDataPromise;
}
