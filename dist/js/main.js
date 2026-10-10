import { createLakeScene, imageToWorld } from "./lake-scene.js";
import {
  chapters,
  discoveries,
  sources,
  factRows,
  timeline,
} from "./content.js";

/* Main application: normal document scrolling drives the camera.
   No scroll hijacking. All buttons work with touch and keyboard. */
const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = {
  progress: 0,
  smoothedProgress: 0,
  chapter: -1,
  overview: false,
  activeNote: null,
};
let saved = new Set();
try {
  saved = new Set(JSON.parse(localStorage.getItem("vad-notebook") || "[]"));
} catch {
  /* Storage may be unavailable in private browsing. */
}

function sourceLinks(ids) {
  const holder = document.createElement("div");
  holder.className = "source-links";
  ids.forEach((id) => {
    const a = document.createElement("a");
    a.href = sources[id].url;
    a.textContent = sources[id].name + " ↗";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    holder.append(a);
  });
  return holder;
}

// Add the source link below each chapter instead of burying attribution.
const chapterSource = document.createElement("div");
chapterSource.className = "chapter-source";
$("#chapter-card").append(chapterSource);
const chapterFact = document.createElement("div");
chapterFact.className = "chapter-fact";
$("#chapter-description").after(chapterFact);
const detailSources = document.createElement("div");
$("#save-button").before(detailSources);
const detailBody = $("#detail-description");
detailBody.remove();
const paragraphs = document.createElement("div");
$("#detail-title").after(paragraphs);
$(".sample-note").textContent =
  "Тематические метки размещены условно и не являются точками геодезической съёмки.";

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 2400);
}
function persistNotebook() {
  try {
    localStorage.setItem("vad-notebook", JSON.stringify([...saved]));
  } catch {
    toast("Сохранено на время посещения. Хранилище браузера недоступно.");
  }
  $("#saved-count").textContent = saved.size;
  pinButtons.forEach(({ note, button }) =>
    button.classList.toggle("is-saved", saved.has(note.id)),
  );
}

let previousFocus;
function closePanels() {
  document
    .querySelectorAll(".side-panel")
    .forEach((panel) => (panel.hidden = true));
  $("#panel-backdrop").hidden = true;
  document.body.classList.remove("panel-open");
  previousFocus?.focus();
}
function showPanel(panel) {
  closePanels();
  previousFocus = document.activeElement;
  panel.hidden = false;
  $("#panel-backdrop").hidden = false;
  document.body.classList.add("panel-open");
  panel.querySelector("button").focus();
}
function updateSaveButton() {
  const isSaved = saved.has(state.activeNote.id);
  $("#save-button").textContent = isSaved
    ? "Убрать из заметок −"
    : "Сохранить в заметки ＋";
  $("#save-button").setAttribute("aria-pressed", String(isSaved));
}
function openDiscovery(note) {
  state.activeNote = note;
  $("#detail-title").textContent = note.title;
  $("#detail-category").textContent = note.category;
  $("#detail-number").textContent = String(
    discoveries.indexOf(note) + 1,
  ).padStart(2, "0");
  paragraphs.replaceChildren(
    ...note.paragraphs.map((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }),
  );
  $("#detail-prompt").textContent = note.prompt;
  detailSources.replaceChildren(sourceLinks(note.sources));
  updateSaveButton();
  showPanel($("#detail-panel"));
}

// World-anchored HTML buttons keep map points accessible without raycasting.
const pinButtons = discoveries.map((note, index) => {
  const button = document.createElement("button");
  button.className = "map-pin";
  button.setAttribute("aria-label", `Узнать: ${note.title}`);
  const dot = document.createElement("span");
  dot.className = "pin-dot";
  dot.textContent = String(index + 1).padStart(2, "0");
  const name = document.createElement("span");
  name.className = "pin-name";
  name.textContent = note.title;
  button.append(dot, name);
  button.addEventListener("click", () => openDiscovery(note));
  $("#pin-layer").append(button);
  return { note, button, world: imageToWorld(note.pixel) };
});
persistNotebook();

