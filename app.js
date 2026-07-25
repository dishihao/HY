"use strict";

const STORAGE_KEY = "hy-gc-assay-calculator-v2";
const LEGACY_STORAGE_KEY = "hy-mint-assay-calculator-v1";

const DEFAULTS = {
  rsdLimit: "2.0",
  stdInjection: "1",
  sampleNo1: "1",
  sampleNo2: "2",
  dilution1: "50",
  dilution2: "50",
  sampleInjection1: "1",
  sampleInjection2: "1",
  analyteName: "",
  specRelation: "min",
  specValue: "0.13"
};

const EXAMPLE = {
  ...DEFAULTS,
  analyteName: "薄荷脑",
  refBatch: "110736-2027",
  refSource: "中检院",
  purity: "99.8",
  dryCondition: "/",
  stdConcentration: "0.2151",
  stdInjection: "1",
  stdPeak1: "799.00",
  stdPeak2: "782.62",
  stdPeak3: "785.28",
  stdPeak4: "789.51",
  stdPeak5: "783.31",
  moisture1: "11.6",
  moisture2: "11.6",
  weight1: "2.1601",
  weight2: "2.1645",
  dilution1: "50",
  dilution2: "50",
  sampleInjection1: "1",
  sampleInjection2: "1",
  sample1Peak1: "471.25",
  sample1Peak2: "463.59",
  sample2Peak1: "486.53",
  sample2Peak2: "466.19",
  specRelation: "min",
  specValue: "0.13"
};

const $ = (id) => document.getElementById(id);
const fields = [...document.querySelectorAll("[data-key]")];
const byKey = Object.fromEntries(fields.map(el => [el.dataset.key, el]));
let saveTimer = null;
let lastResults = null;

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

function frac(n, d = 1n) {
  if (d === 0n) throw new Error("除数不能为0");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function add(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }
function div(a, b) { return frac(a.n * b.d, a.d * b.n); }
function absF(a) { return a.n < 0n ? { n: -a.n, d: a.d } : a; }

function compare(a, b) {
  const x = a.n * b.d;
  const y = b.n * a.d;
  return x < y ? -1 : x > y ? 1 : 0;
}

function toNumber(a) { return Number(a.n) / Number(a.d); }
function pow10(n) { return 10n ** BigInt(n); }

function parseDecimal(value) {
  const raw = String(value ?? "").trim().replace(/％/g, "%").replace(/,/g, "");
  if (!raw) return null;
  const cleaned = raw.endsWith("%") ? raw.slice(0, -1).trim() : raw;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const sign = cleaned.startsWith("-") ? -1n : 1n;
  const unsigned = cleaned.replace(/^[+-]/, "");
  const [whole = "0", decimal = ""] = unsigned.split(".");
  const digits = (whole || "0") + decimal;
  return frac(sign * BigInt(digits || "0"), pow10(decimal.length));
}

function decimalPlaces(value) {
  const raw = String(value ?? "").trim().replace(/％/g, "%");
  const cleaned = raw.endsWith("%") ? raw.slice(0, -1).trim() : raw;
  const match = cleaned.match(/^[+-]?\d*(?:\.(\d*))?$/);
  return match ? (match[1]?.length ?? 0) : null;
}

function average(list) {
  const valid = list.filter(Boolean);
  if (valid.length !== list.length || !valid.length) return null;
  return div(valid.reduce((sum, x) => add(sum, x), frac(0n)), frac(BigInt(valid.length)));
}

function roundHalfEven(f, places) {
  places = Math.max(0, places | 0);
  const negative = f.n < 0n;
  const n = negative ? -f.n : f.n;
  const scaled = n * pow10(places);
  let q = scaled / f.d;
  const r = scaled % f.d;
  const twice = r * 2n;
  if (twice > f.d || (twice === f.d && q % 2n === 1n)) q += 1n;
  const sign = negative && q !== 0n ? "-" : "";
  if (places === 0) return sign + q.toString();
  const s = q.toString().padStart(places + 1, "0");
  return sign + s.slice(0, -places) + "." + s.slice(-places);
}

function roundNumberHalfEven(value, places) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  const scaled = Math.abs(value) * scale;
  let q = Math.floor(scaled);
  const remainder = scaled - q;
  const tolerance = Math.max(1e-12, Number.EPSILON * Math.max(1, scaled) * 16);
  if (remainder > .5 + tolerance || (Math.abs(remainder - .5) <= tolerance && q % 2 === 1)) q += 1;
  const rounded = (value < 0 ? -q : q) / scale;
  return rounded.toFixed(places);
}

