import { useState } from "react";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Profile from "./pages/Profile";
import Playlists from "./pages/Playlists";
import AddGameWizard from "./components/AddGame/AddGameWizard";
import GameDetails from "./pages/GameDetails";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import PerformanceAdvisor from "./pages/PerformanceAdvisor";
import AppShell from "./components/Layout/AppShell";

type Page =
  | "home"
  | "library"
  | "details"
  | "analytics"        // was "stats"
  | "settings"
  | "profile"
  | "playlists"
  | "compatibility";   // was "performance"

function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [perfSeedGameId, setPerfSeedGameId] = useState<number | null>(null);

  const navigateToDetails = (id: number) => {
    setSelectedGameId(id);
    setPage("details");
  };

  const handleSidebarNav = (targetPage: Page, id?: number) => {
    if (targetPage === 'details' && id !== undefined) {
      setSelectedGameId(id);
    }
    if (targetPage === 'playlists') {
      setSelectedPlaylistId(id ?? null);
    }
    setPage(targetPage);
  };

  const renderPage = () => {
    switch (page) {
      case "home":
        return (
          <Home
            onAddGame={() => setIsAddModalOpen(true)}
            onViewLibrary={() => setPage("library")}
            onViewStats={() => setPage("analytics")}
            onViewCompatibility={() => setPage("compatibility")}
            onSelectGame={navigateToDetails}
          />
        );
      case "library":
        return (
          <Library
            onSelectGame={navigateToDetails}
            onAddGame={() => setIsAddModalOpen(true)}
            onBack={() => setPage("home")}
          />
        );
      case "details":
        return selectedGameId !== null ? (
          <GameDetails
            gameId={selectedGameId}
            onBack={() => setPage("library")}
            onDeleted={() => setPage("library")}
            onSelectGame={navigateToDetails}
            onGoSettings={() => setPage("settings")}
          />
        ) : null;
      case "analytics":
        return <Stats onBack={() => setPage("home")} />;
      case "settings":
        return <Settings onRefreshLibrary={() => setPage("library")} />;
      case "compatibility":
        return (
          <PerformanceAdvisor
            seedGameId={perfSeedGameId}
            onClearSeed={() => setPerfSeedGameId(null)}
            onBack={() => setPage("library")}
            onGoSettings={() => setPage("settings")}
          />
        );
      case "profile":
        return <Profile onBack={() => setPage("home")} />;
      case "playlists":
        return (
          <Playlists
            onBack={() => {
              setSelectedPlaylistId(null);
              setPage("home");
            }}
            selectedPlaylistId={selectedPlaylistId}
            onClearPlaylistSelection={() => setSelectedPlaylistId(null)}
            onOpenPlaylist={(id) => {
              setSelectedPlaylistId(id);
              setPage("playlists");
            }}
            onSelectGame={navigateToDetails}
          />
        );
      default:
        return (
          <Home
            onAddGame={() => setIsAddModalOpen(true)}
            onViewLibrary={() => setPage("library")}
            onViewStats={() => setPage("analytics")}
            onViewCompatibility={() => setPage("compatibility")}
            onSelectGame={navigateToDetails}
          />
        );
    }
  };

  return (
    <AppShell currentPage={page} selectedPlaylistId={selectedPlaylistId} setPage={handleSidebarNav}>
      <div style={{ padding: "0" }}>
        {renderPage()}
      </div>
      {isAddModalOpen && (
        <AddGameWizard
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(id) => {
            setIsAddModalOpen(false);
            if (id) {
              navigateToDetails(id);
            } else {
              setPage("library");
            }
          }}
        />
      )}
    </AppShell>
  );
}

export default App;
