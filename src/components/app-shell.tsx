import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Newspaper,
  FolderTree,
  FileText,
  BarChart3,
  Moon,
  Sun,
  ChevronsUpDown,
  Check,
  Globe,
  PenSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Blogs", url: "/blogs", icon: Newspaper },
  { title: "Categorias", url: "/categorias", icon: FolderTree },
  { title: "Postagens", url: "/postagens", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
] as const;

function BlogSwitcher() {
  const { blogs, activeBlog, setActiveBlogId } = useStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
          <span
            className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md text-xs font-bold text-primary-foreground"
            style={{ background: activeBlog?.color ?? "var(--gradient-brand)" }}
          >
            {activeBlog?.logo ? (
              <img src={activeBlog.logo} alt="" className="size-full object-cover" />
            ) : (
              (activeBlog?.name.slice(0, 1).toUpperCase() ?? <Globe className="size-3.5" />)
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{activeBlog?.name ?? "Nenhum blog"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {activeBlog?.url ?? "Cadastre seu primeiro blog"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Blogs cadastrados</DropdownMenuLabel>
        {blogs.length === 0 && (
          <DropdownMenuItem disabled>Nenhum blog cadastrado</DropdownMenuItem>
        )}
        {blogs.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => setActiveBlogId(b.id)}>
            <span className="size-2 rounded-full" style={{ background: b.color }} />
            <span className="flex-1 truncate">{b.name}</span>
            {activeBlog?.id === b.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/blogs">Gerenciar blogs</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-2 px-1">
          <span className="gradient-brand grid size-8 place-items-center rounded-lg text-primary-foreground shadow-lift">
            <PenSquare className="size-4" />
          </span>
          <span className="font-display text-base font-bold tracking-tight">PostFlow</span>
        </div>
        <BlogSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button variant="outline" onClick={toggle} className="justify-start gap-2">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">
              Controle de postagens
            </span>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}