function formatTrimmed(f, maxPlaces = 3) {
  if (!f) return "—";
  let s = roundHalfEven(f, maxPlaces);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function getF(key, fallbackKey = null) {
  const raw = byKey[key]?.value ?? "";
  if (String(raw).trim() !== "") return parseDecimal(raw);
  return fallbackKey ? parseDecimal(byKey[fallbackKey]?.value) : null;
}

function setOutput(id, value) {
  const el = $(id);
  if (el) el.value = value ?? "—";
}

function markValidation() {
  document.querySelectorAll("input.numeric").forEach(el => {
    const value = el.value.trim();
    el.classList.toggle("invalid", value !== "" && !parseDecimal(value));
  });
}

function setStatus(el, state, label) {
  el.className = `status ${state}`;
  el.textContent = label;
}

function calculateContent(sampleAvg, concentration, dilution, stdInjection, stdAvg, weight, moisture, sampleInjection) {
  if (![sampleAvg, concentration, dilution, stdInjection, stdAvg, weight, moisture, sampleInjection].every(Boolean)) return null;
  const dryFactorPercent = sub(frac(100n), moisture);
  if (weight.n <= 0n || stdAvg.n <= 0n || sampleInjection.n <= 0n || dryFactorPercent.n <= 0n) return null;
  const numerator = [sampleAvg, concentration, dilution, stdInjection, frac(10n)].reduce(mul);
  const denominator = [stdAvg, weight, dryFactorPercent, sampleInjection].reduce(mul);
  return div(numerator, denominator);
}

function calculate() {
  markValidation();

  const analyteName = byKey.analyteName.value.trim();
  const shownAnalyte = analyteName || "待测成分";
  const pageTitle = analyteName ? `${analyteName}含量测定计算` : "气相含量测定计算";
  $("appTitle").textContent = pageTitle;
  document.title = pageTitle;
  $("summaryAnalyte").textContent = analyteName || "—";

  const stdPeaks = [1, 2, 3, 4, 5].map(i => parseDecimal(byKey[`stdPeak${i}`].value));
  const stdAvg = average(stdPeaks);
  setOutput("stdAverage", formatTrimmed(stdAvg, 3));

  let rsdText = "—";
  let rsdPass = null;
  if (stdAvg && stdPeaks.every(Boolean)) {
    const values = stdPeaks.map(toNumber);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1);
    const rsd = Math.sqrt(variance) / mean * 100;
    rsdText = roundNumberHalfEven(rsd, 1) ?? "—";
    const limit = parseDecimal(byKey.rsdLimit.value);
    rsdPass = limit ? compare(parseDecimal(rsdText), limit) <= 0 : null;
  }
  setOutput("rsdOutput", rsdText);
  $("summaryRsd").textContent = rsdText;

  const sampleAvg1 = average([getF("sample1Peak1"), getF("sample1Peak2")]);
  const sampleAvg2 = average([getF("sample2Peak1"), getF("sample2Peak2")]);
  setOutput("sampleAvg1", formatTrimmed(sampleAvg1, 3));
  setOutput("sampleAvg2", formatTrimmed(sampleAvg2, 3));

  const specRaw = byKey.specValue.value.trim();
  const spec = parseDecimal(specRaw);
  const specDigits = decimalPlaces(specRaw);
  const contentPlaces = specDigits == null ? null : specDigits + 1;
  const deviationPlaces = specDigits == null ? null : Math.max(0, specDigits - 1);
  const averagePlaces = specDigits;

  $("standardDigits").textContent = specDigits ?? "—";
  $("contentDigits").textContent = contentPlaces ?? "—";
  $("deviationDigits").textContent = deviationPlaces ?? "—";
  $("averageDigits").textContent = averagePlaces ?? "—";

  const concentration = getF("stdConcentration");
  const stdInjection = getF("stdInjection");
  const contentRaw1 = calculateContent(
    sampleAvg1,
    concentration,
    getF("dilution1"),
    stdInjection,
    stdAvg,
    getF("weight1"),
    getF("moisture1"),
    getF("sampleInjection1")
  );
  const contentRaw2 = calculateContent(
    sampleAvg2,
    concentration,
    getF("dilution2"),
    stdInjection,
    stdAvg,
    getF("weight2"),
    getF("moisture2", "moisture1"),
    getF("sampleInjection2")
  );

  const contentText1 = contentRaw1 && contentPlaces != null ? roundHalfEven(contentRaw1, contentPlaces) : "—";
  const contentText2 = contentRaw2 && contentPlaces != null ? roundHalfEven(contentRaw2, contentPlaces) : "—";
  setOutput("content1", contentText1);
  setOutput("content2", contentText2);

  let rdText = "—";
  if (contentText1 !== "—" && contentText2 !== "—" && deviationPlaces != null) {
    const x1Shown = parseDecimal(contentText1);
    const x2Shown = parseDecimal(contentText2);
    const sum = add(x1Shown, x2Shown);
    if (sum.n !== 0n) {
      const rd = mul(div(absF(sub(x1Shown, x2Shown)), absF(sum)), frac(100n));
      rdText = roundHalfEven(rd, deviationPlaces).replace(/^-/, "");
    }
  }
  setOutput("relativeDeviation", rdText);

  let avgText = "—";
  let avgShown = null;
  if (contentRaw1 && contentRaw2 && averagePlaces != null) {
    const avgRaw = div(add(contentRaw1, contentRaw2), frac(2n));
    avgText = roundHalfEven(avgRaw, averagePlaces);
    avgShown = parseDecimal(avgText);
  }
  setOutput("averageContent", avgText);

  const relation = byKey.specRelation.value;
  const relationText = relation === "max" ? "不得高于" : "不得少于";
  $("specText").value = specRaw
    ? `本品按干燥品计算，含${shownAnalyte}${relationText}${specRaw}%。`
    : "请输入标准规定。";

  let contentPass = null;
  if (avgShown && spec) {
    contentPass = relation === "max" ? compare(avgShown, spec) <= 0 : compare(avgShown, spec) >= 0;
  }

  const rsdState = rsdPass == null ? ["pending", "待输入"] : rsdPass ? ["ok", "符合"] : ["bad", "不符合"];
  const contentState = contentPass == null ? ["pending", "待输入"] : contentPass ? ["ok", "符合"] : ["bad", "不符合"];
  setStatus($("rsdStatus"), ...rsdState);
  setStatus($("rsdStatus2"), ...rsdState);
  setStatus($("contentStatus"), ...contentState);

  let overallState = ["pending", "待输入"];
  if (contentPass != null && rsdPass != null) {
    overallState = contentPass && rsdPass ? ["ok", "符合规定"] : ["bad", "不符合规定"];
  }
  setStatus($("overallStatus"), ...overallState);

  $("summaryStdAvg").textContent = formatTrimmed(stdAvg, 3);
  $("summaryX1").textContent = contentText1;
  $("summaryX2").textContent = contentText2;
  $("summaryRd").textContent = rdText;
  $("summaryAvg").textContent = avgText;

  lastResults = {
    analyteName: analyteName || "未填写",
    stdAverage: formatTrimmed(stdAvg, 3),
    rsd: rsdText,
    x1: contentText1,
    x2: contentText2,
    relativeDeviation: rdText,
    averageContent: avgText,
    conclusion: overallState[1]
  };
}

