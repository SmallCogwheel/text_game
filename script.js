const story = document.getElementById("story");
const mapDiv = document.getElementById("map");

// 맵 크기 6x6 설정
const mapSize = 6;

let monsters = [];
let items = [];
let bosses = [];

let currentEnemy = null;
let inBattle = false;

let totalSearches = 0;
const maxSearches = 3;

// 플레이어 스탯
let player = {
    hp: 20,
    maxHp: 20,
    atk: 5,
    gold: 0,
    x: 1,
    y: 1
};

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
let currentRoomKey = null; 

// 각 방의 상태 저장소
let roomStates = {};     
let hasRadar = false;      

async function loadGameData() {
    try {
        monsters = await fetch("./assets/monsters.json").then(res => res.json());
        items = await fetch("./assets/items.json").then(res => res.json());
        bosses = await fetch("./assets/boss.json").then(res => res.json());
    } catch (e) {
        console.error("데이터 로드 실패 - 임시 데이터를 주입합니다:", e);
        monsters = [{ "id": "rust_guard", "name": "녹슨 경비 기계", "hp": 15, "atk": 3, "gold": 10 }];
        items = [{ "id": "small_gear", "name": "작은 톱니", "type": "atk", "value": 1 }];
        bosses = [{ "id": "core_gear", "name": "중앙 톱니", "hp": 100, "atk": 15, "gold": 100 }];
    }
}

