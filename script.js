// ==========================================
// DOM 캐시 (매번 getElementById 호출 방지)
// 혹시 모르는 업데이트 체크    
// ==========================================
const story = document.getElementById("story");
const mapDiv = document.getElementById("map");
const choicesDiv = document.getElementById("choices");
const statusWin = document.getElementById("status-window");
const invDiv = document.getElementById("inventory");

// ==========================================
// 게임 상수 (매직 넘버 제거)
// ==========================================
const MAX_FLOOR = 3;
const MAX_REST_COUNT = 2;
const DEF_BLOCK_CAP = 0.60;       // 방어력이 막을 수 있는 적 공격의 최대 비율
const SAMURAI_BONUS_RATIO = 0.20;  // 사무라이 추가 피해 비율
const SAMURAI_KILL_THRESHOLD = 4;  // 사무라이 카타나 강화 주기
const SAMURAI_ATK_BONUS = 2;       // 카타나 강화 시 공격력 증가량
const LOOT_SUCCESS_CHANCE = 0.20;  // 일반 시체 수색 성공 확률
const LOOT_GOLD_CHANCE = 0.40;     // 성공 시 골드/아이템 분기 확률
const LOOT_TRAP_THRESHOLD = 0.80;  // 자폭 트랩 발동 분기점
const LOOT_MEGA_THRESHOLD = 0.99;  // 대폭발 발동 분기점
const SHOP_HEAL_COST = 10;
const SHOP_SCAN_COST = 8;
const SHOP_ITEM_COST = 25;
const SHOP_ELITE_COST = 110;
const SHOP_SILVER_COST = 4;
const SHOP_HEAL_AMOUNT = 8;        // 응급 수리 회복량
const FLOOR_HP_SCALE = 0.55;       // 층별 일반 몬스터 HP 배율
const FLOOR_ATK_SCALE = 0.38;
const FLOOR_BOSS_HP_SCALE = 0.65;
const FLOOR_BOSS_ATK_SCALE = 0.42;
const FLOOR_GOLD_SCALE = 0.35;

// 층이 올라갈수록 맵 크기가 커집니다. 1층 6x6, 2층 7x7, 3층 8x8.
let mapSize = 6;
const maxFloor = MAX_FLOOR;

let monsters = [];
let items = [];
let bosses = [];
let eliteMonsters = []; 
let eliteItems = []; 
let superiorItems = [];
let gameDataPromise = null;

let currentEnemy = null;
let inBattle = false;
let isGameOver = false;

let totalSearches = 0;
let maxSearches = 3; // 캐릭터 선택에 따라 유동적으로 변경됨
let chosenClass = "netrunner"; // 선택된 클래스 저장용
let currentFloor = 1;

// 플레이어 스탯 (선택한 캐릭터에 따라 selectCharacter에서 덮어씌워짐)
let player = {
    hp: 20,
    maxHp: 20,
    atk: 5,
    def: 0, 
    gold: 20, 
    silver: 0,
    x: 1,
    y: 1
};

// 플레이어가 획득한 아이템을 담을 배열 (인벤토리)
let playerInventory = [];
let inventorySortMode = "rarity";

// 도망칠 때 돌아갈 이전 좌표
let prevX = 1;
let prevY = 1;

// 방문한 방 기록
const visited = new Set();

let bossX = 0;
let bossY = 0;
let restX = 0; 
let restY = 0; 
let radarX = 0; 
let radarY = 0; 
let eliteChestX = 0; 
let eliteChestY = 0; 
let currentRoomKey = null; 

// 각 방의 상태 저장소
let roomStates = {};     
let hasRadar = false;      

// 휴식방 이용 횟수 카운터 변수
let restCount = 0;
const maxRestCount = MAX_REST_COUNT;

function fetchJson(path) {
    return fetch(path).then(res => {
        if (!res.ok) {
            throw new Error(`${path} 로드 실패 (${res.status})`);
        }
        return res.json();
    });
}

// 데이터 로드 기능
async function loadGameData() {
    if (gameDataPromise) return gameDataPromise;

    gameDataPromise = Promise.all([
        fetchJson("./assets/monsters.json"),
        fetchJson("./assets/items.json"),
        fetchJson("./assets/boss.json"),
        fetchJson("./assets/elite.json"),
        fetchJson("./assets/elite_items.json"),
        fetchJson("./assets/superior_items.json")
    ]).then(([monsterData, itemData, bossData, eliteMonsterData, eliteItemData, superiorItemData]) => {
        monsters = monsterData;
        items = itemData;
        bosses = bossData;
        eliteMonsters = eliteMonsterData;
        eliteItems = eliteItemData;
        superiorItems = superiorItemData;
    }).catch(e => {
        console.error("데이터 로드 실패 - JSON 파일 경로 및 문법을 확인하세요:", e);
        monsters = []; items = []; bosses = []; eliteMonsters = []; eliteItems = []; superiorItems = [];
    });

    return gameDataPromise;
}

