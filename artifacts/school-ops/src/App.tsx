import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const AnnouncementsPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.AnnouncementsPage })));
const AttendanceCreatePage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.AttendanceCreatePage })));
const AttendancePage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.AttendancePage })));
const DashboardPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.DashboardPage })));
const FinancePage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.FinancePage })));
const LoginPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.LoginPage })));
const SalaryReceiptPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.SalaryReceiptPage })));
const SettingsPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.SettingsPage })));
const StudentProfilePage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.StudentProfilePage })));
const ReportCardPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.ReportCardPage })));
const StudentsPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.StudentsPage })));
const SupportPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.SupportPage })));
const TimetablePage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.TimetablePage })));
const TransactionDetailPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.TransactionDetailPage })));
const TransactionsPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.TransactionsPage })));
const UserManualPage = lazy(() => import('@/pages/school-pages').then((module) => ({ default: module.UserManualPage })));
const ExpenseCreatePage = lazy(() => import('@/pages/operations-page').then((module) => ({ default: module.ExpenseCreatePage })));
const OperationsPage = lazy(() => import('@/pages/operations-page').then((module) => ({ default: module.OperationsPage })));
const ProfilePage = lazy(() => import('@/pages/profile-page').then((module) => ({ default: module.ProfilePage })));
const SubjectsPage = lazy(() => import('@/pages/subjects-page').then((module) => ({ default: module.SubjectsPage })));
const UserAccountPage = lazy(() => import('@/pages/users-page').then((module) => ({ default: module.UserAccountPage })));
const UsersPage = lazy(() => import('@/pages/users-page').then((module) => ({ default: module.UsersPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
        <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/manual" component={UserManualPage} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/transactions/:transactionId" component={TransactionDetailPage} />
        <Route path="/salary-receipts/:salaryId" component={SalaryReceiptPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/students" component={StudentsPage} />
        <Route path="/students/:studentId" component={StudentProfilePage} />
        <Route path="/students/:studentId/report" component={ReportCardPage} />
        <Route path="/attendance/create" component={AttendanceCreatePage} />
        <Route path="/attendance" component={AttendancePage} />
        <Route path="/finance" component={FinancePage} />
        <Route path="/expenses/create" component={ExpenseCreatePage} />
        <Route path="/expenses" component={OperationsPage} />
        <Route path="/announcements" component={AnnouncementsPage} />
        <Route path="/timetable" component={TimetablePage} />
        <Route path="/subjects" component={SubjectsPage} />
        <Route path="/users/new" component={UserAccountPage} />
        <Route path="/users/:userId" component={UserAccountPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/operations" component={OperationsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
        </Switch>
      </Suspense>
    </RoutedErrorBoundary>
  );
}

function RouteLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[hsl(var(--background))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
      Loading workspace…
    </main>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
