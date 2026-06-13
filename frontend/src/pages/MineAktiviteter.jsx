import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/store/UserContext";
import { ApiActivities, ApiProjects, ApiUsers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, MagnifyingGlass, Plus, X, Pushpin } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AVAILABLE_TITLE = {
  all: "Tilgængelige aktiviteter",
  open: "Tilgængelige åbne aktiviteter",
  upcoming: "Tilgængelige kommende aktiviteter",
  closed: "Lukkede aktiviteter",
};

const LEVEL_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "project", label: "Projekt" },
  { key: "program", label: "Program" },
];

const STATUS_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "open", label: "Åbne" },
  { key: "upcoming", label: "Kommende" },
  { key: "closed", label: "Lukkede" },
];

export default function MineAktiviteter() {
  const { currentUser, refresh } = useUser();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showOnlyFav, setShowOnlyFav] = useState(false);

  useEffect(() => {
    Promise.all([ApiProjects.list(), ApiActivities.list({})]).then(([p, a]) => {
      setProjects(p);
      setActivities(a);
    });
  }, []);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const myIds = new Set(currentUser?.my_activity_ids || []);
  const favIds = new Set(currentUser?.favorite_activity_ids || []);

  const myActivities = activities.filter((a) => myIds.has(a.id));
  // "Tilgængelige" must respect status filter; default exclude closed since they cannot be added.
  const otherAvailable = activities.filter((a) => {
    if (myIds.has(a.id)) return false;
    if (statusFilter === "all") return a.status !== "closed";
    return a.status === statusFilter;
  });

  const matchesLevel = (a) => {
    if (filter === "project" && a.level !== "project") return false;
    if (filter === "program" && a.level !== "program") return false;
    return true;
  };
  const matchesStatus = (a) => {
    if (statusFilter === "all") return true;
    return a.status === statusFilter;
  };
  const matchesSearch = (a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const proj = projectMap[a.project_id]?.name || "Programniveau";
    return a.name.toLowerCase().includes(q) || proj.toLowerCase().includes(q);
  };

  const filteredMine = myActivities
    .filter(matchesLevel)
    .filter(matchesStatus)
    .filter(matchesSearch)
    .filter((a) => (showOnlyFav ? favIds.has(a.id) : true));
  const filteredOther = otherAvailable.filter(matchesLevel).filter(matchesSearch);

  const handleAdd = async (id) => {
    await ApiUsers.addMyActivity(currentUser.id, id);
    await refresh();
    toast.success("Tilføjet til mine aktiviteter");
  };
  const handleRemove = async (id) => {
    await ApiUsers.removeMyActivity(currentUser.id, id);
    await refresh();
  };
  const handleFav = async (id) => {
    await ApiUsers.toggleFavorite(currentUser.id, id);
    await refresh();
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8" data-testid="mine-aktiviteter-page">
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">
            Mine aktiviteter
          </div>
          <h1 className="font-outfit text-3xl md:text-4xl font-semibold tracking-tight text-zinc-950">
            Min aktivitetsliste
          </h1>
          <div className="text-sm text-zinc-500 mt-1">
            Aktiviteter du bruger ofte, samt åbne aktiviteter du kan tilføje til din uge.
          </div>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <Button
            variant={showOnlyFav ? "default" : "outline"}
            onClick={() => setShowOnlyFav((v) => !v)}
            className="h-9 text-sm gap-1.5"
            data-testid="btn-toggle-fav"
          >
            <Star size={15} weight={showOnlyFav ? "fill" : "regular"} />
            {showOnlyFav ? "Viser favoritter" : "Vis kun favoritter"}
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="h-9 text-sm bg-zinc-900 hover:bg-zinc-800 text-white"
            data-testid="btn-go-indtast"
          >
            Gå til indtastning
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg efter projekt, programniveau, aktivitet eller ansvarlig…"
            className="pl-9 h-10 bg-white border-zinc-200"
            data-testid="my-search-input"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-md p-1" data-testid="mine-level-filters">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`filter-${f.key}`}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                filter === f.key
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-md p-1" data-testid="mine-status-filters">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              data-testid={`status-filter-${f.key}`}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === f.key
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* My */}
      <section className="mb-8" data-testid="section-mine">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-outfit text-lg font-semibold text-zinc-950">Mine aktuelle aktiviteter</h2>
          <span className="text-xs text-zinc-500 px-2 py-0.5 bg-zinc-100 rounded-full font-medium">
            {filteredMine.length}
          </span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 shadow-sm">
          {filteredMine.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">
              Ingen aktiviteter matcher. Tilføj nedenfor for at komme i gang.
            </div>
          ) : (
            filteredMine.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                projectName={a.level === "program" ? "Programniveau" : projectMap[a.project_id]?.name}
                isFav={favIds.has(a.id)}
                onFav={() => handleFav(a.id)}
                onRemove={() => handleRemove(a.id)}
                mode="mine"
              />
            ))
          )}
        </div>
      </section>

      {/* Other available */}
      <section data-testid="section-open">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-outfit text-lg font-semibold text-zinc-950">
            {AVAILABLE_TITLE[statusFilter] || AVAILABLE_TITLE.all}
          </h2>
          <span className="text-xs text-zinc-500 px-2 py-0.5 bg-zinc-100 rounded-full font-medium">
            {filteredOther.length}
          </span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100 shadow-sm">
          {filteredOther.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">
              Ingen aktiviteter matcher dit filter.
            </div>
          ) : (
            filteredOther.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                projectName={a.level === "program" ? "Programniveau" : projectMap[a.project_id]?.name}
                onAdd={() => handleAdd(a.id)}
                mode="open"
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ActivityRow({ activity, projectName, isFav, onFav, onRemove, onAdd, mode }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50/60 transition-colors"
      data-testid={`activity-row-${activity.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
          {projectName || "—"}
        </div>
        <div className="text-sm text-zinc-950 font-medium truncate">{activity.name}</div>
        {activity.requires_note && (
          <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
            Note anbefales
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {mode === "mine" && (
          <>
            <button
              onClick={onFav}
              className={`p-1.5 rounded-md transition-colors ${
                isFav ? "text-amber-500" : "text-zinc-400 hover:text-amber-500"
              }`}
              data-testid={`fav-${activity.id}`}
              title={isFav ? "Fjern favorit" : "Marker som favorit"}
            >
              <Star size={16} weight={isFav ? "fill" : "regular"} />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="h-8 text-xs gap-1"
              data-testid={`remove-${activity.id}`}
            >
              <X size={13} /> Fjern
            </Button>
          </>
        )}
        {mode === "open" && (
          <Button
            size="sm"
            onClick={onAdd}
            className="h-8 text-xs gap-1 bg-zinc-900 hover:bg-zinc-800 text-white"
            data-testid={`add-${activity.id}`}
          >
            <Plus size={13} /> Tilføj
          </Button>
        )}
      </div>
    </div>
  );
}
