import type { ComponentType } from "react";
import type { CalendarDay } from "../data/calendar";
import CucumberOracle from "./oracle/CucumberOracle";

export interface MiniAppProps {
  item: CalendarDay;
}

interface MiniAppDefinition {
  id: string;
  Component: ComponentType<MiniAppProps>;
}

const miniApps: Record<
  string,
  MiniAppDefinition
> = {
  "cucumber-oracle": {
    id: "cucumber-oracle",
    Component: CucumberOracle,
  },
};

export function getMiniApp(
  appId: string | undefined,
): MiniAppDefinition | undefined {
  if (!appId) return undefined;

  return miniApps[appId];
}