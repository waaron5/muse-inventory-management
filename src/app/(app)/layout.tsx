import { Shell } from "@/components/shell/shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <Shell>{children}</Shell>;
}
