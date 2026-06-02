// ==========================================
// game.js — 게임 로직 (캐릭터·전투·상점·루팅)
// ==========================================

// ── 캐릭터 선택 ────────────────────────────
async function selectCharacter(className) {
    await loadGameData();
    chosenClass = className;

    // 전체 상태 초기화
    playerInventory = []; inventorySortMode = "rarity"; roomStates = {};
    visited.clear(); currentFloor = 1; totalSearches = 0; restCount = 0;
    inBattle = false; isGameOver = false; currentEnemy = null;
    currentRoomKey = null; hasRadar = false; prevX = prevY = 1;

    if (className === "netrunner") {
        player = { hp: 16, maxHp: 16, atk: 4, def: 0, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 3; hasRadar = true;
        playerInventory.push({ name: "합성화 금속 레이더", atk: 2, hp: 2, isElite: false, rarity: "normal" });
    } else if (className === "samurai") {
        player = { hp: 20, maxHp: 20, atk: 7, def: 0, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 2;
        const weapon = { name: "크롬 카타나", atk: 2, isElite: false, rarity: "normal" };
        playerInventory.push(weapon);
        player.atk += weapon.atk;
    } else if (className === "mechanic") {
        player = { hp: 26, maxHp: 26, atk: 3, def: 2, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 3;
        const armor = { name: "강화 티타늄 판넬", def: 3, isElite: false, rarity: "normal" };
        playerInventory.push(armor);
        player.def += armor.def;
    } else if (className === "jester") {
        // 2번 굴려 낮은 값 채택 — 낮은 숫자가 더 자주 나오도록 가중치
        const d5low = () => Math.min(
            Math.floor(Math.random() * 5) + 1,
            Math.floor(Math.random() * 5) + 1
        );
        const jAtk = d5low(), jDef = d5low(), jHpBonus = d5low();
        const jBaseHp = 18 + jHpBonus;
        player = { hp: jBaseHp, maxHp: jBaseHp, atk: jAtk, def: jDef, gold: 20, silver: 0, x: 1, y: 1 };
        maxSearches = 3;
        playerInventory.push({
            name: "저주받은 10면체 주사위",
            atk: jAtk, def: jDef, hp: jHpBonus,
            isElite: false, rarity: "elite",
            _jesterRolled: true
        });
    }

    document.getElementById("char-select-container").style.display = "none";
    document.getElementById("game-container").style.display = "flex";

    // 난이도 배지 표시
    const diffColors = { easy: "#00ffcc", normal: "#62ff62", hard: "#ffaa00", expert: "#ff3333" };
    const titleEl = document.querySelector(".game-title");
    if (titleEl) {
        const oldBadge = titleEl.querySelector("#difficulty-badge");
        if (oldBadge) oldBadge.remove();
        const badge = document.createElement("span");
        badge.id = "difficulty-badge";
        badge.style.color = diffColors[currentDifficulty] || "#62ff62";
        badge.style.borderColor = diffColors[currentDifficulty] || "#62ff62";
        badge.textContent = DIFFICULTY_LABELS[currentDifficulty] ?? currentDifficulty.toUpperCase();
        titleEl.appendChild(badge);
    }

    const jesterDiceIntro = (() => {
        if (className !== "jester") return "";
        const inv = playerInventory.find(i => i._jesterRolled);
        if (!inv) return "";
        const statColor = v => v >= 4 ? "#62ff62" : v >= 2 ? "#ffcc44" : "#ff6666";
        return `[DICE] 주사위가 스스로 굴러 당신의 운명을 결정했습니다...<br><br>` +
            `<div style="padding:8px 12px;border:1px dashed #ff00ff;margin:6px 0;line-height:2;">` +
            `<span style="color:#ff00ff;">🎲 운명의 스탯 배분 결과</span><br>` +
            `ATK : <b style="color:${statColor(inv.atk)};">${inv.atk}</b> &nbsp;|&nbsp; ` +
            `DEF : <b style="color:${statColor(inv.def)};">${inv.def}</b> &nbsp;|&nbsp; ` +
            `HP 보너스 : <b style="color:${statColor(inv.hp)};">+${inv.hp}</b> (기본 18 + ${inv.hp} = ${player.maxHp})` +
            `</div><br>`;
    })();

    const classIntro = {
        netrunner: `[NET] 내장 오버클럭 레이더가 가동되어 주변 환경 스캔을 시작합니다.<br><br>`,
        samurai:   `[SAM] 손에 쥔 <b style="color:#62ff62;">크롬 카타나</b>가 서늘하게 빛납니다. 앞에 있는 모든 것을 베어 넘기십시오.<br><br>`,
        mechanic:  `[MEC] 두꺼운 <b style="color:#62ff62;">강화 티타늄 판넬</b>에는 당신의 추억이 담겨있습니다.<br><br>`,
        jester:    jesterDiceIntro + `[JST] <b style="color:#ff00ff;">저주받은 주사위</b>가 손 안에서 스스로 굴러다닙니다. 운명은... 항상 옳습니다.<br><br>`
    };
    story.innerHTML = `[ENG] 시스템 프로토콜 동조 완료. [클래스: ${className.toUpperCase()}]<br><br>` +
        (classIntro[className] || "") +
        `당신은 기계 도시 지하 ${currentFloor}층의 녹슨 금속 방에서 눈을 떴습니다.<br><br>` +
        `3층 최상층 코어까지 올라가는 것이 목표입니다.<br>벽에서는 불규칙적인 기계음이 들려옵니다. 주변을 조사하거나 이동하세요.`;

    generateMapObjects();
    visited.add(`${player.x},${player.y}`);
    updateStats(); updateInventoryUI(); renderMap();
}

// ── 적 데이터 유틸리티 ─────────────────────
function getRandomMonster() {
    if (!monsters?.length) return { name: "경비 로봇", hp: 10, atk: 2, gold: 5 };
    return monsters[Math.floor(Math.random() * monsters.length)];
}

function getRandomItem() {
    if (!items?.length) return { name: "고철 부품", atk: 1 };
    return items[Math.floor(Math.random() * items.length)];
}

function scaleEnemyForFloor(enemy, isBoss = false) {
    const diff  = DIFFICULTY_MULTIPLIER[currentDifficulty] ?? 1.0;
    const hpM   = (1 + (currentFloor - 1) * (isBoss ? FLOOR_BOSS_HP_SCALE  : FLOOR_HP_SCALE))  * diff;
    const atkM  = (1 + (currentFloor - 1) * (isBoss ? FLOOR_BOSS_ATK_SCALE : FLOOR_ATK_SCALE)) * diff;
    const goldM = 1 + (currentFloor - 1) * FLOOR_GOLD_SCALE;
    const label = currentFloor > 1 ? `${currentFloor}층 강화 ` : "";
    return { ...enemy, name: `${label}${enemy.name}`,
        hp: Math.ceil(enemy.hp * hpM), atk: Math.ceil(enemy.atk * atkM), gold: Math.ceil(enemy.gold * goldM) };
}

function getBossEnemy() {
    const fallback = {
        1: { id: "core_gear",          name: "중앙 톱니",      hp: 115, atk: 17, gold: 120 },
        2: { id: "upper_core",         name: "상층 압축 코어", hp: 220, atk: 28, gold: 220 },
        3: { id: "final_control_core", name: "최종 제어 코어", hp: 380, atk: 45, gold: 380 }
    };
    const pool = bosses?.["floor" + currentFloor];
    const base = pool ? pool[Math.floor(Math.random() * pool.length)] : fallback[currentFloor];
    return scaleEnemyForFloor({ ...base }, true);
}

// ── 방 이벤트 ──────────────────────────────
function findGold() {
    const amount = Math.floor((Math.random() * 10 + 5) * (1 + (currentFloor - 1) * FLOOR_GOLD_SCALE));
    player.gold += amount;
    story.innerHTML = `[G] ${currentFloor}층 보물 상자 발견!<br><br>골드 +${amount}`;
    updateStats();
}

function emptyRoom() {
    story.innerHTML = `>> 텅 빈 방이다.<br><br>아무 일도 일어나지 않았다.`;
}

function findRadar() {
    hasRadar = true;
    story.innerHTML = `
        [R] <b>기계 도시의 단말기 부품(레이더)</b>을 발견했습니다!<br><br>
        미니맵 전력 개방! 현재 위치 기준 주변 1칸 반경(대각선 포함)의 안개를 스캔합니다.<br>
        사거리 내에 들어온 <b>보물 상자([G])</b>, <b>몬스터([!])</b>, <b>정예 기계([X])</b> 및 <b style="color:#00ffff;">정예 상자([$])</b>의 정보가 투시됩니다.
    `;
}

function openEliteChest() {
    if (!eliteItems?.length) { story.innerHTML = `[$] <b>고대 엘리트 금고</b>를 열었으나 내부에 부품이 없습니다.`; return; }
    const item = eliteItems[Math.floor(Math.random() * eliteItems.length)];
    applyItemReward(item, true, "silver");
    story.innerHTML = `
        <h2 style="color:#00ffff;margin-bottom:12px;">[$] 고대 엘리트 보물상자 개방! [$]</h2>
        두꺼운 보안 시스템이 해제되더니 찬란한 빛를 내뿜는 정예 장비가 모습을 드러납니다.<br><br>
        [ITEM] 획득 아이템: <b style="color:#00ffff;">${item.name}</b><br><br>
        <span style="color:#62ff62;font-weight:bold;">[효과] ${formatItemEffects(item)} 상승!</span>
    `;
    updateStats(); updateInventoryUI();
}

function searchRoom() {
    if (inBattle || isGameOver) { story.innerHTML = `[ATK] 전투 중에는 조사할 수 없다.`; return; }
    if (totalSearches >= maxSearches) { story.innerHTML = `[SCN] 더 이상 조사할 수 없다.<br><br>모든 조사 기회를 사용했다.`; return; }

    totalSearches++;
    const item = getRandomItem();
    if (!item) { story.innerHTML = `[SCN] 방을 샅샅이 뒤졌지만 쓸만한 고철을 찾지 못했습니다.`; updateStats(); return; }

    applyItemReward(item, false);
    story.innerHTML = `
        [SCN] <b>방 주변을 조사했습니다!</b><br><br>
        기계 잔해 속에서 [MOD] <b>${item.name}</b>을(를) 발견하여 장착했습니다.<br><br>
        <span style="color:#62ff62;">[효과] ${formatItemEffects(item)} 상승!</span>
    `;
    updateStats(); updateInventoryUI();
}

// ── 전투 ───────────────────────────────────
function encounterEnemy(key, isNew = true) {
    currentRoomKey = key;
    currentEnemy   = roomStates[key].entity;
    inBattle       = true;
    if (isNew) {
        story.innerHTML = currentEnemy.isElite
            ? `<h3 style="color:#ff3333;margin-bottom:8px;">!! 강력한 경보 발령! !!</h3>정예 경비 시스템인 <b>${currentEnemy.name}</b>이(가) 방어 프로토콜을 가동하며 나타났습니다!`
            : `[BOT] 기계 경보 발령! <b>${currentEnemy.name}</b>이(가) 나타났다!`;
    }
    renderMap(); renderBattle();
}

function bossRoom(key) {
    currentRoomKey = key;
    if (!roomStates[key]?.entity) roomStates[key] = { type: "enemy", entity: getBossEnemy() };
    currentEnemy = roomStates[key].entity;
    inBattle = true;
    story.innerHTML = `[ENG] <b>[경고] ${currentFloor}층 제어실 진입</b><br><br>도시의 핵심 코어, <b>${currentEnemy.name}</b>가 가동을 시작합니다!`;
    renderMap(); renderBattle();
}

// ── 대미지 미리보기 계산 헬퍼 ─────────────
function calcPlayerDamage() {
    const base  = player.atk;
    const extra = (chosenClass === "samurai") ? Math.max(1, Math.floor(base * SAMURAI_BONUS_RATIO)) : 0;
    return { base, extra, total: base + extra };
}

function calcEnemyDamage(guardActive = false) {
    const effDef   = guardActive ? player.def + GUARD_DEF_BONUS : player.def;
    const cap      = guardActive ? GUARD_DEF_CAP : DEF_BLOCK_CAP;
    const blocked  = Math.min(effDef, Math.floor(currentEnemy.atk * cap));
    const dmgTaken = Math.max(1, currentEnemy.atk - blocked);
    return { blocked, dmgTaken, effDef };
}

function renderBattle() {
    const isElite   = currentEnemy.isElite;
    const bColor    = isElite ? "#ff3333" : "#ff6666";
    const atk       = calcPlayerDamage();
    const incoming  = calcEnemyDamage(false);
    const guarded   = calcEnemyDamage(true);

    const hpAfterAtk    = player.hp - incoming.dmgTaken;
    const hpAfterGuard  = player.hp - guarded.dmgTaken;
    const atkHpColor    = hpAfterAtk <= 0 ? "#ff2222" : hpAfterAtk / player.maxHp < 0.25 ? "#ff7700" : "#ffcc44";
    const grdHpColor    = hpAfterGuard <= 0 ? "#ff2222" : hpAfterGuard / player.maxHp < 0.25 ? "#ff9900" : "#62ff62";

    const atkPreview    = chosenClass === "samurai"
        ? `${atk.base}<span style="color:#ff8888;">+${atk.extra}</span>=<b>${atk.total}</b>`
        : `<b>${atk.total}</b>`;

    story.innerHTML += `<div style="margin-top:10px;padding:8px 10px;border:1px dashed ${bColor};font-size:13px;line-height:1.7;">
  <span style="color:${bColor};">${isElite ? "[ELITE] " : ""}${currentEnemy.name}</span> HP: <b>${currentEnemy.hp}</b> &nbsp;|&nbsp; 내 HP: <b>${player.hp}/${player.maxHp}</b> ATK: ${player.atk} DEF: ${player.def}<br>
  ${chosenClass === "jester"
    ? `<span style="color:#ff00ff;">🎲 주사위를 굴려 운명에 맡기십시오!</span> &nbsp;`
    : `<span style="color:#ff6666;">⚔ 공격</span>: 적 <b>-${atk.total}</b> &nbsp; 내가 받을 <span style="color:${atkHpColor};"><b>-${incoming.dmgTaken}</b></span>(방어 -${incoming.blocked}) &nbsp;&nbsp;
  <span style="color:#55aaff;">🛡 가드</span>: DEF <b>+${GUARD_DEF_BONUS}</b>→${guarded.effDef} &nbsp; 받을 <span style="color:${grdHpColor};"><b>-${guarded.dmgTaken}</b></span>(방어 -${guarded.blocked})`
  }
</div>`;

    document.getElementById("choices").innerHTML = chosenClass === "jester" ? `
        <button onclick="rollDice()" style="border-color:#ff00ff;color:#ff00ff;font-size:15px;">[🎲] 주사위 굴리기</button>
        <button onclick="runAway()">[RUN] 도망</button>
    ` : `
        <button onclick="attack()" style="border-color:#ff6666;color:#ff6666;">[ATK] 공격 &nbsp;<small>적-${atk.total} / 내HP-${incoming.dmgTaken}</small></button>
        <button onclick="guardTurn()" style="border-color:#55aaff;color:#55aaff;">[GRD] 가드 &nbsp;<small>DEF+${GUARD_DEF_BONUS} / 내HP-${guarded.dmgTaken}</small></button>
        <button onclick="runAway()">[RUN] 도망</button>
    `;
}

// ── 광대 주사위 ─────────────────────────────
function rollDice() {
    if (!inBattle || !currentEnemy || chosenClass !== "jester") return;

    // 굴리는 동안 버튼 비활성화
    document.getElementById("choices").innerHTML = `
        <button disabled style="border-color:#ff00ff;color:#ff00ff;opacity:0.5;cursor:not-allowed;">[🎲] 굴리는 중...</button>
        <button disabled style="opacity:0.3;cursor:not-allowed;">[RUN] 도망</button>
    `;

    function roll10() { return Math.floor(Math.random() * 10) + 1; }

    const diceTable = `<div style="margin:8px 0;padding:8px 12px;border:1px dashed #ff00ff;font-size:11px;line-height:1.7;background:rgba(255,0,255,0.04);">
  <b style="color:#ff00ff;">🎲 10면체 주사위 결과표</b><br>
</div>`;

    // 사전에 결과값 모두 결정
    const roll1 = roll10();
    let roll2 = null, roll3 = null;
    if (roll1 === 10) { roll2 = roll10(); if (roll2 === 1) roll3 = roll10(); }

    let done = false;
    let log  = diceTable;

    // ── 효과 적용 (애니메이션 끝난 뒤 한꺼번에) ──
    function applyNormalFace(face, labelColor, prefix = "") {
        const tag = `<span style="color:${labelColor};">${prefix}[🎲${face}]</span>`;
        // 아이템 스탯 반영: ATK 기반 데미지, maxHp 기반 힐, def 기반 방어 보너스
        const atkBase  = Math.max(1, player.atk);
        const healBase = Math.max(3, Math.floor(player.maxHp * 0.20));  // maxHp의 20%
        const defBonus = 10 + player.def;                                // 기본 10 + DEF
        switch (face) {
            case 9: {
                const heal = Math.floor(healBase * 1.5);
                player.hp = Math.min(player.maxHp, player.hp + heal);
                return `${tag} <span style="color:#62ff62;">자신 HP +${heal} 회복!</span> <span style="color:#888;font-size:11px;">(maxHP ${player.maxHp}의 30%)</span><br>`;
            }
            case 8: {
                const heal = healBase;
                player.hp = Math.min(player.maxHp, player.hp + heal);
                return `${tag} <span style="color:#62ff62;">자신 HP +${heal} 회복!</span> <span style="color:#888;font-size:11px;">(maxHP ${player.maxHp}의 20%)</span><br>`;
            }
            case 7: {
                const curse = Math.max(2, Math.floor(atkBase * 0.5));
                currentEnemy.hp += curse;
                return `${tag} <span style="color:#ff6666;">적 HP +${curse} 회복... 오히려 도왔습니다.</span><br>`;
            }
            case 6: {
                const dmg = Math.floor(atkBase * 2.0);
                currentEnemy.hp -= dmg; if (currentEnemy.hp <= 0) done = true;
                return `${tag} <b style="color:#ff4444;">적에게 ${dmg} 피해!</b> <span style="color:#888;font-size:11px;">(ATK ${atkBase} × 2.0)</span><br>`;
            }
            case 5: {
                const block = defBonus;
                player._jesterBlock = (player._jesterBlock || 0) + block;
                return `${tag} <span style="color:#55aaff;">이번 턴 방어력 +${block}!</span> <span style="color:#888;font-size:11px;">(기본10 + DEF ${player.def})</span><br>`;
            }
            case 4: {
                const dmg = Math.floor(atkBase * 1.0);
                currentEnemy.hp -= dmg; if (currentEnemy.hp <= 0) done = true;
                return `${tag} <b style="color:#ff8844;">적에게 ${dmg} 피해!</b> <span style="color:#888;font-size:11px;">(ATK ${atkBase} × 1.0)</span><br>`;
            }
            case 3: {
                const block = Math.floor(defBonus * 0.5);
                player._jesterBlock = (player._jesterBlock || 0) + block;
                return `${tag} <span style="color:#55aaff;">이번 턴 방어력 +${block}!</span> <span style="color:#888;font-size:11px;">(기본10 + DEF ${player.def} × 0.5)</span><br>`;
            }
            case 2: {
                const dmg = Math.max(1, Math.floor(atkBase * 0.3));
                currentEnemy.hp -= dmg; if (currentEnemy.hp <= 0) done = true;
                return `${tag} <span style="color:#ff9999;">적에게 ${dmg} 피해...</span> <span style="color:#888;font-size:11px;">(ATK ${atkBase} × 0.3)</span><br>`;
            }
            default: return `${tag} ???<br>`;
        }
    }

    // ── 슬롯 스핀 애니메이션 헬퍼 ──────────────
    // containerId 위치에 숫자가 빠르게 바뀌다가 final에 멈춤
    function spinDie(containerId, finalValue, duration, onDone) {
        const el = document.getElementById(containerId);
        if (!el) { onDone(); return; }
        const start  = Date.now();
        const colors = ["#ff00ff","#ffdd00","#ff4444","#62ff62","#55aaff","#ffaa00","#ff00aa","#ffffff"];
        let   frame  = 0;
        // 초반엔 빠르게, 후반엔 느리게
        function tick() {
            const elapsed = Date.now() - start;
            const progress = elapsed / duration;            // 0→1
            const interval = 40 + progress * 160;          // 40ms → 200ms
            if (elapsed >= duration) {
                el.textContent = finalValue;
                el.style.color = "#ff00ff";
                el.style.textShadow = "0 0 18px #ff00ff, 0 0 40px rgba(255,0,255,0.5)";
                el.style.transform = "scale(1.3)";
                setTimeout(() => { el.style.transform = "scale(1)"; onDone(); }, 180);
                return;
            }
            const rnd = Math.floor(Math.random() * 10) + 1;
            el.textContent = rnd;
            el.style.color = colors[frame % colors.length];
            el.style.textShadow = `0 0 12px ${colors[frame % colors.length]}`;
            frame++;
            setTimeout(tick, interval);
        }
        tick();
    }

    // ── 주사위 표시 HTML 삽입 ──────────────────
    function dieFaceHTML(id, label, color) {
        return `
<div style="display:inline-flex;flex-direction:column;align-items:center;margin:0 10px;">
  <div style="font-size:10px;color:#888;letter-spacing:1px;margin-bottom:4px;">${label}</div>
  <div id="${id}" style="
    width:64px;height:64px;
    border:2px solid ${color};
    border-radius:6px;
    display:flex;align-items:center;justify-content:center;
    font-size:28px;font-weight:900;font-family:'Orbitron',monospace;
    color:#555;
    background:rgba(0,0,0,0.6);
    box-shadow:0 0 12px rgba(255,0,255,0.2);
    transition:transform 0.15s ease;
  ">?</div>
</div>`;
    }

    // ── 단계별 시퀀스 실행 ─────────────────────
    function runSequence() {
        // 1차 주사위 칸만 먼저 생성 — 결과가 나온 후에 다음 칸 추가
        let diceHTML = `<div id="dice-faces-row" style="display:flex;align-items:flex-end;justify-content:center;margin:18px 0 10px;">`;
        diceHTML += dieFaceHTML("die1", "1차 굴림", "#ff00ff");
        diceHTML += `</div><div id="dice-result-log" style="margin-top:6px;"></div>`;

        story.innerHTML = diceTable + diceHTML;
        const resultEl = document.getElementById("dice-result-log");

        // 1차
        spinDie("die1", roll1, 900, () => {
            const tag1 = `<span style="color:#ff00ff;">[1차 🎲${roll1}]</span>`;

            if (roll1 === 10) {
                resultEl.innerHTML += `${tag1} <b style="color:#ffaa00;">✦ 10! 주사위를 한번 더 굴립니다! ✦</b><br>`;

                // 2차 주사위 칸을 결과 확정 후에 추가
                const facesRow = document.getElementById("dice-faces-row");
                if (facesRow) facesRow.insertAdjacentHTML("beforeend", dieFaceHTML("die2", "2차 굴림", "#ffdd00"));

                setTimeout(() => spinDie("die2", roll2, 1000, () => {
                    const tag2 = `<span style="color:#ffdd00;">[2차 🎲${roll2}]</span>`;

                    if (roll2 === 10) {
                        // 즉사
                        const dead = currentEnemy.hp;
                        currentEnemy.hp = 0; done = true;
                        resultEl.innerHTML += `${tag2} <b style="color:#ff00ff;font-size:16px;">✦✦ JACKPOT!! 적 즉사!! ✦✦</b><br>`;
                        resultEl.innerHTML += `주사위의 저주가 폭발! <b>${currentEnemy.name}</b>이(가) 산산조각났습니다! (-${dead})<br>`;
                        finalize();

                    } else if (roll2 === 1) {
                        resultEl.innerHTML += `${tag2} <span style="color:#ff3333;">1... 마지막 기회의 주사위를 굴립니다!</span><br>`;

                        // 3차 주사위 칸도 결과 확정 후에 추가
                        const facesRow2 = document.getElementById("dice-faces-row");
                        if (facesRow2) facesRow2.insertAdjacentHTML("beforeend", dieFaceHTML("die3", "3차 굴림", "#ff00aa"));

                        setTimeout(() => spinDie("die3", roll3, 1100, () => {
                            const tag3 = `<span style="color:#ff00aa;">[3차 🎲${roll3}]</span>`;

                            if (roll3 === 10) {
                                player.silver += 1;
                                let itemLog = "";
                                if (eliteItems?.length) {
                                    const ei = eliteItems[Math.floor(Math.random() * eliteItems.length)];
                                    applyItemReward(ei, true, "elite");
                                    itemLog = `<br>[ITEM] <b style="color:#00ffff;">${ei.name}</b> 획득! (${formatItemEffects(ei)})`;
                                }
                                const luckyDmg = Math.max(1, Math.floor(player.atk * 0.3));
                                currentEnemy.hp -= luckyDmg; if (currentEnemy.hp <= 0) done = true;
                                resultEl.innerHTML += `${tag3} <b style="color:#ff00aa;font-size:15px;">✦✦✦ ULTRA LUCKY!!! ✦✦✦</b><br>`;
                                resultEl.innerHTML += `<span style="color:#d8d8ff;">저주받은 주사위가 역방향으로 공명합니다!</span><br>`;
                                resultEl.innerHTML += `<span style="color:#d8d8ff;font-weight:bold;">[보상] 은화 +1${itemLog}</span><br>`;
                                if (!done) resultEl.innerHTML += `<span style="color:#888;">(그리고 적에게 ${luckyDmg} 피해...)</span><br>`;
                            } else {
                                const failDmg = Math.max(1, Math.floor(player.atk * 0.3));
                                currentEnemy.hp -= failDmg; if (currentEnemy.hp <= 0) done = true;
                                resultEl.innerHTML += `${tag3} <span style="color:#888;">운이 다했습니다. 적에게 ${failDmg} 피해...</span><br>`;
                            }
                            finalize();
                        }), 400);

                    } else {
                        resultEl.innerHTML += applyNormalFace(roll2, "#ffdd00", "2차 ");
                        finalize();
                    }
                }), 400);

            } else if (roll1 === 1) {
                player._jesterBlock = 0;
                resultEl.innerHTML += `${tag1} <span style="color:#888;">방어력 0 — 완전 무방비!</span><br>`;
                finalize();
            } else {
                resultEl.innerHTML += applyNormalFace(roll1, "#ff00ff", "");
                finalize();
            }
        });
    }

    // ── 최종 처리 (반격·승리 판정) ─────────────
    function finalize() {
        const resultEl = document.getElementById("dice-result-log");

        if (done || currentEnemy.hp <= 0) {
            currentEnemy.hp = 0;
            player._jesterBlock = 0;
            // story.innerHTML 전체를 log로 교체하지 않고 winBattle에 넘김
            log = story.innerHTML; // winBattle 내부에서 story.innerHTML을 덮어쓰므로 현재 유지
            updateStats(); updateInventoryUI();
            winBattle();
            return;
        }

        // 반격
        const jBlock   = player._jesterBlock || 0;
        const effDef   = player.def + jBlock;
        const blocked  = Math.min(effDef, Math.floor(currentEnemy.atk * DEF_BLOCK_CAP));
        const dmgTaken = Math.max(1, currentEnemy.atk - blocked);
        player.hp = Math.max(0, player.hp - dmgTaken);

        if (resultEl) {
            if (jBlock > 0) {
                resultEl.innerHTML += `<span style="color:#55aaff;">[방어] 임시 방어 ${jBlock} 적용 → 반격 ${blocked} 차단, 실제 피해 <b>-${dmgTaken}</b></span><br>`;
            } else {
                resultEl.innerHTML += `<span style="color:#ff6666;">[HIT] 반격 <b>-${dmgTaken}</b> (방어 ${blocked} 감소)</span><br>`;
            }
        }

        player._jesterBlock = 0;
        if (player.hp <= 0) { player.hp = 0; updateStats(); gameOver(); return; }
        updateStats(); renderBattle();
    }

    runSequence();
}

function attack() {
    if (!inBattle || !currentEnemy) return;

    let log = "";
    const baseDmg = player.atk;
    currentEnemy.hp -= baseDmg;
    log += `[ATK] ${currentEnemy.name}에게 <b>${baseDmg}</b>의 피해를 주었습니다.<br>`;

    if (chosenClass === "samurai") {
        const extra = Math.max(1, Math.floor(baseDmg * SAMURAI_BONUS_RATIO));
        currentEnemy.hp -= extra;
        log += `<span style="color:#ff6666;">[SAM] 연격 +${extra} 추가 피해!</span><br>`;
    }

    if (currentEnemy.hp <= 0) { currentEnemy.hp = 0; story.innerHTML = log; winBattle(); return; }

    const { blocked, dmgTaken } = calcEnemyDamage(false);
    player.hp -= dmgTaken;
    log += `[HIT] 반격 <b>-${dmgTaken}</b> (방어 ${blocked} 감소)`;
    story.innerHTML = log;

    if (player.hp <= 0) { player.hp = 0; updateStats(); gameOver(); return; }
    updateStats(); renderBattle();
}

function guardTurn() {
    if (!inBattle || !currentEnemy) return;

    const { blocked, dmgTaken, effDef } = calcEnemyDamage(true);
    player.hp = Math.max(0, player.hp - dmgTaken);

    const log = `<span style="color:#55aaff;font-weight:bold;">[GRD] 가드!</span> DEF ${player.def} → <b>${effDef}</b>(+${GUARD_DEF_BONUS}) 일시 적용<br>
<span style="color:#55aaff;">${currentEnemy.name}의 공격 ${blocked} 차단 → 실제 피해 <b>${dmgTaken}</b></span>`;

    if (player.hp <= 0) { story.innerHTML = log; updateStats(); gameOver(); return; }
    story.innerHTML = log;
    updateStats(); renderBattle();
}

function runAway() {
    if (!inBattle) return;
    player.x = prevX; player.y = prevY;
    story.innerHTML = `[RUN] 몬스터를 피해 직전에 있었던 안전한 방 (${player.x}, ${player.y})으로 황급히 뒷문으로 뛰어 도망갔습니다. <br>몬스터의 체력 상태는 그대로 유지됩니다.`;
    inBattle = false; currentEnemy = null; currentRoomKey = null; isGuarding = false;
    restoreDefaultChoices(); renderMap();
}

function winBattle() {
    player.gold += currentEnemy.gold;

    // 보스 처치
    if (currentEnemy.id === "core_gear" || ["upper_core","final_control_core"].includes(currentEnemy.id)) {
        if (currentFloor < maxFloor) {
            story.innerHTML = `
                <h2>[UP] ${currentFloor}층 제어 코어 파괴!</h2>
                <b>${currentEnemy.name}</b>를 무력화하자 위층으로 이어지는 승강 장치가 깨어납니다.<br>
                다음 층의 경비 시스템은 더 두껍고 더 날카롭게 재조립됩니다.<br><br>
                획득 골드: [G] ${currentEnemy.gold} | 현재 골드: [G] ${player.gold}<br><br>
                <button onclick="ascendToNextFloor()" style="border-color:#00ffff;color:#00ffff;">[UP] ${currentFloor + 1}층으로 올라가기</button>
            `;
            inBattle = true;
            document.getElementById("choices").style.display = "none";
            currentEnemy = null; updateStats(); return;
        }
        story.innerHTML = `
            <h2>[WIN] 기계 도시 클리어!</h2>
            3층 최종 제어 코어를 무력화시키는 데 성공했습니다.<br>
            아래층부터 이어지던 기계음이 완전히 멎고, 마침내 지상으로 향하는 문이 열립니다.<br><br>
            최종 골드: [G] ${player.gold}<br><br>
            <button onclick="resetGame()" style="border-color:#62ff62;color:#62ff62;">[RST] 새로운 여정 시작하기</button>
        `;
        isGameOver = true; inBattle = false;
        document.getElementById("choices").style.display = "none";
        currentEnemy = null; updateStats(); return;
    }

    // 정예 처치 보상
    let eliteLog = "";
    if (currentEnemy.isElite) {
        const silver = currentFloor;
        player.silver += silver;
        eliteLog = `<br><br><span style="color:#00ffff;font-weight:bold;">[+] 정예 기계 파괴 보상! 은화 +${silver} [+]</span>`;
        for (let i = 0; i < 2; i++) {
            const r = getRandomItem();
            if (r) { applyItemReward(r, false); eliteLog += `<br>[MOD] <b>${r.name}</b> 획득! <span style="color:#62ff62;">(${formatItemEffects(r)})</span>`; }
        }
    }

    story.innerHTML += `
        <br>[WIN] 승리! ${currentEnemy.name}를 처치하고 ${currentEnemy.isElite ? `[HOT] [정예 처치] ` : ""}[G] ${currentEnemy.gold} 골드를 획득했습니다.${eliteLog}
        <br><br><span style="color:#aaaaaa;">바닥에 쓰러진 기계의 잔해가 연기를 내뿜고 있습니다. 시체를 뒤져 쓸만한 전리품을 수색하시겠습니까?</span>
    `;

    // 사무라이 킬 카운트 & 카타나 강화
    if (chosenClass === "samurai") {
        player.samuraiKills = (player.samuraiKills || 0) + 1;
        const kills = player.samuraiKills;
        if (kills % SAMURAI_KILL_THRESHOLD === 0) {
            const katana = playerInventory.find(i => i.name?.includes("크롬 카타나"));
            if (katana) { katana.atk = (katana.atk || 0) + SAMURAI_ATK_BONUS; player.atk += SAMURAI_ATK_BONUS; }
            story.innerHTML += `<br><br><span style="color:#ff3333;font-weight:bold;">[SAM] [SAMURAI_PASSIVE] 카타나의 형태가 변환됩니다. 몬스터 ${SAMURAI_KILL_THRESHOLD}마리 처치 달성으로 크롬 카타나가 강화되었습니다! (ATK +${SAMURAI_ATK_BONUS} 영구 상승, 현재 처치: ${kills}마리)</span><br>`;
        } else {
            story.innerHTML += `<br><br><span style="color:#aaa;">[SWD] 카타나에 기계의 고철이 스며듭니다. (다음 강화까지: ${SAMURAI_KILL_THRESHOLD - (kills % SAMURAI_KILL_THRESHOLD)}마리 처치 필요)</span><br>`;
        }
    }

    document.getElementById("choices").innerHTML = `
        <button onclick="lootCorpse()" style="border-color:#ffaa00;color:#ffaa00;">[DEAD] 시체 수색하기</button>
        <button onclick="leaveCorpse()">>> 그냥 이동하기</button>
    `;
    if (currentRoomKey) { roomStates[currentRoomKey] = { type: "empty" }; currentRoomKey = null; }
    inBattle = false;
    updateStats(); updateInventoryUI();
}

// ── 루팅 ───────────────────────────────────
function lootCorpse() {
    if (chosenClass === "mechanic") {
        if (Math.random() < 0.40) {
            const gold = Math.floor(Math.random() * 15) + 5;
            player.gold += gold;
            story.innerHTML = `[ENG] <b>[ENGINEER_PRIVILEGE] 시체 정밀 해체 성공!</b><br><br>기계 전문가의 솜씨로 안전하게 내부 중요 코어를 챙겼습니다!<br><span style="color:#ffff44;">[G] 추가 골드 +${gold} 획득!</span>`;
        } else {
            const item = getRandomItem();
            applyItemReward(item, false);
            story.innerHTML = `
                [ENG] <b>[ENGINEER_PRIVILEGE] 시체 정밀 해체 성공!</b><br><br>
                기계 전문가의 솜씨로 안전하게 기계가 쓰던 회로와 무기를 챙겼습니다!.<br><br>
                [MOD] 획득 전리품: <b>${item.name}</b><br>
                <span style="color:#62ff62;">[장착 효과] ${formatItemEffects(item)}</span>
            `;
        }
    } else {
        const roll = Math.random();
        if (roll < LOOT_SUCCESS_CHANCE) {
            if (Math.random() < LOOT_GOLD_CHANCE) {
                const gold = Math.floor(Math.random() * 15) + 5;
                player.gold += gold;
                story.innerHTML = `[DEAD] <b>시체 수색 성공!</b><br><br>숨겨진 내부 비상 금고를 해킹하여 대박을 터트렸습니다!<br><span style="color:#ffff44;">[G] 추가 골드 +${gold} 획득!</span>`;
            } else {
                const item = getRandomItem();
                applyItemReward(item, false);
                story.innerHTML = `
                    [DEAD] <b>시체 수색 성공!</b><br><br>
                    잔해 속에 얽혀있던 유용한 부품을 완벽하게 분리해냈습니다.<br><br>
                    [MOD] 획득 전리품: <b>${item.name}</b><br>
                    <span style="color:#62ff62;">[장착 효과] ${formatItemEffects(item)}</span>
                `;
            }
        } else if (roll < LOOT_TRAP_THRESHOLD) {
            story.innerHTML = `[DEAD] <b>시체 수색 실패</b><br><br>잔해를 한참 뒤졌지만 쓸만한 부품은 이미 망가진 후입니다.<br><span style="color:#aaaaaa;">아무것도 획득하지 못했습니다.</span>`;
        } else {
            const base = Math.floor(Math.random() * 4) + 3 + (currentFloor - 1);
            const mega = roll >= LOOT_MEGA_THRESHOLD;
            const dmg  = mega ? base * 3 : base;
            player.hp  = Math.max(0, player.hp - dmg);
            story.innerHTML = mega
                ? `<span style="color:#ff3333;font-weight:bold;">!! CRITICAL_CHAIN_EXPLOSION !! !!</span><br><br>잔해 속 압축 코어가 연쇄 폭발을 일으켰습니다!<br><br>[BOOM] 대폭발로 인해 <span style="color:#ff3333;font-weight:bold;">체력이 -${dmg}</span> 깎였습니다.<br><span style="color:#ff3333;font-size:12px;">[ERROR] 기존 자폭 피해의 3배 적용</span>`
                : `<span style="color:#ff3333;font-weight:bold;">!! BU_BI_TRAP DETECTED !! !!</span><br><br>기계를 건드린 순간, 내장되어 있던 보안 자폭 시퀀스가 발동했습니다!<br><br>[HIT] 쿠우웅! 폭발로 인해 <span style="color:#ff3333;font-weight:bold;">체력이 -${dmg}</span> 깎였습니다.<br><span style="color:#ff3333;font-size:12px;">[ERROR] 장갑 시스템 우회: 방어력 무시 고정 피해 적용</span>`;
            if (player.hp <= 0) { updateStats(); gameOver(); return; }
        }
    }
    currentEnemy = null; restoreDefaultChoices(); updateStats(); updateInventoryUI(); renderMap();
}

function leaveCorpse() {
    story.innerHTML = `>> 리스크를 방지하기 위해 잔해를 그대로 둔 채 자리를 떠났습니다.`;
    currentEnemy = null; restoreDefaultChoices(); renderMap();
}

// ── 상점 ───────────────────────────────────
function restRoom(message = "") {
    const remaining   = maxRestCount - restCount;
    const notice      = message ? `<div style="margin-bottom:12px;color:#62ff62;">${message}</div>` : "";

    const shopDefs = [
        { label: "응급 수리",      cost: SHOP_HEAL_COST,  action: "buyShopHeal()",      desc: `HP를 ${SHOP_HEAL_AMOUNT} 회복`,      currency: "gold"   },
        { label: "스캔 배터리",    cost: SHOP_SCAN_COST,  action: "buyShopScan()",      desc: "조사 횟수 1회 충전",                  currency: "gold"   },
        { label: "일반 부품 상자", cost: SHOP_ITEM_COST,  action: "buyShopItem()",      desc: "일반 장비 1개 획득",                  currency: "gold"   },
        { label: "정예 부품 상자", cost: SHOP_ELITE_COST, action: "buyShopEliteItem()", desc: "엘리트 장비 1개 획득",                currency: "gold"   },
    ];
    const silverDefs = [
        { label: "상위 공명 상자", cost: SHOP_SILVER_COST,action: "buySuperiorItem()",  desc: "은화 전용 장비 1개 획득",        currency: "silver" }
    ];

    const makeBtn = ({ label, cost, action, desc, currency }) => {
        const disabled = (currency === "gold" ? player.gold < cost : player.silver < cost) ? "disabled" : "";
        const prefix   = currency === "gold" ? `[G] ${cost}` : `은화 ${cost}`;
        return `<button onclick="${action}" ${disabled}>${prefix} | ${label}<span style="display:block;font-size:12px;opacity:.75;">${desc}</span></button>`;
    };

    story.innerHTML = `
        [+] <b>자가 발전 충전소 & 부품 상점</b><br><br>${notice}
        기계 장치들이 부드럽게 돌아가는 안전 구역입니다.<br>
        이곳에서는 무료 충전기를 쓰거나 골드로 정비 부품을 구매할 수 있습니다.<br>
        <span style="color:#ffaa00;font-weight:bold;">현재 층: ${currentFloor}/${maxFloor} | 보유 골드: [G] ${player.gold} | 보유 은화: ${player.silver} | 이번 층 무료 충전 기회: ${remaining}/${maxRestCount}회</span><br><br>
        ${remaining > 0 ? `<button onclick="useRestStation()">[+] 무료 에너지 충전하기</button>` : `<span style="color:#ff3333;font-weight:bold;">[ERR] 발전기 코어가 과열되어 더 이상 에너지를 공급받을 수 없습니다!</span>`}
        <hr style="border:0;border-top:1px dashed #555;margin:14px 0;">
        <b style="color:#00ffff;">[SHOP] 자동 부품 상점</b><br><br>
        <div style="display:grid;gap:8px;">${shopDefs.map(makeBtn).join("")}</div>
        <hr style="border:0;border-top:1px dashed #555;margin:14px 0;">
        <b style="color:#d8d8ff;">은화 교환소</b><br><br>
        <div style="display:grid;gap:8px;">${silverDefs.map(makeBtn).join("")}</div>
    `;
}

function useRestStation() {
    if (restCount >= maxRestCount) return;
    if (player.hp === player.maxHp && totalSearches === 0) { restRoom("[+] 체력과 조사 횟수가 이미 가득 차 있습니다!"); return; }
    player.hp = player.maxHp; totalSearches = 0; restCount++;
    updateStats();
    restRoom(`[+] 체력이 모두 회복되고 조사 횟수가 다시 가득 찼습니다! (${maxSearches}/${maxSearches})`);
}

function spendGold(cost) {
    if (player.gold < cost) { restRoom(`[G] 골드가 부족합니다. 필요한 골드: ${cost}`); return false; }
    player.gold -= cost; updateStats(); return true;
}

function spendSilver(cost) {
    if (player.silver < cost) { restRoom(`은화가 부족합니다. 필요한 은화: ${cost}`); return false; }
    player.silver -= cost; return true;
}

function buyShopHeal() {
    if (player.hp >= player.maxHp) { restRoom("[HP] 이미 HP가 가득 차 있습니다."); return; }
    if (!spendGold(SHOP_HEAL_COST)) return;
    const healed = Math.min(SHOP_HEAL_AMOUNT, player.maxHp - player.hp);
    player.hp += healed; updateStats();
    restRoom(`[HP] 응급 수리 완료. HP가 ${healed} 회복되었습니다.`);
}

function buyShopScan() {
    if (totalSearches <= 0) { restRoom("[SCN] 조사 횟수가 이미 가득 차 있습니다."); return; }
    if (!spendGold(SHOP_SCAN_COST)) return;
    totalSearches = Math.max(0, totalSearches - 1); updateStats();
    restRoom("[SCN] 스캔 배터리 장착 완료. 조사 횟수가 1회 충전되었습니다.");
}

function buyShopItem() {
    if (!spendGold(SHOP_ITEM_COST)) return;
    const item = getRandomItem(); applyItemReward(item, false);
    updateStats(); updateInventoryUI();
    restRoom(`[MOD] 일반 부품 상자 개봉! <b>${item.name}</b> 획득 (${formatItemEffects(item)})`);
}

function buyShopEliteItem() {
    if (!eliteItems?.length) { restRoom("[$] 정예 부품 재고가 비어 있습니다."); return; }
    if (!spendGold(SHOP_ELITE_COST)) return;
    const item = eliteItems[Math.floor(Math.random() * eliteItems.length)];
    applyItemReward(item, true); updateStats(); updateInventoryUI();
    restRoom(`[$] 정예 부품 상자 개봉! <b>${item.name}</b> 획득 (${formatItemEffects(item)})`);
}

function buySuperiorItem() {
    if (!superiorItems?.length) { restRoom("은화 장비 재고가 비어 있습니다."); return; }
    if (!spendSilver(SHOP_SILVER_COST)) return;
    const item = superiorItems[Math.floor(Math.random() * superiorItems.length)];
    applyItemReward(item, true); updateStats(); updateInventoryUI();
    restRoom(`은하 공명 상자 개봉! <b>${item.name}</b> 획득 (${formatItemEffects(item)})`);
}

// ── 층 이동 / 게임 오버 / 리셋 ────────────
function ascendToNextFloor() {
    if (currentFloor >= maxFloor) return;
    currentFloor++; player.x = player.y = 1; prevX = prevY = 1;
    totalSearches = 0; restCount = 0; inBattle = false;
    currentEnemy = null; currentRoomKey = null; roomStates = {};
    visited.clear();
    generateMapObjects();
    visited.add(`${player.x},${player.y}`);
    restoreDefaultChoices();
    document.getElementById("choices").style.display = "flex";
    player.hp = player.maxHp;
    story.innerHTML = `
        <h2>[UP] ${currentFloor}층 진입</h2>
        승강 장치가 멈추자 더 거친 기계음이 복도 전체를 흔듭니다.<br>
        이 층은 더 넓고, 복잡하며 더 많은 기계가 배치되어 있으며, 기계가 더 강화되어 있습니다.<br><br>
        <span style="color:#62ff62;">[MED] 층 이동으로 체력이 완전히 회복되었습니다! (HP: ${player.maxHp}/${player.maxHp})</span><br><br>
        <span style="color:#00ffff;">맵 크기: ${mapSize} x ${mapSize}</span><br>
        <span style="color:#ffaa00;">무료 충전 기회와 조사 횟수가 새 층 기준으로 재정비되었습니다.</span>
    `;
    updateStats(); updateInventoryUI(); renderMap();
}

function gameOver() {
    inBattle = false; isGameOver = true;
    story.innerHTML = `
        <h2 style="color:#ff3333;margin-bottom:10px;">[X] SYSTEM FAILURE</h2>
        기계 도시의 차가운 금속 바닥 위에 쓰러졌습니다.<br>
        당신의 신체는 고철처럼 식어갑니다...<br><br>
        <button onclick="resetGame()" style="width:100%;border-color:#ff3333;color:#ff3333;">[RST] 처음부터 다시 도전하기</button>
    `;
    document.getElementById("choices").style.display = "none";
    renderMap();
}

function confirmGoToCharSelect() {
    const msg = inBattle
        ? "!! 현재 전투가 진행 중입니다! 클래스 재선택 시 지금의 진행 상황과 인벤토리가 완벽히 초기화됩니다. 정말 돌아가시겠습니까?"
        : "[RST] 클래스 선택창으로 이동하시겠습니까? (현재의 아바타 세이브 데이터는 소멸합니다.)";
    if (confirm(msg)) resetGame();
}

function resetGame() {
    document.getElementById("game-container").style.display = "none";
    document.getElementById("char-select-container").style.display = "block";
    // 난이도 배지 제거
    const badge = document.getElementById("difficulty-badge");
    if (badge) badge.remove();
    playerInventory = []; inventorySortMode = "rarity"; prevX = prevY = 1;
    player.silver = 0; currentFloor = 1; totalSearches = 0; restCount = 0;
    inBattle = false; isGameOver = false; currentEnemy = null;
    currentRoomKey = null; hasRadar = false; isGuarding = false; roomStates = {};
    if (player.samuraiKills) player.samuraiKills = 0;
    visited.clear(); restoreDefaultChoices();
    const sw = document.getElementById("status-window");
    if (sw) sw.style.display = "none";
}

// ── 난이도 선택 ────────────────────────────
function setDifficulty(level) {
    if (!DIFFICULTY_MULTIPLIER[level]) return;
    currentDifficulty = level;
    // 버튼 selected 상태 토글
    ["easy","normal","hard","expert"].forEach(d => {
        const el = document.getElementById("diff-" + d);
        if (el) el.classList.toggle("selected", d === level);
    });
}

// ── 초기화 ─────────────────────────────────
async function init() { await loadGameData(); }
window.onload = init;