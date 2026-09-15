import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ExpenseCreatePage, OperationsPage } from '@/pages/operations-page';
import { ProfilePage } from '@/pages/profile-page';
import { SubjectsPage } from '@/pages/subjects-page';
import { UsersPage } from '@/pages/users-page';
import {
  AnnouncementsPage,
  AttendanceCreatePage,
  AttendancePage,
  DashboardPage,
  FinancePage,
  LoginPage,
  SalaryReceiptPage,
  SettingsPage,
  StudentProfilePage,
  ReportCardPage,
  StudentsPage,
  SupportPage,
  TransactionDetailPage,
  TransactionsPage,
  TimetablePage,
  UserManualPage,
} from '@/pages/school-pages';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
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
        <Route path="/users" component={UsersPage} />
        <Route path="/operations" component={OperationsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
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
