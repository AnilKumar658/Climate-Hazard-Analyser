"""
Export service: Generate CSV and PDF exports of analysis results.
"""
import io
import csv
import logging
from typing import List
from models.schemas import AnalyzeResponse, YearlyStats

logger = logging.getLogger(__name__)


def generate_csv(response: AnalyzeResponse) -> bytes:
    """Generate a CSV export of yearly heatwave statistics."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header metadata
    writer.writerow(["# Climate Hazard Trend Analyzer — CSV Export"])
    writer.writerow([f"# Region: {response.region_name}"])
    writer.writerow([f"# Coordinates: {response.lat}°N, {response.lon}°E"])
    writer.writerow([f"# Period: {response.start_year}–{response.end_year}"])
    writer.writerow([f"# Hazard Type: {response.hazard.title()}"])
    writer.writerow([f"# Threshold Temperature: {response.threshold_temp:.2f}°C"])
    writer.writerow([f"# Trend: {response.trend.trend_direction} "
                     f"({response.trend.percent_change:+.1f}%)"])
    writer.writerow([])

    # Data header
    writer.writerow([
        "Year", "Heatwave Events", "Total Hot Days",
        "Mean Intensity (°C above threshold)",
        "Max Temperature (°C)", "Longest Event (days)",
        "5yr Rolling Avg Events"
    ])

    # Rolling avg lookup
    rolling_map = {r["year"]: r["avg_events"] for r in response.rolling_avg_5yr}

    # Data rows
    for stat in response.yearly_stats:
        writer.writerow([
            stat.year,
            stat.event_count,
            stat.total_duration_days,
            stat.mean_intensity,
            stat.max_temp_recorded if stat.max_temp_recorded > 0 else "N/A",
            stat.longest_event_days,
            rolling_map.get(stat.year, ""),
        ])

    writer.writerow([])
    writer.writerow(["# Insights"])
    writer.writerow([response.insights.headline])
    for detail in response.insights.details:
        writer.writerow([detail])

    return output.getvalue().encode("utf-8")


def generate_pdf(response: AnalyzeResponse) -> bytes:
    """Generate a styled PDF report of the analysis."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise RuntimeError("reportlab is required for PDF export")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    accent = colors.HexColor("#FF6B35")
    dark = colors.HexColor("#1a1a2e")

    title_style = ParagraphStyle(
        "Title", parent=styles["Title"], fontSize=20,
        textColor=dark, spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"], fontSize=11,
        textColor=colors.HexColor("#555555"), spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"], fontSize=13,
        textColor=accent, spaceBefore=16, spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"], fontSize=10,
        leading=16, spaceAfter=4,
    )
    insight_style = ParagraphStyle(
        "Insight", parent=styles["Normal"], fontSize=11,
        leading=16, textColor=dark, backColor=colors.HexColor("#FFF3EE"),
        borderPad=8, spaceAfter=8,
    )

    story = []

    # ── Title ──────────────────────────────────────────────────────────────────
    story.append(Paragraph("🌡 Climate Hazard Trend Analyzer", title_style))
    story.append(Paragraph(
        f"Heatwave Analysis Report — {response.region_name}", subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=accent))
    story.append(Spacer(1, 0.4 * cm))

    # ── Summary metadata ──────────────────────────────────────────────────────
    story.append(Paragraph("Analysis Parameters", section_style))
    meta = [
        ["Region", response.region_name],
        ["Coordinates", f"{response.lat:.4f}°N, {response.lon:.4f}°E"],
        ["Period", f"{response.start_year} – {response.end_year}"],
        ["Hazard", response.hazard.title()],
        ["Threshold", f"{response.threshold_temp:.2f}°C (95th percentile)"],
        ["Data Coverage", f"{response.data_quality.get('coverage_pct', 'N/A')}%"],
    ]
    t = Table(meta, colWidths=[5 * cm, 10 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F5F5")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    # ── Key Insight ───────────────────────────────────────────────────────────
    story.append(Paragraph("Key Finding", section_style))
    story.append(Paragraph(response.insights.headline, insight_style))
    for detail in response.insights.details:
        story.append(Paragraph(f"• {detail}", body_style))
    story.append(Spacer(1, 0.3 * cm))

    # ── Trend Statistics ──────────────────────────────────────────────────────
    story.append(Paragraph("Trend Statistics", section_style))
    trend_data = [
        ["Metric", "Value"],
        ["Trend Direction", response.trend.trend_direction.title()],
        ["Percent Change", f"{response.trend.percent_change:+.1f}%"],
        ["Linear Slope", f"{response.trend.slope:+.4f} events/year"],
        ["R² (linear fit)", f"{response.trend.r_squared:.4f}"],
        ["p-value (linear)", f"{response.trend.p_value:.4f}"],
        ["Mann-Kendall Trend", response.trend.mann_kendall_trend.title()],
        ["Mann-Kendall p-value", f"{response.trend.mann_kendall_p:.4f}"],
    ]
    t2 = Table(trend_data, colWidths=[7 * cm, 8 * cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF3EE")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t2)
    story.append(Spacer(1, 0.3 * cm))

    # ── Yearly Data Table ─────────────────────────────────────────────────────
    story.append(Paragraph("Yearly Statistics", section_style))
    table_data = [["Year", "Events", "Hot Days", "Mean Intensity (°C)", "Max Temp (°C)"]]
    for stat in response.yearly_stats:
        table_data.append([
            str(stat.year),
            str(stat.event_count),
            str(stat.total_duration_days),
            f"{stat.mean_intensity:.2f}" if stat.mean_intensity else "—",
            f"{stat.max_temp_recorded:.1f}" if stat.max_temp_recorded else "—",
        ])

    t3 = Table(table_data, colWidths=[2.5 * cm, 2.5 * cm, 2.5 * cm, 4 * cm, 3.5 * cm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9F9F9")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E0E0E0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t3)

    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E0E0E0")))
    story.append(Paragraph(
        "Generated by Climate Hazard Trend Analyzer | Data: Open-Meteo ERA5 Archive",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=8,
                       textColor=colors.HexColor("#999999"), alignment=TA_CENTER),
    ))

    doc.build(story)
    return buffer.getvalue()
