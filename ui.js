// ==========================================
// ui.js — UI 업데이트 (스탯·인벤토리·상태창)
// ==========================================

function updateStats() {
    document.getElementById("hp").textContent  = `${player.hp}/${player.maxHp}`;
    document.getElementById("atk").textContent = player.atk;
    const defEl = document.getElementById("def");
    if (defEl) defEl.textContent = player.def;
    document.getElementById("gold").textContent = player.gold;

    const scanEl = document.getElementById("searchCount");
    if (scanEl) scanEl.textContent = `${maxSearches - totalSearches}/${maxSearches}`;

    if (statusWin && statusWin.style.display === "block") {
        document.getElementById("status-hp").textContent   = `${player.hp} / ${player.maxHp}`;
        document.getElementById("status-atk").textContent  = player.atk;
        document.getElementById("status-def").textContent  = player.def;
        document.getElementById("status-gold").textContent = player.gold;
        document.getElementById("status-radar").textContent = hasRadar ? "ON (가동중)" : "OFF";
    }
}

function toggleStatus() {
    if (!statusWin) return;
    const isHidden = statusWin.style.display === "none" || statusWin.style.display === "";
    if (isHidden) {
        document.getElementById("status-hp").textContent   = `${player.hp} / ${player.maxHp}`;
        document.getElementById("status-atk").textContent  = player.atk;
        document.getElementById("status-def").textContent  = player.def;
        document.getElementById("status-gold").textContent = player.gold;
        document.getElementById("status-radar").textContent = hasRadar ? "ON (가동중)" : "OFF";
        updateInventoryUI();
        statusWin.style.display = "block";
    } else {
        statusWin.style.display = "none";
    }
}

// ── 아이템 유틸리티 ────────────────────────
function formatItemEffects(item) {
    const parts = [];
    if (item.atk > 0) parts.push(`ATK +${item.atk}`);
    if (item.def > 0) parts.push(`DEF +${item.def}`);
    if (item.hp  > 0) parts.push(`HP +${item.hp}`);
    return parts.length ? parts.join(", ") : "효과 없음";
}

function getItemRarity(item) {
    if (item.rarity) return item.rarity;
    if (item.name?.includes("(은화)")) return "silver";
    if (item.isElite) return "elite";
    return "normal";
}

function getItemRarityRank(item) {
    const r = getItemRarity(item);
    return r === "silver" ? 3 : r === "elite" ? 2 : 1;
}

function getItemRarityColor(item) {
    const r = getItemRarity(item);
    return r === "silver" ? "#d8d8ff" : r === "elite" ? "#00ffff" : "#62ff62";
}

function getItemRarityLabel(item) {
    const r = getItemRarity(item);
    return r === "silver" ? "은화" : r === "elite" ? "엘리트" : "일반";
}

function applyItemReward(item, isEliteStatus = false) {
    const iAtk = item.atk || 0;
    const iDef = item.def || 0;
    const iHp  = item.hp  || 0;

    player.atk += iAtk;
    player.def += iDef;
    if (iHp > 0) { player.maxHp += iHp; player.hp += iHp; }

    const itemRarity = item.rarity 
        || (item.name?.includes("(은화)") ? "silver" : (isEliteStatus ? "elite" : "normal"));

    playerInventory.push({ name: item.name, atk: iAtk, def: iDef, hp: iHp, isElite: isEliteStatus, rarity: itemRarity });
}

// ── 인벤토리 UI ────────────────────────────
function setInventorySortMode(mode) {
    inventorySortMode = mode;
    updateInventoryUI();
}

function sortInventoryItems(list) {
    return list.sort((a, b) => {
        const key = inventorySortMode;
        if (["atk", "def", "hp"].includes(key)) {
            const diff = (b[key] || 0) - (a[key] || 0);
            if (diff !== 0) return diff;
        }
        const rDiff = getItemRarityRank(b) - getItemRarityRank(a);
        if (rDiff !== 0) return rDiff;
        const totA = (a.atk || 0) + (a.def || 0) + (a.hp || 0);
        const totB = (b.atk || 0) + (b.def || 0) + (b.hp || 0);
        if (totB !== totA) return totB - totA;
        return a.name.localeCompare(b.name, "ko");
    });
}

function buildSortButtons() {
    const modes = [
        { key: "rarity", label: "희귀도" },
        { key: "atk",    label: "공격"   },
        { key: "def",    label: "방어"   },
        { key: "hp",     label: "체력"   }
    ];
    const btns = modes.map(m =>
        `<button onclick="setInventorySortMode('${m.key}')" ${inventorySortMode === m.key ? "disabled" : ""}>${m.label}</button>`
    ).join("");
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${btns}</div>`;
}

function updateInventoryUI() {
    if (!invDiv) return;
    if (!playerInventory.length) {
        invDiv.innerHTML = buildSortButtons() + "획득한 장비가 없습니다.";
        return;
    }

    const itemMap = {};
    playerInventory.forEach(item => {
        const key = `${item.name}_${getItemRarity(item)}_${item.atk||0}_${item.def||0}_${item.hp||0}`;
        itemMap[key] ? itemMap[key].count++ : (itemMap[key] = { ...item, count: 1 });
    });

    invDiv.innerHTML = buildSortButtons() + sortInventoryItems(Object.values(itemMap)).map(item => {
        const color = getItemRarityColor(item);
        const label = getItemRarityLabel(item);
        const count = item.count > 1 ? ` x${item.count}` : "";
        return `<div style="margin-bottom:4px;">• <span style="color:${color};font-weight:bold;">[${label}] ${item.name}</span> (${formatItemEffects(item)})${count}</div>`;
    }).join("");
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
