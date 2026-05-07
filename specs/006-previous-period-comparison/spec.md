# Feature Specification: Previous Period Comparison

**Feature Branch**: `006-previous-period-comparison`
**Created**: 2026-05-07
**Status**: Draft
**Input**: User description: "For each metric, show a comparison to the aggregated value from the previous period. For example, for Running Distance, if I ran 50km last month, then I would see a label showing that value on the metric card. This should be lower in the info hierarchy than the current value, but still be scannable"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See Previous Period Value on Each Metric Card (Priority: P1)

Every metric card on the dashboard shows the previous period's aggregated value below the current value. For a monthly metric like Running Distance, the card shows the total distance from last month in a smaller, subdued label. For a weekly metric like Cups of Coffee, the card shows last week's total. This gives the user an instant reference point to understand whether they are tracking above or below their historical pace.

**Why this priority**: This is the entire feature. Without the previous period value displayed, there is nothing to compare against.

**Independent Test**: Open the dashboard with at least one metric that has entries in the previous period → confirm each such card shows a secondary label containing the previous period's aggregated value. A metric with no previous-period data should show nothing (no label, no placeholder).

**Acceptance Scenarios**:

1. **Given** a monthly metric with a total of 50km logged last month, **When** the dashboard loads, **Then** the metric card shows a secondary label such as "50 km last month" or "Last month: 50 km" beneath the current value
2. **Given** a weekly metric with 12 entries totalling 12 cups of coffee last week, **When** the dashboard loads, **Then** the metric card shows a secondary label such as "12 last week" beneath the current value
3. **Given** a metric with no entries in the previous period, **When** the dashboard loads, **Then** no previous-period label is shown on that card — the card renders exactly as it did before this feature
4. **Given** a metric with entries in the current period but none in the previous period, **When** the dashboard loads, **Then** no previous-period label is shown — the previous period section is absent, not shown as "0"
5. **Given** an average-type metric (e.g. Sleep Quality) with readings in the previous period, **When** the dashboard loads, **Then** the card shows the previous period's mean value with one decimal place (e.g. "Avg 7.2 last month")

---

### User Story 2 — Previous Period Label Uses Consistent Value Formatting (Priority: P2)

The previous period value is formatted in the same way as the current value for that metric type — distance metrics show a unit, timed metrics show "min", and average metrics show one decimal place. The time reference ("last week" or "last month") is part of the label and makes the context unambiguous without the user needing to recall the metric's timeframe.

**Why this priority**: Unformatted numbers or missing units would reduce legibility. The period label ("last week" / "last month") prevents confusion for users who have a mix of weekly and monthly metrics on one dashboard.

**Independent Test**: Open the dashboard with at least one weekly metric and one monthly metric that both have previous-period data → confirm each card's previous label includes the correct unit/format AND the correct time reference ("last week" vs "last month").

**Acceptance Scenarios**:

1. **Given** a cumulative metric with timeframe "monthly", **When** the previous period label is shown, **Then** it includes the text "last month" (e.g. "50 last month" or "Last month: 50")
2. **Given** a cumulative metric with timeframe "weekly", **When** the previous period label is shown, **Then** it includes the text "last week" (e.g. "12 last week" or "Last week: 12")
3. **Given** a timed metric (minutes-based), **When** the previous period label is shown, **Then** the value is displayed in minutes with a "min" suffix (e.g. "45 min last week")
4. **Given** an average metric, **When** the previous period label is shown, **Then** the value has one decimal place and a period-type qualifier (e.g. "Avg 7.2 last month")

---

### Edge Cases

- What if the metric was created this period and has no previous period at all? → No label is shown; the card renders without a comparison section
- What if the previous period aggregated value is zero? → A zero value is treated the same as no data — no label is shown (a zero comparison provides no useful signal)
- What if the app is opened during a period boundary (e.g. the first day of a new week)? → The previous period is always the fully completed period immediately before the current one; the boundary is well-defined
- What if the user creates a metric mid-period? → The comparison looks back one full period from the start of the current period; if that prior period has no data, no label is shown
- What if the previous period value is very large (e.g. 10,000 steps)? → Display the full number without truncation; no abbreviated formatting (e.g. "10K") required

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each metric card MUST display the aggregated value from the previous complete period when that value is greater than zero
- **FR-002**: The previous period value MUST appear below the current period value in a visually subordinate style (smaller font, lighter colour)
- **FR-003**: The previous period label MUST include a time reference: "last week" for weekly metrics and "last month" for monthly metrics
- **FR-004**: Cumulative and timed metrics MUST display the previous period value as a sum; average metrics MUST display it as a mean
- **FR-005**: Timed metrics MUST include the "min" unit suffix in the previous period label
- **FR-006**: Average metrics MUST display the previous period mean to one decimal place, prefixed with "Avg"
- **FR-007**: If the previous period has no entries, or the aggregated value is zero, the previous period label MUST NOT be shown — the card renders as if the feature does not exist for that metric
- **FR-008**: The previous period label MUST appear on every metric card that has qualifying previous-period data, regardless of metric type

### Key Entities

- **PreviousPeriodValue**: The aggregated value for a metric over the completed period immediately before the current one. For cumulative/timed metrics this is the sum; for average metrics this is the mean. Computed on demand; not persisted separately.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The previous period label appears on all metric cards with qualifying prior-period data within 3 seconds of the dashboard loading
- **SC-002**: Zero metric cards show a previous period label when the previous period has no entries or a zero aggregate
- **SC-003**: 100% of previous period labels include the correct time reference ("last week" or "last month") matching the metric's timeframe
- **SC-004**: Value formatting in the previous period label is consistent with the current value format for that metric type — no cards display a mismatched unit or decimal precision

## Assumptions

- The previous period is defined as the single complete period immediately before the current one: for a monthly metric, the calendar month before the current month; for a weekly metric, the Monday–Sunday week before the current week
- The same period-window logic already used in the app (weekly: Monday–Sunday; monthly: calendar month) is applied to compute the previous period window by shifting back by one period
- A zero aggregate (sum or mean) is treated as "no data" and suppresses the label — showing "0" as a comparison value was deemed unhelpful
- The previous period value is computed from stored log entries; no separate persistence of historical summaries is needed
- The label text style is determined by the product but must be visually subordinate — suggested: smaller font size and a muted colour relative to the current value
- Apple Health-sourced metrics (running distance, sleep, mindfulness) use the same comparison logic as user-created metrics; no special casing required