// 캐릭터 선택 처리 함수 (시작 아이템 인벤토리 지급 반영)
async function selectCharacter(className) {
    await loadGameData();

    chosenClass = className;
    
    // 새 게임 상태 초기화
    playerInventory = [];
    inventorySortMode = "rarity";
    roomStates = {};
    visited.clear();
    currentFloor = 1;
    totalSearches = 0;
    restCount = 0;
    inBattle = false;
    isGameOver = false;
    currentEnemy = null;
    currentRoomKey = null;
    hasRadar = false;
    prevX = 1;
    prevY = 1;

    // 선택한 직업에 따라 초기 스탯 설정 및 고유 장비 인벤토리 직접 추가
    if (className === "netrunner") {
        player = { hp: 16, maxHp: 16, atk: 4, def: 0, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 3;
        hasRadar = true; // 넷러너는 시작부터 레이더 가동
        // 넷러너는 별도 무기 없이 해킹 장치 내장 컨셉이지만, 필요시 여기에 기본 아이템을 넣을 수 있습니다.
    } 
    else if (className === "samurai") {
        player = { hp: 20, maxHp: 20, atk: 7, def: 0, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 2; 

        // ⚔️ 사뮤라이 시작 아이템 객체 정의 및 인벤토리 지급
        const startingWeapon = { name: "크롬 카타나", atk: 2, isElite: false, rarity: "normal" };
        playerInventory.push(startingWeapon);
        
        // 아이템 스탯 반영
        player.atk += startingWeapon.atk; 
    } 
    else if (className === "mechanic") {
        player = { hp: 26, maxHp: 26, atk: 3, def: 2, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 3;

        // ⚙️ 메카닉 시작 아이템 객체 정의 및 인벤토리 지급
        const startingArmor = { name: "강화 티타늄 판넬", def: 1, isElite: false, rarity: "normal" };
        playerInventory.push(startingArmor);
        
        // 아이템 스탯 반영
        player.def += startingArmor.def; 
    }

    // UI 화면 전환
    document.getElementById("char-select-container").style.display = "none";
    document.getElementById("game-container").style.display = "flex";

    // 인트로 텍스트 연출
    let introText = `⚙️ 시스템 프로토콜 동조 완료. [클래스: ${className.toUpperCase()}]<br><br>`;
    if (className === "netrunner") {
        introText += `📡 내장 오버클럭 레이더가 가동되어 주변 환경 스캔을 시작합니다.<br><br>`;
    } else if (className === "samurai") {
        introText += `⚔️ 손에 쥔 <b style="color: #62ff62;">크롬 카타나(ATK +2)</b>가 서늘하게 빛납니다. 경비 로봇들을 베어 넘기십시오.<br><br>`;
    } else if (className === "mechanic") {
        introText += `🛡️ 두꺼운 <b style="color: #62ff62;">강화 티타늄 판넬(DEF +1)</b>이 신체를 보호합니다. 장기전에 유리합니다.<br><br>`;
    }
    
    introText += `당신은 기계 도시 지하 ${currentFloor}층의 녹슨 금속 방에서 눈을 떴습니다.<br><br>3층 제어 코어까지 올라가는 것이 목표입니다.<br>벽에서는 규칙적인 기계음이 들려옵니다. 주변을 조사하거나 이동하세요.`;
    
    story.innerHTML = introText;

    // 초기 게임 맵 빌드 및 모든 UI 동기화
    generateMapObjects();
    visited.add(`${player.x},${player.y}`);
    
    updateStats();       // 상단 바 스탯 갱신
    updateInventoryUI(); // 🎁 인벤토리 UI에 시작 아이템 즉시 출력!
    renderMap();         // 맵 렌더링
}

// 스탯 UI 업데이트 (상단 고정바 데이터 연동)
function updateStats() {
    document.getElementById("hp").textContent = `${player.hp}/${player.maxHp}`;
    document.getElementById("atk").textContent = player.atk;
    
    const defElement = document.getElementById("def");
    if (defElement) {
        defElement.textContent = player.def;
    }
    
    document.getElementById("gold").textContent = player.gold;

    const searchCounter = document.getElementById("searchCount");
    if (searchCounter) {
        searchCounter.textContent = `${maxSearches - totalSearches}/${maxSearches}`;
    }

    // 상태창이 열려있다면 내부 텍스트도 실시간 동기화
    if (statusWin && statusWin.style.display === "block") {
        document.getElementById("status-hp").textContent = `${player.hp} / ${player.maxHp}`;
        document.getElementById("status-atk").textContent = player.atk;
        document.getElementById("status-def").textContent = player.def;
        document.getElementById("status-gold").textContent = player.gold;
        document.getElementById("status-radar").textContent = hasRadar ? "ON (가동중)" : "OFF";
    }
}

// ✨ [수정] 스탯 이름을 한글 없이 영문(ATK, DEF, HP)으로만 직관적으로 출력하는 함수
function formatItemEffects(item) {
    let effects = [];
    if (item.atk && item.atk > 0) effects.push(`ATK +${item.atk}`);
    if (item.def && item.def > 0) effects.push(`DEF +${item.def}`);
    if (item.hp && item.hp > 0) effects.push(`HP +${item.hp}`);
    return effects.length > 0 ? effects.join(", ") : "효과 없음";
}

function getItemRarity(item) {
    if (item.rarity) return item.rarity;
    if (item.name && item.name.includes("(은화)")) return "silver";
    if (item.isElite) return "elite";
    return "normal";
}

function getItemRarityRank(item) {
    const rarity = getItemRarity(item);
    if (rarity === "silver") return 3;
    if (rarity === "elite") return 2;
    return 1;
}

function getItemRarityColor(item) {
    const rarity = getItemRarity(item);
    if (rarity === "silver") return "#d8d8ff";
    if (rarity === "elite") return "#00ffff";
    return "#62ff62";
}

function getItemRarityLabel(item) {
    const rarity = getItemRarity(item);
    if (rarity === "silver") return "은화";
    if (rarity === "elite") return "엘리트";
    return "일반";
}

// ✨ [신규 추가 헬퍼] 플레이어에게 복합 스탯을 적용하고 인벤토리에 안전하게 저장하는 함수
function applyItemReward(item, isEliteStatus = false, rarity = null) {
    // 생략되거나 없는 값은 (item.atk || 0) 방식을 통해 에러 없이 0으로 합산 처리됩니다.
    const iAtk = item.atk || 0;
    const iDef = item.def || 0;
    const iHp = item.hp || 0;

    player.atk += iAtk;
    player.def += iDef;
    if (iHp > 0) {
        player.maxHp += iHp;
        player.hp += iHp; // 최대 체력이 올라간 만큼 현재 체력도 증가 처리
    }

    // 인벤토리 배열 구조에 추가 (나중에 UI 맵 구성에 쓰일 값들 압축 보관)
    const itemRarity = rarity || item.rarity || (item.name && item.name.includes("(은화)") ? "silver" : (isEliteStatus ? "elite" : "normal"));
    playerInventory.push({
        name: item.name,
        atk: iAtk,
        def: iDef,
        hp: iHp,
        isElite: isEliteStatus,
        rarity: itemRarity
    });
}

function setInventorySortMode(mode) {
    inventorySortMode = mode;
    updateInventoryUI();
}

function sortInventoryItems(itemList) {
    const statKey = inventorySortMode;
    return itemList.sort((a, b) => {
        if (statKey === "atk" || statKey === "def" || statKey === "hp") {
            const statDiff = (b[statKey] || 0) - (a[statKey] || 0);
            if (statDiff !== 0) return statDiff;
        }

        const rarityDiff = getItemRarityRank(b) - getItemRarityRank(a);
        if (rarityDiff !== 0) return rarityDiff;

        const totalA = (a.atk || 0) + (a.def || 0) + (a.hp || 0);
        const totalB = (b.atk || 0) + (b.def || 0) + (b.hp || 0);
        if (totalB !== totalA) return totalB - totalA;

        return a.name.localeCompare(b.name, "ko");
    });
}

// 인벤토리 정렬 버튼 HTML 생성 헬퍼 (중복 제거)
function buildSortButtons() {
    const modes = [
        { key: "rarity", label: "희귀도" },
        { key: "atk",    label: "공격" },
        { key: "def",    label: "방어" },
        { key: "hp",     label: "체력" }
    ];
    const buttons = modes.map(m =>
        `<button onclick="setInventorySortMode('${m.key}')" ${inventorySortMode === m.key ? "disabled" : ""}>${m.label}</button>`
    ).join("");
    return `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">${buttons}</div>`;
}

// 인벤토리 UI 업데이트 함수 (중복 아이템 x수량 합산 기능)
function updateInventoryUI() {
    if (!invDiv) return;

    if (playerInventory.length === 0) {
        invDiv.innerHTML = buildSortButtons() + "획득한 장비가 없습니다.";
        return;
    }

    const itemMap = {};

    playerInventory.forEach(item => {
        // 복합 스탯 고유 키값 생성
        const key = `${item.name}_${getItemRarity(item)}_${item.atk || 0}_${item.def || 0}_${item.hp || 0}`;
        if (itemMap[key]) {
            itemMap[key].count += 1;
        } else {
            itemMap[key] = { ...item, count: 1 };
        }
    });

    const sortedItems = sortInventoryItems(Object.values(itemMap));
    invDiv.innerHTML = buildSortButtons() + sortedItems.map(item => {
        const color = getItemRarityColor(item);
        const rarityLabel = getItemRarityLabel(item);
        const countText = item.count > 1 ? ` x${item.count}` : "";
        const statText = formatItemEffects(item);
        
        return `<div style="margin-bottom: 4px;">• <span style="color: ${color}; font-weight: bold;">[${rarityLabel}] ${item.name}</span> (${statText})${countText}</div>`;
    }).join("");
}

// 상태창 토글(Toggle) 함수
function toggleStatus() {
    if (!statusWin) return;

    if (statusWin.style.display === "none" || statusWin.style.display === "") {
        document.getElementById("status-hp").textContent = `${player.hp} / ${player.maxHp}`;
        document.getElementById("status-atk").textContent = player.atk;
        document.getElementById("status-def").textContent = player.def;
        document.getElementById("status-gold").textContent = player.gold;
        document.getElementById("status-radar").textContent = hasRadar ? "ON (가동중)" : "OFF";
        
        updateInventoryUI();
        statusWin.style.display = "block";
    } else {
        statusWin.style.display = "none";
    }
}

function isReachable(x, y) {
    const dx = Math.abs(player.x - x);
    const dy = Math.abs(player.y - y);
    return dx + dy === 1;
}

function isWithinRadar(x, y) {
    return Math.abs(player.x - x) <= 1 && Math.abs(player.y - y) <= 1;
}

function hasRadarTerminalOnFloor() {
    return currentFloor === 1;
}

function getMapSizeForFloor() {
    return 5 + currentFloor;
}

function getEliteMonsterTargetCount() {
    return currentFloor + 1;
}

function getNormalMonsterTargetCount() {
    const minNormalMonsters = 7 + (currentFloor - 1) * 4;
    const maxNormalMonsters = 15 + (currentFloor - 1) * 5;
    return Math.floor(Math.random() * (maxNormalMonsters - minNormalMonsters + 1)) + minNormalMonsters;
}

function renderMap() {
    mapDiv.innerHTML = "";
    
    mapDiv.style.gridTemplateColumns = `repeat(${mapSize}, 1fr)`;
    mapDiv.style.gridTemplateRows = `repeat(${mapSize}, 1fr)`;
    mapDiv.style.width = `${250 + (mapSize - 6) * 40}px`;
    mapDiv.style.height = `${250 + (mapSize - 6) * 40}px`;

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            const key = `${x},${y}`;

            if (x === player.x && y === player.y) {
                cell.textContent = "■";
                cell.classList.add("current");
            } 
            else if (hasRadarTerminalOnFloor() && x === radarX && y === radarY) {
                if (roomStates[key] && roomStates[key].type === "radar_cleared") {
                    cell.textContent = "□";
                    cell.style.color = "#fff";
                } else {
                    cell.textContent = "📡";
                    cell.style.color = "#bb66ff";
                }
            } 
            else if (x === bossX && y === bossY) {
                if (visited.has(key) || (hasRadar && isWithinRadar(x, y))) {
                    cell.textContent = "★";
                    cell.classList.add("boss");
                } else {
                    cell.textContent = "·";
                }
            } 
            else if (x === restX && y === restY) {
                if (visited.has(key) || (hasRadar && isWithinRadar(x, y))) {
                    cell.textContent = "⚡";
                    cell.classList.add("rest");
                } else {
                    cell.textContent = "·";
                }
            } 
            else if (x === eliteChestX && y === eliteChestY) {
                if (visited.has(key)) {
                    cell.textContent = "□";
                    cell.style.color = "#fff";
                } else if (hasRadar && isWithinRadar(x, y)) {
                    cell.textContent = "💎";
                    cell.style.color = "#00ffff";
                    cell.classList.add("radar-visible");
                } else {
                    cell.textContent = "·";
                }
            }
            else if (visited.has(key)) {
                if (roomStates[key] && roomStates[key].type === "enemy") {
                    if (roomStates[key].entity && roomStates[key].entity.isElite) {
                        cell.textContent = "☠️";
                        cell.style.color = "#ff3333";
                    } else {
                        cell.textContent = "⚠️"; 
                        cell.style.color = "#ffaa00";
                    }
                } else {
                    cell.textContent = "□";
                    cell.style.color = "#fff";
                }
            } 
            else if (hasRadar && isWithinRadar(x, y)) {
                const state = roomStates[key];
                if (!state) {
                    // 아직 생성되지 않은 방 — 레이더에 안개로 표시
                    cell.textContent = "■";
                    cell.style.color = "#ffbb33";
                    cell.classList.add("radar-visible");
                } else if (state.type === "enemy") {
                    if (state.entity && state.entity.isElite) {
                        cell.textContent = "☠️"; 
                        cell.style.color = "#ff4444";
                    } else {
                        cell.textContent = "⚠️"; 
                        cell.style.color = "#ffbb33";
                    }
                    cell.classList.add("radar-visible");
                } else if (state.type === "gold") {
                    cell.textContent = "💵"; 
                    cell.style.color = "#ffff44";
                    cell.classList.add("radar-visible");
                } else {
                    cell.textContent = "■"; 
                    cell.style.color = "#ffbb33";
                    cell.classList.add("radar-visible");
                }
            } 
            else {
                cell.textContent = "·";
            }

            if (!inBattle && isReachable(x, y)) {
                cell.classList.add("reachable");
                cell.onclick = () => moveTo(x, y);
            }
            mapDiv.appendChild(cell);
        }
    }
}

function preGenerateRoomState(x, y) {
    const key = `${x},${y}`;
    if (roomStates[key]) return; 

    const random = Math.random();
    if (random < 0.45) {
        roomStates[key] = { type: "gold" }; 
    } else {
        roomStates[key] = { type: "empty" };
    }
}

function fillRemainingRooms() {
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            if (x === player.x && y === player.y) continue;
            preGenerateRoomState(x, y);
        }
    }
}

