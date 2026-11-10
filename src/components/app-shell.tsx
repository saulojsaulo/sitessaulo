import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Newspaper,
  BarChart3,
  DollarSign,
  Moon,
  Sun,
  ChevronsUpDown,
  Check,
  Globe,
  PenSquare,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

type NavUrl = "/" | "/blogs" | "/analytics";

interface NavItem {
  title: string;
  url: NavUrl;
  icon: LucideIcon;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Visão geral",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Sites",
    items: [{ title: "Blogs", url: "/blogs", icon: Newspaper }],
  },
  {
    label: "Resultados",
    items: [{ title: "Analytics", url: "/analytics", icon: BarChart3 }],
  },
];

const allItems: NavItem[] = navGroups.flatMap((g) => g.items);

/** "/" só é ativo na raiz; os demais também valem para sub-rotas. */
const isActivePath = (pathname: string, url: string) =>
  url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);

function BlogSwitcher() {
  const { blogs, activeBlog, setActiveBlogId } = useStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
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
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate font-medium">{activeBlog?.name ?? "Nenhum blog"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {activeBlog?.url ?? "Cadastre seu primeiro blog"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Blogs cadastrados</DropdownMenuLabel>
        {blogs.length === 0 && <DropdownMenuItem disabled>Nenhum blog cadastrado</DropdownMenuItem>}
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <Link to="/" className="flex items-center gap-2.5 px-1" aria-label="PostFlow — início">
          <span className="gradient-brand grid size-8 shrink-0 place-items-center rounded-lg text-primary-foreground shadow-lift">
            <PenSquare className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            PostFlow
          </span>
        </Link>
        <BlogSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.url)}
                      tooltip={item.title}
                    >
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
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggle}
              tooltip={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Paleta de comandos (⌘K / Ctrl+K): ir para uma página, trocar de blog, ações rápidas. */
function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { blogs, activeBlog, setActiveBlogId } = useStore();
  const { theme, toggle } = useTheme();

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Para onde você quer ir? Digite para buscar…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          <CommandItem
            value="receita adsterra anúncios ganhos dinheiro cpm"
            onSelect={() =>
              run(() => void navigate({ to: "/analytics", search: { aba: "receita" } }))
            }
          >
            <DollarSign className="size-4" /> Ver receita (Adsterra)
          </CommandItem>
          <CommandItem value="alternar tema modo escuro claro" onSelect={() => run(toggle)}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ir para">
          {allItems.map((item) => (
            <CommandItem
              key={item.url}
              value={`ir para ${item.title}`}
              onSelect={() => run(() => void navigate({ to: item.url }))}
            >
              <item.icon className="size-4" /> {item.title}
            </CommandItem>
          ))}
        </CommandGroup>
        {blogs.length > 1 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Trocar de blog">
              {blogs.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`blog ${b.name} ${b.url}`}
                  onSelect={() => run(() => setActiveBlogId(b.id))}
                >
                  <span className="size-2 rounded-full" style={{ background: b.color }} />
                  <span className="flex-1 truncate">{b.name}</span>
                  {activeBlog?.id === b.id ? <Check className="size-4 text-primary" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

function HeaderBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeBlog } = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const group = navGroups.find((g) => g.items.some((i) => isActivePath(pathname, i.url)));
  const current = allItems.find((i) => isActivePath(pathname, i.url));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger aria-label="Abrir ou fechar o menu" />
      <span className="hidden h-5 w-px bg-border sm:block" />
      <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5 text-sm">
        {group && group.label !== current?.title ? (
          <span className="hidden text-muted-foreground sm:inline">{group.label} /</span>
        ) : null}
        <span className="truncate font-medium">{current?.title ?? "PostFlow"}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Buscar páginas e ações (Ctrl+K)"
        >
          <Search className="size-4" />
          <span className="hidden md:inline">Buscar…</span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium md:inline">
            Ctrl K
          </kbd>
        </button>
        {activeBlog ? (
          <Link
            to="/blogs"
            title="Blog ativo — clique para gerenciar"
            className="hidden min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:inline-flex"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: activeBlog.color }}
            />
            <span className="max-w-36 truncate">{activeBlog.name}</span>
          </Link>
        ) : null}
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}

function PageArea({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div key={pathname} className="animate-page-in">
        {children}
      </div>
    </main>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
          >
            Pular para o conteúdo
          </a>
          <HeaderBar />
          <PageArea>{children}</PageArea>
        </div>
      </div>
    </SidebarProvider>
  );
}
