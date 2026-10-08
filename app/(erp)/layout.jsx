import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { PeoplePayrollStoreProvider } from "@/lib/usePeoplePayrollStore";

export default function ERPLayout({ children }) {
  return (
    <ToastProvider>
      <PeoplePayrollStoreProvider>
        <AppShell>{children}</AppShell>
      </PeoplePayrollStoreProvider>
    </ToastProvider>
  );
}
