"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutDashboard, ListChecks, Users, ChevronLeft, ChevronRight, Plus, X,
  CheckCircle2, Circle, AlertTriangle, Pencil, Trash2, StickyNote,
  LogOut, Activity as ActivityIcon, Search, RefreshCw
} from "lucide-react";

/* ============================== SUPABASE CONFIG ============================== */
const SUPABASE_URL = "https://mslaxlmqidqxmpkbnnfr.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0p63eo1OLeyNcutLJ2SQg_cXbUoR7x";

async function authSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
  return data; // { access_token, user: { id, email }, ... }
}

async function rest(path, { method = "GET", body, token, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers["Prefer"] = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body ok */ }
  if (!res.ok) throw new Error((data && (data.message || data.hint)) || `Request failed (${res.status})`);
  return data;
}

/* ============================== DATE HELPERS ============================== */
function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addWeeks(date, n) { return addDays(date, n * 7); }
function toKey(date) { return date.toISOString().slice(0, 10); }
function fmtShort(date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function fmtWeekRange(weekStart) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = sameMonth ? end.toLocaleDateString("en-US", { day: "numeric" }) : end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startStr} – ${endStr}`;
}
function fmtWeekday(date) { return date.toLocaleDateString("en-US", { weekday: "short" }); }
const TODAY = new Date();
const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const DAY_LABELS = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

function statusOf(wt) {
  if (wt.completed) return "Completed";
  const due = new Date(wt.due_date + "T23:59:59");
  if (due < TODAY) return "Overdue";
  return "Pending";
}
function pctColor(pct) { if (pct >= 80) return "#2F8F5B"; if (pct >= 50) return "#B98A2E"; return "#C24B3F"; }

/* ============================== SMALL UI PRIMITIVES ============================== */
const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
  .font-display { font-family: 'Space Grotesk', sans-serif; }
  .font-body { font-family: 'Inter', sans-serif; }
  .font-data { font-family: 'IBM Plex Mono', monospace; }
`;

function StatusBadge({ status }) {
  const map = {
    Completed: { bg: "#E9F5EE", fg: "#2F8F5B" },
    Pending: { bg: "#FBF3E4", fg: "#B98A2E" },
    Overdue: { bg: "#FBEAE7", fg: "#C24B3F" },
  };
  const s = map[status];
  return <span className="font-body text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.fg }}>{status}</span>;
}
function PriorityDot({ priority }) {
  const map = { Low: "#9AA69F", Medium: "#B98A2E", High: "#C88A3B", Urgent: "#C24B3F" };
  return <span className="inline-flex items-center gap-1 font-body text-[11px] font-medium" style={{ color: map[priority] }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: map[priority] }} />{priority}</span>;
}
function ProgressBar({ pct, color = "#2F8F5B", height = 8 }) {
  return <div className="w-full rounded-full bg-[#E4E7E1] overflow-hidden" style={{ height }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} /></div>;
}
function Avatar({ name, size = 36, color = "#2E5C7A" }) {
  const initials = (name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <div className="font-display flex items-center justify-center rounded-full text-white shrink-0" style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}>{initials}</div>;
}
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border px-4 py-3 flex items-start gap-2 mb-4" style={{ backgroundColor: "#FBEAE7", borderColor: "#F0C6BF" }}>
      <AlertTriangle size={16} color="#C24B3F" className="shrink-0 mt-0.5" />
      <p className="font-body text-sm flex-1" style={{ color: "#8A2E22" }}>{message}</p>
      {onDismiss && <button onClick={onDismiss}><X size={16} color="#C24B3F" /></button>}
    </div>
  );
}
function Spinner() {
  return <div className="flex items-center justify-center py-12"><RefreshCw size={22} className="animate-spin" color="#9AA69F" /></div>;
}

