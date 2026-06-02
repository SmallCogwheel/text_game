// ==========================================
// map.js — 맵 생성 · 렌더링 · 이동
// ==========================================

// ── 맵 유틸리티 ────────────────────────────
function isReachable(x, y)    { return Math.abs(player.x - x) + Math.abs(player.y - y) === 1; }
function isWithinRadar(x, y)  { return Math.abs(player.x - x) <= 1 && Math.abs(player.y - y) <= 1; }
function hasRadarTerminalOnFloor() { return currentFloor === 1; }
function getMapSizeForFloor() { return 5 + currentFloor; }
function getEliteMonsterTargetCount() { return currentFloor + 1; }
function getNormalMonsterTargetCount() {
    const min = 7 + (currentFloor - 1) * 4;
    const max = 15 + (currentFloor - 1) * 5;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── 맵 오브젝트 생성 ─────────────────────
function generateMapObjects() {
    roomStates = {};
    mapSize    = getMapSizeForFloor();
    radarX = radarY = -1;

    const isStart   = (x, y) => x === 1 && y === 1;
    const isBossPos = (x, y) => x === bossX && y === bossY;
    const isRestPos = (x, y) => x === restX && y === restY;
    const isRadarPos= (x, y) => hasRadarTerminalOnFloor() && x === radarX && y === radarY;
    const isElitePos= (x, y) => x === eliteChestX && y === eliteChestY;

    const randCell = () => ({
        x: Math.floor(Math.random() * mapSize),
        y: Math.floor(Math.random() * mapSize)
    });

    // 주요 오브젝트 위치 선점 (충돌 없이)
    do { ({ x: bossX, y: bossY } = randCell()); } while (isStart(bossX, bossY));
    do { ({ x: restX, y: restY } = randCell()); } while (isStart(restX, restY) || isBossPos(restX, restY));
    if (hasRadarTerminalOnFloor()) {
        do { ({ x: radarX, y: radarY } = randCell()); }
        while (isStart(radarX, radarY) || isBossPos(radarX, radarY) || isRestPos(radarX, radarY));
    }
    do { ({ x: eliteChestX, y: eliteChestY } = randCell()); }
    while (isStart(eliteChestX, eliteChestY) || isBossPos(eliteChestX, eliteChestY)
        || isRestPos(eliteChestX, eliteChestY) || isRadarPos(eliteChestX, eliteChestY));

    // 고정 오브젝트 등록
    roomStates[`${bossX},${bossY}`]             = { type: "enemy", entity: getBossEnemy() };
    roomStates[`${restX},${restY}`]              = { type: "rest" };
    roomStates[`${eliteChestX},${eliteChestY}`]  = { type: "elite_chest" };
    if (hasRadarTerminalOnFloor()) roomStates[`${radarX},${radarY}`] = { type: "radar" };

    // 정예 몬스터 배치
    let placed = 0;
    while (placed < getEliteMonsterTargetCount() && eliteMonsters.length) {
        const { x: ex, y: ey } = randCell();
        const eKey = `${ex},${ey}`;
        if (isStart(ex,ey)||isBossPos(ex,ey)||isRestPos(ex,ey)||isRadarPos(ex,ey)||isElitePos(ex,ey)||roomStates[eKey]) continue;
        const elite = scaleEnemyForFloor({ ...eliteMonsters[Math.floor(Math.random() * eliteMonsters.length)] });
        roomStates[eKey] = { type: "enemy", entity: elite };
        placed++;
    }

    // 일반 몬스터 배치
    let normalPlaced = 0, safety = 0;
    while (normalPlaced < getNormalMonsterTargetCount() && safety < 500) {
        safety++;
        const { x: nx, y: ny } = randCell();
        const nKey = `${nx},${ny}`;
        if (isStart(nx,ny)||isBossPos(nx,ny)||isRestPos(nx,ny)||isRadarPos(nx,ny)||isElitePos(nx,ny)||roomStates[nKey]) continue;
        roomStates[nKey] = { type: "enemy", entity: scaleEnemyForFloor({ ...getRandomMonster() }) };
        normalPlaced++;
    }

    fillRemainingRooms();
}

function preGenerateRoomState(x, y) {
    const key = `${x},${y}`;
    if (roomStates[key]) return;
    roomStates[key] = { type: Math.random() < 0.45 ? "gold" : "empty" };
}

function fillRemainingRooms() {
    for (let y = 0; y < mapSize; y++)
        for (let x = 0; x < mapSize; x++)
            if (!(x === player.x && y === player.y)) preGenerateRoomState(x, y);
}

// ── 맵 렌더링 ──────────────────────────────
function renderMap() {
    mapDiv.innerHTML = "";
    mapDiv.style.gridTemplateColumns = `repeat(${mapSize}, 1fr)`;
    mapDiv.style.gridTemplateRows    = `repeat(${mapSize}, 1fr)`;
    mapDiv.style.width  = `${320 + (mapSize - 6) * 50}px`;
    mapDiv.style.height = `${320 + (mapSize - 6) * 50}px`;

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            const key = `${x},${y}`;
            const vis = visited.has(key);
            const radar = hasRadar && isWithinRadar(x, y);

            if (x === player.x && y === player.y) {
                cell.textContent = "■";
                cell.classList.add("current");
            } else if (hasRadarTerminalOnFloor() && x === radarX && y === radarY) {
                if (roomStates[key]?.type === "radar_cleared") {
                    cell.textContent = "□"; cell.style.color = "#fff";
                } else {
                    cell.textContent = "[R]"; cell.style.color = "#bb66ff";
                }
            } else if (x === bossX && y === bossY) {
                if (vis || radar) { cell.textContent = "[B]"; cell.classList.add("boss"); }
                else cell.textContent = "·";
            } else if (x === restX && y === restY) {
                if (vis || radar) { cell.textContent = "[+]"; cell.classList.add("rest"); }
                else cell.textContent = "·";
            } else if (x === eliteChestX && y === eliteChestY) {
                if (vis) {
                    cell.textContent = "□"; cell.style.color = "#fff";
                } else if (radar) {
                    cell.textContent = "[$]"; cell.style.color = "#00ffff";
                } else {
                    cell.textContent = "·";
                }
            } else if (vis) {
                const state = roomStates[key];
                if (state?.type === "enemy") {
                    if (state.entity?.isElite) { cell.textContent = "[X]"; cell.style.color = "#ff3333"; }
                    else { cell.textContent = "[!]"; cell.classList.add("monster"); }
                } else {
                    cell.textContent = "□"; cell.style.color = "#fff";
                }
            } else if (radar) {
                const state = roomStates[key];
                if (state?.type === "enemy") {
                    if (state.entity?.isElite) { cell.textContent = "[X]"; cell.style.color = "#ff3333"; }
                    else { cell.textContent = "[!]"; cell.classList.add("monster"); }
                } else if (state?.type === "gold") {
                    cell.textContent = "[$]"; cell.style.color = "#ffbb33";
                } else {
                    cell.textContent = "·"; cell.style.color = "#ffbb33";
                }
            } else {
                cell.textContent = "·";
            }

            const reachable = isReachable(x, y) && !inBattle && !isGameOver;
            const isPlayerCell = x === player.x && y === player.y;

            if (reachable) {
                cell.classList.add("reachable");
                cell.onclick = () => moveTo(x, y);
            } else if (!isPlayerCell && radar && !vis) {
                // 레이더 탐지 범위 (미방문) — 하늘색 배경
                cell.classList.add("radar-tint");
            }
            mapDiv.appendChild(cell);
        }
    }
}

