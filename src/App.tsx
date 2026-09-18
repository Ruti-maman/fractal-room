import { Navigate, Route, Routes } from "react-router-dom";
import ScreenPage from "./pages/ScreenPage";
import AdminPage from "./pages/AdminPage";

function App() {
  return (
    <Routes>
      <Route path="/screen/:screenNumber" element={<ScreenPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/screen/1" replace />} />
    </Routes>
  );
}

export default App;
