import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import Display from "./pages/Display";
import WorkoutManager from "./pages/WorkoutManager";
import PDFUpload from "./pages/PDFUpload";
import AutoImport from "./pages/AutoImport";

/**
 * Design Philosophy: Industrial Futurista
 * - Tema escuro (preto profundo)
 * - Acentos neon (laranja + ciano)
 * - Tipografia: Space Mono (títulos) + Roboto (corpo)
 * 
 * Rotas:
 * / - Treino de segunda-feira (padrão)
 * /manager - Gerenciar múltiplos treinos
 * /editor - Criar/editar treino
 * /display - Exibir treino criado
 */

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/manager" component={WorkoutManager} />
      <Route path="/pdf-upload" component={PDFUpload} />
      <Route path="/auto-import" component={AutoImport} />
      <Route path="/editor" component={Editor} />
      <Route path="/display" component={Display} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