// ── 이동 및 방 이벤트 ─────────────────────
function moveTo(x, y) {
    if (inBattle || isGameOver || !isReachable(x, y)) return;

    prevX = player.x; prevY = player.y;
    player.x = x; player.y = y;
    const key = `${x},${y}`;
    const firstVisit = !visited.has(key);
    visited.add(key);

    if (x === bossX && y === bossY)         { bossRoom(key); return; }
    if (x === restX && y === restY)         { restRoom(); renderMap(); return; }
    if (x === eliteChestX && y === eliteChestY) {
        if (firstVisit) openEliteChest();
        else story.innerHTML = `>> 이미 열려있는 낡은 엘리트 보물상자만 덩그러니 남아있습니다.`;
        renderMap(); return;
    }
    if (hasRadarTerminalOnFloor() && x === radarX && y === radarY) {
        handleRadarRoom(key); return;
    }
    if (!firstVisit) {
        if (roomStates[key]?.type === "enemy") {
            const prefix = roomStates[key].entity.isElite ? `!! [위험] ` : `[!] `;
            story.innerHTML = `${prefix}방 구석에서 이전에 도망쳤던 <b>${roomStates[key].entity.name}</b>가 씩씩거리며 서 있습니다!<br><br>`;
            encounterEnemy(key, false); return;
        }
        story.innerHTML = `>> 이미 탐색을 끝낸 안전한 방입니다.`;
        renderMap(); return;
    }
    if (!roomStates[key]) preGenerateRoomState(x, y);
    triggerRoomEvent(key);
}