function moveTo(x, y) {
    if (inBattle || isGameOver) return;
    if (!isReachable(x, y)) return;

    prevX = player.x;
    prevY = player.y;

    player.x = x;
    player.y = y;
    const key = `${x},${y}`;
    
    const firstVisit = !visited.has(key);
    visited.add(key);

    if (x === bossX && y === bossY) {
        bossRoom(key);
        return;
    }

    if (x === restX && y === restY) {
        restRoom();
        renderMap();
        return;
    }

    if (x === eliteChestX && y === eliteChestY) {
        if (firstVisit) {
            openEliteChest();
        } else {
            story.innerHTML = `🚪 이미 열려있는 낡은 엘리트 보물상자 기단만 덩거리니 남아있습니다.`;
        }
        renderMap();
        return;
    }

    // 📡 레이더 단말기 방 방문 시 로직 개편 (넷러너 특전 멀티 스탯 대응)
    if (hasRadarTerminalOnFloor() && x === radarX && y === radarY) {
        if (roomStates[key] && roomStates[key].type === "radar_cleared") {
            story.innerHTML = `📡 레이더 단말기가 설치되어 있던 방입니다. 장치는 이미 완전히 해체되었습니다.`;
        } else {
            roomStates[key] = { type: "radar_cleared" };
            
            // 🛠️ 넷러너 특전: 이미 레이더가 있으므로 장치를 분해하여 랜덤 '엘리트 아이템' 추출!
            if (chosenClass === "netrunner") {
                if (!eliteItems || eliteItems.length === 0) {
                    story.innerHTML = `📡 단말기를 분해했으나 내부 코어가 손상되어 정예 부품을 얻지 못했습니다.`;
                } else {
                    const eItem = eliteItems[Math.floor(Math.random() * eliteItems.length)];
                    
                    // [변경] 새 규격 처리 적용
                    applyItemReward(eItem, true);
                    const logEffects = formatItemEffects(eItem);

                    story.innerHTML = `
                        <h3 style="color: #00ffff; margin-bottom: 8px;">📡 [SCRAP_PROTOCOL] 레이더 시스템 완전 해체</h3>
                        넷러너인 당신에게 이 고정식 안테나는 필요 없습니다.<br>
                        단말기의 고차원 메인 프로세서를 통째로 뜯어내어 고성능 모듈로 가공했습니다!<br><br>
                        ⚙️ 획득 정예 장비: <b style="color: #00ffff;">${eItem.name}</b><br><br>
                        <span style="color: #62ff62; font-weight: bold;">[초강력 엘리트 효과] ${logEffects} 상승!</span>
                    `;
                }
            } 
            // 사뮤라이 및 메카닉: 단말기를 획득하여 맵의 안개를 제거
            else {
                findRadar();
            }
        }
        renderMap(); 
        updateStats();
        updateInventoryUI();
        return;
    }

    if (!firstVisit) {
        if (roomStates[key] && roomStates[key].type === "enemy") {
            const prefix = roomStates[key].entity.isElite ? `🚨 [위험] ` : `⚠️ `;
            story.innerHTML = `${prefix}방 구석에서 이전에 도망쳤던 <b>${roomStates[key].entity.name}</b>가 씩씩거리며 서 있습니다!<br><br>`;
            encounterEnemy(key, false);
            return;
        }
        story.innerHTML = `🚪 이미 탐색을 끝낸 안전한 방입니다.`;
        renderMap();
        return;
    }

    if (!roomStates[key]) {
        preGenerateRoomState(x, y);
    }
    
    triggerRoomEvent(key);
}

