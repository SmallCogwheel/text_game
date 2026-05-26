const story = document.getElementById("story");
const mapDiv = document.getElementById("map");

let player = {
    hp: 20,
    atk: 5,
    gold: 0,
    x: 2,
    y: 1
};

const mapSize = 4;

function updateStats() {
    document.getElementById("hp").textContent = player.hp;
    document.getElementById("atk").textContent = player.atk;
    document.getElementById("gold").textContent = player.gold;
}

function renderMap() {
    mapDiv.innerHTML = "";

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {

            const cell = document.createElement("div");
            cell.classList.add("cell");

            if (x === player.x && y === player.y) {
                cell.textContent = "■";
                cell.classList.add("current");
            }
            else if (x === 3 && y === 3) {
                cell.textContent = "★";
                cell.classList.add("boss");
            }
            else {
                cell.textContent = "□";
            }

            mapDiv.appendChild(cell);
        }
    }
}

function goDoor() {

    const directions = [];

    if (player.x > 0) directions.push([-1, 0]);
    if (player.x < mapSize - 1) directions.push([1, 0]);
    if (player.y > 0) directions.push([0, -1]);
    if (player.y < mapSize - 1) directions.push([0, 1]);

    const move =
        directions[Math.floor(Math.random() * directions.length)];

    player.x += move[0];
    player.y += move[1];

    renderMap();

    if (player.x === 3 && player.y === 3) {
        bossRoom();
        return;
    }

    randomEvent();
}

function randomEvent() {

    const random = Math.random();

    if (random < 0.4) {
        encounterEnemy();
    }
    else if (random < 0.7) {
        findGold();
    }
    else {
        emptyRoom();
    }
}

function encounterEnemy() {

    player.gold += 10;

    story.innerHTML = `
        ⚔️ 녹슨 경비 기계와 조우했다.<br><br>

        전투 끝에 승리했다.<br>

        골드 10 획득.
    `;

    updateStats();
}

function findGold() {

    player.gold += 5;

    story.innerHTML = `
        🪙 금속 상자를 발견했다.<br><br>

        골드 5 획득.
    `;

    updateStats();
}

function emptyRoom() {

    story.innerHTML = `
        조용한 방이다.<br><br>

        특별한 일은 일어나지 않았다.
    `;
}

function searchRoom() {

    player.atk += 1;

    story.innerHTML = `
        🔍 방을 조사했다.<br><br>

        작은 톱니를 발견했다.<br>

        공격력 +1
    `;

    updateStats();
}

function showStatus() {

    story.innerHTML = `
        📜 상태창<br><br>

        HP : ${player.hp}<br>
        공격력 : ${player.atk}<br>
        골드 : ${player.gold}<br><br>

        위치 : (${player.x}, ${player.y})
    `;
}

function bossRoom() {

    story.innerHTML = `
        👑 보스 방 도착!<br><br>

        거대한 중앙 톱니가 당신 앞에 모습을 드러냈다.<br><br>

        아직 보스전은 구현되지 않았다.
    `;
}

updateStats();
renderMap();
