import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider } from "@/store/UserContext";
import Header from "@/components/Header";
import IndtastTimer from "@/pages/IndtastTimer";
import MineAktiviteter from "@/pages/MineAktiviteter";
import Programoverblik from "@/pages/Programoverblik";
import Administration from "@/pages/Administration";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <div className="min-h-screen bg-zinc-50 text-zinc-900 font-ibm-plex">
          <Header />
          <main data-testid="app-main">
            <Routes>
              <Route path="/" element={<IndtastTimer />} />
              <Route path="/mine" element={<MineAktiviteter />} />
              <Route path="/overblik" element={<Programoverblik />} />
              <Route path="/admin" element={<Administration />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Toaster position="bottom-right" />
        </div>
      </UserProvider>
    </BrowserRouter>
  );
}
