interface HeaderProps {
  onLoadGraph: () => void;
  onStartScan: () => void;
  isLoading: boolean;
  isScanning: boolean;
  graphLoaded: boolean;
}

export default function Header({
  onLoadGraph,
  onStartScan,
  isLoading,
  isScanning,
  graphLoaded,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <h1>QueryMesh</h1>
        </div>
        <span className="header-subtitle">Distributed SQL Debugger & Dependency Visualizer</span>
      </div>

      <div className="header-actions">
        <button
          onClick={onLoadGraph}
          disabled={isLoading}
          className="header-btn btn-primary"
        >
          {isLoading ? (
            <>
              <span className="btn-spinner" />
              Loading...
            </>
          ) : (
            <>
              <span className="btn-icon">🔄</span>
              {graphLoaded ? 'Refresh Graph' : 'Load Graph'}
            </>
          )}
        </button>

        <button
          onClick={onStartScan}
          disabled={isScanning || !graphLoaded}
          className="header-btn btn-scan"
        >
          {isScanning ? (
            <>
              <span className="btn-spinner" />
              Scanning...
            </>
          ) : (
            <>
              <span className="btn-icon">🔍</span>
              Scan Violations
            </>
          )}
        </button>
      </div>
    </header>
  );
}
