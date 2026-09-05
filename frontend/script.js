// ─── Config ───────────────────────────────────────────────────────────────────
// 👇 Change this to your Render backend URL after deployment
const API_URL = 'http://localhost:3000/summarize';

// ─── DOM References ───────────────────────────────────────────────────────────
const inputText     = document.getElementById('inputText');
const wordCountEl   = document.getElementById('wordCount');
const charCountEl   = document.getElementById('charCount');
const clearBtn      = document.getElementById('clearBtn');
const summarizeBtn  = document.getElementById('summarizeBtn');
const btnText       = document.getElementById('btnText');
const btnLoader     = document.getElementById('btnLoader');
const errorBox      = document.getElementById('errorBox');
const errorMsg      = document.getElementById('errorMsg');
const outputSection = document.getElementById('outputSection');
const summaryText   = document.getElementById('summaryText');
const statsRow      = document.getElementById('statsRow');
const themeToggle   = document.getElementById('themeToggle');
const themeIcon     = document.getElementById('themeIcon');
const historySection= document.getElementById('historySection');
const historyList   = document.getElementById('historyList');

// ─── State ────────────────────────────────────────────────────────────────────
let summaryHistory = JSON.parse(localStorage.getItem('summaryHistory') || '[]');
let currentSummary = '';

// ─── Dark / Light Mode ────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') {
    document.body.classList.add('light');
    themeIcon.textContent = '☀️';
  }
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  themeIcon.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// ─── Word / Char Counter ──────────────────────────────────────────────────────
inputText.addEventListener('input', () => {
  const text  = inputText.value;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  charCountEl.textContent = `${text.length} character${text.length !== 1 ? 's' : ''}`;
});

// ─── Clear Input ──────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  inputText.value = '';
  wordCountEl.textContent = '0 words';
  charCountEl.textContent = '0 characters';
  inputText.focus();
  hideError();
});

// ─── Summarize ────────────────────────────────────────────────────────────────
summarizeBtn.addEventListener('click', summarize);

// Also allow Ctrl+Enter to submit
inputText.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') summarize();
});

async function summarize() {
  const text   = inputText.value.trim();
  const length = document.getElementById('summaryLength').value;
  const tone   = document.getElementById('summaryTone').value;

  // Validate
  if (!text) {
    showError('Please paste some text before summarizing.');
    return;
  }

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 20) {
    showError(`Your text is only ${wordCount} words. Please provide at least 20 words.`);
    return;
  }

  // UI: loading state
  setLoading(true);
  hideError();
  outputSection.classList.add('hidden');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, length, tone }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }

    // Display summary
    currentSummary = data.summary;
    summaryText.textContent = data.summary;

    // Display stats chips
    if (data.stats) {
      statsRow.innerHTML = `
        <span class="stat-chip">↓ ${data.stats.reduction} shorter</span>
        <span class="stat-chip">${data.stats.inputWords} → ${data.stats.outputWords} words</span>
      `;
    }

    outputSection.classList.remove('hidden');
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Save to history
    saveToHistory(text, data.summary, data.stats, length, tone);

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function setLoading(loading) {
  summarizeBtn.disabled = loading;
  btnText.textContent   = loading ? 'Summarizing...' : 'Summarize →';
  btnLoader.classList.toggle('hidden', !loading);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.classList.add('hidden');
}

function resetOutput() {
  outputSection.classList.add('hidden');
  inputText.focus();
}

// ─── Copy to Clipboard ────────────────────────────────────────────────────────
async function copyToClipboard() {
  if (!currentSummary) return;
  try {
    await navigator.clipboard.writeText(currentSummary);
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
  } catch {
    alert('Copy failed. Please select the text manually.');
  }
}

// ─── Download Summary ─────────────────────────────────────────────────────────
function downloadSummary() {
  if (!currentSummary) return;
  const blob = new Blob([currentSummary], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'summary.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── History ──────────────────────────────────────────────────────────────────
function saveToHistory(originalText, summary, stats, length, tone) {
  const entry = {
    id:        Date.now(),
    date:      new Date().toLocaleString(),
    preview:   summary.slice(0, 120) + (summary.length > 120 ? '...' : ''),
    summary,
    stats,
    length,
    tone,
    words:     originalText.trim().split(/\s+/).length,
  };

  summaryHistory.unshift(entry);
  if (summaryHistory.length > 10) summaryHistory.pop(); // keep last 10
  localStorage.setItem('summaryHistory', JSON.stringify(summaryHistory));
  renderHistory();
}

function renderHistory() {
  if (summaryHistory.length === 0) {
    historySection.style.display = 'none';
    return;
  }

  historySection.style.display = 'block';
  historyList.innerHTML = summaryHistory.map(entry => `
    <div class="history-item" onclick="loadFromHistory(${entry.id})">
      <div class="history-meta">
        <span>${entry.date}</span>
        <span>${entry.words} words → ${entry.stats?.outputWords || '?'} words</span>
        <span>${entry.length} · ${entry.tone}</span>
      </div>
      <div class="history-preview">${entry.preview}</div>
    </div>
  `).join('');
}

function loadFromHistory(id) {
  const entry = summaryHistory.find(e => e.id === id);
  if (!entry) return;

  currentSummary = entry.summary;
  summaryText.textContent = entry.summary;

  if (entry.stats) {
    statsRow.innerHTML = `
      <span class="stat-chip">↓ ${entry.stats.reduction} shorter</span>
      <span class="stat-chip">${entry.stats.inputWords} → ${entry.stats.outputWords} words</span>
    `;
  }

  outputSection.classList.remove('hidden');
  outputSection.scrollIntoView({ behavior: 'smooth' });
}

function clearHistory() {
  summaryHistory = [];
  localStorage.removeItem('summaryHistory');
  historySection.style.display = 'none';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
initTheme();
renderHistory();