import json
from html import escape
from pathlib import Path

input_path = Path("input.json")
output_path = Path("aeromexico_segmentation.json")
chart_path = Path("aeromexico_chart.svg")
report_path = Path("report.md")

payload = json.loads(input_path.read_text())
title = payload.get("title", "Aeromexico Loyalty Segmentation")
chart = payload.get("chart", "value_churn_scatter")
rows = payload.get("rows", [])
routes = payload.get("routes", [])
ask_millions = payload.get("askMillions", 0)

# Brand palette: Aeromexico blue is the primary chart color; the supporting
# palette flags the four value/churn segments.
PRIMARY = "#035CF7"
SEGMENT_COLORS = {
    "Retencion Prioritaria": "#FA0073",
    "Embajadores": "#035CF7",
    "En Riesgo": "#7A88A3",
    "Base": "#020C41",
}
SEGMENT_ORDER = ["Retencion Prioritaria", "Embajadores", "En Riesgo", "Base"]


def classify(value_score, churn_risk):
    high_value = value_score >= 60
    high_risk = churn_risk >= 50
    if high_value and high_risk:
        return "Retencion Prioritaria"
    if high_value:
        return "Embajadores"
    if high_risk:
        return "En Riesgo"
    return "Base"


# --- Score rows, mirroring agent/lib/sandbox-analysis/segmentation.ts ------

members = []
for index, row in enumerate(rows):
    member_id = str(row.get("memberId", f"member-{index + 1}"))
    value_score = float(row.get("valueScore", 0))
    churn_risk = float(row.get("churnRisk", 0))
    rask_at_risk = float(row.get("raskAtRiskMxn", 0))
    rpk12m = float(row.get("rpk12m", 0))
    segment = row.get("segment") or classify(value_score, churn_risk)
    members.append(
        {
            "memberId": member_id,
            "valueScore": value_score,
            "churnRisk": churn_risk,
            "raskAtRiskMxn": rask_at_risk,
            "rpk12m": rpk12m,
            "segment": segment,
        }
    )

segment_buckets = {name: {"members": 0, "raskAtRiskMxn": 0.0} for name in SEGMENT_ORDER}
for member in members:
    bucket = segment_buckets.setdefault(member["segment"], {"members": 0, "raskAtRiskMxn": 0.0})
    bucket["members"] += 1
    bucket["raskAtRiskMxn"] += member["raskAtRiskMxn"]

segments = [
    {"segment": name, "members": bucket["members"], "raskAtRiskMxn": bucket["raskAtRiskMxn"]}
    for name, bucket in segment_buckets.items()
]

total_rask_at_risk = sum(member["raskAtRiskMxn"] for member in members)
total_rpk = sum(member["rpk12m"] for member in members)
# rpk12m is raw seat-km; askMillions is millions of ASK-km, so convert before dividing.
total_rpk_millions = total_rpk / 1_000_000
load_factor = 0 if not ask_millions else total_rpk_millions / ask_millions

top_retention_targets = sorted(
    (m for m in members if m["segment"] == "Retencion Prioritaria"),
    key=lambda m: m["raskAtRiskMxn"],
    reverse=True,
)[:10]

takeaway = (
    f"{len(members)} members scored; {total_rask_at_risk:,.0f} MXN of trailing-12m revenue "
    f"is at risk across the selected members. (Network load factor is a fixed-ASK metric "
    f"— read it from query_members view=network.)"
)

output = {
    "title": title,
    "memberCount": len(members),
    "segments": segments,
    "totalRaskAtRiskMxn": total_rask_at_risk,
    "loadFactor": load_factor,
    "topRetentionTargets": [
        {
            "memberId": m["memberId"],
            "valueScore": m["valueScore"],
            "churnRisk": m["churnRisk"],
            "raskAtRiskMxn": m["raskAtRiskMxn"],
            "segment": m["segment"],
        }
        for m in top_retention_targets
    ],
    "takeaway": takeaway,
}

# --- Hand-rendered SVG (stdlib only, no matplotlib) ------------------------

WIDTH = 720
HEIGHT = 400
PADDING = 54


def scale(value, low, high, out_low, out_high):
    if high == low:
        return (out_low + out_high) / 2
    return out_low + (value - low) / (high - low) * (out_high - out_low)


