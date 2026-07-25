"use strict";

const method = document.body.dataset.method;
const unit = document.body.dataset.unit || "%";
const projectName = document.body.dataset.project || "检验项目";
const editableFields = [...document.querySelectorAll("[data-field]")];

const configurations = {
  impurities: {
    defaults: {
      sampleNo1: "1", sampleNo2: "2", balanceModel: "", balanceId: "",
      relation: "max", spec: "3", roomTemp: "", humidity: "",
      inspector: "", inspectDate: "", reviewer: "", reviewDate: ""
    },
    example: {
      sampleNo1: "1", sampleNo2: "2", balanceModel: "YP5002", balanceId: "HY-TP-01",
      sampleMass1: "51.47", sampleMass2: "50.17", impurityMass1: "0.67", impurityMass2: "0.66",
      relation: "max", spec: "3", roomTemp: "14", humidity: "56",
      inspector: "", inspectDate: "2025-01-07", reviewer: "", reviewDate: "2025-01-07"
    }
  },
  moisture: {
    defaults: {
      sampleNo1: "1", sampleNo2: "2", balanceModel: "", balanceId: "",
      ovenModel: "", ovenId: "", temperature: "105", firstHours: "5", finalHours: "1",
      relation: "max", spec: "14.0", roomTemp: "", humidity: "",
      inspector: "", inspectDate: "", reviewer: "", reviewDate: ""
    },
    example: {
      sampleNo1: "1", sampleNo2: "2", balanceModel: "MB45", balanceId: "HY-TP-05",
      ovenModel: "GZX-136BBS", ovenId: "HY-GW-04", temperature: "105", firstHours: "5", finalHours: "1",
      bottleFirst1: "27.7431", bottleFirst2: "27.7462", bottleFinal1: "27.7429", bottleFinal2: "27.7461",
      sampleMass1: "2.6801", sampleMass2: "2.5815", dryFirst1: "30.0597", dryFirst2: "29.9758",
      dryFinal1: "30.0587", dryFinal2: "29.9748", relation: "max", spec: "14.0",
      roomTemp: "15", humidity: "55", inspector: "", inspectDate: "2025-01-07", reviewer: "", reviewDate: "2025-01-07"
    }
  },
  ash: {
    defaults: {
      sampleNo1: "1", sampleNo2: "2", balanceModel: "", balanceId: "",
      furnaceModel: "", furnaceId: "", temperature: "550", firstHours: "5", finalHours: "1",
      relation: "max", spec: "6.0", roomTemp: "", humidity: "",
      inspector: "", inspectDate: "", reviewer: "", reviewDate: ""
    },
    example: {
      sampleNo1: "1", sampleNo2: "2", balanceModel: "", balanceId: "",
      furnaceModel: "SX2-12-10", furnaceId: "", temperature: "550", firstHours: "5", finalHours: "1",
      crucibleFirst1: "38.8926", crucibleFirst2: "41.5270", crucibleFinal1: "38.8975", crucibleFinal2: "41.5269",
      sampleMass1: "2.1105", sampleMass2: "2.4115", residueFirst1: "39.0062", residueFirst2: "41.6522",
      residueFinal1: "39.0060", residueFinal2: "41.6521", relation: "max", spec: "6.0",
      roomTemp: "19", humidity: "50", inspector: "", inspectDate: "2025-01-07", reviewer: "", reviewDate: "2025-01-07"
    }
  },
  sulfur: {
    defaults: {
      sampleNo1: "1", sampleNo2: "2", relation: "max", blank: "", factor: "", spec: "",
      roomTemp: "", humidity: "", inspector: "", inspectDate: "", reviewer: "", reviewDate: ""
    },
    example: {
      sampleNo1: "1", sampleNo2: "2", blank: "0.10", factor: "0.3203",
      mass1: "10.012", mass2: "10.008", volume1: "1.55", volume2: "1.50",
      relation: "max", spec: "150"
    }
  }
};

const config = configurations[method] || { defaults: {}, example: {} };
const defaults = config.defaults;

function el(id) { return document.getElementById(id); }
function raw(id) { return el(id)?.value?.trim() ?? ""; }
function fieldRaw(key) { return document.querySelector(`[data-field="${key}"]`)?.value?.trim() ?? ""; }
function numberFrom(value) { return value !== "" && Number.isFinite(Number(value)) ? Number(value) : null; }
function fieldNumber(key) { return numberFrom(fieldRaw(key)); }
function decimalPlaces(value) {
  const match = String(value ?? "").trim().match(/^-?\d+(?:\.(\d*))?$/);
  return match ? (match[1]?.length ?? 0) : null;
}

function roundHalfEven(value, places) {
  if (!Number.isFinite(value)) return null;
  places = Math.max(0, places | 0);
  const scale = 10 ** places;
  const scaled = Math.abs(value) * scale;
  let integer = Math.floor(scaled);
  const remainder = scaled - integer;
  const tolerance = Math.max(1e-12, Number.EPSILON * Math.max(1, scaled) * 16);
  if (remainder > .5 + tolerance || (Math.abs(remainder - .5) <= tolerance && integer % 2 === 1)) integer += 1;
  return ((value < 0 ? -integer : integer) / scale).toFixed(places);
}

function setValue(id, value) {
  const node = el(id);
  if (node) node.value = value ?? "—";
}
function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value ?? "—";
}
function setStatus(id, state, text) {
  const node = el(id);
  if (!node) return;
  node.className = `status ${state}`;
  node.textContent = text;
}

function markInvalid() {
  document.querySelectorAll("input.entry[data-number]").forEach(node => {
    const value = node.value.trim();
    node.classList.toggle("invalid", value !== "" && !Number.isFinite(Number(value)));
  });
}

