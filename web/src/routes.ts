import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Route-level code splitting.
 *
 * Every page used to be imported statically, so first paint downloaded all 17 pages
 * (plus recharts) before showing anything. Pages are now separate chunks that load on
 * demand, and each one exposes `preload()` so the sidebar can warm a chunk on hover/focus.
 */
type PageComponent = LazyExoticComponent<ComponentType<any>> & { preload: () => void };

function lazyPage<M extends Record<string, unknown>, K extends keyof M & string>(
  loader: () => Promise<M>,
  exportName: K,
): PageComponent {
  let pending: Promise<M> | null = null;
  const load = () => (pending ??= loader());
  const Component = lazy(() => load().then((m) => ({ default: m[exportName] as ComponentType<any> })));
  return Object.assign(Component, { preload: () => void load().catch(() => (pending = null)) });
}

export const Pages = {
  Login: lazyPage(() => import("./pages/LoginPage"), "LoginPage"),
  Register: lazyPage(() => import("./pages/RegisterPage"), "RegisterPage"),
  Dashboard: lazyPage(() => import("./pages/DashboardPage"), "DashboardPage"),
  WarRoom: lazyPage(() => import("./pages/WarRoomPage"), "WarRoomPage"),
  DungeonGate: lazyPage(() => import("./pages/DungeonGatePage"), "DungeonGatePage"),
  Collection: lazyPage(() => import("./pages/CollectionPage"), "CollectionPage"),
  Rewards: lazyPage(() => import("./pages/RewardsPage"), "RewardsPage"),
  Arena: lazyPage(() => import("./pages/ArenaPage"), "ArenaPage"),
  Social: lazyPage(() => import("./pages/SocialPage"), "SocialPage"),
  Challenges: lazyPage(() => import("./pages/ChallengesPage"), "ChallengesPage"),
  Leaderboard: lazyPage(() => import("./pages/LeaderboardPage"), "LeaderboardPage"),
  Profile: lazyPage(() => import("./pages/ProfilePage"), "ProfilePage"),
  Guide: lazyPage(() => import("./pages/GuidePage"), "GuidePage"),
  ModeSelection: lazyPage(() => import("./pages/ModeSelectionPage"), "ModeSelectionPage"),
  Landing: lazyPage(() => import("./pages/LandingPage"), "LandingPage"),
  Pricing: lazyPage(() => import("./pages/PricingPage"), "PricingPage"),
  Terms: lazyPage(() => import("./pages/LegalPages"), "TermsPage"),
  Privacy: lazyPage(() => import("./pages/LegalPages"), "PrivacyPage"),
  Forgot: lazyPage(() => import("./pages/PasswordPages"), "ForgotPasswordPage"),
  Reset: lazyPage(() => import("./pages/PasswordPages"), "ResetPasswordPage"),
  Settings: lazyPage(() => import("./pages/SettingsPage"), "SettingsPage"),
  Achievements: lazyPage(() => import("./pages/AchievementsPage"), "AchievementsPage"),
  Notifications: lazyPage(() => import("./pages/NotificationsPage"), "NotificationsPage"),
} as const;

/** The floating AI chat is never needed for first paint. */
export const OracleArchitect = lazyPage(() => import("./components/OracleArchitect"), "OracleArchitect");

const PRELOAD_BY_PATH: Record<string, () => void> = {
  "/": Pages.Dashboard.preload,
  "/war-room": Pages.WarRoom.preload,
  "/dungeon-gate": Pages.DungeonGate.preload,
  "/collection": Pages.Collection.preload,
  "/rewards": Pages.Rewards.preload,
  "/arena": Pages.Arena.preload,
  "/social": Pages.Social.preload,
  "/challenges": Pages.Challenges.preload,
  "/leaderboard": Pages.Leaderboard.preload,
  "/profile": Pages.Profile.preload,
  "/guide": Pages.Guide.preload,
  "/mode-selection": Pages.ModeSelection.preload,
  "/achievements": Pages.Achievements.preload,
  "/notifications": Pages.Notifications.preload,
};

/** Warm the chunk for a route (call on link hover/focus). Safe to call repeatedly. */
export function prefetchRoute(path: string): void {
  PRELOAD_BY_PATH[path]?.();
}

/** After first paint, quietly fetch the pages people open most so the first click is instant. */
export function prefetchCommonRoutes(): void {
  const run = () => {
    Pages.DungeonGate.preload();
    Pages.Rewards.preload();
    Pages.Profile.preload();
    OracleArchitect.preload();
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (ric) ric(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
}