function triggerRoomEvent(key) {
    const state = roomStates[key];
    if (!state) return;

    if (state.type === "enemy") {
        encounterEnemy(key, true);
    } 
    else if (state.type === "gold") {
        findGold();
        roomStates[key] = { type: "empty" }; 
        renderMap();
    } 
    else {
        emptyRoom();
        renderMap();
    }
}

// 엘리트 상자 개방 (개편 반영)
function openEliteChest() {
    if (!eliteItems || eliteItems.length === 0) {
        story.innerHTML = `💎 <b>고대 엘리트 금고</b>를 열었으나 내부에 부품이 없습니다.`;
        return;
    }

    const item = eliteItems[Math.floor(Math.random() * eliteItems.length)];
    
    // [변경] 복합 스탯 획득 처리 적용
    applyItemReward(item, true, "silver");
    const logEffects = formatItemEffects(item);

    story.innerHTML = `
        <h2 style="color: #00ffff; margin-bottom: 12px;">💎 고대 엘리트 보물상자 개방! 💎</h2>
        두꺼운 보안 격벽이 해제되더니 찬란한 특수 전파를 내뿜는 정예 장비가 모습을 드러냅니다.<br><br>
        🛡️ 획득 아이템: <b style="color: #00ffff;">${item.name}</b><br><br>
        <span style="color: #62ff62; font-weight: bold;">[초강력 엘리트 효과] ${logEffects} 동시 상승!</span>
    `;
    updateStats();
    updateInventoryUI();
}

function findRadar() {
    hasRadar = true;
    story.innerHTML = `
        📡 <b>기계 도시의 단말기 부품(레이더)</b>을 발견했습니다!<br><br>
        미니맵 전력 개방! 현재 위치 기준 주변 1칸 반경(대각선 포함)의 안개를 스캔합니다.<br>
        사거리 내에 들어온 <b>보물 상자(💵)</b>, <b>몬스터(⚠️)</b>, <b>정예 기계(☠️)</b> 및 <b style="color: #00ffff;">정예 상자(💎)</b>의 정보가 투시됩니다.
    `;
}

function restRoom(message = "") {
    const remainingRest = maxRestCount - restCount;
    const shopItems = [
        { label: "응급 수리",       cost: SHOP_HEAL_COST,  action: "buyShopHeal()",      desc: `HP를 ${SHOP_HEAL_AMOUNT} 회복` },
        { label: "스캔 배터리",     cost: SHOP_SCAN_COST,  action: "buyShopScan()",      desc: "조사 횟수 1회 충전" },
        { label: "일반 부품 상자",  cost: SHOP_ITEM_COST,  action: "buyShopItem()",      desc: "일반 장비 1개 획득" },
        { label: "정예 부품 상자",  cost: SHOP_ELITE_COST, action: "buyShopEliteItem()", desc: "엘리트 장비 1개 획득" }
    ];
    const silverShopItems = [
        { label: "상위 공명 상자",  cost: SHOP_SILVER_COST, action: "buySuperiorItem()", desc: "은화 전용 상위 장비 1개 획득" }
    ];
    const shopButtons = shopItems.map(item => {
        const disabled = player.gold < item.cost ? "disabled" : "";
        return `
            <button onclick="${item.action}" ${disabled}>
                💵 ${item.cost} | ${item.label}
                <span style="display:block; font-size: 12px; opacity: 0.75;">${item.desc}</span>
            </button>
        `;
    }).join("");
    const silverShopButtons = silverShopItems.map(item => {
        const disabled = player.silver < item.cost ? "disabled" : "";
        return `
            <button onclick="${item.action}" ${disabled}>
                은화 ${item.cost} | ${item.label}
                <span style="display:block; font-size: 12px; opacity: 0.75;">${item.desc}</span>
            </button>
        `;
    }).join("");
    const notice = message ? `<div style="margin-bottom: 12px; color: #62ff62;">${message}</div>` : "";

    story.innerHTML = `
        ⚡ <b>자가 발전 충전소 & 부품 상점</b><br><br>
        ${notice}
        기계 장치들이 부드럽게 돌아가는 안전 구역입니다.<br>
        이곳에서는 무료 충전기를 쓰거나 골드로 정비 부품을 구매할 수 있습니다.<br>
        <span style="color: #ffaa00; font-weight: bold;">현재 층: ${currentFloor} / ${maxFloor} | 보유 골드: 💵 ${player.gold} | 보유 은화: ${player.silver} | 이번 층 무료 충전 기회: ${remainingRest} / ${maxRestCount}회</span><br><br>
    `;

    if (remainingRest > 0) {
        story.innerHTML += `<button onclick="useRestStation()">⚡ 무료 에너지 충전하기</button>`;
    } else {
        story.innerHTML += `<span style="color: #ff3333; font-weight: bold;">❌ 발전기 코어가 과열되어 더 이상 에너지를 공급받을 수 없습니다!</span>`;
    }

    story.innerHTML += `
        <hr style="border: 0; border-top: 1px dashed #555; margin: 14px 0;">
        <b style="color: #00ffff;">🛒 자동 부품 상점</b><br><br>
        <div style="display: grid; gap: 8px;">${shopButtons}</div>
        <hr style="border: 0; border-top: 1px dashed #555; margin: 14px 0;">
        <b style="color: #d8d8ff;">은화 교환소</b><br><br>
        <div style="display: grid; gap: 8px;">${silverShopButtons}</div>
    `;
}

