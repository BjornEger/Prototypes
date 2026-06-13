import { useEffect, useMemo, useRef, useState, useCallback } from "react";import { useUser } from "@/store/UserContext";
import { ApiActivities, ApiProjects, ApiTime, ApiUsers } from "@/lib/api";
import {
  DAY_LABELS_DA,
  addDays,
  fromISO,
  isoWeek,
  mondayOf,
  toISO,
  weekDates,
  weekTotal,
  formatWeekRange,
} from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CaretLeft,
  CaretRight,
  Copy,
  FloppyDisk,
  MagnifyingGlass,
  Plus,
  Star,
  StarHalf,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const todayMonday = () => toISO(mondayOf(new Date()));

export default function IndtastTimer() {
  const { currentUser, refresh: refreshUser } = useUser();
  const [weekStart, setWeekStart] = useState(todayMonday());
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [entries, setEntries] = useState({}); // activity_id -> entry doc
  const [notes, setNotes] = useState({}); // activity_id -> string
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [savingMap, setSavingMap] = useState({});
  const [weekSaved, setWeekSaved] = useState(false);
  const saveTimers = useRef({});
  const inputRefs = useRef({}); // key = `${activityId}|${dayIdx}`

  const monday = useMemo(() => fromISO(weekStart), [weekStart]);
  const days = useMemo(() => weekDates(monday), [monday]);
  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  // Load projects + activities (only those that are part of currentUser.my_activity_ids OR have entries)
  const reloadData = useCallback(async () => {
    if (!currentUser) return;
    const [projs, allActs, te] = await Promise.all([
      ApiProjects.list(),
      ApiActivities.list({}),
      ApiTime.list({ user_id: currentUser.id, week_start_date: weekStart }),
    ]);
    setProjects(projs);

    const myIds = new Set(currentUser.my_activity_ids || []);
    const entriesByAct = {};
    const notesByAct = {};
    let anySaved = false;
    for (const e of te) {
      entriesByAct[e.activity_id] = e;
      notesByAct[e.activity_id] = e.note || "";
      myIds.add(e.activity_id);
      if (e.saved) anySaved = true;
    }
    setEntries(entriesByAct);
    setNotes(notesByAct);
    setWeekSaved(anySaved && te.length > 0 && te.every((e) => e.saved));

    const myActs = allActs.filter((a) => myIds.has(a.id));
    // Sort: program-level last, then by project name, then activity name
    myActs.sort((a, b) => {
      const aLvl = a.level === "program" ? 1 : 0;
      const bLvl = b.level === "program" ? 1 : 0;
      if (aLvl !== bLvl) return aLvl - bLvl;
      const ap = projs.find((p) => p.id === a.project_id)?.name || "";
      const bp = projs.find((p) => p.id === b.project_id)?.name || "";
      if (ap !== bp) return ap.localeCompare(bp);
      return a.name.localeCompare(b.name);
    });
    setActivities(myActs);
  }, [currentUser, weekStart]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Debounced auto-save per (activity, cell)
  const queueSave = (activityId, newEntries, newNote) => {
    if (!currentUser) return;
    setSavingMap((m) => ({ ...m, [activityId]: "saving" }));
    if (saveTimers.current[activityId]) clearTimeout(saveTimers.current[activityId]);
    saveTimers.current[activityId] = setTimeout(async () => {
      try {
        await ApiTime.upsert({
          user_id: currentUser.id,
          activity_id: activityId,
          week_start_date: weekStart,
          entries: newEntries,
          note: newNote || "",
          saved: false,
        });
        setSavingMap((m) => ({ ...m, [activityId]: "saved-draft" }));
        setWeekSaved(false);
      } catch (e) {
        setSavingMap((m) => ({ ...m, [activityId]: "error" }));
        toast.error("Kunne ikke gemme kladde");
      }
    }, 500);
  };

  const handleCellChange = (activityId, dayIso, value) => {
    const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const num = cleaned === "" ? "" : Math.max(0, Math.min(24, parseFloat(cleaned) || 0));
    setEntries((prev) => {
      const existing = prev[activityId]?.entries || {};
      const updated = { ...existing };
      if (num === "" || num === 0) delete updated[dayIso];
      else updated[dayIso] = num;
      const newDoc = { ...(prev[activityId] || {}), entries: updated, activity_id: activityId };
      queueSave(activityId, updated, notes[activityId]);
      return { ...prev, [activityId]: newDoc };
    });
  };

  const handleNoteChange = (activityId, note) => {
    setNotes((n) => ({ ...n, [activityId]: note }));
    const existing = entries[activityId]?.entries || {};
    queueSave(activityId, existing, note);
  };

  const handleKeyDown = (e, activityId, dayIdx) => {
    const move = (rowDelta, colDelta) => {
      const actIdx = activities.findIndex((a) => a.id === activityId);
      const newAct = activities[actIdx + rowDelta];
      const newDay = dayIdx + colDelta;
      if (newAct && newDay >= 0 && newDay < 7) {
        const key = `${newAct.id}|${newDay}`;
        inputRefs.current[key]?.focus();
        inputRefs.current[key]?.select();
        e.preventDefault();
      }
    };
    if (e.key === "Enter") move(1, 0);
    else if (e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowLeft" && e.target.selectionStart === 0) move(0, -1);
    else if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) move(0, 1);
  };

  const shiftWeek = (delta) => {
    const newMon = addDays(monday, delta * 7);
    setWeekStart(toISO(newMon));
  };

  const goToday = () => setWeekStart(todayMonday());

  const handleCopyPrevious = async () => {
    if (!currentUser) return;
    try {
      const res = await ApiTime.copyPrevious(currentUser.id, weekStart);
      toast.success(`Kopierede ${res.copied} aktiviteter fra sidste uge`);
      reloadData();
    } catch {
      toast.error("Kunne ikke kopiere sidste uge");
    }
  };

  const handleSaveWeek = async () => {
    if (!currentUser) return;
    try {
      // Flush any pending debounced saves
      for (const aid in saveTimers.current) {
        clearTimeout(saveTimers.current[aid]);
      }
      // Upsert all entries as saved
      const promises = activities.map((a) =>
        ApiTime.upsert({
          user_id: currentUser.id,
          activity_id: a.id,
          week_start_date: weekStart,
          entries: entries[a.id]?.entries || {},
          note: notes[a.id] || "",
          saved: true,
        }),
      );
      await Promise.all(promises);
      setWeekSaved(true);
      toast.success("Ugen er gemt");
      setSavingMap({});
    } catch {
      toast.error("Kunne ikke gemme ugen");
    }
  };

  // Add row from search
  const [allActivities, setAllActivities] = useState([]);
  useEffect(() => {
    if (searchOpen) ApiActivities.list({}).then(setAllActivities);
  }, [searchOpen]);

  const handleAddActivity = async (activity) => {
    if (!currentUser) return;
    await ApiUsers.addMyActivity(currentUser.id, activity.id);
    await refreshUser();
    await reloadData();
    setSearchOpen(false);
    setSearch("");
    toast.success(`Tilføjet "${activity.name}"`);
  };

  const handleRemoveActivity = async (activityId) => {
    if (!currentUser) return;
    if (entries[activityId] && weekTotal(entries[activityId].entries) > 0) {
      if (!window.confirm("Aktiviteten har registrerede timer. Fjern alligevel?")) return;
    }
    await ApiUsers.removeMyActivity(currentUser.id, activityId);
    await refreshUser();
    await reloadData();
  };

  // Totals
  const dayTotals = days.map((d) => {
    const iso = toISO(d);
    return activities.reduce((sum, a) => sum + (parseFloat(entries[a.id]?.entries?.[iso]) || 0), 0);
  });
  const weekGrandTotal = dayTotals.reduce((a, b) => a + b, 0);
  const norm = currentUser?.weekly_hours_norm || 37;
  const missing = Math.max(0, norm - weekGrandTotal);

  // Status badge
  const statusLabel = weekSaved
    ? { text: "Gemt", color: "bg-emerald-100 text-emerald-800 border-emerald-200" }
    : weekGrandTotal > 0
      ? { text: "Kladde", color: "bg-amber-50 text-amber-800 border-amber-200" }
      : { text: "Tom", color: "bg-zinc-100 text-zinc-600 border-zinc-200" };

  if (!currentUser) {
    return <div className="p-10 text-zinc-500">Indlæser bruger…</div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8" data-testid="indtast-timer-page">
      {/* Top: week navigation */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-8 mb-6">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">
            Uge {isoWeek(monday)}
          </div>
          <h1
            className="font-outfit text-3xl md:text-4xl font-semibold tracking-tight text-zinc-950"
            data-testid="week-title"
          >
            {formatWeekRange(monday)}
          </h1>
          <div className="text-sm text-zinc-500 mt-1">
            {weekGrandTotal.toFixed(1)} af {norm} timer registreret · kladde gemmes automatisk
          </div>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftWeek(-1)}
            data-testid="btn-prev-week"
            aria-label="Forrige uge"
          >
            <CaretLeft size={16} />
          </Button>
          <Button
            variant="outline"
            onClick={goToday}
            className="h-9 px-3 text-sm"
            data-testid="btn-this-week"
          >
            Denne uge
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftWeek(1)}
            data-testid="btn-next-week"
            aria-label="Næste uge"
          >
            <CaretRight size={16} />
          </Button>
          <div className="w-px h-6 bg-zinc-200 mx-1" />
          <Button
            variant="outline"
            onClick={handleCopyPrevious}
            className="h-9 px-3 text-sm gap-1.5"
            data-testid="btn-copy-previous"
          >
            <Copy size={15} /> Kopiér sidste uge
          </Button>
          <Button
            onClick={handleSaveWeek}
            className="h-9 px-4 text-sm gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white"
            data-testid="btn-save-week"
          >
            <FloppyDisk size={15} /> Gem uge
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiTile label="Timer registreret" value={weekGrandTotal.toFixed(1)} testId="kpi-registered" />
        <KpiTile
          label="Mangler ift. normtid"
          value={missing.toFixed(1)}
          intent={missing > 0 ? "warn" : "ok"}
          testId="kpi-missing"
        />
        <div
          className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col gap-2 shadow-sm"
          data-testid="kpi-status"
        >
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Status</div>
          <div
            className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${statusLabel.color}`}
            data-testid="status-badge"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {statusLabel.text} for ugen
          </div>
        </div>
      </div>

      {/* Search + add row */}
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex-1 flex items-center gap-2 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-500 hover:border-zinc-300 transition-colors text-left"
              data-testid="btn-search-activity"
            >
              <MagnifyingGlass size={16} />
              Søg program, projekt eller aktivitet…
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[480px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Søg aktivitet…"
                value={search}
                onValueChange={setSearch}
                data-testid="activity-search-input"
              />
              <CommandList>
                <CommandEmpty>Ingen aktiviteter fundet.</CommandEmpty>
                <CommandGroup heading="Åbne aktiviteter">
                  {allActivities
                    .filter((a) => a.status === "open")
                    .filter((a) => {
                      const q = search.toLowerCase();
                      if (!q) return true;
                      const projName = projectMap[a.project_id]?.name || "Programniveau";
                      return (
                        a.name.toLowerCase().includes(q) ||
                        projName.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 50)
                    .map((a) => {
                      const inMine = currentUser.my_activity_ids?.includes(a.id);
                      return (
                        <CommandItem
                          key={a.id}
                          value={a.id}
                          onSelect={() => !inMine && handleAddActivity(a)}
                          disabled={inMine}
                          data-testid={`activity-result-${a.id}`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs text-zinc-500">
                              {projectMap[a.project_id]?.name || "Programniveau"}
                            </span>
                            <span className="text-sm">{a.name}</span>
                          </div>
                          <span className="ml-auto text-xs text-zinc-400">
                            {inMine ? "Tilføjet" : "Tilføj"}
                          </span>
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Grid table */}
      <div
        className="overflow-x-auto border border-zinc-200 rounded-lg bg-white shadow-sm"
        data-testid="time-grid-wrap"
      >
        <table className="w-full text-sm border-collapse" data-testid="time-grid">
          <thead>
            <tr className="bg-zinc-50 text-zinc-700 text-xs uppercase tracking-wider">
              <th className="sticky-col-header text-left px-4 py-2.5 font-semibold min-w-[260px] border-b border-zinc-200">
                Program/projekt · Aktivitet
              </th>
              {days.map((d, i) => {
                const isWeekend = i >= 5;
                return (
                  <th
                    key={i}
                    className={`text-center px-2 py-2.5 font-semibold border-b border-zinc-200 ${
                      isWeekend ? "text-zinc-400" : ""
                    }`}
                  >
                    <div>{DAY_LABELS_DA[i]}</div>
                    <div className="text-[10px] font-medium text-zinc-400 normal-case tracking-normal">
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </th>
                );
              })}
              <th className="text-center px-3 py-2.5 font-semibold border-b border-zinc-200">Total</th>
              <th className="text-left px-3 py-2.5 font-semibold border-b border-zinc-200 min-w-[140px]">
                Note
              </th>
              <th className="w-9 border-b border-zinc-200" />
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="text-center py-16 text-zinc-500"
                  data-testid="empty-state"
                >
                  Ingen aktiviteter på din liste endnu. Brug søgningen ovenfor for at tilføje en
                  aktivitet, eller gå til <strong className="text-zinc-700">Mine aktiviteter</strong>.
                </td>
              </tr>
            ) : (
              activities.map((a) => {
                const proj = a.level === "program" ? "Programniveau" : projectMap[a.project_id]?.name || "—";
                const rowEntries = entries[a.id]?.entries || {};
                const total = weekTotal(rowEntries);
                return (
                  <tr
                    key={a.id}
                    className="hover:bg-zinc-50/60 transition-colors"
                    data-testid={`row-${a.id}`}
                  >
                    <td className="sticky-col px-4 py-2.5 border-b border-zinc-100 align-middle">
                      <div className="flex items-start gap-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                            {proj}
                          </div>
                          <div className="text-[14px] text-zinc-950 font-medium leading-tight">
                            {a.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((d, dayIdx) => {
                      const iso = toISO(d);
                      const val = rowEntries[iso] ?? "";
                      const isWeekend = dayIdx >= 5;
                      return (
                        <td
                          key={dayIdx}
                          className={`border-b border-zinc-100 p-0 ${isWeekend ? "weekend-col" : ""}`}
                        >
                          <input
                            ref={(el) => (inputRefs.current[`${a.id}|${dayIdx}`] = el)}
                            type="text"
                            inputMode="decimal"
                            className={`time-cell ${val !== "" ? "has-value" : ""} ${isWeekend ? "weekend" : ""}`}
                            value={val}
                            onChange={(e) => handleCellChange(a.id, iso, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleKeyDown(e, a.id, dayIdx)}
                            placeholder="-"
                            data-testid={`cell-${a.id}-${dayIdx}`}
                          />
                        </td>
                      );
                    })}
                    <td
                      className="text-center px-3 py-2.5 border-b border-zinc-100 row-total"
                      data-testid={`row-total-${a.id}`}
                    >
                      {total > 0 ? total.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-1 border-b border-zinc-100">
                      <Input
                        value={notes[a.id] || ""}
                        onChange={(e) => handleNoteChange(a.id, e.target.value)}
                        placeholder={a.requires_note ? "Krævet" : "Note"}
                        className={`h-8 text-xs border-zinc-200 ${
                          a.requires_note && !(notes[a.id]) ? "border-amber-300" : ""
                        }`}
                        data-testid={`note-${a.id}`}
                      />
                    </td>
                    <td className="border-b border-zinc-100 text-center">
                      <button
                        onClick={() => handleRemoveActivity(a.id)}
                        className="text-zinc-400 hover:text-red-600 transition-colors p-1.5"
                        title="Fjern fra ugen"
                        data-testid={`remove-${a.id}`}
                      >
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {activities.length > 0 && (
            <tfoot>
              <tr className="bg-zinc-50 border-t-2 border-zinc-200">
                <td className="sticky-col-header text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-zinc-700">
                  Dagstotal
                </td>
                {dayTotals.map((t, i) => (
                  <td
                    key={i}
                    className={`text-center px-2 py-2.5 row-total ${i >= 5 ? "text-zinc-400" : ""}`}
                    data-testid={`day-total-${i}`}
                  >
                    {t > 0 ? t.toFixed(1) : "—"}
                  </td>
                ))}
                <td
                  className="text-center px-3 py-2.5 row-total text-base text-zinc-950"
                  data-testid="week-total"
                >
                  {weekGrandTotal.toFixed(1)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Hint */}
      <div className="text-xs text-zinc-500 mt-3 flex items-center gap-2">
        <kbd className="px-1.5 py-0.5 rounded border border-zinc-300 bg-white font-mono text-[10px]">
          Tab
        </kbd>
        flytter vandret ·
        <kbd className="px-1.5 py-0.5 rounded border border-zinc-300 bg-white font-mono text-[10px]">
          Enter
        </kbd>
        og piletaster flytter mellem celler · kladde gemmes automatisk.
      </div>
    </div>
  );
}

function KpiTile({ label, value, intent, testId }) {
  const valColor = intent === "warn" ? "text-amber-700" : intent === "ok" ? "text-emerald-700" : "text-zinc-950";
  return (
    <div
      className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col gap-1 shadow-sm"
      data-testid={testId}
    >
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</div>
      <div className={`text-3xl font-outfit font-semibold tabular-nums ${valColor}`}>{value}</div>
    </div>
  );
}
