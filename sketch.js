// Publish a Google Sheet as CSV, then paste its public CSV URL here.
// Leave empty to load the local questions.csv while developing.
const CLOUD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTwYOY5u-Ruc3e_1wE-v61uEA4ltyqu72sBpa4T-jDQYwg1m_EMoegHjSge5pZvbeenRwo_NsNQKO59/pub?output=csv";
const LOCAL_CSV_URL = "questions.csv";
const QUESTION_COUNT = 6;

let questionBank = [];
let questions = [];
let choices = [];
let placedChoices = [];
let dragging = null;
let pressedIconIndex = null;
let pressStartX = 0;
let pressStartY = 0;
let submitted = false;
let score = 0;
let confetti = [];
let layout = {};
let loadState = "loading";
let loadError = "";

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Trebuchet MS, sans-serif");
  textAlign(CENTER, CENTER);
  loadQuestionBank();
}

async function loadQuestionBank() {
  const source = CLOUD_CSV_URL.trim() || LOCAL_CSV_URL;
  try {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`CSV 載入失敗（HTTP ${response.status}）`);
    }

    questionBank = parseQuestionCsv(await response.text());
    if (questionBank.length < QUESTION_COUNT) {
      throw new Error(`題庫至少需要 ${QUESTION_COUNT} 題，目前只有 ${questionBank.length} 題。`);
    }

    loadState = "ready";
    startRound();
    calculateLayout();
  } catch (error) {
    loadState = "error";
    loadError = error instanceof Error ? error.message : "無法讀取 CSV 題庫。";
    console.error("題庫載入錯誤：", error);
  }
}

function parseQuestionCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (quoted) {
      if (character === '"' && csvText[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && csvText[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV 格式錯誤：有未成對的雙引號。");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV 沒有題目資料，請確認標題列與題目內容。");

  const headers = rows[0].map((value) => value.trim().replace(/^\uFEFF/, "").toLowerCase());
  const iconColumn = headers.indexOf("icon");
  const labelColumn = headers.indexOf("label");
  const answerColumn = headers.indexOf("answer");
  if ([iconColumn, labelColumn, answerColumn].includes(-1)) {
    throw new Error("CSV 標題列必須包含 icon、label、answer 三欄。");
  }

  const validIcons = new Set(["soap", "recycle", "tooth", "umbrella", "pot", "crosswalk"]);
  const questionsFromCsv = rows.slice(1).map((values, index) => {
    const question = {
      icon: (values[iconColumn] || "").trim().toLowerCase(),
      label: (values[labelColumn] || "").trim(),
      answer: (values[answerColumn] || "").trim()
    };
    if (!validIcons.has(question.icon)) {
      throw new Error(`第 ${index + 2} 列的 icon 不支援，請使用 soap、recycle、tooth、umbrella、pot 或 crosswalk。`);
    }
    if (!question.label || !question.answer) {
      throw new Error(`第 ${index + 2} 列的 label 或 answer 是空白。`);
    }
    return question;
  });

  return questionsFromCsv;
}

function startRound() {
  questions = shuffle([...questionBank]).slice(0, QUESTION_COUNT);
  choices = shuffle(questions.map((question, questionIndex) => ({
    id: questionIndex,
    questionIndex,
    text: question.answer
  })));
  choices.forEach((choice, index) => {
    choice.id = index;
  });
  placedChoices = Array(questions.length).fill(null);
}

function draw() {
  background("#f5f3ec");
  if (loadState !== "ready") {
    drawLoadMessage();
    return;
  }

  drawDecorations();
  drawHeader();
  drawTargets();
  drawChoices();
  drawConfetti();
  if (submitted) drawResult();
  drawActionButton();
}

function drawLoadMessage() {
  textAlign(CENTER, CENTER);
  noStroke();
  fill("#25352e");
  textSize(26);
  text(loadState === "loading" ? "正在載入題庫…" : "題庫載入失敗", width / 2, height / 2 - 35);
  fill("#758078");
  textSize(15);
  const message = loadState === "loading"
    ? "請稍候"
    : `${loadError}\n\n請確認 CSV 網址可公開讀取，且資料欄位正確。`;
  text(message, width / 2, height / 2 + 22, Math.min(width - 40, 600), 150);
}

function calculateLayout() {
  const compact = width < 700;
  const columns = compact ? 2 : 3;
  const padding = compact ? 18 : 34;
  const gap = compact ? 10 : 16;
  const headerHeight = compact ? 94 : 116;
  const buttonHeight = compact ? 52 : 58;
  const buttonBottom = compact ? 18 : 26;
  const targetTop = headerHeight + 4;
  const targetBottom = compact ? height * 0.61 : height * 0.56;
  const choiceTop = targetBottom + (compact ? 18 : 30);
  const choiceBottom = height - buttonHeight - buttonBottom - 24;
  const targetRows = Math.ceil(questions.length / columns);
  const targetCellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const targetCellHeight = (targetBottom - targetTop - gap * (targetRows - 1)) / targetRows;
  const choiceCellHeight = (choiceBottom - choiceTop - gap * 2) / 3;
  const buttonWidth = Math.min(compact ? 260 : 300, width - padding * 2);

  layout = {
    compact, columns, padding, gap, headerHeight, buttonHeight, buttonBottom,
    targetTop, targetBottom, choiceTop, choiceBottom, targetRows,
    targetCellWidth, targetCellHeight, choiceCellHeight, buttonWidth
  };
}

function drawDecorations() {
  noStroke();
  fill("#e9e5d9");
  for (let x = 16; x < width; x += 34) {
    for (let y = 18; y < height; y += 34) circle(x, y, 2);
  }
}

function drawHeader() {
  const titleSize = layout.compact ? 25 : 34;
  textAlign(LEFT, CENTER);
  noStroke();
  fill("#25352e");
  textSize(titleSize);
  text("生活小達人", layout.padding, 34);
  fill("#758078");
  textSize(layout.compact ? 12 : 15);
  text("把每句生活好習慣，配對到正確圖示！", layout.padding + 1, 67);

  const completeCount = placedChoices.filter((choiceId) => choiceId !== null).length;
  textAlign(RIGHT, CENTER);
  fill("#557b67");
  textSize(layout.compact ? 13 : 15);
  text(`${completeCount} / ${QUESTION_COUNT} 題`, width - layout.padding, 38);
  textAlign(CENTER, CENTER);
}

function drawTargets() {
  for (let index = 0; index < questions.length; index += 1) {
    const bounds = targetBounds(index);
    const isFilled = placedChoices[index] !== null;
    drawCard(bounds, isFilled ? "#e7f0e7" : "#fffefa", isFilled ? "#b5cbb8" : "#e1ded4");
    drawIcon(questions[index].icon, bounds.x + bounds.w / 2, bounds.y + bounds.h * 0.23, index);
    drawSoundBadge(bounds.x + bounds.w - 19, bounds.y + 20);

    noStroke();
    fill("#34463c");
    textSize(layout.compact ? 14 : 18);
    text(questions[index].label, bounds.x + 6, bounds.y + bounds.h * 0.59, bounds.w - 12, 22);

    const dropZone = {
      x: bounds.x + 8,
      y: bounds.y + bounds.h * 0.73,
      w: bounds.w - 16,
      h: bounds.h * 0.24
    };
    stroke(isFilled ? "#b5cbb8" : "#d8d8ce");
    strokeWeight(1);
    fill(isFilled ? "#f6fbf6" : "#f7f6f1");
    rect(dropZone.x, dropZone.y, dropZone.w, dropZone.h, 7);

    noStroke();
    if (isFilled) {
      fill("#52715e");
      textSize(layout.compact ? 12 : 14);
      text(wrapChineseText(choiceById(placedChoices[index]).text, dropZone.w - 10), dropZone.x + 4, dropZone.y + 2, dropZone.w - 8, dropZone.h - 4);
    } else {
      fill("#a9aea7");
      textSize(layout.compact ? 12 : 14);
      text("拖曳文字到這裡", dropZone.x + 4, dropZone.y + 2, dropZone.w - 8, dropZone.h - 4);
    }
  }
}

function drawChoices() {
  const available = choices.filter((choice) => !placedChoices.includes(choice.id));
  const cellWidth = (width - layout.padding * 2 - layout.gap * (layout.columns - 1)) / layout.columns;

  textAlign(LEFT, CENTER);
  noStroke();
  fill("#758078");
  textSize(layout.compact ? 14 : 16);
  text("文字選項", layout.padding, layout.choiceTop - 13);
  textAlign(CENTER, CENTER);

  available.forEach((choice, index) => {
    const bounds = {
      x: layout.padding + (index % layout.columns) * (cellWidth + layout.gap),
      y: layout.choiceTop + Math.floor(index / layout.columns) * (layout.choiceCellHeight + layout.gap),
      w: cellWidth,
      h: layout.choiceCellHeight
    };
    if (!dragging || dragging.choiceId !== choice.id) drawChoiceCard(choice, bounds, false);
  });

  if (dragging) {
    drawChoiceCard(choiceById(dragging.choiceId), {
      x: mouseX - dragging.offsetX,
      y: mouseY - dragging.offsetY,
      w: dragging.width,
      h: dragging.height
    }, true);
  }
}

function drawChoiceCard(choice, bounds, active) {
  drawingContext.save();
  if (active) {
    drawingContext.shadowColor = "rgba(37, 53, 46, 0.22)";
    drawingContext.shadowBlur = 16;
    drawingContext.shadowOffsetY = 6;
  }
  drawCard(bounds, active ? "#fff2c9" : "#ffffff", active ? "#d6ae58" : "#dfddd5");
  drawingContext.restore();
  noStroke();
  fill("#35453b");
  textSize(layout.compact ? 14 : 16);
  text(wrapChineseText(choice.text, bounds.w - 20), bounds.x + 8, bounds.y + 5, bounds.w - 16, bounds.h - 10);
}

function wrapChineseText(value, maxWidth) {
  let lines = "";
  let currentLine = "";
  for (const character of value) {
    const candidate = currentLine + character;
    if (currentLine && textWidth(candidate) > maxWidth) {
      lines += `${currentLine}\n`;
      currentLine = character;
    } else {
      currentLine = candidate;
    }
  }
  return lines + currentLine;
}

function drawActionButton() {
  const complete = placedChoices.every((choiceId) => choiceId !== null);
  const button = {
    x: (width - layout.buttonWidth) / 2,
    y: height - layout.buttonHeight - layout.buttonBottom,
    w: layout.buttonWidth,
    h: layout.buttonHeight
  };
  layout.button = button;
  drawCard(button, complete ? "#527b61" : "#d5d7d0", complete ? "#527b61" : "#d5d7d0");
  noStroke();
  fill(complete ? "#ffffff" : "#858b83");
  textSize(layout.compact ? 15 : 17);
  text(submitted ? "再玩一次" : "交卷看成績", button.x, button.y + 1, button.w, button.h);
}

function drawCard(bounds, color, borderColor) {
  rectMode(CORNER);
  stroke(borderColor);
  strokeWeight(1);
  fill(color);
  rect(bounds.x, bounds.y, bounds.w, bounds.h, 12);
}

function drawIcon(type, centerX, centerY, seed) {
  const bounce = sin(frameCount * 0.06 + seed * 1.4) * 2;
  const x = centerX;
  const y = centerY + bounce;
  const size = layout.compact ? Math.min(42, layout.targetCellHeight * 0.42) : 56;

  push();
  translate(x, y);
  strokeJoin(ROUND);
  strokeCap(ROUND);
  stroke("#456c56");
  strokeWeight(3);
  noFill();

  if (type === "soap") {
    fill("#b9dce0");
    rect(-size * 0.55, -size * 0.22, size * 1.1, size * 0.58, 8);
    noStroke();
    fill("#ffffff");
    circle(-size * 0.22, -size * 0.08, 5);
    circle(size * 0.08, -size * 0.12, 4);
    circle(size * 0.32, -size * 0.02, 3);
  } else if (type === "recycle") {
    noFill();
    stroke("#4e8a66");
    strokeWeight(4);
    arc(0, 0, size * 1.35, size * 1.35, -2.4, -0.4);
    arc(0, 0, size * 1.35, size * 1.35, -0.3, 1.7);
    arc(0, 0, size * 1.35, size * 1.35, 1.8, 3.7);
    fill("#4e8a66");
    noStroke();
    triangle(size * 0.37, -size * 0.5, size * 0.62, -size * 0.4, size * 0.39, -size * 0.25);
    triangle(size * 0.25, size * 0.53, size * 0.04, size * 0.68, size * 0.02, size * 0.42);
    triangle(-size * 0.62, -size * 0.08, -size * 0.64, -size * 0.35, -size * 0.39, -size * 0.22);
  } else if (type === "tooth") {
    fill("#fffefa");
    beginShape();
    vertex(-size * 0.35, -size * 0.46);
    vertex(-size * 0.08, -size * 0.36);
    vertex(size * 0.12, -size * 0.42);
    vertex(size * 0.38, -size * 0.3);
    vertex(size * 0.3, size * 0.1);
    vertex(size * 0.15, size * 0.49);
    vertex(0, size * 0.34);
    vertex(-size * 0.16, size * 0.5);
    vertex(-size * 0.32, size * 0.1);
    endShape(CLOSE);
    stroke("#e3a963");
    line(-size * 0.52, -size * 0.34, size * 0.5, -size * 0.34);
    line(-size * 0.45, -size * 0.46, -size * 0.45, -size * 0.3);
    line(-size * 0.28, -size * 0.46, -size * 0.28, -size * 0.3);
    line(-size * 0.1, -size * 0.46, -size * 0.1, -size * 0.3);
  } else if (type === "umbrella") {
    fill("#f2cf72");
    arc(0, 0, size * 1.5, size * 1.25, PI, TWO_PI, CHORD);
    line(0, -size * 0.62, 0, size * 0.55);
    noFill();
    arc(size * 0.18, size * 0.53, size * 0.38, size * 0.38, 0, PI);
    line(-size * 0.5, -size * 0.02, -size * 0.27, size * 0.16);
    line(0, -size * 0.02, 0, size * 0.16);
    line(size * 0.5, -size * 0.02, size * 0.27, size * 0.16);
  } else if (type === "pot") {
    fill("#f2a06c");
    rect(-size * 0.48, -size * 0.1, size * 0.96, size * 0.55, 7);
    line(-size * 0.65, -size * 0.12, size * 0.65, -size * 0.12);
    line(-size * 0.2, -size * 0.25, size * 0.2, -size * 0.25);
    noFill();
    stroke("#dc8f54");
    arc(-size * 0.16, -size * 0.48, size * 0.2, size * 0.28, PI, TWO_PI);
    arc(size * 0.16, -size * 0.48, size * 0.2, size * 0.28, PI, TWO_PI);
  } else if (type === "crosswalk") {
    fill("#dce8dc");
    rect(-size * 0.62, -size * 0.35, size * 1.24, size * 0.7, 5);
    noStroke();
    fill("#ffffff");
    rect(-size * 0.43, -size * 0.25, size * 0.13, size * 0.5, 2);
    rect(-size * 0.13, -size * 0.25, size * 0.13, size * 0.5, 2);
    rect(size * 0.17, -size * 0.25, size * 0.13, size * 0.5, 2);
    stroke("#456c56");
    noFill();
    circle(0, -size * 0.57, size * 0.23);
  }
  pop();
}

function drawSoundBadge(centerX, centerY) {
  push();
  translate(centerX, centerY);
  noStroke();
  fill("#e8efe7");
  circle(0, 0, 24);
  fill("#527b61");
  rect(-7, -3, 4, 6, 1);
  triangle(-3, -4, 3, -8, 3, 8, -3, 4);
  noFill();
  stroke("#527b61");
  strokeWeight(1.5);
  arc(1, 0, 12, 12, -0.85, 0.85);
  arc(1, 0, 18, 18, -0.75, 0.75);
  pop();
}

function targetBounds(index) {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: layout.padding + column * (layout.targetCellWidth + layout.gap),
    y: layout.targetTop + row * (layout.targetCellHeight + layout.gap),
    w: layout.targetCellWidth,
    h: layout.targetCellHeight
  };
}

function iconHitBounds(index) {
  const bounds = targetBounds(index);
  const iconSize = layout.compact ? Math.min(42, layout.targetCellHeight * 0.42) : 56;
  const hitSize = Math.min(bounds.w - 12, Math.max(62, iconSize * 1.6));
  const bounce = sin(frameCount * 0.06 + index * 1.4) * 2;
  return {
    x: bounds.x + (bounds.w - hitSize) / 2,
    y: bounds.y + bounds.h * 0.23 + bounce - hitSize / 2,
    w: hitSize,
    h: Math.min(bounds.h * 0.52, hitSize)
  };
}

function choiceById(choiceId) {
  return choices.find((choice) => choice.id === choiceId);
}

function mousePressed() {
  if (loadState !== "ready") return false;
  if (submitted) {
    if (inside(mouseX, mouseY, layout.button)) resetQuiz();
    return false;
  }

  pressedIconIndex = questions.findIndex((question, index) => inside(mouseX, mouseY, iconHitBounds(index)));
  pressStartX = mouseX;
  pressStartY = mouseY;

  if (placedChoices.every((choiceId) => choiceId !== null) && inside(mouseX, mouseY, layout.button)) {
    submitQuiz();
    return false;
  }

  for (let index = 0; index < placedChoices.length; index += 1) {
    if (placedChoices[index] === null) continue;
    const bounds = targetBounds(index);
    if (inside(mouseX, mouseY, bounds)) {
      dragging = { choiceId: placedChoices[index], offsetX: bounds.w / 2, offsetY: bounds.h / 2, width: bounds.w, height: bounds.h };
      placedChoices[index] = null;
      return false;
    }
  }

  const available = choices.filter((choice) => !placedChoices.includes(choice.id));
  const cellWidth = (width - layout.padding * 2 - layout.gap * (layout.columns - 1)) / layout.columns;
  available.forEach((choice, index) => {
    const bounds = {
      x: layout.padding + (index % layout.columns) * (cellWidth + layout.gap),
      y: layout.choiceTop + Math.floor(index / layout.columns) * (layout.choiceCellHeight + layout.gap),
      w: cellWidth,
      h: layout.choiceCellHeight
    };
    if (!dragging && inside(mouseX, mouseY, bounds)) {
      dragging = { choiceId: choice.id, offsetX: mouseX - bounds.x, offsetY: mouseY - bounds.y, width: bounds.w, height: bounds.h };
    }
  });
  return false;
}

function mouseReleased() {
  if (loadState !== "ready") return false;
  const tappedIcon = pressedIconIndex !== null
    && dist(mouseX, mouseY, pressStartX, pressStartY) < 12
    && inside(mouseX, mouseY, iconHitBounds(pressedIconIndex));
  if (tappedIcon) speakQuestion(pressedIconIndex);
  pressedIconIndex = null;

  if (!dragging) return false;
  const destination = questions.findIndex((question, index) => inside(mouseX, mouseY, targetBounds(index)));
  if (destination >= 0) {
    const existingChoiceId = placedChoices[destination];
    const sourceIndex = placedChoices.indexOf(dragging.choiceId);
    if (sourceIndex >= 0) placedChoices[sourceIndex] = existingChoiceId;
    placedChoices[destination] = dragging.choiceId;
  }
  dragging = null;
  return false;
}

function speakQuestion(index) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const question = questions[index];
  const utterance = new SpeechSynthesisUtterance(`叮咚！${question.label}！${question.answer}`);
  const voices = window.speechSynthesis.getVoices();
  const chineseVoice = voices.find((voice) => voice.lang.toLowerCase() === "zh-tw")
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"));
  utterance.lang = "zh-TW";
  if (chineseVoice) utterance.voice = chineseVoice;
  utterance.pitch = 1.3;
  utterance.rate = 0.92;
  utterance.volume = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function inside(x, y, bounds) {
  return bounds && x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
}

function submitQuiz() {
  const correctCount = placedChoices.filter((choiceId, index) => choiceById(choiceId).questionIndex === index).length;
  score = Math.round((correctCount / questions.length) * 100);
  submitted = true;
  if (score > 60) {
    confetti = Array.from({ length: 150 }, () => ({
      x: random(width), y: random(-height, 0), size: random(5, 10),
      speed: random(2, 6), drift: random(-1.5, 1.5), color: random(["#e77856", "#e6bd52", "#5e9a74", "#5e91b8", "#d9789a"]),
      angle: random(TWO_PI), spin: random(-0.08, 0.08)
    }));
  }
}

function drawResult() {
  noStroke();
  fill(37, 53, 46, 190);
  rect(0, 0, width, height);
  fill("#fffefa");
  textSize(layout.compact ? 19 : 25);
  text(score > 60 ? "太棒了，生活小達人！" : "完成挑戰，再接再厲！", width / 2, height / 2 - 64);
  fill("#f2cf72");
  textSize(layout.compact ? 48 : 62);
  text(`${score}%`, width / 2, height / 2 + 2);
  fill("#ffffff");
  textSize(layout.compact ? 15 : 18);
  const correctCount = Math.round((score * questions.length) / 100);
  text(`答對 ${correctCount} / ${questions.length} 題`, width / 2, height / 2 + 54);
  fill("#d7e5d9");
  textSize(layout.compact ? 12 : 14);
  text("按下方按鈕再玩一次", width / 2, height / 2 + 88);
}

function drawConfetti() {
  if (!submitted || score <= 60) return;
  noStroke();
  confetti.forEach((piece) => {
    push();
    translate(piece.x, piece.y);
    rotate(piece.angle);
    fill(piece.color);
    rectMode(CENTER);
    rect(0, 0, piece.size, piece.size * 0.55, 2);
    pop();
    piece.y += piece.speed;
    piece.x += piece.drift;
    piece.angle += piece.spin;
    if (piece.y > height + 12) {
      piece.y = random(-80, -10);
      piece.x = random(width);
    }
  });
}

function resetQuiz() {
  startRound();
  dragging = null;
  submitted = false;
  score = 0;
  confetti = [];
  calculateLayout();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (loadState === "ready") calculateLayout();
}
