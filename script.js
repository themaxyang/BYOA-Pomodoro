const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('start');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

// Add references to new buttons
const toggleModeBtn = document.getElementById('toggle-mode');

// Settings and cycle/phase logic
const openSettingsBtn = document.getElementById('open-settings');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const settingsForm = document.getElementById('settings-form');
const focusInput = document.getElementById('focus-duration');
const shortBreakInput = document.getElementById('short-break');
const longBreakInput = document.getElementById('long-break');
const cyclesInput = document.getElementById('cycles-per-set');
const autoStartInput = document.getElementById('auto-start');
const chimeVolumeInput = document.getElementById('chime-volume');

// Stats logic
const statToday = document.getElementById('stat-today');
const statWeek = document.getElementById('stat-week');
const statStreak = document.getElementById('stat-streak');
const statTotal = document.getElementById('stat-total');

// Task list logic
const toggleTasksBtn = document.getElementById('toggle-tasks');
const taskSidebar = document.getElementById('task-sidebar');
const closeTasksBtn = document.getElementById('close-tasks');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const currentTaskLabel = document.getElementById('current-task-label');

// Theme logic
const themeBtn = document.getElementById('toggle-theme');

// Default settings
const DEFAULTS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  cyclesPerSet: 4,
  autoStart: false,
  chimeVolume: 0.5
};

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('pomodoro-settings') || 'null');
  return { ...DEFAULTS, ...saved };
}
function saveSettings(settings) {
  localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
}

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function getWeekStr() {
  const d = new Date();
  const y = d.getFullYear();
  const oneJan = new Date(y, 0, 1);
  const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  return `${y}-W${week}`;
}
function loadStats() {
  const stats = JSON.parse(localStorage.getItem('pomodoro-stats') || 'null');
  return stats || {
    today: 0,
    week: 0,
    streak: 0,
    total: 0,
    lastDay: getTodayStr()
  };
}
function saveStats(stats) {
  localStorage.setItem('pomodoro-stats', JSON.stringify(stats));
}
function updateStatsCard(stats) {
  statToday.textContent = stats.today;
  statWeek.textContent = stats.week;
  statStreak.textContent = stats.streak;
  statTotal.textContent = stats.total;
}

function loadTasks() {
  return JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]');
}
function saveTasks(tasks) {
  localStorage.setItem('pomodoro-tasks', JSON.stringify(tasks));
}

let settings = loadSettings();
let phase = 'focus'; // 'focus' | 'short_break' | 'long_break'
let cycle = 1;
let totalCycles = settings.cyclesPerSet;
let duration = settings.focus * 60;
let timeLeft = duration;
let timerInterval = null;
let isRunning = false;
let autoStart = settings.autoStart;
let chimeVolume = settings.chimeVolume;
let stats = loadStats();
let tasks = loadTasks();
let currentTaskId = localStorage.getItem('pomodoro-current-task') || '';
updateStatsCard(stats);

const messageDiv = document.querySelector('.message');
const progressArc = document.getElementById('progress-ring-arc');
const RADIUS = 80;
const CIRCUM = 2 * Math.PI * RADIUS;
if (progressArc) progressArc.setAttribute('stroke-dasharray', CIRCUM.toFixed(0));

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
  // Update browser tab title
  let modeLabel = '';
  if (phase === 'focus') modeLabel = 'Focus';
  else if (phase === 'short_break') modeLabel = 'Short Break';
  else modeLabel = 'Long Break';
  document.title = `${minutes}:${seconds} - ${modeLabel}`;
  // Update message
  if (phase === 'focus') messageDiv.textContent = 'Time to focus!';
  else if (phase === 'short_break') messageDiv.textContent = 'Time for a break!';
  else messageDiv.textContent = 'Long break!';
  // Update progress ring (clockwise fill)
  if (progressArc) {
    const percent = 1 - (timeLeft / duration);
    const offset = CIRCUM * (1 - percent);
    progressArc.setAttribute('stroke-dashoffset', offset.toFixed(1));
  }
}

function switchPhase(nextPhase) {
  phase = nextPhase;
  if (phase === 'focus') {
    duration = settings.focus * 60;
    timeLeft = duration;
    toggleModeBtn.textContent = 'Rest Mode';
    toggleModeBtn.classList.remove('rest-mode');
    toggleModeBtn.classList.add('work-mode');
  } else if (phase === 'short_break') {
    duration = settings.shortBreak * 60;
    timeLeft = duration;
    toggleModeBtn.textContent = 'Work Mode';
    toggleModeBtn.classList.remove('work-mode');
    toggleModeBtn.classList.add('rest-mode');
  } else {
    duration = settings.longBreak * 60;
    timeLeft = duration;
    toggleModeBtn.textContent = 'Work Mode';
    toggleModeBtn.classList.remove('work-mode');
    toggleModeBtn.classList.add('rest-mode');
  }
  updateDisplay();
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = chimeVolume * 0.2;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 350);
  } catch (e) {}
}

function notifyPhaseChange() {
  let title = '';
  let body = '';
  if (phase === 'focus') {
    title = 'Focus Time!';
    body = 'Time to focus.';
  } else if (phase === 'short_break') {
    title = 'Short Break!';
    body = 'Take a short break.';
  } else {
    title = 'Long Break!';
    body = 'Enjoy your long break!';
  }
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (window.Notification && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  } else {
    // fallback
    // alert(title + '\n' + body);
  }
}

