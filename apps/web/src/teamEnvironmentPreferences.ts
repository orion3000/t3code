import { EnvironmentId } from "@t3tools/contracts";

export interface SidebarEnvironmentFilterPreferences {
  readonly sidebarExcludedEnvironmentIds: readonly string[];
  readonly sidebarHideNewRemoteEnvironments: boolean;
  readonly sidebarIncludedRemoteEnvironmentIds: readonly string[];
}

export interface EnvironmentNotificationMutePreferences {
  readonly muteRemoteEnvironmentNotifications: boolean;
  readonly mutedEnvironmentIds: readonly string[];
  readonly unmutedRemoteEnvironmentIds: readonly string[];
}

export function resolveEffectiveExcludedEnvironmentIds(input: {
  readonly environmentIds: readonly EnvironmentId[];
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly preferences: SidebarEnvironmentFilterPreferences;
}): ReadonlySet<EnvironmentId> {
  const excluded = new Set<EnvironmentId>(
    input.preferences.sidebarExcludedEnvironmentIds.map((id) => EnvironmentId.make(id)),
  );
  if (!input.preferences.sidebarHideNewRemoteEnvironments) {
    return excluded;
  }

  const includedRemotes = new Set<EnvironmentId>(
    input.preferences.sidebarIncludedRemoteEnvironmentIds.map((id) => EnvironmentId.make(id)),
  );

  for (const environmentId of input.environmentIds) {
    if (input.primaryEnvironmentId !== null && environmentId === input.primaryEnvironmentId) {
      continue;
    }
    if (!includedRemotes.has(environmentId)) {
      excluded.add(environmentId);
    }
  }

  return excluded;
}

export function planSidebarEnvironmentVisibilityChange(input: {
  readonly environmentIds: readonly EnvironmentId[];
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly nextExcludedIds: ReadonlySet<EnvironmentId>;
  readonly currentPreferences: SidebarEnvironmentFilterPreferences;
}): {
  readonly sidebarExcludedEnvironmentIds: EnvironmentId[];
  readonly sidebarIncludedRemoteEnvironmentIds: EnvironmentId[];
} {
  const knownIds = new Set(input.environmentIds);
  const nextExcluded = new Set<EnvironmentId>();
  const nextIncludedRemotes = new Set<EnvironmentId>();

  // Preserve saved choices for environments that are temporarily offline/unloaded.
  for (const id of input.currentPreferences.sidebarExcludedEnvironmentIds) {
    const envId = EnvironmentId.make(id);
    if (!knownIds.has(envId)) {
      nextExcluded.add(envId);
    }
  }
  for (const id of input.currentPreferences.sidebarIncludedRemoteEnvironmentIds) {
    const envId = EnvironmentId.make(id);
    if (!knownIds.has(envId)) {
      nextIncludedRemotes.add(envId);
    }
  }

  for (const environmentId of input.environmentIds) {
    const isRemote =
      input.primaryEnvironmentId === null || environmentId !== input.primaryEnvironmentId;
    if (input.nextExcludedIds.has(environmentId)) {
      nextExcluded.add(environmentId);
      nextIncludedRemotes.delete(environmentId);
    } else if (isRemote) {
      nextIncludedRemotes.add(environmentId);
    }
  }

  return {
    sidebarExcludedEnvironmentIds: [...nextExcluded],
    sidebarIncludedRemoteEnvironmentIds: [...nextIncludedRemotes],
  };
}

export function isEnvironmentNotificationsMuted(input: {
  readonly environmentId: EnvironmentId;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly preferences: EnvironmentNotificationMutePreferences;
}): boolean {
  if (input.preferences.mutedEnvironmentIds.includes(input.environmentId)) {
    return true;
  }

  const isRemote =
    input.primaryEnvironmentId !== null && input.environmentId !== input.primaryEnvironmentId;
  if (!isRemote) {
    return false;
  }

  if (!input.preferences.muteRemoteEnvironmentNotifications) {
    return false;
  }

  return !input.preferences.unmutedRemoteEnvironmentIds.includes(input.environmentId);
}

export function planEnvironmentNotificationMuteToggle(input: {
  readonly environmentId: EnvironmentId;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly currentPreferences: EnvironmentNotificationMutePreferences;
}): {
  readonly mutedEnvironmentIds: EnvironmentId[];
  readonly unmutedRemoteEnvironmentIds: EnvironmentId[];
} {
  const currentlyMuted = isEnvironmentNotificationsMuted({
    environmentId: input.environmentId,
    primaryEnvironmentId: input.primaryEnvironmentId,
    preferences: input.currentPreferences,
  });
  const mutedSet = new Set(
    input.currentPreferences.mutedEnvironmentIds.map((id) => EnvironmentId.make(id)),
  );
  const unmutedRemoteSet = new Set(
    input.currentPreferences.unmutedRemoteEnvironmentIds.map((id) => EnvironmentId.make(id)),
  );
  const isRemote =
    input.primaryEnvironmentId !== null && input.environmentId !== input.primaryEnvironmentId;

  if (currentlyMuted) {
    mutedSet.delete(input.environmentId);
    if (isRemote) {
      unmutedRemoteSet.add(input.environmentId);
    }
  } else {
    mutedSet.add(input.environmentId);
    unmutedRemoteSet.delete(input.environmentId);
  }

  return {
    mutedEnvironmentIds: [...mutedSet],
    unmutedRemoteEnvironmentIds: [...unmutedRemoteSet],
  };
}

export function formatSessionRemainingDays(expiresAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / (24 * 60 * 60 * 1000)));
}
