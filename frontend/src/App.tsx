import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { socket } from './services/socket';
import { Login } from './components/Login';
import { GameSelect } from './components/GameSelect';
import { GlobalLobby } from './components/GlobalLobby';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';
import { TrucoTable } from './components/TrucoTable';

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const playerName = useGameStore((state) => state.playerName);
  const selectedGame = useGameStore((state) => state.selectedGame);

  useEffect(() => {
    // Si el usuario refresca la página, intenta recuperar la sesión anterior
    const savedName = localStorage.getItem('mosca_playerName');
    const savedRoomId = sessionStorage.getItem('mosca_roomId');
    const savedGameType = sessionStorage.getItem('mosca_gameType');

    if (savedName) {
      useGameStore.getState().setPlayerName(savedName);
      if (savedRoomId && savedGameType) {
        useGameStore.getState().setSelectedGame(savedGameType as 'MOSCA' | 'TRUCO');
      }
      if (!socket.connected) {
        socket.connect();
      }
    }

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="app-container">
      {!playerName ? (
          <Login />
      ) : !selectedGame ? (
          <GameSelect />
      ) : !gameState ? (
          <GlobalLobby />
      ) : gameState.status === 'WAITING' ? (
          <Lobby />
      ) : gameState.gameType === 'TRUCO' ? (
          <TrucoTable />
      ) : (
          <GameTable />
      )}
    </div>
  );
}

export default App;