function useRestStation() {
    if (restCount >= maxRestCount) return;

    // totalSearches === maxSearches 이면 조사 횟수가 남아있고, 0이면 이미 가득 참
    if (player.hp === player.maxHp && totalSearches === 0) {
        restRoom("⚡ 체력과 조사 횟수가 이미 가득 차 있습니다!");
        return;
    }
    
    player.hp = player.maxHp;      
    totalSearches = 0;             
    restCount++; 
    
    updateStats();
    restRoom(`⚡ 체력이 모두 회복되고 조사 횟수가 다시 가득 찼습니다! (${maxSearches}/${maxSearches})`);
}

function spendGold(cost) {
    if (player.gold < cost) {
        restRoom(`💵 골드가 부족합니다. 필요한 골드: ${cost}`);
        return false;
    }

    player.gold -= cost;
    updateStats();
    return true;
}

function spendSilver(cost) {
    if (player.silver < cost) {
        restRoom(`은화가 부족합니다. 필요한 은화: ${cost}`);
        return false;
    }

    player.silver -= cost;
    return true;
}

function buyShopHeal() {
    if (player.hp >= player.maxHp) {
        restRoom("❤️ 이미 HP가 가득 차 있습니다.");
        return;
    }
    if (!spendGold(SHOP_HEAL_COST)) return;

    const healAmount = Math.min(SHOP_HEAL_AMOUNT, player.maxHp - player.hp);
    player.hp += healAmount;
    updateStats();
    restRoom(`❤️ 응급 수리 완료! HP가 ${healAmount} 회복되었습니다.`);
}

function buyShopScan() {
    if (totalSearches <= 0) {
        restRoom("🔍 조사 횟수가 이미 가득 차 있습니다.");
        return;
    }
    if (!spendGold(SHOP_SCAN_COST)) return;

    totalSearches = Math.max(0, totalSearches - 1);
    updateStats();
    restRoom("🔍 스캔 배터리 장착 완료! 조사 횟수가 1회 충전되었습니다.");
}

function buyShopItem() {
    if (!spendGold(SHOP_ITEM_COST)) return;

    const item = getRandomItem();
    applyItemReward(item, false);
    updateStats();
    updateInventoryUI();
    restRoom(`🛠️ 일반 부품 상자 개봉! <b>${item.name}</b> 획득 (${formatItemEffects(item)})`);
}

function buyShopEliteItem() {
    if (!eliteItems || eliteItems.length === 0) {
        restRoom("💎 정예 부품 재고가 비어 있습니다.");
        return;
    }
    if (!spendGold(SHOP_ELITE_COST)) return;

    const item = eliteItems[Math.floor(Math.random() * eliteItems.length)];
    applyItemReward(item, true);
    updateStats();
    updateInventoryUI();
    restRoom(`💎 정예 부품 상자 개봉! <b>${item.name}</b> 획득 (${formatItemEffects(item)})`);
}

function buySuperiorItem() {
    if (!superiorItems || superiorItems.length === 0) {
        restRoom("은화 상위 장비 재고가 비어 있습니다.");
        return;
    }
    if (!spendSilver(SHOP_SILVER_COST)) return;

    const item = superiorItems[Math.floor(Math.random() * superiorItems.length)];
    applyItemReward(item, true);
    updateStats();
    updateInventoryUI();
    restRoom(`은화 공명 상자 개봉! <b>${item.name}</b> 획득 (${formatItemEffects(item)})`);
}

function getRandomMonster() {
    if (!monsters || monsters.length === 0) return { name: "경비 로봇", hp: 10, atk: 2, gold: 5 };
    const idx = Math.floor(Math.random() * monsters.length);
    return monsters[idx];
}

function getRandomItem() {
    // [변경] 기본 아이템 데이터 규격 간소화 (필요한 것만 담도록 세팅용 백업)
    if (!items || items.length === 0) return { name: "고철 부품", atk: 1 };
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
}

function scaleEnemyForFloor(enemy, isBoss = false) {
    const hpMultiplier = 1 + (currentFloor - 1) * (isBoss ? FLOOR_BOSS_HP_SCALE : FLOOR_HP_SCALE);
    const atkMultiplier = 1 + (currentFloor - 1) * (isBoss ? FLOOR_BOSS_ATK_SCALE : FLOOR_ATK_SCALE);
    const goldMultiplier = 1 + (currentFloor - 1) * FLOOR_GOLD_SCALE;
    const floorLabel = currentFloor > 1 ? `${currentFloor}층 강화 ` : "";

    return {
        ...enemy,
        name: `${floorLabel}${enemy.name}`,
        hp: Math.ceil(enemy.hp * hpMultiplier),
        atk: Math.ceil(enemy.atk * atkMultiplier),
        gold: Math.ceil(enemy.gold * goldMultiplier)
    };
}

function getBossEnemy() {
    let pool;

    if (!bosses || !bosses["floor" + currentFloor]) {
        // 폴백: 데이터 없을 때 기본 보스
        const fallback = {
            1: { id: "core_gear",          name: "중앙 톱니",      hp: 115, atk: 17, gold: 120 },
            2: { id: "upper_core",         name: "상층 압축 코어", hp: 220, atk: 28, gold: 220 },
            3: { id: "final_control_core", name: "최종 제어 코어", hp: 380, atk: 45, gold: 380 }
        };
        return scaleEnemyForFloor({ ...fallback[currentFloor] }, true);
    }

    pool = bosses["floor" + currentFloor];
    const boss = { ...pool[Math.floor(Math.random() * pool.length)] };
    return scaleEnemyForFloor(boss, true);
}

function encounterEnemy(key, isNew = true) {
    currentRoomKey = key;
    currentEnemy = roomStates[key].entity;
    inBattle = true;

    if (isNew) {
        if (currentEnemy.isElite) {
            story.innerHTML = `<h3 style="color: #ff3333; margin-bottom: 8px;">🚨 강력한 경보 발령! 🚨</h3>정예 경비 시스템인 <b>${currentEnemy.name}</b>이(가) 방어 프로토콜을 가동하며 나타났습니다!`;
        } else {
            story.innerHTML = `🤖 기계 경보 발령! <b>${currentEnemy.name}</b>이(가) 나타났다!`;
        }
    }
    renderMap(); 
    renderBattle();
}

function bossRoom(key) {
    currentRoomKey = key;
    if (!roomStates[key] || !roomStates[key].entity) {
        roomStates[key] = { type: "enemy", entity: getBossEnemy() };
    }
    currentEnemy = roomStates[key].entity;
    inBattle = true;

    story.innerHTML = `⚙️ <b>[경고] ${currentFloor}층 제어실 진입</b><br><br>도시의 핵심 코어, <b>${currentEnemy.name}</b>가 가동을 시작합니다!`;
    renderMap();
    renderBattle();
}

