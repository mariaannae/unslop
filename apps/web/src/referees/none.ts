import type { Referee } from "../core/types";

/** Always approves (spec §10.4). Keeps the referee slot exercised without adding rules. */
export const noneReferee: Referee = {
  id: "none",
  async verify() {
    return { approved: true, reasons: [] };
  },
};
