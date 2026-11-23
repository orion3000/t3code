import type { EnvironmentId, EnvironmentMachineKind } from "@t3tools/contracts";
import { T, useGT } from "gt-react";
import { BellIcon, BellOffIcon, ChevronDownIcon, ChevronUpIcon, ServerIcon } from "lucide-react";
import { useId, useState } from "react";

import { EnvironmentMachineIcon } from "../EnvironmentMachineIcon";
import { Checkbox } from "../ui/checkbox";

export function SidebarEnvironmentFilter(props: {
  readonly environments: readonly {
    readonly environmentId: EnvironmentId;
    readonly label: string;
  }[];
  readonly excludedEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly machineByEnvironmentId: ReadonlyMap<EnvironmentId, EnvironmentMachineKind>;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly onChange: (excludedIds: ReadonlySet<EnvironmentId>) => void;
  readonly hideNewRemoteEnvironments?: boolean;
  readonly onHideNewRemoteEnvironmentsChange?: (hide: boolean) => void;
  readonly mutedEnvironmentIds?: ReadonlySet<EnvironmentId>;
  readonly onToggleEnvironmentMute?: (environmentId: EnvironmentId) => void;
  readonly muteRemoteNotifications?: boolean;
  readonly onMuteRemoteNotificationsChange?: (mute: boolean) => void;
}) {
  const gt = useGT();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const selected = props.environments.filter(
    (environment) => !props.excludedEnvironmentIds.has(environment.environmentId),
  );
  const allSelected = selected.length === props.environments.length;
  const label = allSelected
    ? gt("All environments")
    : selected.length === 0
      ? gt("No environments")
      : selected.length === 1
        ? selected[0]!.label
        : gt("{count} environments", { count: selected.length });

  const primaryOnlySelected =
    props.primaryEnvironmentId !== null &&
    selected.length === 1 &&
    selected[0]!.environmentId === props.primaryEnvironmentId;

  const selectPrimaryOnly = () => {
    if (props.primaryEnvironmentId === null) {
      return;
    }
    const excluded = new Set<EnvironmentId>();
    for (const environment of props.environments) {
      if (environment.environmentId !== props.primaryEnvironmentId) {
        excluded.add(environment.environmentId);
      }
    }
    props.onChange(excluded);
  };

  return (
    <div className="shrink-0 border-t border-border/70 p-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left text-base outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-7 sm:text-sm"
      >
        <ServerIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {expanded ? (
          <ChevronUpIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded ? (
        <div
          id={panelId}
          role="group"
          aria-label={gt("Filter environments")}
          className="max-h-[min(18rem,calc(var(--available-height)-10rem))] overflow-y-auto"
        >
          <div className="flex items-center gap-1 pr-1">
            <label className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-base hover:bg-accent sm:min-h-7 sm:text-sm">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && selected.length > 0}
                onCheckedChange={(checked) =>
                  props.onChange(
                    checked
                      ? new Set()
                      : new Set([
                          ...props.excludedEnvironmentIds,
                          ...props.environments.map((environment) => environment.environmentId),
                        ]),
                  )
                }
              />
              <span className="truncate">
                <T>All environments</T>
              </span>
            </label>
            {props.primaryEnvironmentId !== null ? (
              <button
                type="button"
                disabled={primaryOnlySelected}
                onClick={selectPrimaryOnly}
                className="shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-50"
              >
                <T>This machine</T>
              </button>
            ) : null}
          </div>
          <div className="mx-2 my-1 h-px bg-border/70" />
          {props.environments.map((environment) => {
            const isMuted = props.mutedEnvironmentIds?.has(environment.environmentId) ?? false;
            return (
              <div
                key={environment.environmentId}
                className="flex items-center gap-1 rounded-sm pr-1 hover:bg-accent"
              >
                <label className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1 text-base sm:min-h-7 sm:text-sm">
                  <Checkbox
                    checked={!props.excludedEnvironmentIds.has(environment.environmentId)}
                    onCheckedChange={(checked) => {
                      const next = new Set(props.excludedEnvironmentIds);
                      if (checked) next.delete(environment.environmentId);
                      else next.add(environment.environmentId);
                      props.onChange(next);
                    }}
                  />
                  <EnvironmentMachineIcon
                    aria-hidden
                    kind={props.machineByEnvironmentId.get(environment.environmentId) ?? "server"}
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">{environment.label}</span>
                  {environment.environmentId === props.primaryEnvironmentId ? (
                    <span className="text-xs text-muted-foreground">
                      <T>This machine</T>
                    </span>
                  ) : null}
                </label>
                {props.onToggleEnvironmentMute ? (
                  <button
                    type="button"
                    aria-label={
                      isMuted
                        ? gt("Unmute notifications for {environment}", {
                            environment: environment.label,
                          })
                        : gt("Mute notifications for {environment}", {
                            environment: environment.label,
                          })
                    }
                    onClick={() => props.onToggleEnvironmentMute?.(environment.environmentId)}
                    className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  >
                    {isMuted ? (
                      <BellOffIcon aria-hidden className="size-3.5 opacity-60" />
                    ) : (
                      <BellIcon aria-hidden className="size-3.5" />
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
          {props.onHideNewRemoteEnvironmentsChange || props.onMuteRemoteNotificationsChange ? (
            <>
              <div className="mx-2 my-1 h-px bg-border/70" />
              {props.onHideNewRemoteEnvironmentsChange ? (
                <label className="flex min-h-7 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Checkbox
                    checked={props.hideNewRemoteEnvironments ?? true}
                    onCheckedChange={(checked) =>
                      props.onHideNewRemoteEnvironmentsChange?.(checked === true)
                    }
                  />
                  <span>
                    <T>Hide new remote environments</T>
                  </span>
                </label>
              ) : null}
              {props.onMuteRemoteNotificationsChange ? (
                <label className="flex min-h-7 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Checkbox
                    checked={props.muteRemoteNotifications ?? true}
                    onCheckedChange={(checked) =>
                      props.onMuteRemoteNotificationsChange?.(checked === true)
                    }
                  />
                  <span>
                    <T>Mute remote notifications</T>
                  </span>
                </label>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
