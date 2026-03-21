package com.querymesh.controller;

import com.querymesh.model.*;
import com.querymesh.service.DiagnosticService;
import com.querymesh.service.SchemaIntrospectionService;
import com.querymesh.service.ViolationScannerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schema")
@RequiredArgsConstructor
public class SchemaController {

    private final SchemaIntrospectionService introspectionService;
    private final ViolationScannerService violationScannerService;
    private final DiagnosticService diagnosticService;

    /**
     * GET /api/schema/graph — returns full node+edge dependency graph
     */
    @GetMapping("/graph")
    public ResponseEntity<SchemaGraph> getGraph() {
        SchemaGraph graph = introspectionService.buildGraph();
        return ResponseEntity.ok(graph);
    }

    /**
     * GET /api/schema/tables — list all tables with metadata
     */
    @GetMapping("/tables")
    public ResponseEntity<List<SchemaNode>> getTables() {
        List<SchemaNode> tables = introspectionService.getAllTables();
        return ResponseEntity.ok(tables);
    }

    /**
     * GET /api/schema/violations — integrity check results
     */
    @GetMapping("/violations")
    public ResponseEntity<List<ViolationResult>> getViolations() {
        List<ViolationResult> violations = violationScannerService.scanAllViolations();
        return ResponseEntity.ok(violations);
    }

    /**
     * POST /api/schema/diagnose — run targeted diagnostic on a table
     */
    @PostMapping("/diagnose")
    public ResponseEntity<DiagnoseResult> diagnose(@RequestBody DiagnoseRequest request) {
        DiagnoseResult result = diagnosticService.diagnose(request.getTableName());
        return ResponseEntity.ok(result);
    }
}
