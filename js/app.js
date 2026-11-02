// Экраны приложения: главная → занятие (карточки) → мини-тест → итог → (большой тест по блоку → итог).
const STORE_KEY = 'techeng-v1';
const $ = id => document.getElementById(id);

let state = load();
let queue = [];        // карточки занятия: { w, retry }
let lessonWords = [];  // слова этого занятия — для мини-теста
let total = 0;         // сколько разных слов в занятии
let knew = 0;          // сколько из них знал с первого раза
let quiz = null;       // идущий тест: { type: 'small' | 'big', block, questions, i, right }

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.words) return Object.assign(SRS.emptyState(), s);
  } catch (e) { /* испорченные данные — начинаем заново */ }
  return SRS.emptyState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* нет места или приватный режим */ }
}

function show(screenId) {
  for (const id of ['home', 'session', 'quiz', 'done']) $(id).hidden = id !== screenId;
  window.scrollTo(0, 0);
}

// ---------- Главная ----------

function renderHome() {
  const day = SRS.today();
  const learned = WORDS.filter(w => SRS.isLearned(state, w.id)).length;
  $('streak').textContent = SRS.currentStreak(state, day);
  $('learned').textContent = learned;
  $('learned-of').textContent = `из ${WORDS.length} выучено`;
  $('bar-fill').style.width = `${learned / WORDS.length * 100}%`;

  const cards = SRS.buildSession(state, WORDS, day);
  const fresh = cards.filter(w => !state.words[w.id]).length;
  const review = cards.length - fresh;
  $('start').disabled = cards.length === 0;
  $('start-info').textContent = cards.length === 0
    ? 'На сегодня всё. Приходи завтра!'
    : [review && `повторить: ${review}`, fresh && `новых: ${fresh}`].filter(Boolean).join(' · ');

  setBigButton($('home-big'), 'Сдать блок');

  const allBlocks = QUIZ.blocks(WORDS);
  $('topics').replaceChildren(...TOPICS.map(t => {
    const words = WORDS.filter(w => w.topic === t.id);
    const tBlocks = allBlocks.filter(b => b.topic === t.id);
    const li = document.createElement('li');
    const name = document.createElement('span');
    const sub = document.createElement('small');
    const pct = document.createElement('span');
    name.textContent = t.title;
    sub.className = 'blocks';
    sub.textContent = `блоков сдано: ${tBlocks.filter(b => QUIZ.isPassed(state, b)).length} из ${tBlocks.length}`;
    name.append(sub);
    pct.className = 'pct';
    pct.textContent = `${Math.round(words.filter(w => SRS.isLearned(state, w.id)).length / words.length * 100)}%`;
    li.append(name, pct);
    return li;
  }));
  show('home');
}

// Кнопка большого теста: видна, если есть блок, где все слова пройдены, а тест не сдан
function setBigButton(btn, label) {
  const b = QUIZ.pendingBlocks(state, WORDS)[0];
  btn.hidden = !b;
  if (b) {
    btn.textContent = `${label} «${b.title}»`;
    btn.onclick = () => startBig(b);
  }
}

// ---------- Занятие на карточках ----------

function startSession() {
  queue = SRS.buildSession(state, WORDS, SRS.today()).map(w => ({ w, retry: false }));
  lessonWords = queue.map(q => q.w);
  total = queue.length;
  knew = 0;
  if (!total) return;
  show('session');
  showCard();
}

function showCard() {
  const { w } = queue[0];
  const answered = total - queue.filter(q => !q.retry).length;
  $('card-tag').textContent = w.group;
  $('card-new').hidden = !!state.words[w.id];
  $('card-en').textContent = w.en;
  $('card-ru').textContent = w.ru;
  $('card-ru').hidden = true;
  $('show').hidden = false;
  $('grade').hidden = true;
  $('left').textContent = `осталось ${queue.length}`;
  $('sess-fill').style.width = `${answered / total * 100}%`;
  speak(w.en);
}

function reveal() {
  $('card-ru').hidden = false;
  $('show').hidden = true;
  $('grade').hidden = false;
}

function grade(ok) {
  const item = queue.shift();
  if (!item.retry) {
    state.words[item.w.id] = SRS.answer(state.words[item.w.id], ok, SRS.today());
    if (ok) knew++;
    save();
  }
  // Не знал — слово вернётся ещё раз в конце занятия
  if (!ok) queue.push({ w: item.w, retry: true });
  if (queue.length) {
    showCard();
  } else {
    // День засчитан, как только пройдены карточки; дальше мини-тест
    SRS.finishDay(state, SRS.today());
    save();
    startQuiz('small', QUIZ.smallTest(lessonWords, state, WORDS));
  }
}

// ---------- Тесты ----------

function startBig(block) {
  startQuiz('big', QUIZ.bigTest(block.words, WORDS), block);
}

function startQuiz(type, questions, block = null) {
  quiz = { type, block, questions, i: 0, right: 0 };
  $('quiz-title').textContent = type === 'small' ? 'Мини-тест по занятию' : `Большой тест: «${block.title}»`;
  show('quiz');
  showQuestion();
}

const ASK = {
  'en-ru': 'Выбери перевод',
  'ru-en': 'Выбери английское слово',
  'type': 'Напиши по-английски',
};

