import { useAtomValue } from "@effect/atom-react";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  resolveEnvironmentMachineKind,
} from "@t3tools/contracts";
import { T, useGT } from "gt-react";
import { BellIcon, BellOffIcon, EyeIcon, EyeOffIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { environmentCatalog } from "~/connection/catalog";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { type EnvironmentPresentation } from "~/state/environments";
import { environmentSession } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import {
  formatSessionRemainingDays,
  isEnvironmentNotificationsMuted,
  planEnvironmentNotificationMuteToggle,
  planSidebarEnvironmentVisibilityChange,
  resolveEffectiveExcludedEnvironmentIds,
} from "~/teamEnvironmentPreferences";
import { useUiStateStore } from "~/uiStateStore";
import { EnvironmentMachineIcon } from "../EnvironmentMachineIcon";
import { Button } from "../ui/button";

function FleetEnvironmentRow(props: {
  readonly environment: EnvironmentPresentation;
  readonly nowMs: number;
  readonly isVisibleInSidebar: boolean;
  readonly isMuted: boolean;
  readonly onToggleSidebarVisibility: (environmentId: EnvironmentId) => void;
  readonly onToggleMute: (environmentId: EnvironmentId) => void;
  readonly onPingOne: (environmentId: EnvironmentId) => void;
}) {
  const gt = useGT();
  const { environment } = props;
  const sessionState = useAtomValue(
    environmentSession.sessionStateValueAtom(environment.environmentId),
  );
  const phase = environment.connection.phase;
  const isConnected = phase === "connected";
  const isBusy = phase === "connecting" || phase === "reconnecting";
  const canOperate = sessionState?.scopes?.includes(AuthOrchestrationOperateScope) ?? false;
  const isRenewable = sessionState?.sessionMethod === "dpop-access-token";
  const expiresAtMs = sessionState?.expiresAt?.epochMilliseconds ?? null;
  const remainingDays =
    expiresAtMs !== null ? formatSessionRemainingDays(expiresAtMs, props.nowMs) : null;
  const serverVersion = environment.serverConfig?.environment.serverVersion ?? null;
  const machineKind = resolveEnvironmentMachineKind(environment.serverConfig);

  const statusToneClass = isConnected
    ? "bg-success"
    : isBusy
      ? "bg-warning animate-pulse"
      : "bg-muted-foreground/50";

  const statusText = !environment.entry.enabled
    ? gt("Off")
    : isConnected
      ? gt("Online")
      : isBusy
        ? gt("Connecting")
        : gt("Offline");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${statusToneClass}`} />
        <EnvironmentMachineIcon
          aria-hidden
          kind={machineKind}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{environment.label}</span>
            <span className="text-muted-foreground">{statusText}</span>
            {serverVersion ? (
              <span className="truncate font-mono text-2xs text-muted-foreground">
                v{serverVersion}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
            {environment.displayUrl ? (
              <span className="truncate font-mono">{environment.displayUrl}</span>
            ) : null}
            {sessionState ? (
              <span>{canOperate ? gt("Read + message") : gt("Read-only")}</span>
            ) : null}
            {isRenewable ? (
              <span>
                <T>Auto-renews (30d window)</T>
              </span>
            ) : remainingDays !== null ? (
              <span>{gt("Session expires in {days}d", { days: remainingDays })}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="xs"
          variant="ghost"
          aria-label={
            props.isVisibleInSidebar
              ? gt("Hide {environment} from sidebar", { environment: environment.label })
              : gt("Show {environment} in sidebar", { environment: environment.label })
          }
          onClick={() => props.onToggleSidebarVisibility(environment.environmentId)}
        >
          {props.isVisibleInSidebar ? (
            <EyeIcon aria-hidden className="size-3.5" />
          ) : (
            <EyeOffIcon aria-hidden className="size-3.5 text-muted-foreground" />
          )}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          aria-label={
            props.isMuted
              ? gt("Unmute notifications for {environment}", { environment: environment.label })
              : gt("Mute notifications for {environment}", { environment: environment.label })
          }
          onClick={() => props.onToggleMute(environment.environmentId)}
        >
          {props.isMuted ? (
            <BellOffIcon aria-hidden className="size-3.5 text-muted-foreground" />
          ) : (
            <BellIcon aria-hidden className="size-3.5" />
          )}
        </Button>
        {environment.entry.enabled ? (
          <Button
            size="xs"
            variant="ghost"
            aria-label={gt("Ping {environment}", { environment: environment.label })}
            onClick={() => props.onPingOne(environment.environmentId)}
          >
            <RefreshCwIcon aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function FleetStatusPanel(props: {
  readonly environments: readonly EnvironmentPresentation[];
  readonly primaryEnvironmentId: EnvironmentId | null;
}) {
  const gt = useGT();
  const [pinging, setPinging] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastPingLabel, setLastPingLabel] = useState<string | null>(null);
  const retryNow = useAtomCommand(environmentCatalog.retryNow);

  const persistedExcluded = useUiStateStore((state) => state.sidebarExcludedEnvironmentIds);
  const hideNewRemotes = useUiStateStore((state) => state.sidebarHideNewRemoteEnvironments);
  const includedRemotes = useUiStateStore((state) => state.sidebarIncludedRemoteEnvironmentIds);
  const setSidebarVisibility = useUiStateStore((state) => state.setSidebarEnvironmentVisibility);

  const muteRemotes = useUiStateStore((state) => state.muteRemoteEnvironmentNotifications);
  const mutedIds = useUiStateStore((state) => state.mutedEnvironmentIds);
  const unmutedRemotes = useUiStateStore((state) => state.unmutedRemoteEnvironmentIds);
  const setMuteLists = useUiStateStore((state) => state.setEnvironmentNotificationMuteLists);

  const remoteEnvironments = props.environments.filter(
    (environment) =>
      props.primaryEnvironmentId === null ||
      environment.environmentId !== props.primaryEnvironmentId,
  );

  if (remoteEnvironments.length === 0) {
    return null;
  }

  const allEnvironmentIds = props.environments.map((environment) => environment.environmentId);
  const sidebarPrefs = {
    sidebarExcludedEnvironmentIds: persistedExcluded,
    sidebarHideNewRemoteEnvironments: hideNewRemotes,
    sidebarIncludedRemoteEnvironmentIds: includedRemotes,
  };
  const excludedIds = resolveEffectiveExcludedEnvironmentIds({
    environmentIds: allEnvironmentIds,
    primaryEnvironmentId: props.primaryEnvironmentId,
    preferences: sidebarPrefs,
  });
  const mutePrefs = {
    muteRemoteEnvironmentNotifications: muteRemotes,
    mutedEnvironmentIds: mutedIds,
    unmutedRemoteEnvironmentIds: unmutedRemotes,
  };

  const onlineCount = remoteEnvironments.filter(
    (environment) => environment.connection.phase === "connected",
  ).length;
  const offlineCount = remoteEnvironments.length - onlineCount;

  const pingEnvironment = async (environment: EnvironmentPresentation) => {
    if (!environment.entry.enabled) {
      return;
    }
    if (environment.connection.phase === "connected") {
      appAtomRegistry.refresh(environmentSession.sessionStateAtom(environment.environmentId));
      return;
    }
    await retryNow(environment.environmentId);
    appAtomRegistry.refresh(environmentSession.sessionStateAtom(environment.environmentId));
  };

  const handlePingAll = async () => {
    if (pinging) {
      return;
    }
    setPinging(true);
    try {
      await Promise.allSettled(
        remoteEnvironments.map((environment) => pingEnvironment(environment)),
      );
      const completedAt = Date.now();
      setNowMs(completedAt);
      setLastPingLabel(
        new Date(completedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    } finally {
      setPinging(false);
    }
  };

  const handleToggleSidebarVisibility = (environmentId: EnvironmentId) => {
    const nextExcluded = new Set(excludedIds);
    if (nextExcluded.has(environmentId)) {
      nextExcluded.delete(environmentId);
    } else {
      nextExcluded.add(environmentId);
    }
    setSidebarVisibility(
      planSidebarEnvironmentVisibilityChange({
        environmentIds: allEnvironmentIds,
        primaryEnvironmentId: props.primaryEnvironmentId,
        nextExcludedIds: nextExcluded,
        currentPreferences: sidebarPrefs,
      }),
    );
  };

  const handleToggleMute = (environmentId: EnvironmentId) => {
    setMuteLists(
      planEnvironmentNotificationMuteToggle({
        environmentId,
        primaryEnvironmentId: props.primaryEnvironmentId,
        currentPreferences: mutePrefs,
      }),
    );
  };

  return (
    <div className="mb-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">
            <T>Remote fleet status</T>
          </div>
          <div className="text-xs text-muted-foreground">
            {gt("{online} online · {offline} offline", {
              online: onlineCount,
              offline: offlineCount,
            })}
            {lastPingLabel ? ` · ${gt("Last ping {time}", { time: lastPingLabel })}` : ""}
          </div>
        </div>
        <Button size="xs" variant="outline" disabled={pinging} onClick={() => void handlePingAll()}>
          <RefreshCwIcon aria-hidden className={`size-3.5 ${pinging ? "animate-spin" : ""}`} />
          <span>{pinging ? gt("Pinging…") : gt("Ping all")}</span>
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {remoteEnvironments.map((environment) => (
          <FleetEnvironmentRow
            key={environment.environmentId}
            environment={environment}
            nowMs={nowMs}
            isVisibleInSidebar={!excludedIds.has(environment.environmentId)}
            isMuted={isEnvironmentNotificationsMuted({
              environmentId: environment.environmentId,
              primaryEnvironmentId: props.primaryEnvironmentId,
              preferences: mutePrefs,
            })}
            onToggleSidebarVisibility={handleToggleSidebarVisibility}
            onToggleMute={handleToggleMute}
            onPingOne={(environmentId) => {
              const target = remoteEnvironments.find(
                (candidate) => candidate.environmentId === environmentId,
              );
              if (target) {
                void pingEnvironment(target);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