function renderBattle() {
    const borderColor = currentEnemy.isElite ? "#f33" : "#f66";
    story.innerHTML += `
        <div class="battle-box" style="margin-top:15px; padding:10px; border:1px dashed ${borderColor};">
            [전투 상태]<br>
            현재 층: ${currentFloor} / ${maxFloor}<br>
            나의 HP: ${player.hp}/${player.maxHp} | 공격력: ${player.atk} | 방어력: ${player.def}<br>
            적의 이름: ${currentEnemy.name} (HP: ${currentEnemy.hp})
        </div>
    `;

    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = `
        <button onclick="attack()">⚔️ 공격하기</button>
        <button onclick="runAway()">🏃 도망치기</button>
    `;
}
function confirmGoToCharSelect() {
    const message = inBattle 
        ? "🚨 현재 전투가 진행 중입니다! 클래스 재선택 시 지금의 진행 상황과 인벤토리가 완벽히 초기화됩니다. 정말 돌아가시겠습니까?"
        : "🔄 클래스 선택창으로 이동하시겠습니까? (현재의 아바타 세이브 데이터는 소멸합니다.)";

    if (confirm(message)) {
        resetGame();
    }
}
function restoreDefaultChoices() {
    if (!choicesDiv) return;

    choicesDiv.innerHTML = `
        <button onclick="searchRoom()">주변을 조사한다</button>
        <button onclick="toggleStatus()">상태창 보기</button>
        <button onclick="confirmGoToCharSelect()">클래스 재선택</button>
    `;
    choicesDiv.style.display = "flex";
}

function attack() {
    if (!inBattle || !currentEnemy) return;

    // 기본 가한 피해량 계산
    let baseDamage = player.atk;
    currentEnemy.hp -= baseDamage;
    let log = `⚔️ ${currentEnemy.name}에게 ${baseDamage}의 피해를 주었습니다.<br>`;

    // 🔴 [사무라이 특전] 준 데미지의 20% 추가 피해 프로토콜
    if (chosenClass === "samurai") {
        let extraDamage = Math.max(1, Math.floor(baseDamage * SAMURAI_BONUS_RATIO));
        currentEnemy.hp -= extraDamage;
        log += `<span style="color: #ff3333; font-weight: bold;">⚔️ [SAMURAI_PASSIVE] 가속 연격 발동! ${extraDamage}의 추가 피해를 입혔습니다.</span><br>`;
    }

    // 적 처치 여부 판정
    if (currentEnemy.hp <= 0) {
        currentEnemy.hp = 0; // 체력이 음수로 내려가는 것 방지
        story.innerHTML = log;
        winBattle();
        return;
    }

    // 적의 반격 계산: 방어력은 강하지만 적 공격력의 60%까지만 줄일 수 있습니다.
    const blockedDamage = Math.min(player.def, Math.floor(currentEnemy.atk * DEF_BLOCK_CAP));
    let damageTaken = Math.max(1, currentEnemy.atk - blockedDamage);
    player.hp -= damageTaken;
    log += `💥 ${currentEnemy.name}이(가) 반격하여 ${damageTaken}의 피해를 입었습니다. (방어력으로 ${blockedDamage} 감소)`;

    story.innerHTML = log;

    // 플레이어 사망 판정
    if (player.hp <= 0) {
        player.hp = 0;
        updateStats();
        gameOver();
        return;
    }

    updateStats();
    renderBattle();
}

function runAway() {
    if (!inBattle) return;

    player.x = prevX;
    player.y = prevY;

    story.innerHTML = `🏃 몬스터를 피해 직전에 있었던 안전한 방 (${player.x}, ${player.y})으로 황급히 텔레포트하여 도망쳤습니다! <br>몬스터의 체력 상태는 그대로 유지됩니다.`;
    inBattle = false;
    currentEnemy = null;
    currentRoomKey = null; 
    
    restoreDefaultChoices();
    renderMap();
}

// 전투 승리 보상 (개편 반영)
function winBattle() {
    player.gold += currentEnemy.gold;

    if (currentEnemy.id === "core_gear") {
        if (currentFloor < maxFloor) {
            story.innerHTML = `
                <h2>⬆️ ${currentFloor}층 제어 코어 파괴!</h2>
                <b>${currentEnemy.name}</b>를 무력화하자 위층으로 이어지는 승강 장치가 깨어납니다.<br>
                다음 층의 경비 시스템은 더 두껍고 더 날카롭게 재조립됩니다.<br><br>
                획득 골드: 💵 ${currentEnemy.gold}<br>
                현재 골드: 💵 ${player.gold}<br><br>
                <button onclick="ascendToNextFloor()" style="border-color: #00ffff; color: #00ffff;">⬆️ ${currentFloor + 1}층으로 올라가기</button>
            `;
            inBattle = true;
            document.getElementById("choices").style.display = "none";
            currentEnemy = null;
            updateStats();
            return;
        }

        story.innerHTML = `
            <h2>🎉 기계 도시 클리어!</h2>
            3층 최종 제어 코어를 무력화시키는 데 성공했습니다.<br>
            아래층부터 이어지던 기계음이 완전히 멎고, 마침내 지상으로 향하는 문이 열립니다.<br><br>
            최종 골드: 💵 ${player.gold}<br><br>
            <button onclick="resetGame()" style="border-color: #62ff62; color: #62ff62;">🔄 새로운 여정 시작하기</button>
        `;
        isGameOver = true;
        inBattle = false;
        document.getElementById("choices").style.display = "none";
        currentEnemy = null;
        updateStats();
        return;
    }

    let eliteRewardLog = "";
    if (currentEnemy.isElite) {
        const silverReward = currentFloor;
        player.silver += silverReward;
        eliteRewardLog = `<br><br><span style="color: #00ffff; font-weight: bold;">⚡ 정예 기계 파괴 보상 획득! 은화 +${silverReward} ⚡</span>`;
        
        for (let i = 1; i <= 2; i++) {
            const randomItem = getRandomItem();
            if (randomItem) {
                applyItemReward(randomItem, false);
                const logEffects = formatItemEffects(randomItem);
                eliteRewardLog += `<br>🛠️ <b>${randomItem.name}</b> 획득! <span style="color: #62ff62;">(${logEffects})</span>`;
            }
        }
    }

    const rewardText = currentEnemy.isElite ? `🔥 [정예 처치] 💵 ${currentEnemy.gold}` : `💵 ${currentEnemy.gold}`;
    
    story.innerHTML += `
        <br>🏆 승리! ${currentEnemy.name}를 처치하고 ${rewardText} 골드를 획득했습니다.${eliteRewardLog}
        <br><br><span style="color: #aaaaaa;">바닥에 쓰러진 기계의 잔해가 연기를 내뿜고 있습니다. 시체를 뒤져 쓸만한 전리품을 수색하시겠습니까?</span>
    `;

    if (chosenClass === "samurai") { player.samuraiKills = (player.samuraiKills || 0) + 1; if (player.samuraiKills % SAMURAI_KILL_THRESHOLD === 0) { const katana = playerInventory.find(item => item.name && item.name.includes("크롬 카타나")); if (katana) { katana.atk = (katana.atk || 0) + SAMURAI_ATK_BONUS; } story.innerHTML += `<br><br><span style="color: #ff3333; font-weight: bold;">⚔️ [SAMURAI_PASSIVE] 검술 숙련도 극대화! 몬스터 ${SAMURAI_KILL_THRESHOLD}마리 처치 달성으로 크롬 카타나가 강화되었습니다! (ATK +${SAMURAI_ATK_BONUS} 영구 상승, 현재 처치: ${player.samuraiKills}마리)</span><br>`; } else { story.innerHTML += `<br><br><span style="color: #aaa;">🗡️ 카타나에 적의 에너지가 흡수됩니다. (다음 강화까지: ${SAMURAI_KILL_THRESHOLD - (player.samuraiKills % SAMURAI_KILL_THRESHOLD)}마리 처치 필요)</span><br>`; } }

    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = `
        <button onclick="lootCorpse()" style="border-color: #ffaa00; color: #ffaa00;">💀 시체 수색하기</button>
        <button onclick="leaveCorpse()">🚪 그냥 이동하기</button>
    `;

    if (currentRoomKey) {
        roomStates[currentRoomKey] = { type: "empty" };
        currentRoomKey = null;
    }
    inBattle = false;
    updateStats();       // 상단 스탯창 갱신
    updateInventoryUI(); // 인벤토리 아이템 글씨 갱신 (추가됨!)
}

