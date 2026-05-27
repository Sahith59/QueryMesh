package com.querymesh.controller;

import com.querymesh.model.*;
import com.querymesh.service.DeletionOrderService;
import com.querymesh.service.DiagnosticService;
import com.querymesh.service.IndexAnalysisService;
import com.querymesh.service.MigrationScorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tools")
@RequiredArgsConstructor
public class ToolsController {

    private final DeletionOrderService deletionOrderService;
    private final IndexAnalysisService indexAnalysisService;
    private final DiagnosticService diagnosticService;
    private final MigrationScorerService migrationScorerService;

    @PostMapping("/deletion-order")
    public ResponseEntity<DeletionOrderResponse> getDeletionOrder(
            @RequestBody DeletionOrderRequest request) {
        return ResponseEntity.ok(deletionOrderService.computeDeletionOrder(request.getTables()));
    }

    @GetMapping("/index-gaps")
    public ResponseEntity<List<IndexGap>> getIndexGaps() {
        return ResponseEntity.ok(indexAnalysisService.findIndexGaps());
    }

    @GetMapping("/circular-deps")
    public ResponseEntity<CircularDepsResult> getCircularDeps() {
        return ResponseEntity.ok(diagnosticService.detectCircularDeps());
    }

    @PostMapping("/migration-score")
    public ResponseEntity<MigrationScoreResponse> getMigrationScore(
            @RequestBody MigrationScoreRequest request) {
        return ResponseEntity.ok(migrationScorerService.score(request));
    }
}