function showQuestion() {
  const q = quiz.questions[quiz.i];
  const enShown = q.kind === 'en-ru';
  $('quiz-ask').textContent = ASK[q.kind];
  $('quiz-word').textContent = enShown ? q.w.en : q.w.ru;
  $('quiz-say').hidden = !enShown || !('speechSynthesis' in window);
  $('quiz-left').textContent = `${quiz.i + 1} из ${quiz.questions.length}`;
  $('quiz-fill').style.width = `${quiz.i / quiz.questions.length * 100}%`;
  $('quiz-feedback').hidden = true;
  $('quiz-next').hidden = true;

  $('quiz-form').hidden = q.kind !== 'type';
  $('quiz-options').hidden = q.kind === 'type';
  if (q.kind === 'type') {
    $('quiz-input').value = '';
    $('quiz-input').disabled = false;
    $('quiz-form').querySelector('button').hidden = false;
    $('quiz-input').focus();
  } else {
    $('quiz-options').replaceChildren(...q.options.map(opt => {
      const b = document.createElement('button');
      b.textContent = opt;
      b.onclick = () => choose(b, opt);
      return b;
    }));
  }
  if (enShown) speak(q.w.en);
}

function choose(btn, opt) {
  const q = quiz.questions[quiz.i];
  const ok = opt === q.answer;
  for (const b of $('quiz-options').children) {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('right');
  }
  if (!ok) btn.classList.add('wrong');
  answered(ok, ok ? 'Верно!' : `Неверно. Правильно: ${q.answer}`);
}

function submitTyped(e) {
  e.preventDefault();
  const q = quiz.questions[quiz.i];
  if ($('quiz-input').disabled || !$('quiz-input').value.trim()) return;
  const res = QUIZ.checkTyped($('quiz-input').value, q.answer);
  $('quiz-input').disabled = true;
  $('quiz-form').querySelector('button').hidden = true;
  answered(res !== 'wrong', {
    ok: 'Верно!',
    typo: `Почти! Пишется так: ${q.answer}`,
    wrong: `Неверно. Правильно: ${q.answer}`,
  }[res]);
}

function answered(ok, text) {
  const q = quiz.questions[quiz.i];
  if (ok) quiz.right++;
  // Ошибка в тесте — слово вернётся на повторение завтра
  else state.words[q.w.id] = SRS.answer(state.words[q.w.id], false, SRS.today());
  save();
  $('quiz-feedback').textContent = text;
  $('quiz-feedback').className = `feedback ${ok ? 'good' : 'bad'}`;
  $('quiz-feedback').hidden = false;
  $('quiz-next').hidden = false;
  $('quiz-next').focus();
  if (q.kind !== 'en-ru') speak(q.w.en);
}

function nextQuestion() {
  quiz.i++;
  if (quiz.i < quiz.questions.length) showQuestion(); else finishQuiz();
}

function finishQuiz() {
  const n = quiz.questions.length;
  const lines = [];
  let title, passed = true;
  if (quiz.type === 'small') {
    title = 'Занятие закончено!';
    lines.push(`Карточки: знал сразу ${knew} из ${total}`, `Мини-тест: ${quiz.right} из ${n}`);
  } else {
    const pct = QUIZ.recordBig(state, quiz.block, quiz.right);
    passed = QUIZ.isPassed(state, quiz.block);
    save();
    title = passed ? `Блок «${quiz.block.title}» сдан! 🎉` : `Блок «${quiz.block.title}» пока не сдан`;
    lines.push(`Правильно: ${quiz.right} из ${n} (${pct}%)`);
    if (!passed) lines.push(`Нужно ${QUIZ.PASS * 100}%. Слова с ошибками повторишь завтра, пересдать можно с главной.`);
  }
  lines.push(`Дней подряд: ${SRS.currentStreak(state, SRS.today())} 🔥`);
  $('done-title').textContent = title;
  $('done-icon').textContent = passed ? '✓' : '↻';
  $('done-icon').classList.toggle('fail', !passed);
  $('done-text').replaceChildren(...lines.flatMap((l, i) => i ? [document.createElement('br'), l] : [l]));
  setBigButton($('done-big'), 'Большой тест:');
  quiz = null;
  show('done');
}

// ---------- Озвучка встроенным голосом браузера ----------

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  u.voice = voices.find(v => /^en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
  u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

// ---------- Кнопки ----------

$('start').onclick = startSession;
$('show').onclick = reveal;
$('yes').onclick = () => grade(true);
$('no').onclick = () => grade(false);
$('say').onclick = () => speak(queue[0].w.en);
$('quit').onclick = renderHome;
$('quiz-quit').onclick = renderHome;
$('quiz-say').onclick = () => speak(quiz.questions[quiz.i].w.en);
$('quiz-form').onsubmit = submitTyped;
$('quiz-next').onclick = nextQuestion;
$('home-btn').onclick = renderHome;
if (!('speechSynthesis' in window)) $('say').hidden = true;

renderHome();

// Для снимков экрана при проверке: index.html#start, #show, #quiz, #type, #done
const demo = location.hash.slice(1);
if (demo === 'start' || demo === 'show') {
  startSession();
  if (demo === 'show') reveal();
} else if (demo === 'quiz') {
  startQuiz('small', [QUIZ.question(WORDS[0], 'en-ru', WORDS)]);
} else if (demo === 'type') {
  startQuiz('small', [QUIZ.question(WORDS[3], 'type', WORDS)]);
  $('quiz-input').value = 'natural gaz';
  $('quiz-form').requestSubmit();
} else if (demo === 'done') {
  const block = QUIZ.blocks(WORDS)[0];
  block.words.forEach(w => { state.words[w.id] = { box: 1, due: SRS.today() }; });
  startQuiz('small', [QUIZ.question(WORDS[0], 'en-ru', WORDS)]);
  finishQuiz();
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js');
}