function handleRadarRoom(key) {
    if (roomStates[key]?.type === "radar_cleared") {
        story.innerHTML = `[NET] 레이더 단말기가 설치되어 있던 방입니다. 장치는 이미 완전히 해체되었습니다.`;
    } else {
        roomStates[key] = { type: "radar_cleared" };
        if (chosenClass === "netrunner") {
            const roll = Math.random();
            let droppedItem, rarityLabel, rarityColor, isEliteFlag;
            if (roll < 0.90) {
                droppedItem = getRandomItem();
                rarityLabel = "일반"; rarityColor = "#62ff62"; isEliteFlag = false;
            } else if (roll < 0.99) {
                droppedItem = eliteItems?.length ? eliteItems[Math.floor(Math.random() * eliteItems.length)] : getRandomItem();
                rarityLabel = "엘리트"; rarityColor = "#00ffff"; isEliteFlag = true;
            } else {
                droppedItem = superiorItems?.length ? superiorItems[Math.floor(Math.random() * superiorItems.length)] : getRandomItem();
                rarityLabel = "은화 전용"; rarityColor = "#d8d8ff"; isEliteFlag = true;
            }
            if (!droppedItem) {
                story.innerHTML = `[NET] 단말기를 분해했으나 내부 코어가 손상되어 부품을 얻지 못했습니다.`;
            } else {
                applyItemReward(droppedItem, isEliteFlag);
                story.innerHTML = `
                    <h3 style="color:#00ffff;margin-bottom:8px;">[NET] [SCRAP_PROTOCOL] 레이더 시스템 완전 해체</h3>
                    단말기 내부 회로를 분석하여 부품을 추출했습니다.<br>
                    <span style="color:#aaa;font-size:12px;">[드랍 확률: 일반 90% / 엘리트 9% / 은화 1%]</span><br><br>
                    [ENG] 획득: <b style="color:${rarityColor};">[${rarityLabel}] ${droppedItem.name}</b><br>
                    <span style="color:${rarityColor};font-weight:bold;">[효과] ${formatItemEffects(droppedItem)} 상승!</span>
                `;
            }
        } else {
            findRadar();
        }
    }
    renderMap(); updateStats(); updateInventoryUI();
}

function triggerRoomEvent(key) {
    const state = roomStates[key];
    if (!state) return;
    if (state.type === "enemy") { encounterEnemy(key, true); }
    else if (state.type === "gold") { findGold(); roomStates[key] = { type: "empty" }; renderMap(); }
    else { emptyRoom(); renderMap(); }
}
