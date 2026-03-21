package com.querymesh.service;

import com.querymesh.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ViolationScannerService {

    private final JdbcTemplate jdbcTemplate;
    private final SchemaIntrospectionService introspectionService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Scan all FK relationships for integrity violations (orphaned rows).
     * Returns results synchronously (for REST endpoint).
     */
    public List<ViolationResult> scanAllViolations() {
        List<SchemaEdge> edges = introspectionService.getAllForeignKeys();
        List<ViolationResult> violations = new ArrayList<>();

        for (SchemaEdge edge : edges) {
            try {
                ViolationResult violation = checkViolation(edge);
                if (violation != null && violation.getOrphanedRows() > 0) {
                    violations.add(violation);
                }
            } catch (Exception e) {
                log.error("Error checking violation for constraint {}: {}",
                        edge.getConstraintName(), e.getMessage());
            }
        }

        return violations;
    }

    /**
     * Async scan that streams progress and violations via WebSocket.
     */
    @Async
    public void scanWithWebSocket() {
        List<SchemaEdge> edges = introspectionService.getAllForeignKeys();
        List<SchemaNode> tables = introspectionService.getAllTables();
        int totalTables = tables.size();
        int violationsFound = 0;
        int tablesScanned = 0;

        log.info("Starting WebSocket scan: {} tables, {} FK relationships", totalTables, edges.size());

        // Emit initial event
        messagingTemplate.convertAndSend("/topic/scan-progress",
                ScanProgressEvent.builder()
                        .currentTable("Initializing scan...")
                        .tablesScanned(0)
                        .totalTables(totalTables)
                        .violationsFound(0)
                        .status("SCANNING")
                        .build());

        // Group edges by source table
        var edgesByTable = edges.stream()
                .collect(java.util.stream.Collectors.groupingBy(SchemaEdge::getFrom));

        // Scan each table
        for (SchemaNode table : tables) {
            tablesScanned++;
            String tableName = table.getTableName();

            // Emit progress
            messagingTemplate.convertAndSend("/topic/scan-progress",
                    ScanProgressEvent.builder()
                            .currentTable(tableName)
                            .tablesScanned(tablesScanned)
                            .totalTables(totalTables)
                            .violationsFound(violationsFound)
                            .status("SCANNING")
                            .build());

            // Check all FK edges originating from this table
            List<SchemaEdge> tableEdges = edgesByTable.getOrDefault(tableName, List.of());
            for (SchemaEdge edge : tableEdges) {
                try {
                    ViolationResult violation = checkViolation(edge);
                    if (violation != null && violation.getOrphanedRows() > 0) {
                        violationsFound++;

                        // Emit violation alert immediately
                        messagingTemplate.convertAndSend("/topic/violations",
                                ViolationAlert.builder()
                                        .table(violation.getTableName())
                                        .column(violation.getColumnName())
                                        .orphanedRows(violation.getOrphanedRows())
                                        .severity(violation.getSeverity())
                                        .suggestedFix(violation.getSuggestedFix())
                                        .referencedTable(violation.getReferencedTable())
                                        .constraintName(violation.getConstraintName())
                                        .build());
                    }
                } catch (Exception e) {
                    log.error("Error scanning {}: {}", tableName, e.getMessage());
                }
            }

            // Small delay to make progress visible on frontend
            try {
                Thread.sleep(300);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }

        // Emit completion
        messagingTemplate.convertAndSend("/topic/scan-progress",
                ScanProgressEvent.builder()
                        .currentTable("Scan complete")
                        .tablesScanned(totalTables)
                        .totalTables(totalTables)
                        .violationsFound(violationsFound)
                        .status("COMPLETE")
                        .build());

        log.info("Scan complete: {} violations found across {} tables", violationsFound, totalTables);
    }

    /**
     * Check a single FK relationship for orphaned rows.
     */
    private ViolationResult checkViolation(SchemaEdge edge) {
        String query = String.format(
                "SELECT COUNT(*) FROM \"%s\" c LEFT JOIN \"%s\" p ON c.\"%s\" = p.\"%s\" WHERE p.\"%s\" IS NULL AND c.\"%s\" IS NOT NULL",
                edge.getFrom(), edge.getTo(),
                edge.getFromColumn(), edge.getToColumn(),
                edge.getToColumn(), edge.getFromColumn()
        );

        Long orphanedCount = jdbcTemplate.queryForObject(query, Long.class);
        long count = orphanedCount != null ? orphanedCount : 0;

        if (count > 0) {
            return ViolationResult.builder()
                    .tableName(edge.getFrom())
                    .columnName(edge.getFromColumn())
                    .referencedTable(edge.getTo())
                    .referencedColumn(edge.getToColumn())
                    .constraintName(edge.getConstraintName())
                    .orphanedRows(count)
                    .severity(determineSeverity(count))
                    .suggestedFix(generateSuggestedFix(edge, count))
                    .build();
        }
        return null;
    }

    private String determineSeverity(long orphanedCount) {
        if (orphanedCount >= 100) return "HIGH";
        if (orphanedCount >= 10) return "MEDIUM";
        return "LOW";
    }

    private String generateSuggestedFix(SchemaEdge edge, long count) {
        return String.format(
                "DELETE orphaned rows: DELETE FROM \"%s\" WHERE \"%s\" NOT IN (SELECT \"%s\" FROM \"%s\"); "
                        + "Or re-insert missing parent rows into \"%s\". Affected: %d rows.",
                edge.getFrom(), edge.getFromColumn(),
                edge.getToColumn(), edge.getTo(),
                edge.getTo(), count
        );
    }
}
