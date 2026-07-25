"use strict";

(() => {
  const method = document.body.dataset.method || "assay";
  const byField = key => document.querySelector(`[data-field="${key}"]`)?.value?.trim() ?? "";
  const byKey = key => document.querySelector(`[data-key="${key}"]`)?.value?.trim() ?? "";
  const output = id => document.getElementById(id)?.value?.trim() || document.getElementById(id)?.textContent?.trim() || "—";
  const shown = value => value === "" ? "□" : value;
  const complete = values => values.every(value => value !== "" && value !== "—");

  function ensureBox() {
    let box = document.getElementById("formulaSubstitution");
    if (box) return box;
    const anchor = document.querySelector(method === "assay" ? ".formula-line" : ".formula-box");
    if (!anchor) return null;
    box = document.createElement("div");
    box.id = "formulaSubstitution";
    box.className = "formula-substitution";
    anchor.insertAdjacentElement("afterend", box);
    return box;
  }

  function renderRows(rows) {
    const box = ensureBox();
    if (!box) return;
    box.replaceChildren();
    const title = document.createElement("div");
    title.className = "formula-substitution-title";
    title.textContent = "数据代入计算：";
    box.appendChild(title);
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "formula-substitution-empty";
      empty.textContent = "填写完整数据后，这里会自动显示可直接抄写的代入过程。";
      box.appendChild(empty);
      return;
    }
    rows.forEach(text => {
      const row = document.createElement("div");
      row.className = "formula-substitution-row";
      row.textContent = text;
      box.appendChild(row);
    });
  }

  function commonFinalRows(x1, x2, rd, avg, averageLabel = "平均值") {
    const rows = [];
    if (complete([x1, x2, rd])) rows.push(`相对偏差＝|${x1}－${x2}|÷（${x1}＋${x2}）×100%＝${rd}%`);
    if (complete([x1, x2, avg])) rows.push(`${averageLabel}＝（${x1}＋${x2}）÷2＝${avg}`);
    return rows;
  }

  function renderImpurities() {
    const s1 = byField("sampleMass1"), s2 = byField("sampleMass2");
    const i1 = byField("impurityMass1"), i2 = byField("impurityMass2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([s1, i1, x1])) rows.push(`X₁＝${i1}÷${s1}×100%＝${x1}%`);
    if (complete([s2, i2, x2])) rows.push(`X₂＝${i2}÷${s2}×100%＝${x2}%`);
    rows.push(...commonFinalRows(x1, x2, rd, avg === "—" ? avg : `${avg}%`, "杂质平均含量"));
    renderRows(rows);
  }

  function renderMoisture() {
    const b1 = byField("bottleFinal1"), b2 = byField("bottleFinal2");
    const m1 = byField("sampleMass1"), m2 = byField("sampleMass2");
    const d1 = byField("dryFinal1"), d2 = byField("dryFinal2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([b1, m1, d1, x1])) rows.push(`X₁＝（${b1}＋${m1}－${d1}）÷${m1}×100%＝${x1}%`);
    if (complete([b2, m2, d2, x2])) rows.push(`X₂＝（${b2}＋${m2}－${d2}）÷${m2}×100%＝${x2}%`);
    rows.push(...commonFinalRows(x1, x2, rd, avg === "—" ? avg : `${avg}%`, "平均水分"));
    renderRows(rows);
  }

  function renderAsh() {
    const c1 = byField("crucibleFinal1"), c2 = byField("crucibleFinal2");
    const m1 = byField("sampleMass1"), m2 = byField("sampleMass2");
    const r1 = byField("residueFinal1"), r2 = byField("residueFinal2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([c1, m1, r1, x1])) rows.push(`X₁＝（${r1}－${c1}）÷${m1}×100%＝${x1}%`);
    if (complete([c2, m2, r2, x2])) rows.push(`X₂＝（${r2}－${c2}）÷${m2}×100%＝${x2}%`);
    rows.push(...commonFinalRows(x1, x2, rd, avg === "—" ? avg : `${avg}%`, "平均总灰分"));
    renderRows(rows);
  }

  function renderSulfur() {
    const blank = byField("blank"), factor = byField("factor");
    const m1 = byField("mass1"), m2 = byField("mass2"), v1 = byField("volume1"), v2 = byField("volume2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([blank, factor, m1, v1, x1])) rows.push(`X₁＝（${v1}－${blank}）×${factor}×1000÷${m1}＝${x1} mg/kg`);
    if (complete([blank, factor, m2, v2, x2])) rows.push(`X₂＝（${v2}－${blank}）×${factor}×1000÷${m2}＝${x2} mg/kg`);
    rows.push(...commonFinalRows(x1, x2, rd, avg === "—" ? avg : `${avg} mg/kg`, "平均残留量"));
    renderRows(rows);
  }

  function renderAssay() {
    const peaks = [1,2,3,4,5].map(i => byKey(`stdPeak${i}`));
    const stdAvg = output("stdAverage"), rsd = output("rsdOutput");
    const c = byKey("stdConcentration"), vStd = byKey("stdInjection");
    const rows = [];
    if (complete([...peaks, stdAvg])) rows.push(`Ā对＝（${peaks.join("＋")}）÷5＝${stdAvg}`);
    if (complete([...peaks, stdAvg, rsd])) {
      const squared = peaks.map(value => `（${value}－${stdAvg}）²`).join("＋");
      rows.push(`RSD＝√[（${squared}）÷4]÷${stdAvg}×100%＝${rsd}%`);
    }
    [1,2].forEach(index => {
      const p1 = byKey(`sample${index}Peak1`), p2 = byKey(`sample${index}Peak2`);
      const a = output(`sampleAvg${index}`), f = byKey(`dilution${index}`), w = byKey(`weight${index}`);
      const q = byKey(`moisture${index}`) || (index === 2 ? byKey("moisture1") : "");
      const v = byKey(`sampleInjection${index}`), x = output(`content${index}`);
      if (complete([p1,p2,a])) rows.push(`Ā样${index}＝（${p1}＋${p2}）÷2＝${a}`);
      if (complete([a,c,f,vStd,stdAvg,w,q,v,x])) rows.push(`X${index}＝（${a}×${c}×${f}×${vStd}）÷（${stdAvg}×${w}×1000×（1－${q}%）×${v}）×100%＝${x}%`);
    });
    const x1 = output("content1"), x2 = output("content2"), rd = output("relativeDeviation"), avg = output("averageContent");
    rows.push(...commonFinalRows(x1, x2, rd, avg === "—" ? avg : `${avg}%`, "平均含量"));
    renderRows(rows);
  }

  function update() {
    if (method === "impurities") renderImpurities();
    else if (method === "moisture") renderMoisture();
    else if (method === "ash") renderAsh();
    else if (method === "sulfur") renderSulfur();
    else renderAssay();
  }

  document.addEventListener("input", () => setTimeout(update, 0), true);
  document.addEventListener("change", () => setTimeout(update, 0), true);
  ["exampleBtn", "resetBtn"].forEach(id => document.getElementById(id)?.addEventListener("click", () => setTimeout(update, 0)));
  setTimeout(update, 0);
})();
