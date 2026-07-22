import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { socket } from './services/socket';
import { Login } from './components/Login';
import { GlobalLobby } from './components/GlobalLobby';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const playerName = useGameStore((state) => state.playerName);

  useEffect(() => {
    // Escucha eventos globales si los hay que requieran montar/desmontar
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="app-container">
      {!playerName ? (
          <Login />
      ) : !gameState ? (
          <GlobalLobby />
      ) : gameState.status === 'WAITING' ? (
          <Lobby />
      ) : (
          <GameTable />
      )}
    </div>
  );
}

export default App;
