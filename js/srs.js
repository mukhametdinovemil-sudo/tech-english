// Умное повторение по «коробкам» (система Лейтнера).
// Знал слово — оно переходит в следующую коробку и появится позже: через 1, 2, 4, 8, 16 дней.
// Не знал — возвращается в первую коробку и появится завтра.
const SRS = (() => {
  const INTERVALS = [0, 1, 2, 4, 8, 16];
  const LEARNED_BOX = 3;      // с этой коробки слово считается выученным
  const NEW_PER_SESSION = 8;  // новых слов за одно занятие
  const MAX_SESSION = 30;     // всего карточек за занятие (~15 минут)

  function today(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function addDays(day, n) {
    const [y, m, d] = day.split('-').map(Number);
    return today(new Date(y, m - 1, d + n));
  }

  function emptyState() {
    return { words: {}, blocks: {}, streak: 0, lastDay: null };
  }

  // Новая запись о слове после ответа. rec — старая запись или undefined для нового слова.
  function answer(rec, ok, day) {
    const box = ok ? Math.min((rec ? rec.box : 0) + 1, INTERVALS.length - 1) : 1;
    return { box, due: addDays(day, INTERVALS[box]) };
  }

  // Карточки на сегодня: сначала слова, которые пора повторить, потом новые.
  function buildSession(state, words, day) {
    const due = words
      .filter(w => state.words[w.id] && state.words[w.id].due <= day)
      .sort((a, b) => state.words[a.id].due.localeCompare(state.words[b.id].due));
    const fresh = words.filter(w => !state.words[w.id]).slice(0, NEW_PER_SESSION);
    return due.concat(fresh).slice(0, MAX_SESSION);
  }

  // Занятие закончено: обновляем счётчик дней подряд.
  function finishDay(state, day) {
    if (state.lastDay === day) return;
    state.streak = state.lastDay === addDays(day, -1) ? state.streak + 1 : 1;
    state.lastDay = day;
  }

  // Сколько дней подряд показывать: если вчера и сегодня не занимался, серия сгорела.
  function currentStreak(state, day) {
    return state.lastDay === day || state.lastDay === addDays(day, -1) ? state.streak : 0;
  }

  function isLearned(state, id) {
    return (state.words[id] ? state.words[id].box : 0) >= LEARNED_BOX;
  }

  return { today, addDays, emptyState, answer, buildSession, finishDay, currentStreak, isLearned };
})();
