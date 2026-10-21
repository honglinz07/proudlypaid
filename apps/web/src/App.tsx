import { BrowserRouter, Route, Routes } from "react-router";
import { SiteLayout } from "./components/SiteLayout";
import { LocaleProvider } from "./lib/locale";
import { FaqPage } from "./pages/FaqPage";
import { ContributePage } from "./pages/ContributePage";
import { HomePage } from "./pages/HomePage";
import { ManifestoPage } from "./pages/ManifestoPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SearchPage } from "./pages/SearchPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="contribute" element={<ContributePage />} />
        <Route path="manifesto" element={<ManifestoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LocaleProvider>
  );
}