function updateStats() {
    document.getElementById("hp").textContent = `${player.hp}/${player.maxHp}`;
    document.getElementById("atk").textContent = player.atk;
    document.getElementById("gold").textContent = player.gold;

    const searchCounter = document.getElementById("searchCount");
    if (searchCounter) {
        searchCounter.textContent = `${maxSearches - totalSearches}/${maxSearches}`;
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

function renderMap() {
    mapDiv.innerHTML = "";
    
    mapDiv.style.gridTemplateColumns = `repeat(${mapSize}, 1fr)`;
    mapDiv.style.gridTemplateRows = `repeat(${mapSize}, 1fr)`;

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            const key = `${x},${y}`;

            if (x === player.x && y === player.y) {
                cell.textContent = "■";
                cell.classList.add("current");
            } 
            else if (x === radarX && y === radarY) {
                cell.textContent = "📡";
                cell.style.color = "#bb66ff";
            } 
            else if (x === bossX && y === bossY && (visited.has(key) || (hasRadar && isWithinRadar(x, y)))) {
                cell.textContent = "★";
                cell.classList.add("boss");
            } 
            else if (x === restX && y === restY && (visited.has(key) || (hasRadar && isWithinRadar(x, y)))) {
                cell.textContent = "⚡";
                cell.classList.add("rest");
            } 
            else if (visited.has(key)) {
                if (roomStates[key] && roomStates[key].type === "enemy") {
                    cell.textContent = "⚠️"; 
                    cell.style.color = "#ffaa00";
                } else {
                    cell.textContent = "□";
                    cell.style.color = "#fff";
                }
            } 
            else if (hasRadar && isWithinRadar(x, y)) {
                cell.textContent = "░";
                cell.classList.add("radar-visible");
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

function moveTo(x, y) {
    if (inBattle) return;
    if (!isReachable(x, y)) return;

    prevX = player.x;
    prevY = player.y;

    player.x = x;
    player.y = y;
    const key = `${x},${y}`;
    
    const firstVisit = !visited.has(key);
    visited.add(key);
    renderMap();

    if (x === bossX && y === bossY) {
        bossRoom(key);
        return;
    }

    if (x === restX && y === restY) {
        restRoom();
        return;
    }

    if (x === radarX && y === radarY) {
        if (roomStates[key] && roomStates[key].type === "radar_cleared") {
            story.innerHTML = `📡 레이더 단말기가 설치되어 있던 방입니다. 장치는 이미 챙겼습니다.`;
        } else {
            roomStates[key] = { type: "radar_cleared" };
            findRadar();
        }
        return;
    }

    if (!firstVisit) {
        if (roomStates[key] && roomStates[key].type === "enemy") {
            story.innerHTML = `⚠️ 방 구석에서 이전에 도망쳤던 ${roomStates[key].entity.name}가 씩씩거리며 서 있습니다!<br><br>`;
            encounterEnemy(key, false);
            return;
        }
        story.innerHTML = `🚪 이미 탐색을 끝낸 안전한 방입니다.`;
        return;
    }

    triggerRoomEvent(x, y);
}

function triggerRoomEvent(x, y) {
    const key = `${x},${y}`;
    const random = Math.random();

    if (random < 0.40) {
        const monster = { ...getRandomMonster() };
        roomStates[key] = { type: "enemy", entity: monster };
        encounterEnemy(key, true);
    } 
    else if (random < 0.70) {
        roomStates[key] = { type: "empty" };
        findGold();
    } 
    else {
        roomStates[key] = { type: "empty" };
        emptyRoom();
    }
}

function findRadar() {
    hasRadar = true;
    story.innerHTML = `
        📡 <b>기계 도시의 단말기 부품(레이더)</b>을 발견했습니다!<br><br>
        미니맵 전력 개방! 현재 위치 기준 주변 1칸 반경(대각선 포함)의 지형과<br>
        숨겨진 보스(★), 충전소(⚡)의 위치를 실시간으로 감지하여 안개 구역(░)을 밝힙니다.
    `;
    renderMap();
}

function restRoom() {
    story.innerHTML = `
        ⚡ <b>자가 발전 충전소 (고정 휴식처)</b><br><br>
        기계 장치들이 부드럽게 돌아가는 안전 구역입니다.<br>
        이곳에서는 체력을 채우고 <b>조사 횟수를 충전</b>할 수 있습니다.<br><br>
        <button onclick="useRestStation()">에너지 충전하기</button>
    `;
}

// [수정된 부분] 체력 및 조사 횟수 동시 충전 시스템
function useRestStation() {
    if (player.hp === player.maxHp && totalSearches === 0) {
        story.innerHTML = `⚡ 체력과 조사 횟수가 이미 가득 차 있습니다!`;
        return;
    }
    
    player.hp = player.maxHp;      // 체력 완치
    totalSearches = 0;             // 조사 횟수 풀 초기화 (0번 사용 상태로 리셋)
    
    story.innerHTML = `⚡ 기계 장치와 연결되어 고밀도 에너지를 공급받았습니다!<br><br><span style="color: #62ff62;">✔ 체력이 모두 회복되었습니다.<br>✔ 주변 조사 횟수가 다시 가득 찼습니다! (3/3)</span>`;
    updateStats();
}

function getRandomMonster() {
    if (!monsters || monsters.length === 0) return { name: "경비 로봇", hp: 10, atk: 2, gold: 5 };
    const idx = Math.floor(Math.random() * monsters.length);
    return monsters[idx];
}

function getRandomItem() {
    if (!items || items.length === 0) return { name: "고철 부품", type: "atk", value: 1 };
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
}

function encounterEnemy(key, isNew = true) {
    currentRoomKey = key;
    currentEnemy = roomStates[key].entity;
    inBattle = true;

    if (isNew) {
        story.innerHTML = `🤖 기계 경보 발령! <b>${currentEnemy.name}</b>이(가) 나타났다!`;
    }
    renderMap(); 
    renderBattle();
}

function bossRoom(key) {
    currentRoomKey = key;
    if (!roomStates[key]) {
        roomStates[key] = { type: "enemy", entity: { ...bosses[0] } };
    }
    currentEnemy = roomStates[key].entity;
    inBattle = true;

    story.innerHTML = `⚙️ <b>[경고] 중앙 제어실 진입</b><br><br>도시의 핵심 코어, <b>${currentEnemy.name}</b>가 가동을 시작합니다!`;
    renderMap();
    renderBattle();
}

function renderBattle() {
    story.innerHTML += `
        <div class="battle-box" style="margin-top:15px; padding:10px; border:1px dashed #f66;">
            [전투 상태]<br>
            나의 HP: ${player.hp}/${player.maxHp} | 공격력: ${player.atk}<br>
            적의 이름: ${currentEnemy.name} (HP: ${currentEnemy.hp})
        </div>
    `;

    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = `
        <button onclick="attack()">⚔️ 공격하기</button>
        <button onclick="runAway()">🏃 도망치기</button>
    `;
}

function restoreDefaultChoices() {
    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = `
        <button onclick="searchRoom()">주변을 조사한다</button>
        <button onclick="showStatus()">상태창 보기</button>
    `;
    choicesDiv.style.display = "flex";
}

function attack() {
    if (!inBattle || !currentEnemy) return;

    currentEnemy.hp -= player.atk;
    let log = `⚔️ ${currentEnemy.name}에게 ${player.atk}의 피해를 주었습니다.<br>`;

    if (currentEnemy.hp <= 0) {
        story.innerHTML = log;
        winBattle();
        return;
    }

    player.hp -= currentEnemy.atk;
    log += `💥 ${currentEnemy.name}이(가) 반격하여 ${currentEnemy.atk}의 피해를 입었습니다.`;

    story.innerHTML = log;

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

function winBattle() {
    player.gold += currentEnemy.gold;

    if (currentEnemy.id === "core_gear") {
        story.innerHTML = `
            <h2>🎉 기계 도시 클리어!</h2>
            도시의 중추인 '중앙 톱니'를 무력화시키는 데 성공했습니다.<br>
            멈춰버린 기계 더미 사이로 마침내 지상으로 향하는 문이 열립니다.<br><br>
            최종 골드: 🪙 ${player.gold}<br><br>
            <button onclick="resetGame()" style="border-color: #62ff62; color: #62ff62;">🔄 새로운 여정 시작하기</button>
        `;
        inBattle = true; 
        document.getElementById("choices").style.display = "none";
        currentEnemy = null;
        updateStats();
        return;
    }

    story.innerHTML += `<br>🏆 승리! ${currentEnemy.name}를 처치하고 🪙 ${currentEnemy.gold} 골드를 획득했습니다.`;

    if (currentRoomKey) {
        roomStates[currentRoomKey] = { type: "empty" };
        currentRoomKey = null;
    }

    currentEnemy = null;
    inBattle = false;
    
    restoreDefaultChoices();
    updateStats();
    renderMap();
}

function gameOver() {
    inBattle = true; 
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
    const amount = Math.floor(Math.random() * 10) + 5;
    player.gold += amount;
    story.innerHTML = `🪙 보물 상자 발견!<br><br>골드 +${amount}`;
    updateStats();
}

function emptyRoom() {
    story.innerHTML = `🚪 텅 빈 방이다.<br><br>아무 일도 일어나지 않았다.`;
}

function searchRoom() {
    if (inBattle) {
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

    let typeLabel = "";
    if (item.type === "atk") {
        player.atk += item.value;
        typeLabel = "공격력(ATK)";
    }
    else if (item.type === "hp") {
        player.hp = Math.min(player.maxHp, player.hp + item.value);
        typeLabel = "체력(HP)";
    }

    story.innerHTML = `
        🔍 <b>방 주변을 조사했습니다!</b><br><br>
        기계 잔해 속에서 🛠️ <b>${item.name}</b>을(를) 발견하여 장착했습니다.<br><br>
        <span style="color: #62ff62;">[효과] ${typeLabel} +${item.value}</span>
    `;

    updateStats();
}

function showStatus() {
    story.innerHTML = `
        📜 상태창<br><br>
        나의 스펙:<br>
        - HP : ${player.hp} / ${player.maxHp}<br>
        - ATK : ${player.atk}<br>
        - GOLD : 🪙 ${player.gold}<br>
        - RADAR : ${hasRadar ? "장착 완료 (ON)" : "미획득 (OFF)"}
    `;
}

function resetGame() {
    player = {
        hp: 20,
        maxHp: 20,
        atk: 5,
        gold: 0,
        x: 1,
        y: 1
    };
    prevX = 1;
    prevY = 1;

    totalSearches = 0;
    inBattle = false;
    currentEnemy = null;
    currentRoomKey = null;
    hasRadar = false;
    roomStates = {};

    visited.clear();
    visited.add(`${player.x},${player.y}`);

    story.innerHTML = "⚙️ 시스템이 재부팅되었습니다.<br><br>당신은 다시 녹슨 금속 방에서 눈을 떴다.<br><br>벽에서는 규칙적인 기계음이 들린다.<br>출구로 보이는 문이 하나 있다.";
    restoreDefaultChoices();

    generateMapObjects();
    updateStats();
    renderMap();
}

function generateMapObjects() {
    do {
        bossX = Math.floor(Math.random() * mapSize);
        bossY = Math.floor(Math.random() * mapSize);
    } while (bossX === 1 && bossY === 1);

    do {
        restX = Math.floor(Math.random() * mapSize);
        restY = Math.floor(Math.random() * mapSize);
    } while ((restX === 1 && restY === 1) || (restX === bossX && restY === bossY));

    do {
        radarX = Math.floor(Math.random() * mapSize);
        radarY = Math.floor(Math.random() * mapSize);
    } while (
        (radarX === 1 && radarY === 1) || 
        (radarX === bossX && radarY === bossY) || 
        (radarX === restX && radarY === restY)
    );
}

async function init() {
    await loadGameData();
    generateMapObjects(); 
    visited.add(`${player.x},${player.y}`);
    updateStats();
    renderMap();
}

window.onload = init;