function collectState() {
  return Object.fromEntries(fields.map(el => [el.dataset.key, el.value]));
}

function applyState(state) {
  fields.forEach(el => {
    const key = el.dataset.key;
    if (Object.hasOwn(state, key)) el.value = state[key];
    else if (Object.hasOwn(DEFAULTS, key)) el.value = DEFAULTS[key];
    else el.value = "";
  });
  calculate();
}

function saveNow() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
  $("saveState").textContent = "已自动保存";
}

function scheduleSave() {
  $("saveState").textContent = "保存中…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 260);
}

function load() {
  let state = DEFAULTS;
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    const stored = current || legacy;
    if (stored && typeof stored === "object") state = { ...DEFAULTS, ...stored };
  } catch (_) {}
  applyState(state);
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 1800);
}

fields.forEach(el => {
  el.addEventListener("input", () => {
    calculate();
    scheduleSave();
  });
  el.addEventListener("change", () => {
    calculate();
    scheduleSave();
  });
});

$("exampleBtn").addEventListener("click", () => {
  applyState(EXAMPLE);
  saveNow();
  toast("已载入示例数据");
});

$("resetBtn").addEventListener("click", () => {
  if (!confirm("确认清空当前计算数据？固定仪器信息和默认规则会保留。")) return;
  applyState(DEFAULTS);
  saveNow();
  toast("已清空");
});

$("printBtn").addEventListener("click", () => window.print());

$("copyBtn").addEventListener("click", async () => {
  calculate();
  const text = [
    `项目/测定成分：${lastResults.analyteName}`,
    `对照品平均峰面积：${lastResults.stdAverage}`,
    `RSD：${lastResults.rsd}%`,
    `X1：${lastResults.x1}%`,
    `X2：${lastResults.x2}%`,
    `相对偏差：${lastResults.relativeDeviation}%`,
    `平均含量：${lastResults.averageContent}%`,
    `结论：${lastResults.conclusion}`
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast("结果已复制");
  } catch (_) {
    prompt("复制以下结果：", text);
  }
});

load();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
