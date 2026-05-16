import React from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';

interface AppShellProps {
  children: React.ReactNode;
  currentPage: string;
  selectedPlaylistId?: number | null;
  setPage: (page: any, id?: number) => void;
}

const AppShell: React.FC<AppShellProps> = ({ children, currentPage, selectedPlaylistId, setPage }) => {
  return (
    <div className="app-shell">
      <Sidebar currentPage={currentPage} selectedPlaylistId={selectedPlaylistId} setPage={setPage} />
      <MainContent>{children}</MainContent>
    </div>
  );
};

export default AppShell;
