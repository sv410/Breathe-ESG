import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Ingest from "@/pages/ingest";
import Batches from "@/pages/batches";
import Records from "@/pages/records";
import Clients from "@/pages/clients";
import Login from "@/pages/login";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  return <Layout>{children}</Layout>;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/ingest">
        <ProtectedLayout><Ingest /></ProtectedLayout>
      </Route>
      <Route path="/batches">
        <ProtectedLayout><Batches /></ProtectedLayout>
      </Route>
      <Route path="/records">
        <ProtectedLayout><Records /></ProtectedLayout>
      </Route>
      <Route path="/clients">
        <ProtectedLayout><Clients /></ProtectedLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
