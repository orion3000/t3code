import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatSessionRemainingDays,
  isEnvironmentNotificationsMuted,
  planEnvironmentNotificationMuteToggle,
  planSidebarEnvironmentVisibilityChange,
  resolveEffectiveExcludedEnvironmentIds,
} from "./teamEnvironmentPreferences";

const primary = EnvironmentId.make("env-primary");
const remoteA = EnvironmentId.make("env-remote-a");
const remoteB = EnvironmentId.make("env-remote-b");
const remoteOffline = EnvironmentId.make("env-remote-offline");

describe("teamEnvironmentPreferences", () => {
  it("hides newly connected remote environments by default while keeping primary visible", () => {
    const excluded = resolveEffectiveExcludedEnvironmentIds({
      environmentIds: [primary, remoteA, remoteB],
      primaryEnvironmentId: primary,
      preferences: {
        sidebarExcludedEnvironmentIds: [],
        sidebarHideNewRemoteEnvironments: true,
        sidebarIncludedRemoteEnvironmentIds: [remoteA],
      },
    });

    expect(excluded.has(primary)).toBe(false);
    expect(excluded.has(remoteA)).toBe(false);
    expect(excluded.has(remoteB)).toBe(true);
  });

  it("shows newly connected remote environments when hide-new-remotes is off", () => {
    const excluded = resolveEffectiveExcludedEnvironmentIds({
      environmentIds: [primary, remoteA, remoteB],
      primaryEnvironmentId: primary,
      preferences: {
        sidebarExcludedEnvironmentIds: [remoteA],
        sidebarHideNewRemoteEnvironments: false,
        sidebarIncludedRemoteEnvironmentIds: [],
      },
    });

    expect(excluded.has(primary)).toBe(false);
    expect(excluded.has(remoteA)).toBe(true);
    expect(excluded.has(remoteB)).toBe(false);
  });

  it("plans visibility updates while preserving offline environment choices", () => {
    const planned = planSidebarEnvironmentVisibilityChange({
      environmentIds: [primary, remoteA, remoteB],
      primaryEnvironmentId: primary,
      nextExcludedIds: new Set([remoteB]),
      currentPreferences: {
        sidebarExcludedEnvironmentIds: [remoteOffline],
        sidebarHideNewRemoteEnvironments: true,
        sidebarIncludedRemoteEnvironmentIds: [remoteOffline],
      },
    });

    expect(planned.sidebarExcludedEnvironmentIds).toEqual([remoteOffline, remoteB]);
    expect(planned.sidebarIncludedRemoteEnvironmentIds).toEqual([remoteOffline, remoteA]);
  });

  it("mutes remote environments by default and allows explicit per-environment overrides", () => {
    const defaults = {
      muteRemoteEnvironmentNotifications: true,
      mutedEnvironmentIds: [],
      unmutedRemoteEnvironmentIds: [],
    };

    expect(
      isEnvironmentNotificationsMuted({
        environmentId: primary,
        primaryEnvironmentId: primary,
        preferences: defaults,
      }),
    ).toBe(false);
    expect(
      isEnvironmentNotificationsMuted({
        environmentId: remoteA,
        primaryEnvironmentId: primary,
        preferences: defaults,
      }),
    ).toBe(true);

    const afterUnmuteRemoteA = {
      ...defaults,
      ...planEnvironmentNotificationMuteToggle({
        environmentId: remoteA,
        primaryEnvironmentId: primary,
        currentPreferences: defaults,
      }),
    };
    expect(
      isEnvironmentNotificationsMuted({
        environmentId: remoteA,
        primaryEnvironmentId: primary,
        preferences: afterUnmuteRemoteA,
      }),
    ).toBe(false);
    expect(
      isEnvironmentNotificationsMuted({
        environmentId: remoteB,
        primaryEnvironmentId: primary,
        preferences: afterUnmuteRemoteA,
      }),
    ).toBe(true);

    const afterMutePrimary = {
      ...afterUnmuteRemoteA,
      ...planEnvironmentNotificationMuteToggle({
        environmentId: primary,
        primaryEnvironmentId: primary,
        currentPreferences: afterUnmuteRemoteA,
      }),
    };
    expect(
      isEnvironmentNotificationsMuted({
        environmentId: primary,
        primaryEnvironmentId: primary,
        preferences: afterMutePrimary,
      }),
    ).toBe(true);
  });

  it("computes remaining session days safely", () => {
    const now = Date.UTC(2026, 10, 23, 12, 0, 0);
    const in12Days = now + 12 * 24 * 60 * 60 * 1000;
    const expired = now - 60_000;
    expect(formatSessionRemainingDays(in12Days, now)).toBe(12);
    expect(formatSessionRemainingDays(expired, now)).toBe(0);
  });
});
