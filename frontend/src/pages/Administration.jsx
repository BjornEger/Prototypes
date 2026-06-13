import { useEffect, useMemo, useState } from "react";
import { ApiActivities, ApiProjects, ApiUsers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, MagnifyingGlass, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "open", label: "Åbne" },
  { key: "upcoming", label: "Kommende" },
  { key: "closed", label: "Lukkede" },
];

const LEVEL_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "project", label: "Projekt" },
  { key: "program", label: "Program" },
];

const STATUS_COLOR = {
  open: "bg-emerald-100 text-emerald-800 border-emerald-200",
  upcoming: "bg-amber-50 text-amber-800 border-amber-200",
  closed: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const STATUS_LABEL = { open: "Åben", upcoming: "Kommende", closed: "Lukket" };

const EMPTY = {
  name: "",
  project_id: "__program",
  level: "project",
  owner_user_id: "__none",
  status: "open",
  requires_note: false,
};

export default function Administration() {
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const [a, p, u] = await Promise.all([
      ApiActivities.list({}),
      ApiProjects.list(),
      ApiUsers.list(),
    ]);
    setActivities(a);
    setProjects(p);
    setUsers(u);
  };
  useEffect(() => {
    load();
  }, []);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const filtered = activities
    .filter((a) => (filter === "all" ? true : a.status === filter))
    .filter((a) => (levelFilter === "all" ? true : a.level === levelFilter))
    .filter((a) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const proj = projectMap[a.project_id]?.name || "Programniveau";
      const owner = userMap[a.owner_user_id]?.name || "";
      return (
        a.name.toLowerCase().includes(q) ||
        proj.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q)
      );
    });

  const groupByStatus = {
    upcoming: filtered.filter((a) => a.status === "upcoming"),
    open: filtered.filter((a) => a.status === "open"),
    closed: filtered.filter((a) => a.status === "closed"),
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      name: a.name,
      project_id: a.project_id || "__program",
      level: a.level,
      owner_user_id: a.owner_user_id || "__none",
      status: a.status,
      requires_note: !!a.requires_note,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Aktiviteten skal have et navn");
      return;
    }
    const payload = {
      name: form.name.trim(),
      level: form.level,
      project_id: form.level === "program" ? null : form.project_id === "__program" ? null : form.project_id,
      owner_user_id: form.owner_user_id === "__none" ? null : form.owner_user_id,
      status: form.status,
      requires_note: form.requires_note,
    };
    if (editing) {
      await ApiActivities.update(editing.id, payload);
      toast.success("Aktivitet opdateret");
    } else {
      await ApiActivities.create(payload);
      toast.success("Aktivitet oprettet");
    }
    setOpen(false);
    await load();
  };

  const quickStatus = async (a, newStatus) => {
    await ApiActivities.update(a.id, { status: newStatus });
    toast.success(`Status ændret til ${STATUS_LABEL[newStatus]}`);
    load();
  };

  const remove = async (a) => {
    if (!window.confirm(`Slet "${a.name}"?`)) return;
    await ApiActivities.remove(a.id);
    toast.success("Slettet");
    load();
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8" data-testid="admin-page">
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">
            Administration · aktiviteter
          </div>
          <h1 className="font-outfit text-3xl md:text-4xl font-semibold tracking-tight text-zinc-950">
            Styr aktivitetspuljen
          </h1>
          <div className="text-sm text-zinc-500 mt-1">
            Aktiviteter kan oprettes på projekt- eller programniveau og åbnes for registrering.
          </div>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openCreate}
                className="h-9 text-sm gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white"
                data-testid="btn-new-activity"
              >
                <Plus size={15} /> Ny aktivitet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" data-testid="activity-dialog">
              <DialogHeader>
                <DialogTitle className="font-outfit">
                  {editing ? "Rediger aktivitet" : "Ny aktivitet"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                    Navn
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Fx: Workshopforberedelse"
                    autoFocus
                    data-testid="form-name"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                    Niveau
                  </Label>
                  <Select
                    value={form.level}
                    onValueChange={(v) => setForm({ ...form, level: v })}
                  >
                    <SelectTrigger data-testid="form-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Projekt</SelectItem>
                      <SelectItem value="program">Programniveau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.level === "project" && (
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                      Projekt
                    </Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => setForm({ ...form, project_id: v })}
                    >
                      <SelectTrigger data-testid="form-project">
                        <SelectValue placeholder="Vælg projekt…" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                    Ansvarlig
                  </Label>
                  <Select
                    value={form.owner_user_id}
                    onValueChange={(v) => setForm({ ...form, owner_user_id: v })}
                  >
                    <SelectTrigger data-testid="form-owner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Ingen</SelectItem>
                      {users
                        .filter((u) => u.role !== "medarbejder")
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                    Status
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger data-testid="form-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Kommende</SelectItem>
                      <SelectItem value="open">Åben</SelectItem>
                      <SelectItem value="closed">Lukket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-950">Note påkrævet</div>
                    <div className="text-xs text-zinc-500">Brugeren skal angive en note</div>
                  </div>
                  <Switch
                    checked={form.requires_note}
                    onCheckedChange={(v) => setForm({ ...form, requires_note: v })}
                    data-testid="form-requires-note"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} data-testid="form-cancel">
                  Annullér
                </Button>
                <Button
                  onClick={submit}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white"
                  data-testid="form-submit"
                >
                  {editing ? "Gem ændringer" : "Opret aktivitet"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-5 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg aktivitet, projekt, programniveau eller ansvarlig…"
            className="pl-9 h-10 bg-white border-zinc-200"
            data-testid="admin-search"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-md p-1" data-testid="admin-level-filters">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setLevelFilter(f.key)}
              data-testid={`admin-level-filter-${f.key}`}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                levelFilter === f.key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-md p-1" data-testid="admin-status-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`admin-filter-${f.key}`}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                filter === f.key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {["upcoming", "open", "closed"].map((key) => {
        const list = groupByStatus[key];
        if (list.length === 0) return null;
        return (
          <section key={key} className="mb-6" data-testid={`admin-section-${key}`}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-outfit text-base font-semibold text-zinc-950">
                {STATUS_LABEL[key]}
              </h2>
              <span className="text-xs text-zinc-500 px-2 py-0.5 bg-zinc-100 rounded-full font-medium">
                {list.length}
              </span>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 shadow-sm">
              {list.map((a) => {
                const proj = a.level === "program" ? "Programniveau" : projectMap[a.project_id]?.name || "—";
                const owner = userMap[a.owner_user_id]?.name;
                return (
                  <div
                    key={a.id}
                    className="px-5 py-3 flex items-center gap-4 hover:bg-zinc-50/60 transition-colors"
                    data-testid={`admin-row-${a.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                        {proj}
                      </div>
                      <div className="text-sm text-zinc-950 font-medium truncate">{a.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {owner ? `Ansvarlig: ${owner}` : <span className="text-amber-700">Mangler ansvarlig</span>}
                        {a.requires_note && <span className="ml-2">· Note påkrævet</span>}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${STATUS_COLOR[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>

                    <div className="flex items-center gap-1">
                      {a.status !== "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickStatus(a, "open")}
                          className="h-7 text-xs"
                          data-testid={`open-${a.id}`}
                        >
                          Åbn
                        </Button>
                      )}
                      {a.status !== "closed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickStatus(a, "closed")}
                          className="h-7 text-xs"
                          data-testid={`close-${a.id}`}
                        >
                          Luk
                        </Button>
                      )}
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-900 transition-colors"
                        title="Rediger"
                        data-testid={`edit-${a.id}`}
                      >
                        <PencilSimple size={15} />
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                        title="Slet"
                        data-testid={`delete-${a.id}`}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg py-16 text-center text-sm text-zinc-500">
          Ingen aktiviteter matcher dit søgekriterie.
        </div>
      )}
    </div>
  );
}
