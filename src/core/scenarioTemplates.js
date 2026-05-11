export function createPizzaKitchenScenario(overrides = {}) {
  return {
    name: "披萨厨房",
    templateType: "pizza-kitchen",
    grid: { width: 12, height: 8 },
    startPosition: { x: 0, y: 0 },
    orders: overrides.orders ?? 4,
    workerCount: overrides.workers ?? 2,
    workerSpeed: overrides.workerSpeed ?? 1,
    stations: [
      station("doughTable", "面饼台", "dough", { x: 1, y: 1 }, 1, 8),
      station("toppings", "辅料区", "toppings", { x: 10, y: 1 }, 1, 6, {
        cornerOnly: true,
      }),
      station("oven", "烤箱", "bake", { x: 10, y: 6 }, 1, 12, { fixed: true }),
      station("slice", "切片台", "slice", { x: 1, y: 6 }, 1, 4),
    ],
    steps: [
      step("dough", "制作面饼", "doughTable", "dough"),
      step("toppings", "铺辅料", "toppings", "toppings"),
      step("bake", "进烤箱", "oven", "bake"),
      step("slice", "取出切片", "slice", "slice"),
    ],
    blockedCells: [
      { x: 5, y: 3 },
      { x: 6, y: 3 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ],
  };
}

export function createBakeryFactoryScenario(overrides = {}) {
  return {
    name: "烘焙工厂",
    templateType: "bakery-factory",
    grid: { width: 18, height: 12 },
    startPosition: { x: 0, y: 5 },
    orders: overrides.orders ?? 6,
    workerCount: overrides.workers ?? 4,
    workerSpeed: overrides.workerSpeed ?? 1,
    stations: [
      station("ingredient-zone", "配料区", "ingredient", { x: 2, y: 1 }, 2, 8),
      station("mixer", "和面机", "mix", { x: 5, y: 1 }, 2, 18),
      station("fermentation", "发酵室", "ferment", { x: 9, y: 2 }, 3, 36),
      station("divider", "分割整形台", "shape", { x: 13, y: 2 }, 2, 16),
      station("proofer", "醒发室", "proof", { x: 15, y: 6 }, 3, 28),
      station("deck-oven", "烤炉", "bake", { x: 12, y: 10 }, 2, 24, { fixed: true }),
      station("cooling-rack", "冷却架", "cool", { x: 7, y: 10 }, 4, 20),
      station("packaging", "包装台", "pack", { x: 3, y: 9 }, 2, 12),
      station("finished-goods", "成品暂存区", "store", { x: 1, y: 10 }, 4, 6),
    ],
    steps: [
      step("prepare", "称量配料", "ingredient-zone", "ingredient"),
      step("mix", "和面", "mixer", "mix"),
      step("ferment", "基础发酵", "fermentation", "ferment"),
      step("shape", "分割整形", "divider", "shape"),
      step("proof", "最终醒发", "proofer", "proof"),
      step("bake", "烘烤", "deck-oven", "bake"),
      step("cool", "冷却", "cooling-rack", "cool"),
      step("pack", "包装", "packaging", "pack"),
      step("store", "成品暂存", "finished-goods", "store"),
    ],
    blockedCells: [
      { x: 8, y: 5 },
      { x: 9, y: 5 },
      { x: 8, y: 6 },
      { x: 9, y: 6 },
      { x: 10, y: 6 },
      { x: 10, y: 7 },
    ],
  };
}

export function getScenarioTemplates() {
  return [
    { id: "pizza-kitchen", label: "披萨厨房", create: createPizzaKitchenScenario },
    { id: "bakery-factory", label: "烘焙工厂", create: createBakeryFactoryScenario },
  ];
}

function station(id, label, type, position, capacity, processTime, options = {}) {
  return { id, label, type, position, capacity, processTime, ...options };
}

function step(id, label, stationId, stationType) {
  return { id, label, stationId, stationType, durationMode: "station" };
}
