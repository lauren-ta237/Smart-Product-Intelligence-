import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Notice the 'type' keyword added here:
import { type ReactNode } from "react"; 

interface ProvidersProps {
  children: ReactNode;
}

const client = new QueryClient();

export default function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}