def svg_header(subtitle):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}">'
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#FFFFFF"/>'
        f'<text x="{PADDING}" y="30" fill="{PRIMARY}" font-family="monospace" font-size="18">{escape(title)}</text>'
        f'<text x="{PADDING}" y="48" fill="#4A5568" font-family="monospace" font-size="11">{escape(subtitle)}</text>'
    )


def build_value_churn_scatter():
    plot_top = 70
    plot_bottom = HEIGHT - PADDING
    plot_left = PADDING
    plot_right = WIDTH - 30
    x_mid = scale(60, 0, 100, plot_left, plot_right)
    y_mid = scale(50, 100, 0, plot_top, plot_bottom)
    max_rpk = max((m["rpk12m"] for m in members), default=1) or 1

    parts = [svg_header("Value score vs churn risk (bubble size = trailing 12m RPK)")]
    parts.append(
        f'<rect x="{plot_left}" y="{plot_top}" width="{plot_right - plot_left:.2f}" '
        f'height="{plot_bottom - plot_top:.2f}" fill="none" stroke="#E2E8F0" stroke-width="1"/>'
    )
    parts.append(
        f'<line x1="{plot_left}" x2="{plot_right}" y1="{y_mid:.2f}" y2="{y_mid:.2f}" '
        f'stroke="#05E7CC" stroke-width="1" stroke-dasharray="4,4"/>'
    )
    parts.append(
        f'<line x1="{x_mid:.2f}" x2="{x_mid:.2f}" y1="{plot_top}" y2="{plot_bottom}" '
        f'stroke="#05E7CC" stroke-width="1" stroke-dasharray="4,4"/>'
    )
    for member in members:
        x = scale(member["valueScore"], 0, 100, plot_left, plot_right)
        y = scale(member["churnRisk"], 100, 0, plot_top, plot_bottom)
        radius = 3 + (member["rpk12m"] / max_rpk) * 9
        color = SEGMENT_COLORS.get(member["segment"], PRIMARY)
        parts.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{radius:.2f}" fill="{color}" fill-opacity="0.75" '
            f'stroke="{color}" stroke-width="1">'
            f'<title>{escape(member["memberId"])}: value {member["valueScore"]:.0f}, churn {member["churnRisk"]:.0f}</title>'
            f"</circle>"
        )
    parts.append(
        f'<text x="{plot_left}" y="{plot_bottom + 20}" fill="#4A5568" font-family="monospace" font-size="10">valueScore &#8594;</text>'
    )
    parts.append(
        f'<text x="{plot_left - 40}" y="{plot_top - 8}" fill="#4A5568" font-family="monospace" font-size="10">churnRisk &#8593;</text>'
    )
    parts.append("</svg>")
    return "".join(parts)


def build_bar_chart(subtitle, labels, values, value_format, bar_color=PRIMARY):
    plot_top = 70
    plot_bottom = HEIGHT - PADDING
    plot_left = PADDING
    plot_right = WIDTH - 30
    max_value = max(values, default=1) or 1
    bar_gap = 14
    count = max(len(labels), 1)
    bar_width = (plot_right - plot_left - bar_gap * (count - 1)) / count if count else 0

    parts = [svg_header(subtitle)]
    parts.append(
        f'<line x1="{plot_left}" x2="{plot_right}" y1="{plot_bottom}" y2="{plot_bottom}" '
        f'stroke="#CBD5E1" stroke-width="1"/>'
    )
    for index, (label, value) in enumerate(zip(labels, values)):
        bar_height = 0 if max_value == 0 else (value / max_value) * (plot_bottom - plot_top)
        x = plot_left + index * (bar_width + bar_gap)
        y = plot_bottom - bar_height
        parts.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{bar_width:.2f}" height="{bar_height:.2f}" fill="{bar_color}">'
            f"<title>{escape(str(label))}: {value_format(value)}</title></rect>"
        )
        parts.append(
            f'<text x="{x + bar_width / 2:.2f}" y="{plot_bottom + 16}" fill="#4A5568" font-family="monospace" '
            f'font-size="9" text-anchor="middle">{escape(str(label)[:10])}</text>'
        )
        parts.append(
            f'<text x="{x + bar_width / 2:.2f}" y="{y - 6:.2f}" fill="{PRIMARY}" font-family="monospace" '
            f'font-size="10" text-anchor="middle">{value_format(value)}</text>'
        )
    parts.append("</svg>")
    return "".join(parts)