/* ============================== MAIN APP ============================== */
export default function TaskManagerLive() {
  const [session, setSession] = useState(null); // { access_token, user }
  const [profile, setProfile] = useState(null); // row from public.users
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [view, setView] = useState("mytasks");
  const [weekOffset, setWeekOffset] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [weeklyTasks, setWeeklyTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskModal, setTaskModal] = useState(null);
  const [noteDrawer, setNoteDrawer] = useState(null);
  const [filters, setFilters] = useState({ employee: "all", status: "all" });

  const isAdmin = profile?.role === "admin";
  const weekStart = useMemo(() => addWeeks(startOfWeekMonday(TODAY), weekOffset), [weekOffset]);
  const weekKey = toKey(weekStart);

  const handleLogin = async (email, password) => {
    setLoggingIn(true);
    setLoginError("");
    try {
      const data = await authSignIn(email, password);
      const [me] = await rest(`users?id=eq.${data.user.id}&select=*`, { token: data.access_token });
      setSession(data);
      setProfile(me);
      setView(me.role === "admin" ? "dashboard" : "mytasks");
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => { setSession(null); setProfile(null); setWeeklyTasks([]); setView("mytasks"); };

  const token = session?.access_token;

  const loadWeek = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      // materialize this week's instances from active recurring templates (idempotent)
      await rest("rpc/generate_weekly_tasks", { method: "POST", token, body: { target_week_start: weekKey } });
      const wt = await rest(
        `weekly_tasks?week_start=eq.${weekKey}&select=*,tasks(title,description,priority,category_id,categories(name))&order=due_date.asc`,
        { token }
      );
      setWeeklyTasks(wt || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, weekKey]);

  const loadStaticData = useCallback(async () => {
    if (!token) return;
    try {
      const [emps, cats] = await Promise.all([
        rest(`users?role=eq.employee&select=*&order=name.asc`, { token }),
        rest(`categories?select=*&order=name.asc`, { token }),
      ]);
      setEmployees(emps || []);
      setCategories(cats || []);
      if (isAdmin) {
        const tpls = await rest(`tasks?active=eq.true&select=*,categories(name)&order=title.asc`, { token });
        setTemplates(tpls || []);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [token, isAdmin]);

  const loadActivity = useCallback(async () => {
    if (!token) return;
    try {
      const log = await rest(`activity_log?select=*,users(name)&order=created_at.desc&limit=50`, { token });
      setActivityLog(log || []);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { if (token) loadStaticData(); }, [token, loadStaticData]);
  useEffect(() => { if (token) loadWeek(); }, [token, weekKey, loadWeek]);
  useEffect(() => { if (token && view === "activity") loadActivity(); }, [token, view, loadActivity]);

  const toggleTask = async (wt) => {
    const nowCompleted = !wt.completed;
    setWeeklyTasks((prev) => prev.map((w) => (w.id === wt.id ? { ...w, completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null } : w)));
    try {
      await rest(`weekly_tasks?id=eq.${wt.id}`, {
        method: "PATCH", token,
        body: { completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null },
      });
      await rest("activity_log", {
        method: "POST", token,
        body: { user_id: profile.id, action: `${nowCompleted ? "completed" : "reopened"} "${wt.tasks?.title}"`, weekly_task_id: wt.id },
      });
    } catch (e) {
      setError(e.message);
      loadWeek();
    }
  };

  const addNote = async (wtId, text) => {
    try {
      await rest("task_notes", { method: "POST", token, body: { weekly_task_id: wtId, user_id: profile.id, note: text } });
      const wt = weeklyTasks.find((w) => w.id === wtId);
      if (wt) await rest("activity_log", { method: "POST", token, body: { user_id: profile.id, action: `added a note on "${wt.tasks?.title}"`, weekly_task_id: wtId } });
      setNoteDrawer(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const saveTask = async (form) => {
    try {
      const payload = {
        title: form.title, description: form.description, assigned_to: form.assignedTo,
        category_id: form.categoryId || null, priority: form.priority,
        recurrence: form.recurrence, recurrence_days: form.recurrence === "weekly" ? form.days : [],
        due_date: form.recurrence === "one_time" ? form.dueDate : null,
        created_by: profile.id,
      };
      if (form.id) {
        await rest(`tasks?id=eq.${form.id}`, { method: "PATCH", token, body: payload });
      } else {
        await rest("tasks", { method: "POST", token, body: payload });
      }
      await rest("rpc/generate_weekly_tasks", { method: "POST", token, body: { target_week_start: weekKey } });
      setTaskModal(null);
      await Promise.all([loadStaticData(), loadWeek()]);
    } catch (e) {
      setError(e.message);
    }
  };

  const deactivateTask = async (taskId) => {
    try {
      await rest(`tasks?id=eq.${taskId}`, { method: "PATCH", token, body: { active: false } });
      await Promise.all([loadStaticData(), loadWeek()]);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!session) {
    return (
      <>
        <style>{FONT_STYLE}</style>
        <LoginScreen onLogin={handleLogin} loading={loggingIn} error={loginError} />
      </>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F1F3F0" }}>
        <style>{FONT_STYLE}</style>
        <Spinner />
      </div>
    );
  }

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  const myTasks = weeklyTasks.filter((w) => w.employee_id === profile.id);
  const visibleForTeam = weeklyTasks.filter((w) => {
    if (filters.employee !== "all" && w.employee_id !== filters.employee) return false;
    if (filters.status !== "all" && statusOf(w) !== filters.status) return false;
    return true;
  });

  const overallStats = (() => {
    const total = weeklyTasks.length;
    const completed = weeklyTasks.filter((w) => w.completed).length;
    const pending = weeklyTasks.filter((w) => !w.completed && statusOf(w) === "Pending").length;
    const overdue = weeklyTasks.filter((w) => statusOf(w) === "Overdue").length;
    return { total, completed, pending, overdue, pct: total ? Math.round((completed / total) * 100) : 0 };
  })();

  const employeeStats = employees.map((e) => {
    const list = weeklyTasks.filter((w) => w.employee_id === e.id);
    const completed = list.filter((w) => w.completed).length;
    const overdue = list.filter((w) => statusOf(w) === "Overdue").length;
    const pct = list.length ? Math.round((completed / list.length) * 100) : 0;
    return { employee: e, total: list.length, completed, overdue, pct };
  }).sort((a, b) => a.pct - b.pct);

  return (
    <div className="min-h-screen font-body" style={{ backgroundColor: "#F1F3F0", color: "#12211D" }}>
      <style>{FONT_STYLE}</style>
      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r" style={{ borderColor: "#DEE3DD", backgroundColor: "#FFFFFF" }}>
          <SidebarContent view={view} setView={setView} isAdmin={isAdmin} profile={profile} onLogout={logout} />
        </aside>

        <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
          <span className="font-display font-semibold text-sm">Task Manager</span>
          <button onClick={logout} className="p-1"><LogOut size={18} color="#9AA69F" /></button>
        </div>

        <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-20 md:pb-8">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
            <ErrorBanner message={error} onDismiss={() => setError("")} />
            {loading && <Spinner />}

            {!loading && view === "dashboard" && isAdmin && (
              <Dashboard weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset} overallStats={overallStats} employeeStats={employeeStats} />
            )}
            {!loading && view === "mytasks" && (
              <MyTasks tasks={myTasks} weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset} onToggle={toggleTask} onNote={(id) => setNoteDrawer(id)} />
            )}
            {!loading && view === "team" && isAdmin && (
              <TeamView
                employees={employees} weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset}
                filters={filters} setFilters={setFilters} tasks={visibleForTeam} employeeMap={employeeMap}
                onToggle={toggleTask} onNote={(id) => setNoteDrawer(id)}
                onCreate={() => setTaskModal({ mode: "create" })}
                onEdit={(wt) => { const tpl = templates.find((t) => t.id === wt.task_id); if (tpl) setTaskModal({ mode: "edit", task: tpl }); }}
                onDelete={(wt) => deactivateTask(wt.task_id)}
              />
            )}
            {!loading && view === "employees" && isAdmin && <EmployeesView employeeStats={employeeStats} />}
            {!loading && view === "activity" && isAdmin && <ActivityView log={activityLog} />}
          </div>
        </main>
      </div>

      <MobileBottomNav view={view} setView={setView} isAdmin={isAdmin} />

      {taskModal && (
        <TaskModal
          mode={taskModal.mode} task={taskModal.task} employees={employees} categories={categories}
          onClose={() => setTaskModal(null)} onSave={saveTask}
        />
      )}
      {noteDrawer && (
        <NoteDrawer wtId={noteDrawer} token={token} onClose={() => setNoteDrawer(null)} onAddNote={(text) => addNote(noteDrawer, text)} />
      )}
    </div>
  );
}

/* ============================== LOGIN ============================== */
function LoginScreen({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F1F3F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center font-display font-bold text-white text-lg" style={{ backgroundColor: "#C88A3B" }}>T</div>
          <h1 className="font-display text-2xl font-semibold">Weekly Task Manager</h1>
          <p className="font-body text-sm mt-1" style={{ color: "#4A5A55" }}>Sign in with your account</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }}
          className="rounded-2xl border p-5 space-y-3"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}
        >
          <ErrorBanner message={error} />
          <div>
            <label className="font-body text-xs font-semibold block mb-1.5" style={{ color: "#4A5A55" }}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full font-body text-sm rounded-lg border px-3 py-2.5" style={{ borderColor: "#DEE3DD" }} />
          </div>
          <div>
            <label className="font-body text-xs font-semibold block mb-1.5" style={{ color: "#4A5A55" }}>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full font-body text-sm rounded-lg border px-3 py-2.5" style={{ borderColor: "#DEE3DD" }} />
          </div>
          <button type="submit" disabled={loading} className="w-full font-body text-sm font-semibold py-2.5 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: "#2E5C7A" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================== NAV ============================== */
const NAV_ADMIN = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "mytasks", label: "My Tasks", icon: ListChecks },
  { id: "team", label: "Team", icon: Users },
  { id: "employees", label: "Employees", icon: Users },
  { id: "activity", label: "Activity", icon: ActivityIcon },
];
const NAV_EMPLOYEE = [{ id: "mytasks", label: "My Tasks", icon: ListChecks }];

function SidebarContent({ view, setView, isAdmin, profile, onLogout }) {
  const items = isAdmin ? NAV_ADMIN : NAV_EMPLOYEE;
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-white text-sm" style={{ backgroundColor: "#C88A3B" }}>T</div>
        <span className="font-display font-semibold text-base">Task Manager</span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button key={item.id} onClick={() => setView(item.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm font-medium transition-colors"
              style={{ backgroundColor: active ? "#EFF3EE" : "transparent", color: active ? "#2E5C7A" : "#4A5A55" }}>
              <Icon size={17} />{item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t" style={{ borderColor: "#EEF1EC" }}>
        <div className="flex items-center gap-2 px-3 py-2">
          <Avatar name={profile.name} size={30} />
          <div className="min-w-0">
            <div className="font-body text-sm font-medium truncate">{profile.name}</div>
            <div className="font-body text-[11px]" style={{ color: "#9AA69F" }}>{isAdmin ? "Admin" : "Employee"}</div>
          </div>
          <button onClick={onLogout} className="ml-auto p-1.5 rounded-lg hover:bg-[#F1F3F0]"><LogOut size={16} color="#9AA69F" /></button>
        </div>
      </div>
    </div>
  );
}
function MobileBottomNav({ view, setView, isAdmin }) {
  const items = isAdmin ? NAV_ADMIN.slice(0, 4) : NAV_EMPLOYEE;
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t flex" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
      {items.map((item) => {
        const Icon = item.icon; const active = view === item.id;
        return (
          <button key={item.id} onClick={() => setView(item.id)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <Icon size={19} color={active ? "#2E5C7A" : "#9AA69F"} />
            <span className="font-body text-[10px] font-medium" style={{ color: active ? "#2E5C7A" : "#9AA69F" }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function WeekSelector({ weekStart, weekOffset, setWeekOffset }) {
  return (
    <div className="flex items-center gap-2 font-body text-sm">
      <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg border hover:bg-[#F1F3F0]" style={{ borderColor: "#DEE3DD" }}><ChevronLeft size={16} /></button>
      <span className="font-data font-medium px-1 min-w-[112px] text-center">{fmtWeekRange(weekStart)}</span>
      <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg border hover:bg-[#F1F3F0]" style={{ borderColor: "#DEE3DD" }}><ChevronRight size={16} /></button>
      {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="font-body text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: "#2E5C7A", backgroundColor: "#EFF3EE" }}>This Week</button>}
    </div>
  );
}

/* ============================== DASHBOARD ============================== */
function Dashboard({ weekStart, weekOffset, setWeekOffset, overallStats, employeeStats }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Team Weekly Progress</h1>
        <WeekSelector weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Completion" value={`${overallStats.pct}%`} color={pctColor(overallStats.pct)} />
        <StatCard label="Completed" value={overallStats.completed} color="#2F8F5B" />
        <StatCard label="Pending" value={overallStats.pending} color="#B98A2E" />
        <StatCard label="Overdue" value={overallStats.overdue} color="#C24B3F" />
      </div>
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
        <h2 className="font-display text-base font-semibold mb-4">Team Progress</h2>
        <div className="space-y-4">
          {employeeStats.length === 0 && <p className="font-body text-sm" style={{ color: "#9AA69F" }}>No employees yet.</p>}
          {employeeStats.map(({ employee, total, completed, overdue, pct }) => (
            <div key={employee.id} className="flex items-center gap-4">
              <Avatar name={employee.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-body text-sm font-medium">{employee.name}</span>
                  <div className="flex items-center gap-2">
                    {overdue > 0 ? <span className="font-body text-xs font-semibold flex items-center gap-1" style={{ color: "#C24B3F" }}><AlertTriangle size={12} /> {overdue} Overdue</span> : <span className="font-body text-xs font-semibold" style={{ color: "#2F8F5B" }}>✓ On Track</span>}
                    <span className="font-data text-xs font-semibold" style={{ color: "#4A5A55" }}>{completed}/{total}</span>
                  </div>
                </div>
                <ProgressBar pct={pct} color={pctColor(pct)} />
              </div>
              <span className="font-data text-sm font-semibold w-10 text-right" style={{ color: pctColor(pct) }}>{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function StatCard({ label, value, color }) {
  return <div className="rounded-2xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}><div className="font-data text-2xl font-semibold" style={{ color }}>{value}</div><div className="font-body text-xs mt-1" style={{ color: "#4A5A55" }}>{label}</div></div>;
}

/* ============================== MY TASKS ============================== */
function MyTasks({ tasks, weekStart, weekOffset, setWeekOffset, onToggle, onNote }) {
  const completed = tasks.filter((t) => t.completed);
  const overdue = tasks.filter((t) => !t.completed && statusOf(t) === "Overdue");
  const pending = tasks.filter((t) => !t.completed && statusOf(t) === "Pending");
  const pct = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">My Tasks</h1>
        <WeekSelector weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-body text-sm font-medium" style={{ color: "#4A5A55" }}>This Week</span>
          <span className="font-data text-sm font-semibold" style={{ color: pctColor(pct) }}>{pct}%</span>
        </div>
        <div className="font-display text-xl font-semibold mb-3">{completed.length} of {tasks.length} completed</div>
        <ProgressBar pct={pct} color={pctColor(pct)} height={10} />
      </div>
      <TaskSection title="Overdue" items={overdue} onToggle={onToggle} onNote={onNote} accent="#C24B3F" />
      <TaskSection title="Pending" items={pending} onToggle={onToggle} onNote={onNote} emptyText="Nothing pending. 🎉" />
      <TaskSection title="Completed" items={completed} onToggle={onToggle} onNote={onNote} />
    </div>
  );
}
function TaskSection({ title, items, onToggle, onNote, emptyText, accent }) {
  if (!items.length && !emptyText) return null;
  return (
    <div>
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: accent || "#4A5A55" }}>{title} {items.length > 0 && <span className="font-data" style={{ color: "#9AA69F" }}>({items.length})</span>}</h3>
      {items.length === 0 ? <p className="font-body text-sm px-1" style={{ color: "#9AA69F" }}>{emptyText}</p> : (
        <div className="rounded-2xl border divide-y overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
          {items.map((wt) => <TaskRow key={wt.id} wt={wt} onToggle={onToggle} onNote={onNote} />)}
        </div>
      )}
    </div>
  );
}
function TaskRow({ wt, onToggle, onNote, showEmployee, employeeName, isAdmin, onEdit, onDelete }) {
  const status = statusOf(wt);
  const due = new Date(wt.due_date);
  const t = wt.tasks || {};
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <button onClick={() => onToggle(wt)} className="mt-0.5 shrink-0">{wt.completed ? <CheckCircle2 size={22} color="#2F8F5B" /> : <Circle size={22} color="#C9D0C6" />}</button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body text-sm font-medium" style={{ color: wt.completed ? "#9AA69F" : "#12211D", textDecoration: wt.completed ? "line-through" : "none" }}>{t.title}</span>
          <StatusBadge status={status} />
        </div>
        {t.description && <p className="font-body text-xs mt-0.5" style={{ color: "#9AA69F" }}>{t.description}</p>}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <PriorityDot priority={t.priority} />
          {t.categories?.name && <span className="font-body text-[11px]" style={{ color: "#9AA69F" }}>{t.categories.name}</span>}
          <span className="font-data text-[11px]" style={{ color: "#9AA69F" }}>Due {fmtWeekday(due)} {fmtShort(due)}</span>
          {showEmployee && <span className="font-body text-[11px]" style={{ color: "#4A5A55" }}>{employeeName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onNote(wt.id)} className="p-1.5 rounded-lg hover:bg-[#F1F3F0]"><StickyNote size={15} color="#9AA69F" /></button>
        {isAdmin && (
          <>
            <button onClick={() => onEdit(wt)} className="p-1.5 rounded-lg hover:bg-[#F1F3F0]"><Pencil size={15} color="#9AA69F" /></button>
            <button onClick={() => onDelete(wt)} className="p-1.5 rounded-lg hover:bg-[#FBEAE7]"><Trash2 size={15} color="#C24B3F" /></button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== TEAM (admin) ============================== */
function TeamView({ employees, weekStart, weekOffset, setWeekOffset, filters, setFilters, tasks, employeeMap, onToggle, onNote, onCreate, onEdit, onDelete }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Team</h1>
        <div className="flex items-center gap-3">
          <WeekSelector weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
          <button onClick={onCreate} className="flex items-center gap-1.5 font-body text-sm font-semibold px-3.5 py-2 rounded-xl text-white" style={{ backgroundColor: "#2E5C7A" }}><Plus size={16} /> New Task</button>
        </div>
      </div>
      <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-2" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
        <select className="font-body text-xs font-medium rounded-lg border px-2.5 py-1.5" style={{ borderColor: "#DEE3DD" }} value={filters.employee} onChange={(e) => setFilters((f) => ({ ...f, employee: e.target.value }))}>
          <option value="all">All Employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="font-body text-xs font-medium rounded-lg border px-2.5 py-1.5" style={{ borderColor: "#DEE3DD" }} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="all">All Status</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>
      <div className="rounded-2xl border divide-y overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
        {tasks.length === 0 ? <p className="font-body text-sm px-4 py-8 text-center" style={{ color: "#9AA69F" }}>No tasks yet. Create one to get started.</p> :
          tasks.map((wt) => <TaskRow key={wt.id} wt={wt} onToggle={onToggle} onNote={onNote} showEmployee employeeName={employeeMap[wt.employee_id]?.name} isAdmin onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

/* ============================== EMPLOYEES ============================== */
function EmployeesView({ employeeStats }) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Employees</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {employeeStats.map(({ employee, total, completed, pct }) => (
          <div key={employee.id} className="rounded-2xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={employee.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-body font-semibold text-sm truncate">{employee.name}</div>
                <div className="font-body text-xs" style={{ color: "#4A5A55" }}>{completed} / {total} completed</div>
              </div>
              <span className="font-data text-lg font-semibold" style={{ color: pctColor(pct) }}>{pct}%</span>
            </div>
            <ProgressBar pct={pct} color={pctColor(pct)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ACTIVITY ============================== */
function ActivityView({ log }) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Activity Log</h1>
      <div className="rounded-2xl border divide-y overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#DEE3DD" }}>
        {log.length === 0 && <p className="font-body text-sm px-4 py-8 text-center" style={{ color: "#9AA69F" }}>No activity yet.</p>}
        {log.map((entry) => (
          <div key={entry.id} className="px-4 py-3">
            <p className="font-body text-sm">{entry.users?.name || "Someone"} {entry.action}</p>
            <p className="font-data text-[11px] mt-0.5" style={{ color: "#9AA69F" }}>{new Date(entry.created_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== TASK MODAL ============================== */
function TaskModal({ mode, task, employees, categories, onClose, onSave }) {
  const [form, setForm] = useState(
    task
      ? { id: task.id, title: task.title, description: task.description || "", assignedTo: task.assigned_to, categoryId: task.category_id, priority: task.priority, recurrence: task.recurrence === "one_time" ? "one_time" : "weekly", days: task.recurrence_days || ["MO"], dueDate: task.due_date }
      : { id: null, title: "", description: "", assignedTo: employees[0]?.id || "", categoryId: categories[0]?.id || "", priority: "Medium", recurrence: "weekly", days: ["MO"], dueDate: "" }
  );
  const [saving, setSaving] = useState(false);
  const toggleDay = (code) => setForm((f) => ({ ...f, days: f.days.includes(code) ? f.days.filter((d) => d !== code) : [...f.days, code] }));
  const canSave = form.title.trim() && form.assignedTo && (form.recurrence !== "weekly" || form.days.length > 0) && (form.recurrence !== "one_time" || form.dueDate);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">{mode === "edit" ? "Edit Task" : "New Task"}</h2>
          <button onClick={onClose}><X size={20} color="#9AA69F" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Task name"><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full font-body text-sm rounded-lg border px-3 py-2" style={{ borderColor: "#DEE3DD" }} /></Field>
          <Field label="Description"><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full font-body text-sm rounded-lg border px-3 py-2 resize-none" style={{ borderColor: "#DEE3DD" }} /></Field>
          <Field label="Assign to">
            <select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} className="w-full font-body text-sm rounded-lg border px-3 py-2" style={{ borderColor: "#DEE3DD" }}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full font-body text-sm rounded-lg border px-3 py-2" style={{ borderColor: "#DEE3DD" }}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className="w-full font-body text-sm rounded-lg border px-3 py-2" style={{ borderColor: "#DEE3DD" }}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Recurrence">
            <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))} className="w-full font-body text-sm rounded-lg border px-3 py-2" style={{ borderColor: "#DEE3DD" }}>
              <option value="weekly">Weekly (repeats every week)</option>
              <option value="one_time">One time</option>
            </select>
          </Field>
          {form.recurrence === "weekly" ? (
            <Field label="Repeat on">
              <div className="flex flex-wrap gap-1.5">
                {DAY_CODES.map((code) => (
                  <button key={code} type="button" onClick={() => toggleDay(code)} className="font-body text-xs font-semibold w-11 py-1.5 rounded-lg" style={{ backgroundColor: form.days.includes(code) ? "#2E5C7A" : "#EFF3EE", color: form.days.includes(code) ? "#fff" : "#4A5A55" }}>{DAY_LABELS[code]}</button>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="Due date"><input type="date" value={form.dueDate || ""} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full font-body text-sm rounded-lg border px-3 py-2" style={{ borderColor: "#DEE3DD" }} /></Field>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 font-body text-sm font-semibold py-2.5 rounded-xl border" style={{ borderColor: "#DEE3DD" }}>Cancel</button>
          <button disabled={!canSave || saving} onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }} className="flex-1 font-body text-sm font-semibold py-2.5 rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: "#2E5C7A" }}>
            {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <div><label className="font-body text-xs font-semibold block mb-1.5" style={{ color: "#4A5A55" }}>{label}</label>{children}</div>;
}

/* ============================== NOTE DRAWER ============================== */
function NoteDrawer({ wtId, token, onClose, onAddNote }) {
  const [notes, setNotes] = useState(null);
  const [text, setText] = useState("");
  useEffect(() => {
    rest(`task_notes?weekly_task_id=eq.${wtId}&select=*,users(name)&order=created_at.asc`, { token })
      .then(setNotes).catch(() => setNotes([]));
  }, [wtId, token]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full md:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Notes</h2>
          <button onClick={onClose}><X size={20} color="#9AA69F" /></button>
        </div>
        <div className="space-y-3 mb-4">
          {notes === null && <Spinner />}
          {notes && notes.length === 0 && <p className="font-body text-sm" style={{ color: "#9AA69F" }}>No notes yet.</p>}
          {notes && notes.map((n) => (
            <div key={n.id} className="rounded-lg p-3" style={{ backgroundColor: "#FAFBF9" }}>
              <p className="font-body text-sm">{n.note}</p>
              <p className="font-data text-[11px] mt-1" style={{ color: "#9AA69F" }}>{n.users?.name || "Someone"} · {new Date(n.created_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a note..." className="flex-1 font-body text-sm rounded-lg border px-3 py-2 resize-none" style={{ borderColor: "#DEE3DD" }} />
          <button onClick={() => { if (text.trim()) { onAddNote(text.trim()); setText(""); } }} className="font-body text-sm font-semibold px-3.5 py-2.5 rounded-lg text-white shrink-0" style={{ backgroundColor: "#2E5C7A" }}>Add</button>
        </div>
      </div>
    </div>
  );
}
