const story = document.getElementById("story");
const mapDiv = document.getElementById("map");

const mapSize = 4;

let monsters = [];
let items = [];
let bosses = [];

let currentEnemy = null;
let inBattle = false;

let totalSearches = 0;
const maxSearches = 3;

let player = {
    hp: 20,
    atk: 5,
    gold: 0,
    x: 1,
    y: 1
};

const visited = new Set();
visited.add(`${player.x},${player.y}`);

const roomEvents = {};

async function loadGameData() {

    monsters = await fetch("./assets/monsters.json")
        .then(res => res.json());

    items = await fetch("./assets/items.json")
        .then(res => res.json());

    bosses = await fetch("./assets/boss.json")
        .then(res => res.json());
}

function updateStats() {

    document.getElementById("hp").textContent = player.hp;
    document.getElementById("atk").textContent = player.atk;
    document.getElementById("gold").textContent = player.gold;

    const searchCounter =
        document.getElementById("searchCount");

    if (searchCounter) {
        searchCounter.textContent =
            `${maxSearches - totalSearches}/${maxSearches}`;
    }
}

function isReachable(x, y) {

    const dx = Math.abs(player.x - x);
    const dy = Math.abs(player.y - y);

    return dx + dy === 1;
}

function renderMap() {

    mapDiv.innerHTML = "";

    for (let y = 0; y < mapSize; y++) {

        for (let x = 0; x < mapSize; x++) {

            const cell = document.createElement("div");
            cell.classList.add("cell");

            const key = `${x},${y}`;

            if (x === player.x && y === player.y) {

                cell.textContent = "■";
                cell.classList.add("current");

            } else if (x === 3 && y === 3) {

                cell.textContent = "★";
                cell.classList.add("boss");

            } else if (visited.has(key)) {

                cell.textContent = "□";

            } else {

                cell.textContent = "·";
            }

            if (isReachable(x, y)) {

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

    player.x = x;
    player.y = y;

    const key = `${x},${y}`;
    const firstVisit = !visited.has(key);

    visited.add(key);

    renderMap();

    if (x === 3 && y === 3) {
        bossRoom();
        return;
    }

    if (!firstVisit) {

        story.innerHTML = `
            🚪 이미 탐험한 방이다.<br><br>
            특별한 일은 일어나지 않았다.
        `;

        return;
    }

    triggerRoomEvent(x, y);
}

function getRoomEvent(x, y) {

    const key = `${x},${y}`;

    if (!roomEvents[key]) {

        const random = Math.random();

        if (random < 0.4) {
            roomEvents[key] = "enemy";
        }
        else if (random < 0.7) {
            roomEvents[key] = "gold";
        }
        else {
            roomEvents[key] = "empty";
        }
    }

    return roomEvents[key];
}

function triggerRoomEvent(x, y) {

    const event = getRoomEvent(x, y);

    switch (event) {

        case "enemy":
            encounterEnemy();
            break;

        case "gold":
            findGold();
            break;

        default:
            emptyRoom();
    }
}

function getRandomMonster() {

    return monsters[
        Math.floor(Math.random() * monsters.length)
    ];
}

function getRandomItem() {

    return items[
        Math.floor(Math.random() * items.length)
    ];
}

function encounterEnemy() {

    currentEnemy = {
        ...getRandomMonster()
    };

    inBattle = true;

    renderBattle();
}

function renderBattle() {

    story.innerHTML = `
        <h3>⚔️ 전투</h3>

        <strong>${currentEnemy.name}</strong><br><br>

        적 HP : ${currentEnemy.hp}<br>
        적 공격력 : ${currentEnemy.atk}<br><br>

        내 HP : ${player.hp}<br>
        내 공격력 : ${player.atk}<br><br>

        <button onclick="attackEnemy()">공격</button>
        <button onclick="runAway()">도망</button>
    `;
}

function attackEnemy() {

    if (!inBattle) return;

    currentEnemy.hp -= player.atk;

    if (currentEnemy.hp <= 0) {
        winBattle();
        return;
    }

    player.hp -= currentEnemy.atk;

    if (player.hp <= 0) {
        gameOver();
        return;
    }

    updateStats();

    story.innerHTML = `
        ⚔️ ${currentEnemy.name}에게 ${player.atk} 피해!<br><br>

        💥 ${currentEnemy.name}의 공격!<br>
        ${currentEnemy.atk} 피해를 입었다.<br><br>

        적 HP : ${currentEnemy.hp}<br>
        적 공격력 : ${currentEnemy.atk}<br><br>

        내 HP : ${player.hp}<br>
        내 공격력 : ${player.atk}<br><br>

        <button onclick="attackEnemy()">공격</button>
        <button onclick="runAway()">도망</button>
    `;
}

function winBattle() {

    player.gold += currentEnemy.gold;

    story.innerHTML = `
        🏆 승리!<br><br>

        ${currentEnemy.name} 처치<br><br>

        골드 +${currentEnemy.gold}
    `;

    currentEnemy = null;
    inBattle = false;

    updateStats();
}

function runAway() {

    if (!inBattle) return;

    if (Math.random() < 0.5) {

        story.innerHTML = `
            🏃 도망에 성공했다!
        `;

        currentEnemy = null;
        inBattle = false;

    } else {

        player.hp -= currentEnemy.atk;

        updateStats();

        if (player.hp <= 0) {
            gameOver();
            return;
        }

        story.innerHTML = `
            ❌ 도망 실패!<br><br>

            ${currentEnemy.atk} 피해를 입었다.<br><br>

            <button onclick="attackEnemy()">공격</button>
            <button onclick="runAway()">도망</button>
        `;
    }
}

function gameOver() {

    inBattle = false;

    story.innerHTML = `
        <h2>☠️ GAME OVER</h2>
        기계 도시 깊은 곳에서 쓰러졌다.
    `;
}

function findGold() {

    const amount =
        Math.floor(Math.random() * 10) + 5;

    player.gold += amount;

    story.innerHTML = `
        🪙 보물 상자 발견!<br><br>
        골드 +${amount}
    `;

    updateStats();
}

function emptyRoom() {

    story.innerHTML = `
        🚪 텅 빈 방이다.<br><br>
        아무 일도 일어나지 않았다.
    `;
}

function searchRoom() {

    if (inBattle) {

        story.innerHTML = `
            ⚔️ 전투 중에는 조사할 수 없다.
        `;

        return;
    }

    if (totalSearches >= maxSearches) {

        story.innerHTML = `
            🔍 더 이상 조사할 수 없다.<br><br>
            모든 조사 기회를 사용했다.
        `;

        return;
    }

    totalSearches++;

    const item = getRandomItem();

    if (item.type === "atk") {
        player.atk += item.value;
    }
    else if (item.type === "hp") {
        player.hp += item.value;
    }

    story.innerHTML = `
        🔍 조사 성공!<br><br>

        ${item.name} 획득!<br><br>

        ${item.type.toUpperCase()}
        +${item.value}
    `;

    updateStats();
}

function showStatus() {

    story.innerHTML = `
        📜 상태창<br><br>

        HP : ${player.hp}<br>
        공격력 : ${player.atk}<br>
        골드 : ${player.gold}<br><br>

        조사 :
        ${maxSearches - totalSearches}/${maxSearches}
    `;
}

function bossRoom() {

    currentEnemy = {
        ...bosses[0]
    };

    inBattle = true;

    renderBattle();
}

async function init() {

    await loadGameData();

    updateStats();
    renderMap();
}

init();