function calculateOne(index) {
  if (method === "impurities") {
    const sampleMass = fieldNumber(`sampleMass${index}`);
    const impurityMass = fieldNumber(`impurityMass${index}`);
    if ([sampleMass, impurityMass].some(value => value === null)) return null;
    if (sampleMass <= 0 || impurityMass < 0) return null;
    return impurityMass / sampleMass * 100;
  }

  if (method === "moisture") {
    const bottle = fieldNumber(`bottleFinal${index}`);
    const sampleMass = fieldNumber(`sampleMass${index}`);
    const driedTotal = fieldNumber(`dryFinal${index}`);
    if ([bottle, sampleMass, driedTotal].some(value => value === null)) return null;
    const loss = bottle + sampleMass - driedTotal;
    if (sampleMass <= 0 || loss < 0) return null;
    return loss / sampleMass * 100;
  }

  if (method === "ash") {
    const crucible = fieldNumber(`crucibleFinal${index}`);
    const sampleMass = fieldNumber(`sampleMass${index}`);
    const residueTotal = fieldNumber(`residueFinal${index}`);
    if ([crucible, sampleMass, residueTotal].some(value => value === null)) return null;
    const ashMass = residueTotal - crucible;
    if (sampleMass <= 0 || ashMass < 0) return null;
    return ashMass / sampleMass * 100;
  }

  if (method === "sulfur") {
    const blank = fieldNumber("blank");
    const factor = fieldNumber("factor");
    const mass = fieldNumber(`mass${index}`);
    const volume = fieldNumber(`volume${index}`);
    if ([blank, factor, mass, volume].some(value => value === null)) return null;
    const correctedVolume = volume - blank;
    if (mass <= 0 || factor <= 0 || correctedVolume < 0) return null;
    setValue(`sampleWeight${index}`, roundHalfEven(mass, 3));
    setValue(`change${index}`, roundHalfEven(correctedVolume, 2));
    return correctedVolume * factor * 1000 / mass;
  }

  return null;
}

function calculate() {
  markInvalid();

  const specRaw = fieldRaw("spec");
  const spec = numberFrom(specRaw);
  const specDigits = decimalPlaces(specRaw);
  const resultPlaces = specDigits === null ? 2 : specDigits + 1;
  const averagePlaces = specDigits === null ? 1 : specDigits;
  const deviationPlaces = specDigits === null ? 1 : Math.max(0, specDigits - 1);

  const resultRaw1 = calculateOne(1);
  const resultRaw2 = calculateOne(2);
  const resultText1 = resultRaw1 === null ? "—" : roundHalfEven(resultRaw1, resultPlaces);
  const resultText2 = resultRaw2 === null ? "—" : roundHalfEven(resultRaw2, resultPlaces);

  setValue("result1", resultText1);
  setValue("result2", resultText2);
  setText("summary1", resultText1);
  setText("summary2", resultText2);

  let relativeText = "—";
  if (resultText1 !== "—" && resultText2 !== "—") {
    const x1 = Number(resultText1);
    const x2 = Number(resultText2);
    const sum = Math.abs(x1 + x2);
    if (sum > 0) relativeText = roundHalfEven(Math.abs(x1 - x2) / sum * 100, deviationPlaces);
  }
  setValue("relativeDeviation", relativeText);
  setText("summaryRd", relativeText);

  let averageText = "—";
  let averageRaw = null;
  if (resultRaw1 !== null && resultRaw2 !== null) {
    averageRaw = (resultRaw1 + resultRaw2) / 2;
    averageText = roundHalfEven(averageRaw, averagePlaces);
  }
  setValue("average", averageText);
  setText("summaryAvg", averageText);

  const relation = fieldRaw("relation") || "max";
  const relationText = relation === "min" ? "不得少于" : (method === "sulfur" ? "不得高于" : "不得过");
  setValue("standardText", spec === null ? "请输入标准规定。" : `${projectName}${relationText}${specRaw}${unit}。`);

  let pass = null;
  if (averageRaw !== null && spec !== null) pass = relation === "min" ? averageRaw >= spec : averageRaw <= spec;
  setStatus("resultStatus", pass === null ? "pending" : pass ? "ok" : "bad", pass === null ? "待输入" : pass ? "符合" : "不符合");
  setStatus("overallStatus", pass === null ? "pending" : pass ? "ok" : "bad", pass === null ? "待输入" : pass ? "符合规定" : "不符合规定");
}

function apply(values) {
  editableFields.forEach(node => {
    const key = node.dataset.field;
    node.value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : (defaults[key] ?? "");
  });
  calculate();
}

function toast(message) {
  const node = el("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove("show"), 1600);
}

editableFields.forEach(node => {
  node.addEventListener("input", calculate);
  node.addEventListener("change", calculate);
});

el("exampleBtn")?.addEventListener("click", () => {
  apply(config.example || defaults);
  toast("已载入纸质记录示例数据");
});
el("resetBtn")?.addEventListener("click", () => {
  if (confirm("确认清空当前页面数据？")) {
    apply(defaults);
    toast("已清空");
  }
});
el("printBtn")?.addEventListener("click", () => window.print());
el("copyBtn")?.addEventListener("click", async () => {
  calculate();
  const text = [
    `${projectName}结果1：${el("summary1")?.textContent}${unit}`,
    `${projectName}结果2：${el("summary2")?.textContent}${unit}`,
    `相对偏差：${el("summaryRd")?.textContent}%`,
    `平均结果：${el("summaryAvg")?.textContent}${unit}`,
    `结论：${el("overallStatus")?.textContent}`
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast("结果已复制");
  } catch (_) {
    prompt("复制以下结果：", text);
  }
});

apply(defaults);