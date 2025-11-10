// small project data stored in browser so user data persists
const LS_KEY = "habitflow_data_v3";
let state = { habits: [], expenses: [] };

// try to load saved data from localStorage
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    state = { habits: [], expenses: [] };
  }
}

// simple debounce to avoid too many writes
function debounce(fn, delay = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
const saveDebounced = debounce(() => {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}, 200);

// call this to update UI and save (saving is debounced)
function save() {
  render();
  saveDebounced();
}

/* DOM references */
const habitForm = document.getElementById("habitForm");
const habitName = document.getElementById("habitName");
const habitList = document.getElementById("habitList");

const expenseForm = document.getElementById("expenseForm");
const expenseTitle = document.getElementById("expenseTitle");
const expenseAmount = document.getElementById("expenseAmount");
const expenseCategory = document.getElementById("expenseCategory");
const expenseList = document.getElementById("expenseList");
const expenseErr = document.getElementById("expenseErr");

const totalSpentEl = document.getElementById("totalSpent");
const expenseChartCtx = document.getElementById("expenseChart").getContext("2d");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");

let chart = null;

/* initialize app */
load();
render();

/* HABIT: add new habit */
habitForm.addEventListener("submit", e => {
  e.preventDefault();
  const name = habitName.value.trim();
  if (!name) return;
  // store id, name, doneToday & streak
  state.habits.push({ id: Date.now(), name, doneToday: false, streak: 0 });
  habitName.value = "";
  save();
});

/* render habit list */
function renderHabits() {
  habitList.innerHTML = "";
  if (!state.habits.length) {
    habitList.innerHTML = `<p style="color:var(--muted);padding:.5rem 0;">No habits yet — add one above.</p>`;
    return;
  }

  state.habits.forEach(h => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <label>
        <input type="checkbox" ${h.doneToday ? "checked" : ""}>
        <div>
          <div style="font-weight:600;">${h.name}</div>
          <div class="meta">Streak: ${h.streak} day(s)</div>
        </div>
      </label>
      <div class="item-actions">
        <button class="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    // toggle done and update streak
    li.querySelector("input").addEventListener("change", e => {
      h.doneToday = e.target.checked;
      h.streak = h.doneToday ? h.streak + 1 : Math.max(0, h.streak - 1);
      save();
    });
    // delete habit
    li.querySelector(".delete").addEventListener("click", () => {
      if (confirm(`Delete "${h.name}"?`)) {
        state.habits = state.habits.filter(x => x.id !== h.id);
        save();
      }
    });
    // edit habit name
    li.querySelector(".edit").addEventListener("click", () => {
      const newName = prompt("Edit habit:", h.name);
      if (newName && newName.trim()) {
        h.name = newName.trim();
        save();
      }
    });

    habitList.appendChild(li);
  });
}

/* EXPENSE: add new expense with validation */
expenseForm.addEventListener("submit", e => {
  e.preventDefault();
  expenseErr.style.display = "none";
  const title = expenseTitle.value.trim();
  const amount = parseFloat(expenseAmount.value);
  const category = expenseCategory.value;

  if (!title || !amount || isNaN(amount) || amount <= 0) {
    expenseErr.textContent = "Enter valid title and amount > 0";
    expenseErr.style.display = "block";
    setTimeout(() => (expenseErr.style.display = "none"), 2500);
    return;
  }

  state.expenses.push({
    id: Date.now(),
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    date: new Date().toLocaleDateString(),
  });

  expenseTitle.value = "";
  expenseAmount.value = "";
  save();
});

/* render expense list and totals */
function renderExpenses() {
  expenseList.innerHTML = "";
  if (!state.expenses.length) {
    expenseList.innerHTML = `<p style="color:var(--muted);padding:.5rem 0;">No expenses yet — add one above.</p>`;
    totalSpentEl.textContent = "0.00 ₹";
    if (chart) chart.destroy();
    return;
  }

  state.expenses.slice().reverse().forEach(ex => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div>
        <div style="font-weight:600;">${ex.title}</div>
        <div class="meta">${ex.date} • ${ex.category}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;">
        <div style="font-weight:600;">${ex.amount.toFixed(2)} ₹</div>
        <button class="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    li.querySelector(".delete").addEventListener("click", () => {
      if (confirm(`Delete "${ex.title}"?`)) {
        state.expenses = state.expenses.filter(x => x.id !== ex.id);
        save();
      }
    });
    expenseList.appendChild(li);
  });

  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  totalSpentEl.textContent = `${total.toFixed(2)} ₹`;

  renderChart();
}

/* render category doughnut chart */
function renderChart() {
  const sums = state.expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const labels = Object.keys(sums);
  const data = Object.values(sums);
  if (chart) chart.destroy();
  chart = new Chart(expenseChartCtx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)} ₹` } }
      }
    }
  });
}

/* export current app data to a file */
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "habitflow-backup.json";
  a.click();
});

/* import data from JSON backup (simple merge/replace) */
importBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.habits && data.expenses) {
          state = data;
          save();
          alert("Import successful!");
        } else {
          alert("Invalid backup file.");
        }
      } catch {
        alert("Invalid file.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

/* update UI (call after data changes) */
function render() {
  renderHabits();
  renderExpenses();
}
