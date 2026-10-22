import { TODAY, cdpProfiles, daysBetween, getUnifiedMembers } from "../aeromexico-data";
import { getIdentityGraph } from "./identity";
import { getCdpSources, isHoldout, type DigitalChannel } from "./sources";

// Channel and timing decisioning per member, from identity-resolved activity.
// Deterministic: same data, same plan. It never sends anything; it decides
// where an offer should go, and whether it may go at all.

export type PlanStatus = "ready" | "holdout_control" | "no_consent" | "frequency_capped";
export type ChannelEvidence = { readonly channel: DigitalChannel; readonly sends: number; readonly opens: number; readonly clicks: number; readonly score: number };
export type MemberPlan = {
  readonly memberId: string;
  readonly name: string;
  readonly tier: string;
  readonly segment: string;
  readonly raskAtRiskMxn: number;
  readonly status: PlanStatus;
  readonly channel: DigitalChannel | null;
  readonly sendWeekday: string | null;
  readonly evidence: readonly ChannelEvidence[];
  readonly reason: string;
};

const FREQUENCY_CAP = { sends: 2, days: 14 };
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function planMember(memberId: string): MemberPlan | null {
  const member = getUnifiedMembers().find((m) => m.memberId === memberId);
  const profile = cdpProfiles.find((p) => p.memberId === memberId);
  if (!member || !profile) return null;

  const graph = getIdentityGraph();
  const sources = getCdpSources();
  const owned = (id: string) => graph.resolutions.get(id)?.memberId === memberId;
  const sends = sources.sends.filter((s) => owned(s.sendId));

  const consented: Record<DigitalChannel, boolean> = {
    email: profile.emailOptIn,
    push: profile.pushOptIn && profile.appInstalled,
    in_app: profile.appInstalled,
  };
  // Engagement per channel: opens and clicks over sends, smoothed so a channel
  // with one lucky open does not beat a proven one.
  const evidence = (["email", "push", "in_app"] as const).map((channel) => {
    const mine = sends.filter((s) => s.channel === channel);
    const opens = mine.filter((s) => s.opened).length;
    const clicks = mine.filter((s) => s.clicked).length;
    const score = Math.round(((opens + 2 * clicks + 1) / (mine.length + 3)) * 100) / 100;
    return { channel, sends: mine.length, opens, clicks, score };
  });

  const base = {
    memberId,
    name: `${member.firstName} ${member.lastName}`,
    tier: member.tier,
    segment: member.segment,
    raskAtRiskMxn: member.raskAtRiskMxn,
    evidence,
  };

  if (isHoldout(memberId)) {
    return { ...base, status: "holdout_control", channel: null, sendWeekday: null, reason: "Control group: kept out of every activation so lift stays measurable." };
  }
  const options = evidence.filter((e) => consented[e.channel]);
  if (options.length === 0) {
    return { ...base, status: "no_consent", channel: null, sendWeekday: null, reason: "No marketing consent on email, push or in-app." };
  }
  const best = [...options].sort((a, b) => b.score - a.score || (a.channel === profile.predictedChannel ? -1 : 1))[0];

  // Most frequent weekday of the member's resolved sessions.
  const days = sources.events.filter((e) => owned(e.eventId)).map((e) => new Date(`${e.date}T00:00:00Z`).getUTCDay());
  const counts = days.reduce<number[]>((acc, d) => ((acc[d] += 1), acc), Array(7).fill(0));
  const sendWeekday = days.length === 0 ? null : WEEKDAYS[counts.indexOf(Math.max(...counts))];

  const recent = sends.filter((s) => daysBetween(s.sentDate, TODAY) <= FREQUENCY_CAP.days).length;
  if (recent >= FREQUENCY_CAP.sends) {
    return { ...base, status: "frequency_capped", channel: best.channel, sendWeekday, reason: `${recent} sends in the last ${FREQUENCY_CAP.days} days; wait before another.` };
  }
  return {
    ...base,
    status: "ready",
    channel: best.channel,
    sendWeekday,
    reason: `Highest consented engagement: ${best.opens}/${best.sends} opens, ${best.clicks} clicks on ${best.channel}.`,
  };
}

export function planMembers(memberIds: readonly string[]) {
  const plans = memberIds.map(planMember).filter((p): p is MemberPlan => p !== null);
  const count = (status: PlanStatus) => plans.filter((p) => p.status === status).length;
  const byChannel = (["email", "push", "in_app"] as const).map((channel) => ({
    channel,
    members: plans.filter((p) => p.status === "ready" && p.channel === channel).length,
  }));
  return {
    plans,
    summary: {
      members: plans.length,
      ready: count("ready"),
      holdoutControl: count("holdout_control"),
      noConsent: count("no_consent"),
      frequencyCapped: count("frequency_capped"),
      readyRaskAtRiskMxn: Math.round(plans.filter((p) => p.status === "ready").reduce((sum, p) => sum + p.raskAtRiskMxn, 0)),
      byChannel,
    },
  };
}
