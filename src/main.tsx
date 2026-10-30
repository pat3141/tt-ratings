import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Compare from './pages/Compare';
import { ClubPage, Clubs } from './pages/Clubs';
import { EventPage, Events } from './pages/Events';
import Home from './pages/Home';
import PlayerPage from './pages/PlayerPage';
import Players from './pages/Players';
import './styles.css';

// Hash routing: deep links work on GitHub Pages without a 404 redirect hack.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/players', element: <Players /> },
      { path: '/player/:id', element: <PlayerPage /> },
      { path: '/compare', element: <Compare /> },
      { path: '/events', element: <Events /> },
      { path: '/event/:id', element: <EventPage /> },
      { path: '/clubs', element: <Clubs /> },
      { path: '/club/:id', element: <ClubPage /> },
      { path: '*', element: <Home /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