function ascendToNextFloor() {
    if (currentFloor >= maxFloor) return;

    currentFloor++;
    player.x = 1;
    player.y = 1;
    prevX = 1;
    prevY = 1;
    totalSearches = 0;
    restCount = 0;
    inBattle = false;
    currentEnemy = null;
    currentRoomKey = null;
    roomStates = {};
    visited.clear();

    generateMapObjects();
    visited.add(`${player.x},${player.y}`);
    restoreDefaultChoices();
    document.getElementById("choices").style.display = "flex";

    story.innerHTML = `
        <h2>⬆️ ${currentFloor}층 진입</h2>
        승강 장치가 멈추자 더 거친 기계음이 복도 전체를 흔듭니다.<br>
        이 층은 더 넓고, 더 많은 경비 기계가 배치되어 있으며, 몬스터의 HP와 공격력도 강화되어 있습니다.<br><br>
        <span style="color: #00ffff;">맵 크기: ${mapSize} x ${mapSize}</span><br>
        <span style="color: #ffaa00;">무료 충전 기회와 조사 횟수가 새 층 기준으로 재정비되었습니다.</span>
    `;
    updateStats();
    updateInventoryUI();
    renderMap();
}
// 시체 루팅 (메카닉 특전 반영)
function lootCorpse() {
    // ⚙️ 엔지니어(mechanic)인 경우 트랩을 무조건 무력화하고 100% 확률로 성공!
    if (chosenClass === "mechanic") {
        const subChance = Math.random();
        if (subChance < 0.40) {
            const extraGold = Math.floor(Math.random() * 15) + 5;
            player.gold += extraGold;
            story.innerHTML = `⚙️ <b>[ENGINEER_PRIVILEGE] 시체 정밀 해체 성공!</b><br><br>기계 전문가의 솜씨로 안전하게 내부 비상 금고를 우회 해킹했습니다!<br><span style="color: #ffff44;">💵 추가 골드 +${extraGold} 획득!</span>`;
        } else {
            const item = getRandomItem();
            applyItemReward(item, false);
            const logEffects = formatItemEffects(item);

            story.innerHTML = `
                ⚙️ <b>[ENGINEER_PRIVILEGE] 시체 정밀 해체 성공!</b><br><br>
                회로를 완벽히 분석하여 잔해 속에 숨겨진 핵심 부품을 상처 없이 추출했습니다.<br><br>
                🛠️ 획득 전리품: <b>${item.name}</b><br>
                <span style="color: #62ff62;">[장착 효과] ${logEffects}</span>
            `;
        }
    } 
    // 그 외 다른 클래스들은 대부분 잔해만 뒤지고, 낮은 확률로 보상/자폭/대폭발이 발생합니다.
    else {
        const randomChance = Math.random();

        if (randomChance < LOOT_SUCCESS_CHANCE) {
            const subChance = Math.random();
            if (subChance < LOOT_GOLD_CHANCE) {
                const extraGold = Math.floor(Math.random() * 15) + 5;
                player.gold += extraGold;
                story.innerHTML = `💀 <b>시체 수색 성공!</b><br><br>숨겨진 내부 비상 금고를 해킹하여 대박을 터트렸습니다!<br><span style="color: #ffff44;">💵 추가 골드 +${extraGold} 획득!</span>`;
            } else {
                const item = getRandomItem();
                applyItemReward(item, false);
                const logEffects = formatItemEffects(item);

                story.innerHTML = `
                    💀 <b>시체 수색 성공!</b><br><br>
                    잔해 속에 얽혀있던 유용한 부품을 완벽하게 분리해냈습니다.<br><br>
                    🛠️ 획득 전리품: <b>${item.name}</b><br>
                    <span style="color: #62ff62;">[장착 효과] ${logEffects}</span>
                `;
            }
        } else if (randomChance < LOOT_TRAP_THRESHOLD) {
            story.innerHTML = `
                💀 <b>시체 수색 실패</b><br><br>
                잔해를 한참 뒤졌지만 쓸만한 부품은 이미 녹아내렸습니다.<br>
                <span style="color: #aaaaaa;">아무것도 획득하지 못했습니다.</span>
            `;
        } else {
            const baseTrapDamage = Math.floor(Math.random() * 4) + 3 + (currentFloor - 1);
            const isMegaExplosion = randomChance >= LOOT_MEGA_THRESHOLD;
            const trapDamage = isMegaExplosion ? baseTrapDamage * 3 : baseTrapDamage;
            player.hp -= trapDamage;
            if (player.hp < 0) player.hp = 0;

            if (isMegaExplosion) {
                story.innerHTML = `
                    <span style="color: #ff3333; font-weight: bold;">🚨 CRITICAL_CHAIN_EXPLOSION !! 🚨</span><br><br>
                    잔해 속 압축 코어가 연쇄 폭발을 일으켰습니다!<br><br>
                    💥💥💥 대폭발로 인해 <span style="color: #ff3333; font-weight: bold;">체력이 -${trapDamage}</span> 깎였습니다.<br>
                    <span style="color: #ff3333; font-size: 12px;">[ERROR] 기존 자폭 피해의 3배 적용</span>
                `;
            } else {
                story.innerHTML = `
                    <span style="color: #ff3333; font-weight: bold;">🚨 BU_BI_TRAP DETECTED !! 🚨</span><br><br>
                    기계를 건드린 순간, 내장되어 있던 보안 자폭 시퀀스가 발동했습니다!<br><br>
                    💥 쿠우웅! 폭발로 인해 <span style="color: #ff3333; font-weight: bold;">체력이 -${trapDamage}</span> 깎였습니다.<br>
                    <span style="color: #ff3333; font-size: 12px;">[ERROR] 장갑 시스템 우회: 방어력 무시 고정 피해 적용</span>
                `;
            }

            if (player.hp <= 0) {
                updateStats();
                gameOver();
                return;
            }
        }
    }

    currentEnemy = null;
    restoreDefaultChoices();
    updateStats();
    updateInventoryUI();
    renderMap();
}