function goToChapter(index) {
  if (state.overview) toggleOverview();
  const maximumScroll = document.documentElement.scrollHeight - innerHeight;
  window.scrollTo({
    top: (maximumScroll * index) / (chapters.length - 1),
    behavior: reducedMotion ? "instant" : "smooth",
  });
}
const navButtons = chapters.map((chapter, index) => {
  const button = document.createElement("button");
  button.textContent = String(index + 1).padStart(2, "0");
  button.title = chapter.short;
  button.setAttribute("aria-label", `Глава ${index + 1}: ${chapter.short}`);
  button.addEventListener("click", () => goToChapter(index));
  $("#chapter-nav").append(button);
  return button;
});
function updateChapter(index) {
  state.chapter = index;
  const chapter = chapters[index];
  $("#chapter-number").textContent =
    `${String(index + 1).padStart(2, "0")} / 06`;
  // Only this hand-authored title uses HTML for intentional line breaks.
  $("#chapter-title").innerHTML = chapter.title;
  $("#chapter-description").textContent = chapter.description;
  chapterFact.textContent = chapter.fact;
  chapterSource.replaceChildren(sourceLinks([chapter.source]));
  $("#next-button").innerHTML =
    index === 5
      ? "Открыть справочник <span>↗</span>"
      : "Продолжить прогулку <span>↓</span>";
  navButtons.forEach((button, i) => {
    button.classList.toggle("active", i === index);
    if (i === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}
$("#next-button").addEventListener("click", () =>
  state.chapter === 5 ? openGuide() : goToChapter(state.chapter + 1),
);
$(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  goToChapter(0);
});
function toggleOverview() {
  state.overview = !state.overview;
  document.body.classList.toggle("overview", state.overview);
  $("#overview-button").setAttribute("aria-pressed", String(state.overview));
  $("#overview-button").innerHTML = state.overview
    ? "К путешествию <span>↙</span>"
    : "Вся карта <span>↗</span>";
  $("#scroll-hint").textContent = state.overview
    ? "ВЕСЬ ЛАНДШАФТ"
    : "ПРОКРУТИТЕ ДЛЯ ПРОГУЛКИ";
}
$("#overview-button").addEventListener("click", toggleOverview);
$("#save-button").addEventListener("click", () => {
  const id = state.activeNote.id;
  saved.has(id) ? saved.delete(id) : saved.add(id);
  persistNotebook();
  updateSaveButton();
  toast(
    saved.has(id) ? "Добавлено в ваши заметки" : "Удалено из ваших заметок",
  );
});
$("#notebook-button").addEventListener("click", () => {
  const list = $("#notebook-list");
  list.replaceChildren();
  if (!saved.size) {
    const p = document.createElement("p");
    p.textContent =
      "Здесь пока пусто. Нажмите на пронумерованную точку на карте и сохраните её историю.";
    list.append(p);
  }
  discoveries
    .filter((note) => saved.has(note.id))
    .forEach((note) => {
      const button = document.createElement("button");
      button.className = "notebook-item";
      const number = document.createElement("span");
      number.textContent = String(discoveries.indexOf(note) + 1).padStart(
        2,
        "0",
      );
      const title = document.createElement("strong");
      title.textContent = note.title;
      button.append(number, title, "↗");
      button.onclick = () => openDiscovery(note);
      list.append(button);
    });
  showPanel($("#notebook-panel"));
});
$("#close-detail").onclick = closePanels;
$("#close-notebook").onclick = closePanels;
$("#panel-backdrop").onclick = closePanels;

// A compact reference guide collects the facts, uncertainties and original sources.
const guide = document.createElement("aside");
guide.id = "guide-panel";
guide.className = "side-panel guide-panel";
guide.hidden = true;
guide.setAttribute("role", "dialog");
guide.setAttribute("aria-modal", "true");
guide.setAttribute("aria-labelledby", "guide-title");
guide.innerHTML =
  '<button class="close-button" aria-label="Закрыть справочник">×</button><span class="panel-eyebrow">СПРАВОЧНИК</span><h2 id="guide-title">Взглянем внимательнее<br>на Вадское озеро.</h2><p>География, гидрология, природа и история озера — с подтверждающими источниками.</p><h3>Озеро в цифрах</h3>';
guide.querySelector("button").onclick = closePanels;
const table = document.createElement("table");
const tbody = document.createElement("tbody");
factRows.forEach(([name, value, ...ids]) => {
  const row = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = name;
  const td = document.createElement("td");
  td.textContent = value;
  td.append(sourceLinks(ids));
  row.append(th, td);
  tbody.append(row);
});
table.append(tbody);
guide.append(table);
function guideHeading(text) {
  const h = document.createElement("h3");
  h.textContent = text;
  guide.append(h);
}
guideHeading("Краткая история");
timeline.forEach(([date, text, id]) => {
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = date + " — ";
  p.append(strong, text, sourceLinks([id]));
  guide.append(p);
});
guideHeading("Все познавательные заметки");
const search = document.createElement("input");
search.type = "search";
search.placeholder = "Источники, птицы, история…";
search.setAttribute("aria-label", "Поиск по заметкам");
guide.append(search);
const noteIndex = document.createElement("div");
guide.append(noteIndex);
function renderNoteIndex() {
  noteIndex.replaceChildren();
  const notes = discoveries.filter((note) =>
    (note.title + " " + note.category + " " + note.paragraphs.join(" "))
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  );
  if (!notes.length) {
    const p = document.createElement("p");
    p.textContent = "Совпадений нет. Попробуйте другое слово.";
    noteIndex.append(p);
  }
  notes.forEach((note) => {
    const button = document.createElement("button");
    button.className = "notebook-item";
    button.textContent = note.title + " ↗";
    button.onclick = () => openDiscovery(note);
    noteIndex.append(button);
  });
}
search.oninput = renderNoteIndex;
renderNoteIndex();
guideHeading("Источники и пояснения");
const editorial = document.createElement("p");
editorial.textContent =
  "Источники проверены 10 октября 2026 года. Исторические наблюдения сопровождаются датами. Статья Руниверсалиса по предоставленной ссылке вернула ошибку доступа 403 и не использована как подтверждение. Ссылка сохранена ниже. Нынешняя доступность пещеры, работа туристических объектов и качество воды не подтверждены.";
guide.append(editorial);
Object.entries(sources).forEach(([id, source]) => {
  const block = document.createElement("div");
  block.className = "source-entry";
  block.append(sourceLinks([id]));
  const p = document.createElement("p");
  p.textContent = source.type;
  block.append(p);
  guide.append(block);
});
guideHeading("Об этой карте");
const about = document.createElement("p");
about.textContent =
  "В основе сайта — созданная ранее трёхмерная модель. Контур озера обведён по исходному изображению, небольшие перепады высоты сгенерированы. Здания, деревья, глубины и расположение тематических меток условны. Карта не является результатом геодезической съёмки.";
guide.append(about);
document.body.append(guide);
const guideButton = document.createElement("button");
guideButton.id = "guide-button";
guideButton.textContent = "Справочник ↗";
$(".topbar nav").prepend(guideButton);
guideButton.onclick = openGuide;
function openGuide() {
  showPanel(guide);
}

// Modal keyboard behavior and keyboard chapter shortcuts.
document.addEventListener("keydown", (event) => {
  const panel = [...document.querySelectorAll(".side-panel")].find(
    (p) => !p.hidden,
  );
  if (event.key === "Escape") {
    closePanels();
    return;
  }
  if (panel && event.key === "Tab") {
    const items = [...panel.querySelectorAll("button,a[href],input")];
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (panel || /INPUT|TEXTAREA|BUTTON|A/.test(event.target.tagName)) return;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    goToChapter(Math.min(5, state.chapter + 1));
  }
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    goToChapter(Math.max(0, state.chapter - 1));
  }
});

function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  state.progress = Math.max(0, Math.min(1, scrollY / Math.max(1, max)));
}
window.addEventListener("scroll", updateScroll, { passive: true });
window.addEventListener("resize", updateScroll);
updateScroll();
updateChapter(0);