function onFocusComplete() {
  const todayStr = getTodayStr();
  const weekStr = getWeekStr();
  // Reset daily/weekly if needed
  if (stats.lastDay !== todayStr) {
    stats.streak = (stats.lastDay === (new Date(Date.now() - 86400000)).toISOString().slice(0, 10)) ? stats.streak + 1 : 1;
    stats.today = 0;
    stats.lastDay = todayStr;
  }
  stats.today++;
  if (stats.lastWeek !== weekStr) {
    stats.week = 0;
    stats.lastWeek = weekStr;
  }
  stats.week++;
  stats.total += settings.focus;
  saveStats(stats);
  updateStatsCard(stats);
}

function nextPhase() {
  if (phase === 'focus') {
    if (cycle < settings.cyclesPerSet) {
      switchPhase('short_break');
    } else {
      switchPhase('long_break');
    }
    onFocusComplete();
  } else {
    if (phase === 'short_break') {
      cycle++;
      switchPhase('focus');
    } else {
      cycle = 1;
      switchPhase('focus');
    }
  }
  playChime();
  notifyPhaseChange();
  if (autoStart) {
    startTimer();
  }
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateDisplay();
    } else {
      clearInterval(timerInterval);
      isRunning = false;
      nextPhase();
      updateDisplay();
      // TODO: autoStart, sound, notification
    }
  }, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timerInterval);
}

function resetTimer() {
  pauseTimer();
  if (phase === 'focus') duration = settings.focus * 60;
  else if (phase === 'short_break') duration = settings.shortBreak * 60;
  else duration = settings.longBreak * 60;
  timeLeft = duration;
  updateDisplay();
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

toggleModeBtn.addEventListener('click', () => {
  pauseTimer();
  if (phase === 'focus') {
    switchPhase('short_break');
  } else {
    switchPhase('focus');
  }
});

// Settings modal logic
openSettingsBtn.addEventListener('click', () => {
  focusInput.value = settings.focus;
  shortBreakInput.value = settings.shortBreak;
  longBreakInput.value = settings.longBreak;
  cyclesInput.value = settings.cyclesPerSet;
  autoStartInput.checked = settings.autoStart;
  chimeVolumeInput.value = settings.chimeVolume;
  settingsModal.style.display = 'flex';
});
closeSettingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  settings = {
    focus: parseInt(focusInput.value, 10),
    shortBreak: parseInt(shortBreakInput.value, 10),
    longBreak: parseInt(longBreakInput.value, 10),
    cyclesPerSet: parseInt(cyclesInput.value, 10),
    autoStart: autoStartInput.checked,
    chimeVolume: parseFloat(chimeVolumeInput.value)
  };
  autoStart = settings.autoStart;
  chimeVolume = settings.chimeVolume;
  saveSettings(settings);
  cycle = 1;
  switchPhase('focus');
  settingsModal.style.display = 'none';
});

document.addEventListener('keydown', e => {
  // Task sidebar close
  if (e.key === 'Escape' && taskSidebar.style.display === 'flex') {
    taskSidebar.style.display = 'none';
  }
  // Settings modal close
  if (e.key === 'Escape' && settingsModal.style.display === 'flex') {
    settingsModal.style.display = 'none';
  }
  // Keyboard shortcuts (ignore if in input/modal)
  const active = document.activeElement;
  const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  if (inInput || settingsModal.style.display === 'flex' || taskSidebar.style.display === 'flex') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (isRunning) pauseTimer(); else startTimer();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
    e.preventDefault();
    // Skip back: go to previous phase
    if (phase === 'focus' && cycle > 1) {
      cycle--;
      switchPhase('focus');
    } else if (phase === 'short_break') {
      switchPhase('focus');
    } else if (phase === 'long_break') {
      switchPhase('focus');
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
    e.preventDefault();
    // Skip forward: go to next phase
    nextPhase();
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    openSettingsBtn.click();
  }
});

// Initial setup
switchPhase('focus');
updateDisplay();

// Request notification permission on first load
if (window.Notification && Notification.permission === 'default') {
  Notification.requestPermission();
}

function renderTasks() {
  taskList.innerHTML = '';
  tasks.forEach(task => {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!task.done;
    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      saveTasks(tasks);
      renderTasks();
    });
    const span = document.createElement('span');
    span.textContent = task.text;
    span.className = 'task-text' + (task.done ? ' done' : '');
    const currentBtn = document.createElement('button');
    currentBtn.textContent = 'Current';
    currentBtn.className = 'current-btn' + (task.id === currentTaskId ? ' active' : '');
    currentBtn.addEventListener('click', () => {
      currentTaskId = task.id;
      localStorage.setItem('pomodoro-current-task', currentTaskId);
      renderTasks();
      renderCurrentTaskLabel();
    });
    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(currentBtn);
    taskList.appendChild(li);
  });
}
function renderCurrentTaskLabel() {
  const task = tasks.find(t => t.id === currentTaskId);
  currentTaskLabel.textContent = task && !task.done ? `Current: ${task.text}` : '';
}
toggleTasksBtn.addEventListener('click', () => {
  taskSidebar.style.display = 'flex';
});
closeTasksBtn.addEventListener('click', () => {
  taskSidebar.style.display = 'none';
});
taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  tasks.push({ id, text, done: false });
  saveTasks(tasks);
  taskInput.value = '';
  renderTasks();
});
renderTasks();
renderCurrentTaskLabel();

// Theme logic
function setTheme(dark) {
  document.body.classList.toggle('dark', dark);
  themeBtn.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('pomodoro-theme', dark ? 'dark' : 'light');
}
function getSystemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function loadTheme() {
  const saved = localStorage.getItem('pomodoro-theme');
  if (saved) return saved === 'dark';
  return getSystemPrefersDark();
}
themeBtn.addEventListener('click', () => {
  setTheme(!document.body.classList.contains('dark'));
});
setTheme(loadTheme()); 