function leaveCorpse() {
    story.innerHTML = `🚪 리스크를 방지하기 위해 잔해를 그대로 둔 채 자리를 떠났습니다.`;
    currentEnemy = null;
    restoreDefaultChoices();
    renderMap();
}

function gameOver() {
    inBattle = false;
    isGameOver = true;
    story.innerHTML = `
        <h2 style="color: #ff3333; margin-bottom: 10px;">☠️ SYSTEM FAILURE</h2>
        기계 도시의 차가운 금속 바닥 위에 쓰러졌습니다.<br>
        당신의 육체는 곧 고철로 재활용될 것입니다...<br><br>
        <button onclick="resetGame()" style="width: 100%; border-color: #ff3333; color: #ff3333;">🔄 처음부터 다시 도전하기</button>
    `;
    document.getElementById("choices").style.display = "none";
    renderMap(); 
}

function findGold() {
    const amount = Math.floor((Math.random() * 10 + 5) * (1 + (currentFloor - 1) * 0.35));
    player.gold += amount;
    story.innerHTML = `💵 ${currentFloor}층 보물 상자 발견!<br><br>골드 +${amount}`;
    updateStats();
}

function emptyRoom() {
    story.innerHTML = `🚪 텅 빈 방이다.<br><br>아무 일도 일어나지 않았다.`;
}

// 주변 조사 (개편 반영)
function searchRoom() {
    if (inBattle || isGameOver) {
        story.innerHTML = `⚔️ 전투 중에는 조사할 수 없다.`;
        return;
    }

    if (totalSearches >= maxSearches) {
        story.innerHTML = `🔍 더 이상 조사할 수 없다.<br><br>모든 조사 기회를 사용했다.`;
        return;
    }

    totalSearches++;
    const item = getRandomItem();

    if (!item) {
        story.innerHTML = `🔍 방을 샅샅이 뒤졌지만 쓸만한 고철을 찾지 못했습니다.`;
        updateStats();
        return;
    }

    // [변경] 복합 스탯 조사 획득 적용
    applyItemReward(item, false);
    const logEffects = formatItemEffects(item);

    story.innerHTML = `
        🔍 <b>방 주변을 조사했습니다!</b><br><br>
        기계 잔해 속에서 🛠️ <b>${item.name}</b>을(를) 발견하여 장착했습니다.<br><br>
        <span style="color: #62ff62;">[효과] ${logEffects} 상승!</span>
    `;

    updateStats();
    updateInventoryUI();
}

function resetGame() {
    document.getElementById("game-container").style.display = "none";
    document.getElementById("char-select-container").style.display = "block";
    
    playerInventory = []; 
    inventorySortMode = "rarity";
    prevX = 1;
    prevY = 1;
    player.silver = 0;

    currentFloor = 1;
    totalSearches = 0;
    restCount = 0; 
    inBattle = false;
    isGameOver = false;
    currentEnemy = null;
    currentRoomKey = null;
    hasRadar = false;
    roomStates = {};

    visited.clear();
    restoreDefaultChoices();
    if (player.samuraiKills) player.samuraiKills = 0;
    const statusWin = document.getElementById("status-window");
    if (statusWin) {
        statusWin.style.display = "none";
    }
}

function generateMapObjects() {
    roomStates = {};
    mapSize = getMapSizeForFloor();
    radarX = -1;
    radarY = -1;

    // 1. 주요 고정 오브젝트 좌표 랜덤 선점 (중복 제외)
    do { bossX = Math.floor(Math.random() * mapSize); bossY = Math.floor(Math.random() * mapSize); } while (bossX === 1 && bossY === 1);
    do { restX = Math.floor(Math.random() * mapSize); restY = Math.floor(Math.random() * mapSize); } while ((restX === 1 && restY === 1) || (restX === bossX && restY === bossY));
    if (hasRadarTerminalOnFloor()) {
        do { radarX = Math.floor(Math.random() * mapSize); radarY = Math.floor(Math.random() * mapSize); } while ((radarX === 1 && radarY === 1) || (radarX === bossX && radarY === bossY) || (radarX === restX && radarY === restY));
    }
    do { eliteChestX = Math.floor(Math.random() * mapSize); eliteChestY = Math.floor(Math.random() * mapSize); } while ((eliteChestX === 1 && eliteChestY === 1) || (eliteChestX === bossX && eliteChestY === bossY) || (eliteChestX === restX && eliteChestY === restY) || (hasRadarTerminalOnFloor() && eliteChestX === radarX && eliteChestY === radarY));

    roomStates[`${bossX},${bossY}`] = { type: "enemy", entity: getBossEnemy() };
    roomStates[`${restX},${restY}`] = { type: "rest" };
    // ✨ [버그 수정] 엘리트 상자 방의 상태를 데이터베이스에 확정 등록하여 덮어쓰기 방지!
    roomStates[`${eliteChestX},${eliteChestY}`] = { type: "elite_chest" };
    // 레이더 단말기는 1층 전용입니다.
    if (hasRadarTerminalOnFloor()) {
        roomStates[`${radarX},${radarY}`] = { type: "radar" };
    }

    // 2. 정예 몬스터 배치 (층이 올라갈수록 증가)
    const targetEliteCount = getEliteMonsterTargetCount();
    let assignedEliteCount = 0;
    while (assignedEliteCount < targetEliteCount && eliteMonsters.length > 0) {
        const ex = Math.floor(Math.random() * mapSize);
        const ey = Math.floor(Math.random() * mapSize);
        const eKey = `${ex},${ey}`;

        if (
            (ex === 1 && ey === 1) || (ex === bossX && ey === bossY) || 
            (ex === restX && ey === restY) || (hasRadarTerminalOnFloor() && ex === radarX && ey === radarY) || 
            (ex === eliteChestX && ey === eliteChestY) || roomStates[eKey]
        ) {
            continue;
        }

        const chosenElite = scaleEnemyForFloor({ ...eliteMonsters[Math.floor(Math.random() * eliteMonsters.length)] });
        roomStates[eKey] = { type: "enemy", entity: { ...chosenElite } };
        assignedEliteCount++;
    }

    // 3. 일반 몬스터 배치 (층이 올라갈수록 증가)
    const targetMonsterCount = getNormalMonsterTargetCount();
    
    let assignedNormalCount = 0;
    let safetyCounter = 0; 

    while (assignedNormalCount < targetMonsterCount && safetyCounter < 500) {
        safetyCounter++;
        const nx = Math.floor(Math.random() * mapSize);
        const ny = Math.floor(Math.random() * mapSize);
        const nKey = `${nx},${ny}`;

        if (
            (nx === 1 && ny === 1) || (nx === bossX && ny === bossY) || 
            (nx === restX && ny === restY) || (hasRadarTerminalOnFloor() && nx === radarX && ny === radarY) || 
            (nx === eliteChestX && ny === eliteChestY) || roomStates[nKey]
        ) {
            continue;
        }

        const chosenMonster = scaleEnemyForFloor({ ...getRandomMonster() });
        roomStates[nKey] = { type: "enemy", entity: chosenMonster };
        assignedNormalCount++;
    }

    fillRemainingRooms();
}

async function init() {
    await loadGameData();
}

window.onload = init;
