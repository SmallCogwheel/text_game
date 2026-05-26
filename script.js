const story = document.getElementById("story");
const mapDiv = document.getElementById("map");

const mapSize = 4;

let player = {
    hp: 20,
    atk: 5,
    gold: 0,
    x: 1,
    y: 1
};

const visited = new Set();
visited.add(`${player.x},${player.y}`);

function updateStats() {
    document.getElementById("hp").textContent = player.hp;
    document.getElementById("atk").textContent = player.atk;
    document.getElementById("gold").textContent = player.gold;
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

            // 현재 위치
            if (x === player.x && y === player.y) {

                cell.textContent = "■";
                cell.classList.add("current");

            }

            // 보스방
            else if (x === 3 && y === 3) {

                cell.textContent = "★";
                cell.classList.add("boss");

            }

            // 방문한 방
            else if (visited.has(key)) {

                cell.textContent = "□";

            }

            // 미방문
            else {

                cell.textContent = "·";

            }

            // 이동 가능 칸
            if (isReachable(x, y)) {

                cell.classList.add("reachable");

                cell.addEventListener("click", () => {
                    moveTo(x, y);
                });
            }

            mapDiv.appendChild(cell);
        }
    }
}

function moveTo(x, y) {

    if (!isReachable(x, y)) return;

    player.x = x;
    player.y = y;

    visited.add(`${x},${y}`);

    renderMap();

    if (x === 3 && y === 3) {
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
        ⚔️ 녹슨 경비 기계를 발견했다.<br><br>
        간단한 전투 끝에 승리했다.<br><br>
        골드 +10
    `;

    updateStats();
}

function findGold() {

    player.gold += 5;

    story.innerHTML = `
        🪙 버려진 상자를 발견했다.<br><br>
        골드 +5
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

    player.atk += 1;

    story.innerHTML = `
        🔍 방을 조사했다.<br><br>
        작은 톱니를 발견했다.<br><br>
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

        현재 위치 : (${player.x}, ${player.y})
    `;
}

function bossRoom() {

    story.innerHTML = `
        👑 보스 방 도착!<br><br>

        거대한 중앙 톱니가 움직이기 시작했다.<br><br>

        (보스전은 아직 구현되지 않음)
    `;
}

updateStats();
renderMap();