def build_loadfactor_chart():
    plot_top = 70
    plot_bottom = HEIGHT - PADDING
    plot_left = PADDING
    plot_right = WIDTH - 30
    labels = [str(r.get("route", "?")) for r in routes]
    values = [float(r.get("loadFactor", 0)) for r in routes]
    max_value = max([1.0] + values)
    bar_gap = 14
    count = max(len(labels), 1)
    bar_width = (plot_right - plot_left - bar_gap * (count - 1)) / count if count else 0

    parts = [svg_header("Load factor by route (dashed line = fixed ASK ceiling)")]
    ask_line_y = scale(1.0, 0, max_value, plot_bottom, plot_top)
    parts.append(
        f'<line x1="{plot_left}" x2="{plot_right}" y1="{ask_line_y:.2f}" y2="{ask_line_y:.2f}" '
        f'stroke="#C8102E" stroke-width="1.5" stroke-dasharray="6,4"/>'
    )
    parts.append(
        f'<text x="{plot_right - 90}" y="{ask_line_y - 6:.2f}" fill="#C8102E" font-family="monospace" '
        f'font-size="9">ASK capacity</text>'
    )
    for index, (label, value) in enumerate(zip(labels, values)):
        bar_height = 0 if max_value == 0 else (value / max_value) * (plot_bottom - plot_top)
        x = plot_left + index * (bar_width + bar_gap)
        y = plot_bottom - bar_height
        parts.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{bar_width:.2f}" height="{bar_height:.2f}" fill="{PRIMARY}">'
            f'<title>{escape(label)}: {value * 100:.1f}%</title></rect>'
        )
        parts.append(
            f'<text x="{x + bar_width / 2:.2f}" y="{plot_bottom + 16}" fill="#4A5568" font-family="monospace" '
            f'font-size="9" text-anchor="middle">{escape(label[:10])}</text>'
        )
    parts.append("</svg>")
    return "".join(parts)


if chart == "rask_by_segment":
    svg = build_bar_chart(
        "RASK-at-risk by segment (MXN)",
        [s["segment"] for s in segments],
        [s["raskAtRiskMxn"] for s in segments],
        lambda v: f"{v:,.0f}",
    )
elif chart == "rpk_by_route":
    svg = build_bar_chart(
        "RPK by route (millions)",
        [str(r.get("route", "?")) for r in routes],
        [float(r.get("rpkMillions", 0)) for r in routes],
        lambda v: f"{v:.3f}M",
    )
elif chart == "loadfactor_by_route":
    svg = build_loadfactor_chart()
else:
    svg = build_value_churn_scatter()

report_lines = [
    f"# {title}",
    "",
    f"- Chart: {chart}",
    f"- Members scored: {len(members)}",
    f"- Load factor (scored set): {load_factor * 100:.1f}%",
    f"- Total RASK-at-risk: {total_rask_at_risk:,.0f} MXN",
    "",
    "## Segments",
    "",
]
for s in segments:
    report_lines.append(f"- {s['segment']}: {s['members']} members, {s['raskAtRiskMxn']:,.0f} MXN at risk")
report_lines += ["", "## Top retention targets", ""]
if output["topRetentionTargets"]:
    for t in output["topRetentionTargets"]:
        report_lines.append(
            f"- {t['memberId']}: value {t['valueScore']:.0f}, churn {t['churnRisk']:.0f}, "
            f"{t['raskAtRiskMxn']:,.0f} MXN at risk"
        )
else:
    report_lines.append("- None in this row set.")
report_lines += [
    "",
    f"- Takeaway: {takeaway}",
    "",
    "Sandbox artifacts:",
    "- input: input.json",
    f"- script: /workspace/scripts/{Path(__file__).name}",
    "- json: aeromexico_segmentation.json",
    "- chart: aeromexico_chart.svg",
]
report = "\n".join(report_lines) + "\n"

output_path.write_text(json.dumps(output, indent=2))
chart_path.write_text(svg)
report_path.write_text(report)
print(takeaway)
print(f"Wrote sandbox artifacts: {output_path}, {chart_path}, {report_path}")
