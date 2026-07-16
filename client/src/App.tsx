import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Residents from "./pages/Residents";
import ResidentPackages from "./pages/ResidentPackages";
import CheckIn from "./pages/CheckIn";
import EmailSettings from "./pages/EmailSettings";
import ResidentLogin from "./pages/ResidentLogin";
import ResidentDashboard from "./pages/ResidentDashboard";
import Settings from "./pages/Settings";

import Statistics from "./pages/Statistics";
import ResidentProfile from "./pages/ResidentProfile";
import ArchivedResidents from "./pages/ArchivedResidents";
import FixCheckout from "./pages/FixCheckout";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/checkin" component={CheckIn} />
      <Route path="/resident/login" component={ResidentLogin} />
      <Route path="/resident/dashboard" component={ResidentDashboard} />
      <Route path="/fix-checkout" component={FixCheckout} />
      <Route path="/">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/residents">
        <DashboardLayout>
          <Residents />
        </DashboardLayout>
      </Route>
      <Route path="/residents/:id">
        <DashboardLayout>
          <ResidentProfile />
        </DashboardLayout>
      </Route>
      <Route path="/residents/:id/packages">
        <DashboardLayout>
          <ResidentPackages />
        </DashboardLayout>
      </Route>
      <Route path="/settings/email">
        <DashboardLayout>
          <EmailSettings />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>
      <Route path="/archived">
        <DashboardLayout>
          <ArchivedResidents />
        </DashboardLayout>
      </Route>

      <Route path="/statistics">
        <DashboardLayout>
          <Statistics />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
