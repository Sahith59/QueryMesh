package com.querymesh.service;

import com.querymesh.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MigrationScorerService {

    private final DiagnosticService diagnosticService;
    private final ViolationScannerService violationScannerService;
    private final SchemaIntrospectionService introspectionService;
    private final IndexAnalysisService indexAnalysisService;

    public MigrationScoreResponse score(MigrationScoreRequest request) {
        String tableName  = request.getTableName().toLowerCase().trim();
        String changeType = request.getChangeType();

        // ── Factor 1: Blast Radius (30pts) ──────────────────────────────
        DiagnoseResult diagnosis = diagnosticService.diagnose(tableName);
        int blastRadius = diagnosis.getBlastRadius();

        int    blastScore;
        String blastDetail;
        if (blastRadius == 0) {
            blastScore  = 30;
            blastDetail = "No dependent tables — isolated change";
        } else if (blastRadius <= 2) {
            blastScore  = 20;
            blastDetail = blastRadius + " table(s) in blast radius";
        } else if (blastRadius <= 5) {
            blastScore  = 10;
            blastDetail = blastRadius + " tables will be affected";
        } else {
            blastScore  = 0;
            blastDetail = "High blast radius: " + blastRadius + " tables affected";
        }

        // ── Factor 2: FK Violations (25pts) ─────────────────────────────
        List<ViolationResult> allViolations = violationScannerService.scanAllViolations();
        long tableViolations = allViolations.stream()
                .filter(v -> v.getTableName().equalsIgnoreCase(tableName)
                          || v.getReferencedTable().equalsIgnoreCase(tableName))
                .count();

        int    violationScore;
        String violationDetail;
        if (tableViolations == 0) {
            violationScore  = 25;
            violationDetail = "No FK integrity violations detected";
        } else if (tableViolations <= 2) {
            violationScore  = 15;
            violationDetail = tableViolations + " FK violation(s) exist on this table";
        } else if (tableViolations <= 5) {
            violationScore  = 5;
            violationDetail = tableViolations + " FK violations — clean up first";
        } else {
            violationScore  = 0;
            violationDetail = "Critical: " + tableViolations + " FK violations detected";
        }

        // ── Factor 3: Row Count (20pts) ──────────────────────────────────
        long rowCount = introspectionService.getAllTables().stream()
                .filter(n -> n.getTableName().equalsIgnoreCase(tableName))
                .mapToLong(SchemaNode::getRowCount)
                .findFirst()
                .orElse(0L);

        int    rowScore;
        String rowDetail;
        if (rowCount <= 1_000) {
            rowScore  = 20;
            rowDetail = rowCount + " rows — minimal lock risk";
        } else if (rowCount <= 10_000) {
            rowScore  = 15;
            rowDetail = rowCount + " rows — short lock window expected";
        } else if (rowCount <= 100_000) {
            rowScore  = 8;
            rowDetail = rowCount + " rows — consider CONCURRENTLY options";
        } else {
            rowScore  = 0;
            rowDetail = rowCount + " rows — plan a maintenance window";
        }

        // ── Factor 4: Index Coverage (15pts) ─────────────────────────────
        long tableGaps = indexAnalysisService.findIndexGaps().stream()
                .filter(g -> g.getTable().equalsIgnoreCase(tableName))
                .count();

        int    indexScore;
        String indexDetail;
        if (tableGaps == 0) {
            indexScore  = 15;
            indexDetail = "All FK columns are properly indexed";
        } else if (tableGaps == 1) {
            indexScore  = 8;
            indexDetail = "1 unindexed FK column detected";
        } else {
            indexScore  = 0;
            indexDetail = tableGaps + " unindexed FK columns — JOINs will scan";
        }

        // ── Factor 5: Circular FKs (10pts) ───────────────────────────────
        CircularDepsResult cycleResult = diagnosticService.detectCircularDeps();
        boolean inCycle = cycleResult.getCycles().stream()
                .anyMatch(c -> c.getPath().stream()
                        .anyMatch(p -> p.equalsIgnoreCase(tableName)));

        int    cycleScore  = inCycle ? 0 : 10;
        String cycleDetail = inCycle
                ? "Table is in a circular FK chain"
                : "No circular FK involvement";

        // ── Total & risk level ────────────────────────────────────────────
        int totalScore = blastScore + violationScore + rowScore + indexScore + cycleScore;

        String riskLevel;
        if      (totalScore >= 75) riskLevel = "GREEN";
        else if (totalScore >= 45) riskLevel = "AMBER";
        else                       riskLevel = "RED";

        List<ScoreBreakdown> breakdown = Arrays.asList(
                ScoreBreakdown.builder().factor("Blast Radius")  .score(blastScore)    .maxScore(30).detail(blastDetail)    .build(),
                ScoreBreakdown.builder().factor("FK Violations") .score(violationScore).maxScore(25).detail(violationDetail).build(),
                ScoreBreakdown.builder().factor("Row Count")     .score(rowScore)      .maxScore(20).detail(rowDetail)      .build(),
                ScoreBreakdown.builder().factor("Index Coverage").score(indexScore)    .maxScore(15).detail(indexDetail)    .build(),
                ScoreBreakdown.builder().factor("Circular FKs") .score(cycleScore)    .maxScore(10).detail(cycleDetail)    .build()
        );

        List<String> warnings  = buildWarnings(changeType, blastRadius, tableViolations, rowCount, tableGaps, inCycle, diagnosis.getAffectedTables());
        List<String> checklist = buildChecklist(changeType, blastRadius, tableViolations, rowCount, tableGaps, inCycle);

        return MigrationScoreResponse.builder()
                .tableName(tableName)
                .changeType(changeType)
                .score(totalScore)
                .riskLevel(riskLevel)
                .breakdown(breakdown)
                .warnings(warnings)
                .checklist(checklist)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Warnings
    // ─────────────────────────────────────────────────────────────────────

    private List<String> buildWarnings(String changeType, int blastRadius, long violations,
                                       long rowCount, long gaps, boolean inCycle,
                                       List<String> affectedTables) {
        List<String> w = new ArrayList<>();

        switch (changeType) {
            case "DROP_TABLE" -> {
                w.add("DROP TABLE is irreversible without a backup — take a snapshot first");
                if (blastRadius > 0)
                    w.add(blastRadius + " table(s) reference this table and will break: " +
                          String.join(", ", affectedTables.subList(0, Math.min(5, affectedTables.size()))));
            }
            case "DROP_COLUMN" ->
                w.add("Removing a column is irreversible — ensure no application code or views reference it");
            case "RENAME_COLUMN", "RENAME_TABLE" ->
                w.add("Renames break all hardcoded references in application code, views, and stored procedures");
            case "ADD_FK" -> {
                if (violations > 0)
                    w.add("Existing FK violations will cause ADD CONSTRAINT to fail — clean up orphaned rows first");
            }
            case "DROP_FK" ->
                w.add("Removing a FK constraint disables referential integrity enforcement on this relationship");
        }

        if (inCycle)
            w.add("Table is in a circular FK chain — TRUNCATE requires DISABLE TRIGGER ALL or CASCADE");
        if (rowCount > 100_000)
            w.add("Table has " + rowCount + " rows — use a maintenance window to avoid long lock waits");
        else if (rowCount > 10_000)
            w.add("Use CONCURRENTLY where available (index creation) to reduce lock duration");
        if (gaps > 0)
            w.add(gaps + " FK column(s) lack an index — query performance will degrade under load");
        if (violations > 0 && !changeType.equals("ADD_FK"))
            w.add(violations + " existing FK violation(s) detected — data integrity is already compromised");

        return w;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Checklist
    // ─────────────────────────────────────────────────────────────────────

    private List<String> buildChecklist(String changeType, int blastRadius, long violations,
                                        long rowCount, long gaps, boolean inCycle) {
        List<String> c = new ArrayList<>();

        // Universal items
        c.add("Take a schema snapshot before running the migration");
        c.add("Run the migration against a staging database first");
        c.add("Verify application health metrics after applying in staging");

        // Change-type specific items
        switch (changeType) {
            case "DROP_TABLE" -> {
                c.add("Confirm no application code references this table");
                c.add("Back up data: CREATE TABLE " + "backup_table AS SELECT * FROM target_table");
                c.add("Update all FK references in dependent tables before dropping");
            }
            case "DROP_COLUMN" -> {
                c.add("Grep codebase for column references before dropping");
                c.add("Check views and stored procedures for column usage");
                c.add("Deploy code change (stop using column) before running DROP COLUMN");
            }
            case "RENAME_COLUMN", "RENAME_TABLE" -> {
                c.add("Use an alias / view as a compatibility shim during the transition period");
                c.add("Update all ORM models, repositories, and raw SQL queries");
                c.add("Deploy application update atomically with the migration");
            }
            case "ADD_COLUMN" -> {
                c.add("Add column as nullable first; backfill; then add NOT NULL constraint");
                c.add("Avoid long-running ALTER TABLE with DEFAULT on large tables");
            }
            case "ADD_FK" -> {
                if (violations > 0)
                    c.add("Delete or fix " + violations + " orphaned row(s) before adding the constraint");
                c.add("Use ADD CONSTRAINT ... NOT VALID; then VALIDATE CONSTRAINT separately on large tables");
            }
            case "DROP_FK" ->
                c.add("Document why the constraint is being removed for future reference");
            case "ADD_INDEX" ->
                c.add("Use CREATE INDEX CONCURRENTLY to avoid locking the table during index creation");
            case "DROP_INDEX" ->
                c.add("Confirm the index is not used by any query plan (check pg_stat_user_indexes)");
        }

        // Condition-based items
        if (rowCount > 10_000)
            c.add("Schedule during low-traffic hours or use pg_repack for zero-downtime changes");
        if (gaps > 0)
            c.add("Create missing FK indexes with CREATE INDEX CONCURRENTLY before the migration");
        if (inCycle)
            c.add("Temporarily disable triggers (SET session_replication_role = replica) if TRUNCATE is needed");
        if (blastRadius > 3)
            c.add("Notify teams owning the " + blastRadius + " dependent tables before migrating");

        return c;
    }
}
