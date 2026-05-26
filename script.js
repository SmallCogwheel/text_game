const story = document.getElementById("story");

let player = {
    hp: 20,
    atk: 5,
    gold: 0
};

function updateStats() {
    document.getElementById("hp").textContent = player.hp;
    document.getElementById("atk").textContent = player.atk;
    document.getElementById("gold").textContent = player.gold;
}

function goDoor() {

    const random = Math.random();

    if (random < 0.5) {
        encounterGoblin();
    } else {
        findGold();
    }
}

function searchRoom() {

    story.innerHTML = `
        방을 조사했다.<br><br>
        낡은 철 상자를 발견했다.<br>
        안에는 작은 톱니 하나가 들어있다.<br><br>
        공격력이 1 증가했다.
    `;

    player.atk += 1;
    updateStats();
}

function showStatus() {

    story.innerHTML = `
        상태 정보<br><br>

        HP : ${player.hp}<br>
        공격력 : ${player.atk}<br>
        골드 : ${player.gold}
    `;
}

function encounterGoblin() {

    story.innerHTML = `
        ⚠️ 녹슨 경비 기계가 나타났다!<br><br>
        공격력 ${player.atk}로 적을 공격했다.<br><br>
        승리했다!<br>
        골드 10 획득.
    `;

    player.gold += 10;
    updateStats();
}

function findGold() {

    story.innerHTML = `
        복도를 지나던 중 작은 금속 상자를 발견했다.<br><br>
        골드 5 획득!
    `;

    player.gold += 5;
    updateStats();
}

updateStats();
