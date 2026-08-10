(() => {
  "use strict";

  const SAVE_KEY = "nan26-freight-save-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const formatMoney = (value) => `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")} C`;

  const CONTRACTS = [
    { id: "normal", name: "일반 배송", reward: 1, time: 48, risk: "낮음", note: "표준 보상. 위험 화물 등장률이 낮습니다.", loss: "파손 화물 가치만 차감" },
    { id: "express", name: "특급 배송", reward: 1.65, time: 36, risk: "중간", note: "짧은 상차 시간. 신속 배송 수당 65%.", loss: "시간 초과 시 특급 수당 상실" },
    { id: "hazard", name: "위험물 배송", reward: 2.2, time: 43, risk: "높음", note: "폭발물 투입. 무손상 도착 시 위험 수당 120%.", loss: "폭발 시 해당 화물과 인접 화물 파손" }
  ];

  const PLANETS = [
    { id: "earth", name: "지구권 궤도", gravity: 1, vector: "↓", label: "↓ 1.0G", risk: 0, unlock: 0, note: "표준 하향 중력. 기본 운송 훈련 항로." },
    { id: "moon", name: "저중력 달", gravity: .35, vector: "↘", label: "↘ 0.35G", risk: .12, unlock: 900, note: "화물이 오래 튕깁니다. 미끄러운 화물 이동 증가." },
    { id: "mars", name: "고중력 화성", gravity: 1.65, vector: "↓", label: "↓ 1.65G", risk: .22, unlock: 2200, note: "하단 압력이 큽니다. 파손주의 위 적재를 피하십시오." }
  ];

  const CARGO_TYPES = [
    { id: "ore", name: "철질 광석", code: "HVY", attr: "heavy", w: 92, h: 66, value: 120, weight: 1.7, friction: .86, color: "#b8733d", edge: "#e5a66e", circles: [[6,18,46],[34,2,52],[51,22,39]] },
    { id: "glass", name: "성운 유리", code: "FRG", attr: "fragile", w: 84, h: 72, value: 190, weight: .65, friction: .72, color: "#d7c67b", edge: "#fff0aa", circles: [[4,20,44],[27,0,45],[43,27,40]] },
    { id: "gel", name: "냉각 젤", code: "SLP", attr: "slippery", w: 104, h: 58, value: 145, weight: .75, friction: .28, color: "#72b98b", edge: "#a8efba", circles: [[2,17,42],[27,2,48],[58,11,44]] },
    { id: "core", name: "반응로 코어", code: "EXP", attr: "explosive", w: 82, h: 82, value: 320, weight: 1.1, friction: .68, color: "#cf5537", edge: "#ff9a55", circles: [[4,26,43],[20,3,50],[42,28,38]] },
    { id: "parts", name: "궤도 부품", code: "STD", attr: "standard", w: 110, h: 62, value: 110, weight: 1, friction: .65, color: "#87928a", edge: "#c4cec6", circles: [[2,15,44],[31,1,50],[65,17,43]] },
    { id: "bio", name: "배양 캡슐", code: "BIO", attr: "fragile", w: 74, h: 94, value: 240, weight: .6, friction: .75, color: "#a9c84b", edge: "#d9f278", circles: [[8,2,48],[1,35,49],[28,48,40]] },
    { id: "coil", name: "자력 코일", code: "HVY", attr: "heavy", w: 98, h: 78, value: 175, weight: 1.55, friction: .9, color: "#b08756", edge: "#e1bc7c", circles: [[2,22,48],[28,1,51],[53,29,42]] },
    { id: "silk", name: "진공 섬유", code: "SLP", attr: "slippery", w: 118, h: 54, value: 165, weight: .45, friction: .22, color: "#96a89c", edge: "#d5e0d8", circles: [[1,10,42],[30,1,47],[65,8,45],[88,18,32]] }
  ];

  const SHIP_UPGRADES = {
    engine: { name: "주 엔진", base: 280, effect: level => `추력 +${level * 8}%, 수익 +${level * 4}%` },
    fuel: { name: "연료 탱크", base: 240, effect: level => `최대 연료 +${level * 8}, 잔여 연료 보너스 증가` },
    bay: { name: "화물칸", base: 360, effect: level => `유효 적재 면적 보정 +${level * 3}%` }
  };
  const STAFF_UPGRADES = {
    pilot: { name: "조종사", base: 260, effect: level => `엔진 진동 -${level * 5}%` },
    loader: { name: "상하차 직원", base: 230, effect: level => `상차 제한시간 +${level * 2}초` },
    controller: { name: "관제 직원", base: 250, effect: level => `계약 보상 +${level * 4}%` }
  };

  const defaultSave = () => ({
    money: 600,
    unlockedPlanets: ["earth"],
    upgrades: { engine: 1, fuel: 1, bay: 1 },
    staff: { pilot: 1, loader: 1, controller: 1 },
    discoveredCargo: [],
    deliveries: 0,
    bestFill: 0,
    bestPay: 0
  });

  let save = loadSave();
  let state = freshState();
  let animationId = 0;
  let deliveryAnimationId = 0;
  let modalAction = null;

  function freshState() {
    return {
      phase: "contract", contract: null, planet: null, cargos: [], nextCargo: null,
      elapsed: 0, timeLeft: 0, beltSpeed: 21, pausedUntil: 0, boostedUntil: 0,
      reverseUntil: 0, pauseUses: 1, reverseUses: 2, heat: 0, spawnClock: 0,
      running: false, drag: null, fuel: 100, gyroUsed: false, clampUsed: false,
      deliveryStart: 0, deliveryTimeout: 0, damage: [], deliveryRisk: 0, bayPan: 0, bayPanDrag: null
    };
  }

  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      return raw ? { ...defaultSave(), ...raw, upgrades: { ...defaultSave().upgrades, ...raw.upgrades }, staff: { ...defaultSave().staff, ...raw.staff } } : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    renderMoney();
  }

  function renderMoney() {
    $("#moneyDisplay").textContent = formatMoney(save.money);
  }

  function init() {
    renderMoney();
    bindNavigation();
    bindActions();
    renderContracts();
    renderGrowth();
    renderCollection();
  }

  function bindNavigation() {
    $$(".nav-button").forEach(button => button.addEventListener("click", () => {
      $$(".nav-button").forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      $$(".screen").forEach(screen => screen.classList.toggle("active", screen.id === `${button.dataset.screen}Screen`));
      if (button.dataset.screen === "growth") renderGrowth();
      if (button.dataset.screen === "collection") renderCollection();
    }));
  }

  function bindActions() {
    $("#beginLoadingButton").addEventListener("click", beginLoading);
    $("#pauseButton").addEventListener("click", pauseBelt);
    $("#boostButton").addEventListener("click", boostBelt);
    $("#reverseButton").addEventListener("click", reverseBelt);
    $("#launchButton").addEventListener("click", requestLaunch);
    $("#gyroButton").addEventListener("click", useGyro);
    $("#clampButton").addEventListener("click", useClamp);
    $("#retryButton").addEventListener("click", resetRun);
    $("#bayPanHandle").addEventListener("pointerdown", startBayPan);
    $("#bayPanHandle").addEventListener("pointermove", moveBayPan);
    $("#bayPanHandle").addEventListener("pointerup", endBayPan);
    $("#bayPanHandle").addEventListener("pointercancel", endBayPan);
    $("#bayPanHandle").addEventListener("keydown", event => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      setBayPan(state.bayPan + (event.key === "ArrowUp" ? -24 : 24));
    });
    $("#resetSaveButton").addEventListener("click", () => openModal(
      "모든 기록을 초기화합니까?",
      "보유금, 업그레이드, 해금 행성, 도감 기록이 삭제됩니다. 되돌릴 수 없습니다.",
      () => { localStorage.removeItem(SAVE_KEY); save = defaultSave(); resetRun(); renderGrowth(); renderCollection(); }
    ));
    $("#modalCancel").addEventListener("click", closeModal);
    $("#modalConfirm").addEventListener("click", () => { const action = modalAction; closeModal(); if (action) action(); });
  }

  function renderContracts() {
    const list = $("#contractChoices");
    list.innerHTML = "";
    CONTRACTS.forEach(contract => {
      const button = document.createElement("button");
      button.className = `choice-card ${contract.id === "hazard" ? "risk" : ""}`;
      button.setAttribute("role", "listitem");
      button.innerHTML = `<span class="choice-top"><strong>${contract.name}</strong><em>보상 ×${contract.reward.toFixed(2)}</em></span>
        <p>${contract.note}</p><p class="risk-copy">위험 ${contract.risk} · ${contract.loss}</p>`;
      button.addEventListener("click", () => selectContract(contract));
      list.append(button);
    });
  }

  function selectContract(contract) {
    state.contract = contract;
    $$(".choice-card").forEach((card, index) => card.classList.toggle("selected", CONTRACTS[index] === contract));
    $("#briefingPanel").classList.add("hidden");
    $("#planetPanel").classList.remove("hidden");
    renderPlanets();
  }

  function renderPlanets() {
    const list = $("#planetChoices");
    list.innerHTML = "";
    PLANETS.forEach(planet => {
      const unlocked = save.unlockedPlanets.includes(planet.id);
      const button = document.createElement("button");
      button.className = `planet-card ${unlocked ? "" : "locked"}`;
      button.disabled = !unlocked;
      button.setAttribute("role", "listitem");
      button.innerHTML = `<span class="planet-top"><strong>${planet.name}</strong><em>${unlocked ? planet.label : `${formatMoney(planet.unlock)} 필요`}</em></span>
        <p>${planet.note}</p>`;
      button.addEventListener("click", () => {
        state.planet = planet;
        $$(".planet-card").forEach((card, index) => card.classList.toggle("selected", PLANETS[index] === planet));
        $("#beginLoadingButton").disabled = false;
      });
      list.append(button);
    });
  }

  function beginLoading() {
    if (!state.contract || !state.planet) return;
    state.phase = "loading";
    state.timeLeft = state.contract.time + save.staff.loader * 2;
    state.running = true;
    state.nextCargo = pickCargoType();
    $("#planetPanel").classList.add("hidden");
    $("#loadingPanel").classList.remove("hidden");
    $("#missionContract").textContent = state.contract.name;
    $("#missionPlanet").textContent = state.planet.name;
    $("#missionGravity").textContent = state.planet.label;
    $("#gravityVector").textContent = state.planet.label;
    configureCargoBay();
    spawnCargo(-10);
    spawnCargo(125);
    spawnCargo(270);
    updateNextPreview();
    updateTelemetry();
    let last = performance.now();
    const frame = now => {
      if (!state.running || state.phase !== "loading") return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      tickLoading(dt, now);
      animationId = requestAnimationFrame(frame);
    };
    animationId = requestAnimationFrame(frame);
  }

  function pickCargoType() {
    const pool = state.contract?.id === "hazard" ? CARGO_TYPES : CARGO_TYPES.filter(type => type.attr !== "explosive");
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function configureCargoBay() {
    const extraHeight = Math.max(0, save.upgrades.bay - 1) * 36;
    $("#cargoBay").style.height = `${260 + extraHeight}px`;
    $("#bayPanHandle").classList.toggle("hidden", extraHeight <= 0);
    setBayPan(0);
  }

  function setBayPan(value) {
    const maxPan = Math.max(0, $("#cargoBay").clientHeight - $("#bayViewport").clientHeight);
    state.bayPan = clamp(value, -maxPan, 0);
    $("#cargoBay").style.setProperty("--bay-pan", `${state.bayPan}px`);
  }

  function startBayPan(event) {
    if (state.phase !== "loading" || $("#bayPanHandle").classList.contains("hidden")) return;
    event.preventDefault();
    state.bayPanDrag = { startY: event.clientY, startPan: state.bayPan, pointerId: event.pointerId };
    $("#bayPanHandle").classList.add("dragging");
    $("#bayPanHandle").setPointerCapture(event.pointerId);
  }

  function moveBayPan(event) {
    if (!state.bayPanDrag || event.pointerId !== state.bayPanDrag.pointerId) return;
    setBayPan(state.bayPanDrag.startPan + event.clientY - state.bayPanDrag.startY);
  }

  function endBayPan(event) {
    if (!state.bayPanDrag || event.pointerId !== state.bayPanDrag.pointerId) return;
    $("#bayPanHandle").releasePointerCapture?.(event.pointerId);
    $("#bayPanHandle").classList.remove("dragging");
    state.bayPanDrag = null;
  }

  function spawnCargo(x = -125) {
    const type = state.nextCargo || pickCargoType();
    state.nextCargo = pickCargoType();
    const cargo = {
      uid: `${Date.now()}-${Math.random()}`, type, x, y: Math.max(8, (112 - type.h) / 2),
      placed: false, dragging: false, clamped: false, damaged: false
    };
    cargo.el = createCargoElement(cargo);
    $("#conveyor").append(cargo.el);
    state.cargos.push(cargo);
    updateNextPreview();
  }

  function createCargoElement(cargo) {
    const el = document.createElement("div");
    const type = cargo.type;
    el.className = "cargo";
    el.dataset.code = type.code;
    el.style.cssText = `--cargo-w:${type.w}px;--cargo-h:${type.h}px;--cargo-color:${type.color};--cargo-edge:${type.edge};left:${cargo.x}px;top:${cargo.y}px`;
    type.circles.forEach(([left, top, size]) => {
      const orb = document.createElement("i");
      orb.className = "cargo-orb";
      orb.style.cssText = `left:${left}px;top:${top}px;width:${size}px;height:${size}px`;
      el.append(orb);
    });
    const label = document.createElement("span");
    label.className = "cargo-label";
    label.textContent = `${type.name} · ${attributeName(type.attr)}`;
    el.append(label);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `${type.name}, ${attributeName(type.attr)}, 가치 ${type.value}`);
    el.addEventListener("pointerdown", event => startDrag(event, cargo));
    return el;
  }

  function attributeName(attr) {
    return ({ heavy: "무거움", slippery: "미끄러움", fragile: "파손주의", explosive: "폭발물", standard: "일반" })[attr];
  }

  function tickLoading(dt, now) {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.heat = Math.max(0, state.heat - dt * 8);
    const paused = now < state.pausedUntil;
    const boosted = now < state.boostedUntil && state.heat < 100;
    const reversed = now < state.reverseUntil;
    $("#conveyor").classList.toggle("paused", paused);
    $("#conveyor").classList.toggle("reversed", reversed);
    $("#pauseButton").classList.toggle("active", paused);
    $("#boostButton").classList.toggle("active", boosted);
    $("#reverseButton").classList.toggle("active", reversed);
    const direction = reversed ? -1 : 1;
    const speed = paused ? 0 : state.beltSpeed * (boosted ? 3 : 1) * direction;
    if (boosted) state.heat = Math.min(100, state.heat + dt * 25);

    state.cargos.filter(cargo => !cargo.placed && !cargo.dragging).forEach(cargo => {
      cargo.x += speed * dt;
      cargo.el.style.left = `${cargo.x}px`;
      if (cargo.x > 500 || cargo.x < -170) removeCargo(cargo);
    });
    state.spawnClock += dt;
    if (state.spawnClock > (boosted ? 1.15 : 2.35) && direction > 0) {
      state.spawnClock = 0;
      spawnCargo(-125);
    }
    if (state.timeLeft <= 0) {
      state.running = false;
      updateTelemetry();
      openModal("상차 시간이 종료되었습니다", "현재 적재 화물로 즉시 출항하거나 이번 계약을 포기할 수 있습니다.", requestLaunch, "즉시 출항");
    }
    updateTelemetry();
  }

  function removeCargo(cargo) {
    cargo.el.remove();
    state.cargos = state.cargos.filter(item => item !== cargo);
  }

  function startDrag(event, cargo) {
    if (state.phase !== "loading" || cargo.placed || cargo.dragging) return;
    event.preventDefault();
    const rect = cargo.el.getBoundingClientRect();
    cargo.dragging = true;
    state.drag = { cargo, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, originalX: cargo.x, originalY: cargo.y };
    cargo.el.classList.add("dragging");
    cargo.el.style.position = "fixed";
    cargo.el.style.left = `${rect.left}px`;
    cargo.el.style.top = `${rect.top}px`;
    cargo.el.style.margin = "0";
    document.body.append(cargo.el);
    cargo.el.addEventListener("pointermove", moveDrag);
    cargo.el.addEventListener("pointerup", endDrag, { once: true });
    cargo.el.addEventListener("pointercancel", endDrag, { once: true });
    cargo.el.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!state.drag) return;
    const { cargo, offsetX, offsetY } = state.drag;
    cargo.el.style.left = `${event.clientX - offsetX}px`;
    cargo.el.style.top = `${event.clientY - offsetY}px`;
    previewPlacement(cargo);
  }

  function previewPlacement(cargo) {
    const bayRect = $("#cargoBay").getBoundingClientRect();
    const rect = cargo.el.getBoundingClientRect();
    const x = rect.left - bayRect.left;
    const y = rect.top - bayRect.top;
    const valid = isWithinBay(cargo, x, y) && !collidesWithPlaced(cargo, x, y);
    $("#cargoBay").classList.toggle("valid", valid);
    $("#cargoBay").classList.toggle("invalid", !valid && rect.bottom > bayRect.top && rect.top < bayRect.bottom);
    cargo.el.classList.toggle("outside", !isWithinBay(cargo, x, y));
    cargo.el.classList.toggle("collision", collidesWithPlaced(cargo, x, y));
  }

  function endDrag(event) {
    if (!state.drag) return;
    const { cargo, originalX, originalY } = state.drag;
    cargo.el.releasePointerCapture?.(event.pointerId);
    cargo.el.removeEventListener("pointermove", moveDrag);
    const bayRect = $("#cargoBay").getBoundingClientRect();
    const rect = cargo.el.getBoundingClientRect();
    const x = rect.left - bayRect.left;
    const y = rect.top - bayRect.top;
    const inside = isWithinBay(cargo, x, y);
    const collision = collidesWithPlaced(cargo, x, y);
    cargo.dragging = false;
    cargo.el.classList.remove("dragging", "outside", "collision");
    $("#cargoBay").classList.remove("valid", "invalid");
    if (inside && !collision) placeCargo(cargo, x, y);
    else {
      cargo.x = originalX;
      cargo.y = originalY;
      cargo.el.style.position = "absolute";
      cargo.el.style.left = `${originalX}px`;
      cargo.el.style.top = `${originalY}px`;
      $("#conveyor").append(cargo.el);
      setPlacementMessage(inside ? "다른 화물의 곡면과 겹칩니다. 붉은 접촉 표시를 피하십시오." : "화물이 적재칸 경계를 벗어났습니다.", "error");
    }
    state.drag = null;
  }

  function placeCargo(cargo, x, y) {
    cargo.placed = true;
    cargo.x = clamp(x, 0, $("#cargoBay").clientWidth - cargo.type.w);
    cargo.y = clamp(y, 0, $("#cargoBay").clientHeight - cargo.type.h);
    cargo.el.style.position = "absolute";
    cargo.el.style.left = `${cargo.x}px`;
    cargo.el.style.top = `${cargo.y}px`;
    $("#cargoBay").append(cargo.el);
    $("#placementHint").classList.add("hidden");
    if (!save.discoveredCargo.includes(cargo.type.id)) {
      save.discoveredCargo.push(cargo.type.id);
      persist();
    }
    setPlacementMessage(`${cargo.type.name} 안착. 경계와 다른 화물 사이 간격이 확보되었습니다.`, "success");
    updateTelemetry();
  }

  function isWithinBay(cargo, x, y) {
    const width = $("#cargoBay").clientWidth;
    const height = $("#cargoBay").clientHeight;
    return cargo.type.circles.every(([cx, cy, size]) => x + cx >= 0 && y + cy >= 0 && x + cx + size <= width && y + cy + size <= height);
  }

  function collidesWithPlaced(cargo, x, y) {
    return state.cargos.some(other => {
      if (!other.placed || other === cargo) return false;
      return cargo.type.circles.some(([ax, ay, as]) => other.type.circles.some(([bx, by, bs]) => {
        const dx = x + ax + as / 2 - (other.x + bx + bs / 2);
        const dy = y + ay + as / 2 - (other.y + by + bs / 2);
        return Math.hypot(dx, dy) < (as + bs) * .43;
      }));
    });
  }

  function cargoArea(type) {
    return type.circles.reduce((sum, circle) => sum + Math.PI * (circle[2] / 2) ** 2, 0) * .7;
  }

  function calculateStats() {
    const placed = state.cargos.filter(cargo => cargo.placed);
    const bayArea = ($("#cargoBay").clientWidth || 430) * ($("#cargoBay").clientHeight || 260) * .43;
    const bayEfficiency = 1 + Math.max(0, save.upgrades.bay - 1) * .03;
    const fill = clamp(placed.reduce((sum, cargo) => sum + cargoArea(cargo.type), 0) / bayArea * 100 * bayEfficiency, 0, 100);
    const totalWeight = placed.reduce((sum, cargo) => sum + cargo.type.weight, 0);
    let stability = 100 - state.planet.risk * 100 - Math.max(0, totalWeight - 5) * 3;
    placed.forEach(cargo => {
      const vertical = cargo.y / Math.max(1, $("#cargoBay").clientHeight - cargo.type.h);
      if (cargo.type.attr === "heavy") stability += vertical > .55 ? 5 : -10;
      if (cargo.type.attr === "slippery") stability -= (1 - cargo.type.friction) * 9;
      if (cargo.type.attr === "fragile" && heavyAbove(cargo)) stability -= 14;
      if (cargo.type.attr === "explosive") stability -= 7;
    });
    stability += save.staff.pilot * 5;
    stability = clamp(stability, 12, 100);
    const vibration = clamp(22 + state.planet.risk * 65 + totalWeight * 2.5 - save.staff.pilot * 4, 8, 92);
    const baseValue = placed.reduce((sum, cargo) => sum + cargo.type.value, 0);
    const profit = (baseValue + fill * 2.2) * state.contract.reward * (1 + save.upgrades.engine * .04 + save.staff.controller * .04);
    return { placed, fill, stability, vibration, profit, totalWeight };
  }

  function heavyAbove(target) {
    return state.cargos.some(cargo => cargo.placed && cargo.type.attr === "heavy" && cargo.y < target.y && Math.abs(cargo.x - target.x) < Math.max(cargo.type.w, target.type.w) * .65);
  }

  function updateTelemetry() {
    if (!state.contract || !state.planet) return;
    const stats = calculateStats();
    const seconds = Math.ceil(state.timeLeft);
    $("#timerDisplay").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    $("#fillDisplay").textContent = `${stats.fill.toFixed(1)}%`;
    $("#stabilityDisplay").textContent = `${Math.round(stats.stability)}%`;
    $("#profitDisplay").textContent = formatMoney(stats.profit);
    $("#launchEstimate").textContent = `예상 ${formatMoney(stats.profit)}`;
    $("#vibrationMeter").style.width = `${stats.vibration}%`;
    $("#vibrationText").textContent = stats.vibration < 35 ? "낮음" : stats.vibration < 62 ? "주의" : "위험";
    $("#pauseCount").textContent = `${state.pauseUses}회`;
    $("#reverseCount").textContent = `${state.reverseUses}회`;
    $("#heatText").textContent = `열 ${Math.round(state.heat)}%`;
    $("#pauseButton").disabled = state.pauseUses <= 0;
    $("#reverseButton").disabled = state.reverseUses <= 0;
    $("#boostButton").disabled = state.heat >= 100;
  }

  function pauseBelt() {
    if (state.pauseUses <= 0 || state.phase !== "loading") return;
    state.pauseUses -= 1;
    state.pausedUntil = performance.now() + 3200;
  }

  function boostBelt() {
    if (state.heat >= 100 || state.phase !== "loading") return;
    state.boostedUntil = performance.now() + 2600;
  }

  function reverseBelt() {
    if (state.reverseUses <= 0 || state.phase !== "loading") return;
    state.reverseUses -= 1;
    state.reverseUntil = performance.now() + 2100;
  }

  function requestLaunch() {
    if (state.phase !== "loading") return;
    const stats = calculateStats();
    if (!stats.placed.length) {
      setPlacementMessage("출항할 화물이 없습니다. 컨베이어 화물을 먼저 적재하십시오.", "error");
      return;
    }
    const risks = [];
    if (stats.stability < 55) risks.push("안정도 낮음: 운송 중 화물 이동 예상");
    if (stats.placed.some(cargo => cargo.type.attr === "explosive")) risks.push("폭발물: 강한 충돌 시 인접 화물 파손");
    if (stats.placed.some(cargo => cargo.type.attr === "fragile" && heavyAbove(cargo))) risks.push("파손주의 화물 위에 무거운 화물 감지");
    const message = `적재율 ${stats.fill.toFixed(1)}% · 안정도 ${Math.round(stats.stability)}% · 진동 ${Math.round(stats.vibration)}%\n예상 손실: ${risks.length ? risks.join(" / ") : "낮음. 경계 및 겹침 검사 통과"}\n자이로 보정과 긴급 클램프는 운송 중 각각 1회 사용할 수 있습니다.`;
    openModal("화물칸을 봉인하고 출항합니까?", message, beginDelivery, "출항");
  }

  function beginDelivery() {
    cancelAnimationFrame(animationId);
    state.running = false;
    state.phase = "delivery";
    state.fuel = 100 + save.upgrades.fuel * 8;
    state.gyroUsed = false;
    state.clampUsed = false;
    const stats = calculateStats();
    state.deliveryRisk = 100 - stats.stability + stats.vibration * .38;
    $("#loadingPanel").classList.add("hidden");
    $("#deliveryPanel").classList.remove("hidden");
    $("#gyroButton").classList.remove("used");
    $("#clampButton").classList.remove("used");
    $("#gyroButton").disabled = false;
    $("#clampButton").disabled = false;
    transferCargoToDelivery();
    updateFuel();
    state.deliveryStart = performance.now();
    state.deliveryTimeout = window.setTimeout(() => {
      if (state.phase === "delivery") finishDelivery();
    }, 5000);
    let lastSecond = -1;
    const frame = now => {
      const elapsed = (now - state.deliveryStart) / 1000;
      const remaining = Math.max(0, 5 - elapsed);
      $("#deliveryTimer").textContent = remaining.toFixed(1);
      const shock = elapsed > 2.25 && elapsed < 3.25;
      $("#shockWarning").classList.toggle("visible", elapsed > 1.65 && elapsed < 3.25);
      $("#deliveryBay").classList.toggle("shaking", shock && !state.gyroUsed);
      if (shock) applyVisualShake(elapsed);
      const second = Math.floor(elapsed);
      if (second !== lastSecond) {
        lastSecond = second;
        updateDeliveryLog(second);
      }
      if (remaining <= 0) finishDelivery();
      else deliveryAnimationId = requestAnimationFrame(frame);
    };
    deliveryAnimationId = requestAnimationFrame(frame);
  }

  function transferCargoToDelivery() {
    const source = $("#cargoBay");
    const target = $("#deliveryBay");
    const sx = target.clientWidth / Math.max(1, source.clientWidth);
    const sy = target.clientHeight / Math.max(1, source.clientHeight);
    state.cargos.filter(cargo => cargo.placed).forEach(cargo => {
      cargo.x *= sx;
      cargo.y *= sy;
      cargo.el.style.left = `${cargo.x}px`;
      cargo.el.style.top = `${cargo.y}px`;
      cargo.el.classList.add("locked");
      target.append(cargo.el);
    });
  }

  function applyVisualShake(elapsed) {
    const intensity = state.gyroUsed ? 1 : 4;
    state.cargos.filter(cargo => cargo.placed).forEach((cargo, index) => {
      if (cargo.clamped) return;
      const slip = cargo.type.attr === "slippery" ? 2.1 : 1;
      const dx = Math.sin(elapsed * 25 + index) * intensity * slip;
      const dy = Math.cos(elapsed * 19 + index) * intensity;
      cargo.el.style.transform = `translate(${dx}px,${dy}px)`;
    });
  }

  function updateDeliveryLog(second) {
    const logs = [
      "엔진 점화. 진동 예측값을 감시하십시오.",
      `항로 진입. ${state.planet.name} 중력 벡터 ${state.planet.label}.`,
      "충격파가 접근합니다. 지금 안정화 능력을 사용할 수 있습니다.",
      state.gyroUsed ? "자이로 보정 유지. 자세 편차가 감소했습니다." : "충격 통과. 화물 이동량을 계산 중입니다.",
      state.clampUsed ? "긴급 클램프 체결 확인. 도착 궤도 진입." : "최종 진동 구간. 미고정 화물을 감시하십시오.",
      "감속 완료. 하역 도크와 연결합니다."
    ];
    $("#deliveryLog").textContent = logs[clamp(second, 0, logs.length - 1)];
  }

  function useGyro() {
    if (state.gyroUsed || state.fuel < 18 || state.phase !== "delivery") return;
    state.gyroUsed = true;
    state.fuel -= 18;
    state.deliveryRisk -= 24;
    $("#gyroButton").classList.add("used");
    $("#gyroButton").disabled = true;
    $("#deliveryBay").classList.remove("shaking");
    updateFuel();
    $("#deliveryLog").textContent = "자이로 보정 작동. 엔진 진동과 측면 중력을 상쇄했습니다.";
  }

  function useClamp() {
    if (state.clampUsed || state.fuel < 12 || state.phase !== "delivery") return;
    state.clampUsed = true;
    state.fuel -= 12;
    state.deliveryRisk -= 17;
    const target = state.cargos.filter(cargo => cargo.placed && !cargo.clamped).sort((a, b) => {
      const danger = cargo => ({ explosive: 4, fragile: 3, slippery: 2, heavy: 1, standard: 0 })[cargo.type.attr];
      return danger(b) - danger(a);
    })[0];
    if (target) {
      target.clamped = true;
      target.el.classList.add("clamped");
      target.el.style.transform = "";
    }
    $("#clampButton").classList.add("used");
    $("#clampButton").disabled = true;
    updateFuel();
    $("#deliveryLog").textContent = target ? `긴급 클램프가 ${target.type.name}을 고정했습니다.` : "긴급 클램프 대기 위치 고정.";
  }

  function updateFuel() {
    const maxFuel = 100 + save.upgrades.fuel * 8;
    const percent = clamp(state.fuel / maxFuel * 100, 0, 100);
    $("#fuelDisplay").textContent = `${Math.round(percent)}%`;
    $("#fuelMeter").style.width = `${percent}%`;
  }

  function finishDelivery() {
    if (state.phase !== "delivery") return;
    cancelAnimationFrame(deliveryAnimationId);
    clearTimeout(state.deliveryTimeout);
    state.phase = "result";
    state.cargos.forEach(cargo => { if (cargo.el) cargo.el.style.transform = ""; });
    const stats = calculateStats();
    let risk = Math.max(0, state.deliveryRisk);
    const fragile = stats.placed.filter(cargo => cargo.type.attr === "fragile" && !cargo.clamped);
    const explosives = stats.placed.filter(cargo => cargo.type.attr === "explosive" && !cargo.clamped);
    const slippery = stats.placed.filter(cargo => cargo.type.attr === "slippery" && !cargo.clamped);
    const damaged = [];
    if (risk >= 48 && fragile.length) damaged.push(fragile[0]);
    if (risk >= 62 && slippery.length) damaged.push(slippery[0]);
    if (risk >= 76 && explosives.length) {
      damaged.push(explosives[0]);
      const neighbor = stats.placed.find(cargo => cargo !== explosives[0] && !cargo.clamped);
      if (neighbor) damaged.push(neighbor);
    }
    const uniqueDamage = [...new Set(damaged)];
    uniqueDamage.forEach(cargo => { cargo.damaged = true; cargo.el?.classList.add("collision"); });
    const success = uniqueDamage.length < Math.max(2, Math.ceil(stats.placed.length * .5));
    const damageValue = uniqueDamage.reduce((sum, cargo) => sum + cargo.type.value, 0);
    const perfect = stats.fill >= 90;
    const fuelPercent = state.fuel / (100 + save.upgrades.fuel * 8) * 100;
    const fuelBonus = state.fuel * 1.2;
    const perfectBonus = perfect ? 350 : 0;
    const pay = Math.max(0, stats.profit - damageValue * state.contract.reward + fuelBonus + perfectBonus) * (success ? 1 : .35);
    save.money += Math.round(pay);
    save.deliveries += 1;
    save.bestFill = Math.max(save.bestFill, stats.fill);
    save.bestPay = Math.max(save.bestPay, pay);
    persist();
    showResult({ stats, uniqueDamage, success, perfect, fuelPercent, pay, risk });
  }

  function showResult({ stats, uniqueDamage, success, perfect, fuelPercent, pay, risk }) {
    $("#deliveryPanel").classList.add("hidden");
    $("#resultPanel").classList.remove("hidden");
    $("#resultStamp").textContent = success ? "배송 성공" : "화물 손실";
    $("#resultStamp").classList.toggle("failed", !success);
    $("#resultTitle").textContent = success ? `${state.planet.name} 인계 완료` : "파손 보고서 발행";
    let reason = "경계 검사와 화물 간격이 유지되어 정상 인계했습니다.";
    if (uniqueDamage.length) {
      const names = uniqueDamage.map(cargo => cargo.type.name).join(", ");
      reason = `예측 위험 ${Math.round(risk)}단계에서 ${names} 파손. ${risk >= 76 ? "폭발물 충격이 인접 화물로 전달되었습니다." : "진동과 중력에 의해 고정 한계를 넘었습니다."}`;
    }
    $("#resultReason").textContent = reason;
    $("#resultFill").textContent = `${stats.fill.toFixed(1)}%`;
    $("#resultCondition").textContent = uniqueDamage.length ? `${uniqueDamage.length}개 파손` : "전량 정상";
    $("#resultFuel").textContent = `${Math.round(fuelPercent)}%`;
    $("#resultPay").textContent = formatMoney(pay);
    $("#perfectBanner").classList.toggle("hidden", !perfect);
    renderGrowth();
    renderCollection();
  }

  function renderGrowth() {
    renderUpgradeGroup("#shipUpgrades", SHIP_UPGRADES, "upgrades");
    renderUpgradeGroup("#staffUpgrades", STAFF_UPGRADES, "staff");
    const list = $("#planetUnlocks");
    list.innerHTML = "";
    PLANETS.filter(planet => planet.unlock > 0).forEach(planet => {
      const unlocked = save.unlockedPlanets.includes(planet.id);
      const row = document.createElement("div");
      row.className = "upgrade-row";
      row.innerHTML = `<div><h3>${planet.name}</h3><p>${planet.label} · ${planet.note}</p></div>`;
      const button = document.createElement("button");
      button.textContent = unlocked ? "해금 완료" : formatMoney(planet.unlock);
      button.disabled = unlocked || save.money < planet.unlock;
      button.addEventListener("click", () => {
        if (save.money < planet.unlock || save.unlockedPlanets.includes(planet.id)) return;
        save.money -= planet.unlock;
        save.unlockedPlanets.push(planet.id);
        persist(); renderGrowth(); renderPlanets(); renderCollection();
      });
      row.append(button);
      list.append(row);
    });
  }

  function renderUpgradeGroup(selector, config, saveKey) {
    const list = $(selector);
    list.innerHTML = "";
    Object.entries(config).forEach(([id, upgrade]) => {
      const level = save[saveKey][id];
      const cost = Math.round(upgrade.base * Math.pow(1.62, level - 1));
      const row = document.createElement("div");
      row.className = "upgrade-row";
      row.innerHTML = `<div><h3>${upgrade.name} · LV.${level}</h3><p>${upgrade.effect(level)}</p></div>`;
      const button = document.createElement("button");
      button.textContent = level >= 6 ? "최고 레벨" : formatMoney(cost);
      button.disabled = level >= 6 || save.money < cost;
      button.addEventListener("click", () => {
        if (save.money < cost || save[saveKey][id] >= 6) return;
        save.money -= cost;
        save[saveKey][id] += 1;
        persist(); renderGrowth(); renderCollection();
      });
      row.append(button);
      list.append(row);
    });
  }

  function renderCollection() {
    const groups = [
      {
        title: "화물 도감", progress: `${save.discoveredCargo.length}/${CARGO_TYPES.length}`,
        items: CARGO_TYPES.map(type => save.discoveredCargo.includes(type.id)
          ? { name: type.name, detail: `${attributeName(type.attr)} · 기본 가치 ${formatMoney(type.value)}` }
          : { name: "미발견 화물", detail: "실루엣 데이터 없음", unknown: true })
      },
      {
        title: "행성 도감", progress: `${save.unlockedPlanets.length}/${PLANETS.length}`,
        items: PLANETS.map(planet => save.unlockedPlanets.includes(planet.id)
          ? { name: planet.name, detail: `${planet.label} · 중력 위험 ${Math.round(planet.risk * 100)}` }
          : { name: "미해금 항로", detail: `${formatMoney(planet.unlock)} 필요`, unknown: true })
      },
      {
        title: "직원 도감", progress: "3/3",
        items: Object.entries(STAFF_UPGRADES).map(([id, staff]) => ({ name: staff.name, detail: `훈련 LV.${save.staff[id]} · ${staff.effect(save.staff[id])}` }))
      },
      {
        title: "우주선 도감", progress: "1/1",
        items: [{ name: "NAN-26 하울러", detail: `배송 ${save.deliveries}회 · 최고 적재 ${save.bestFill.toFixed(1)}% · 최고 수익 ${formatMoney(save.bestPay)}` }]
      }
    ];
    const content = $("#collectionContent");
    content.innerHTML = "";
    groups.forEach(group => {
      const section = document.createElement("section");
      section.className = "collection-group";
      section.innerHTML = `<header><h3>${group.title}</h3><strong>${group.progress}</strong></header><div class="collection-grid"></div>`;
      const grid = $(".collection-grid", section);
      group.items.forEach(item => {
        const node = document.createElement("div");
        node.className = `collection-item ${item.unknown ? "unknown" : ""}`;
        node.innerHTML = `<strong>${item.name}</strong><span>${item.detail}</span>`;
        grid.append(node);
      });
      content.append(section);
    });
  }

  function updateNextPreview() {
    if (!state.nextCargo) return;
    const preview = $("#nextCargoPreview");
    preview.style.background = state.nextCargo.color;
    preview.style.borderRadius = "48% 55% 43% 60%";
  }

  function setPlacementMessage(message, type = "") {
    const node = $("#placementMessage");
    node.textContent = message;
    node.className = `placement-message ${type}`;
  }

  function openModal(title, body, action, confirmText = "확인") {
    modalAction = action;
    $("#modalTitle").textContent = title;
    $("#modalBody").textContent = body;
    $("#modalConfirm").textContent = confirmText;
    $("#confirmModal").classList.remove("hidden");
    $("#modalConfirm").focus();
  }

  function closeModal() {
    $("#confirmModal").classList.add("hidden");
    modalAction = null;
  }

  function resetRun() {
    cancelAnimationFrame(animationId);
    cancelAnimationFrame(deliveryAnimationId);
    clearTimeout(state.deliveryTimeout);
    state.cargos.forEach(cargo => cargo.el?.remove());
    state = freshState();
    $("#briefingPanel").classList.remove("hidden");
    $("#planetPanel").classList.add("hidden");
    $("#loadingPanel").classList.add("hidden");
    $("#deliveryPanel").classList.add("hidden");
    $("#resultPanel").classList.add("hidden");
    $("#placementHint").classList.remove("hidden");
    $("#beginLoadingButton").disabled = true;
    $("#cargoBay").style.height = "260px";
    $("#cargoBay").style.setProperty("--bay-pan", "0px");
    $("#bayPanHandle").classList.add("hidden");
    renderContracts();
    renderMoney();
  }

  init();
})();