let lake;
try {
  lake = createLakeScene(
    $("#scene"),
    (percent) =>
      ($("#loading-progress").textContent = `Загружаем ландшафт · ${percent}%`),
  );
} catch (error) {
  console.error(error);
  $("#loading").hidden = true;
  $("#error").hidden = false;
}
if (lake) {
  lake.ready
    .then(() => {
      $("#loading").classList.add("done");
      setTimeout(() => ($("#loading").hidden = true), 700);
    })
    .catch((error) => {
      console.error(error);
      $("#loading").hidden = true;
      $("#error").hidden = false;
    });
  let lastTime = 0;
  function animate(milliseconds) {
    const delta = Math.min((milliseconds - lastTime) / 1000, 0.1);
    lastTime = milliseconds;
    state.smoothedProgress = reducedMotion
      ? state.progress
      : state.smoothedProgress +
        (state.progress - state.smoothedProgress) * (1 - Math.exp(-8 * delta));
    const position = state.smoothedProgress * (chapters.length - 1);
    const i = Math.min(4, Math.floor(position));
    const t = position - i;
    const start = chapters[i],
      end = chapters[i + 1];
    lake.render(
      {
        x: start.x + (end.x - start.x) * t,
        z: start.z + (end.z - start.z) * t,
        overview: state.overview,
      },
      milliseconds / 1000,
    );
    const index = Math.min(5, Math.floor(position + 0.45));
    if (index !== state.chapter) updateChapter(index);
    const percent = Math.round(state.progress * 100);
    $("#progress-value").textContent = String(percent).padStart(2, "0") + "%";
    $("#progress-fill").style.width = percent + "%";
    pinButtons.forEach(({ note, button, world }) => {
      const p = lake.project(world);
      const relevant =
        state.overview || Math.abs(note.chapter - state.chapter) <= 1;
      // Keep points clear of the left text card on desktop and mobile bottom card.
      const frame = lake.container;
      const card = $("#chapter-card").getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      const screenX = bounds.left + p.x,
        screenY = bounds.top + p.y;
      const overlaps =
        !state.overview &&
        screenX > card.left - 30 &&
        screenX < card.right + 80 &&
        screenY > card.top - 20 &&
        screenY < card.bottom + 20;
      button.classList.toggle("hidden", !p.visible || !relevant || overlaps);
      button.style.left = p.x + "px";
      button.style.top = p.y + "px";
    });
    const label = lake.project(imageToWorld([730, 320]));
    $("#water-label").style.left = label.x + "px";
    $("#water-label").style.top = label.y + "px";
    $("#water-label").style.visibility = label.visible ? "visible" : "hidden";
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
