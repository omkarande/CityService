import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import Home from './screens/Home';
import City from './screens/City';
import Results from './screens/Results';
import PlatformDetail from './screens/PlatformDetail';
import Nearby from './screens/Nearby';
import Saved from './screens/Saved';
import Account from './screens/Account';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/city/:cityId" element={<City />} />
        <Route path="/l/:localityId" element={<Results />} />
        <Route path="/l/:localityId/:platformId" element={<PlatformDetail />} />
        <Route path="/nearby" element={<Nearby />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
