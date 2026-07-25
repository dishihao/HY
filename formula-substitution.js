"use strict";

(() => {
  const method = document.body.dataset.method || "assay";
  const byField = key => document.querySelector(`[data-field="${key}"]`)?.value?.trim() ?? "";
  const byKey = key => document.querySelector(`[data-key="${key}"]`)?.value?.trim() ?? "";
  const output = id => document.getElementById(id)?.value?.trim() || document.getElementById(id)?.textContent?.trim() || "—";
  const complete = values => values.every(value => value !== "" && value !== "—");
  const esc = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

  const fraction = (numerator, denominator) =>
    `<span class="calc-fraction"><span class="calc-numerator">${numerator}</span><span class="calc-denominator">${denominator}</span></span>`;

  const equation = (label, expression, result = "", unit = "") =>
    `<div class="formula-substitution-row"><span class="calc-label">${label}</span>${expression}${result !== "" ? `<span class="calc-divider">＝</span><span class="calc-result">${esc(result)}${unit}</span>` : ""}</div>`;

  function renderSymbolicFormula() {
    if (method === "assay") return;
    const box = document.querySelector(".formula-box");
    if (!box) return;
    box.classList.add("formula-equation-box");
    if (method === "impurities") {
      box.innerHTML = `<span class="calc-label">X＝</span>${fraction("M<sub>1</sub>", "M<sub>总</sub>")}<span>×100%</span>`;
    } else if (method === "moisture") {
      box.innerHTML = `<span class="calc-label">X＝</span>${fraction("W<sub>0</sub>＋W<sub>r</sub>－W<sub>1</sub>", "W<sub>r</sub>")}<span>×100%</span>`;
    } else if (method === "ash") {
      box.innerHTML = `<span class="calc-label">X＝</span>${fraction("W<sub>1</sub>－W<sub>0</sub>", "W<sub>r</sub>")}<span>×100%</span>`;
    } else if (method === "sulfur") {
      box.innerHTML = `<span class="calc-label">X＝</span>${fraction("（V－V<sub>0</sub>）×F×1000", "m")}<span>mg/kg</span>`;
    }
  }

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
      empty.textContent = "填写完整数据后，这里会按上方公式的相同布局自动代入。";
      box.appendChild(empty);
      return;
    }
    rows.forEach(html => {
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      box.appendChild(template.content.firstElementChild);
    });
  }

  function finalRows(x1, x2, rd, avg, averageLabel, averageUnit) {
    const rows = [];
    if (complete([x1, x2, rd])) {
      rows.push(equation(
        "相对偏差＝",
        `${fraction(`|${esc(x1)}－${esc(x2)}|`, `（${esc(x1)}＋${esc(x2)}）`)}<span>×100%</span>`,
        rd,
        "%"
      ));
    }
    if (complete([x1, x2, avg])) {
      rows.push(equation(
        `${averageLabel}＝`,
        fraction(`（${esc(x1)}＋${esc(x2)}）`, "2"),
        avg,
        averageUnit
      ));
    }
    return rows;
  }

  function renderImpurities() {
    const s1 = byField("sampleMass1"), s2 = byField("sampleMass2");
    const i1 = byField("impurityMass1"), i2 = byField("impurityMass2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([s1, i1, x1])) rows.push(equation("X<sub>1</sub>＝", `${fraction(esc(i1), esc(s1))}<span>×100%</span>`, x1, "%"));
    if (complete([s2, i2, x2])) rows.push(equation("X<sub>2</sub>＝", `${fraction(esc(i2), esc(s2))}<span>×100%</span>`, x2, "%"));
    rows.push(...finalRows(x1, x2, rd, avg, "杂质平均含量＝", "%"));
    renderRows(rows);
  }

  function renderMoisture() {
    const b1 = byField("bottleFinal1"), b2 = byField("bottleFinal2");
    const m1 = byField("sampleMass1"), m2 = byField("sampleMass2");
    const d1 = byField("dryFinal1"), d2 = byField("dryFinal2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([b1, m1, d1, x1])) rows.push(equation("X<sub>1</sub>＝", `${fraction(`${esc(b1)}＋${esc(m1)}－${esc(d1)}`, esc(m1))}<span>×100%</span>`, x1, "%"));
    if (complete([b2, m2, d2, x2])) rows.push(equation("X<sub>2</sub>＝", `${fraction(`${esc(b2)}＋${esc(m2)}－${esc(d2)}`, esc(m2))}<span>×100%</span>`, x2, "%"));
    rows.push(...finalRows(x1, x2, rd, avg, "平均水分＝", "%"));
    renderRows(rows);
  }

  function renderAsh() {
    const c1 = byField("crucibleFinal1"), c2 = byField("crucibleFinal2");
    const m1 = byField("sampleMass1"), m2 = byField("sampleMass2");
    const r1 = byField("residueFinal1"), r2 = byField("residueFinal2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([c1, m1, r1, x1])) rows.push(equation("X<sub>1</sub>＝", `${fraction(`${esc(r1)}－${esc(c1)}`, esc(m1))}<span>×100%</span>`, x1, "%"));
    if (complete([c2, m2, r2, x2])) rows.push(equation("X<sub>2</sub>＝", `${fraction(`${esc(r2)}－${esc(c2)}`, esc(m2))}<span>×100%</span>`, x2, "%"));
    rows.push(...finalRows(x1, x2, rd, avg, "平均总灰分＝", "%"));
    renderRows(rows);
  }

  function renderSulfur() {
    const blank = byField("blank"), factor = byField("factor");
    const m1 = byField("mass1"), m2 = byField("mass2"), v1 = byField("volume1"), v2 = byField("volume2");
    const x1 = output("result1"), x2 = output("result2"), rd = output("relativeDeviation"), avg = output("average");
    const rows = [];
    if (complete([blank, factor, m1, v1, x1])) rows.push(equation("X<sub>1</sub>＝", fraction(`（${esc(v1)}－${esc(blank)}）×${esc(factor)}×1000`, esc(m1)), x1, " mg/kg"));
    if (complete([blank, factor, m2, v2, x2])) rows.push(equation("X<sub>2</sub>＝", fraction(`（${esc(v2)}－${esc(blank)}）×${esc(factor)}×1000`, esc(m2)), x2, " mg/kg"));
    rows.push(...finalRows(x1, x2, rd, avg, "平均残留量＝", " mg/kg"));
    renderRows(rows);
  }

  function renderAssay() {
    const peaks = [1, 2, 3, 4, 5].map(i => byKey(`stdPeak${i}`));
    const stdAvg = output("stdAverage"), rsd = output("rsdOutput");
    const c = byKey("stdConcentration"), vStd = byKey("stdInjection");
    const rows = [];

    if (complete([...peaks, stdAvg])) {
      rows.push(equation("Ā<sub>对</sub>＝", fraction(peaks.map(esc).join("＋"), "5"), stdAvg));
    }
    if (complete([...peaks, stdAvg, rsd])) {
      const deviations = peaks.map(value => `（${esc(value)}－${esc(stdAvg)}）²`).join("＋");
      const radical = `<span class="calc-radical"><span class="calc-radical-sign">√</span><span class="calc-radicand">${fraction(deviations, "4")}</span></span>`;
      rows.push(equation("RSD＝", `${fraction(radical, esc(stdAvg))}<span>×100%</span>`, rsd, "%"));
    }

    [1, 2].forEach(index => {
      const p1 = byKey(`sample${index}Peak1`), p2 = byKey(`sample${index}Peak2`);
      const a = output(`sampleAvg${index}`), f = byKey(`dilution${index}`), w = byKey(`weight${index}`);
      const q = byKey(`moisture${index}`) || (index === 2 ? byKey("moisture1") : "");
      const v = byKey(`sampleInjection${index}`), x = output(`content${index}`);
      if (complete([p1, p2, a])) rows.push(equation(`Ā<sub>样${index}</sub>＝`, fraction(`${esc(p1)}＋${esc(p2)}`, "2"), a));
      if (complete([a, c, f, vStd, stdAvg, w, q, v, x])) {
        const numerator = `${esc(a)}×${esc(c)}×${esc(f)}×${esc(vStd)}`;
        const denominator = `${esc(stdAvg)}×${esc(w)}×1000×（1－${esc(q)}%）×${esc(v)}`;
        rows.push(equation(`X<sub>${index}</sub>＝`, `${fraction(numerator, denominator)}<span>×100%</span>`, x, "%"));
      }
    });

    const x1 = output("content1"), x2 = output("content2"), rd = output("relativeDeviation"), avg = output("averageContent");
    rows.push(...finalRows(x1, x2, rd, avg, "平均含量＝", "%"));
    renderRows(rows);
  }

  function update() {
    if (method === "impurities") renderImpurities();
    else if (method === "moisture") renderMoisture();
    else if (method === "ash") renderAsh();
    else if (method === "sulfur") renderSulfur();
    else renderAssay();
  }

  renderSymbolicFormula();
  document.addEventListener("input", () => setTimeout(update, 0), true);
  document.addEventListener("change", () => setTimeout(update, 0), true);
  ["exampleBtn", "resetBtn"].forEach(id => document.getElementById(id)?.addEventListener("click", () => setTimeout(update, 0)));
  setTimeout(update, 0);
})();
